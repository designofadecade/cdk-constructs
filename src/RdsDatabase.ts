import { Construct } from 'constructs';
import { Duration, Tags, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import {
    DatabaseCluster,
    DatabaseClusterFromSnapshot,
    DatabaseClusterEngine,
    Credentials,
    SnapshotCredentials,
    AuroraPostgresEngineVersion,
    ClusterInstance,
    type IClusterEngine,
    type IDatabaseCluster,
    type Endpoint,
} from 'aws-cdk-lib/aws-rds';
import {
    InstanceType,
    SubnetType,
    InstanceClass,
    InstanceSize,
    SecurityGroup,
    Port,
    type IVpc,
    type ISecurityGroup,
} from 'aws-cdk-lib/aws-ec2';
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager';

/**
 * Properties for configuring an RDS database cluster
 */
export interface RdsDatabaseProps {
    /**
     * The name for the database cluster
     */
    readonly name: string;

    /**
     * The VPC where the database will be deployed
     */
    readonly vpc: IVpc;

    /**
     * The stack reference containing ID and tags
     */
    readonly stack: {
        readonly id: string;
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    };

    /**
     * Optional database engine (default: Aurora PostgreSQL 17.6)
     */
    readonly engine?: IClusterEngine;

    /**
     * Optional default database name (default: 'postgres')
     */
    readonly databaseName?: string;

    /**
     * Optional master username (default: '{name}_admin')
     */
    readonly username?: string;

    /**
     * Optional secret name for storing credentials (default: '{name}-rds-credentials')
     */
    readonly secretName?: string;

    /**
     * Optional instance class (default: BURSTABLE4_GRAVITON)
     */
    readonly instanceClass?: InstanceClass;

    /**
     * Optional instance size (default: SMALL)
     */
    readonly instanceSize?: InstanceSize;

    /**
     * Optional serverless v2 minimum capacity in ACUs (Aurora Capacity Units)
     * If specified, creates serverless instances instead of provisioned
     */
    readonly serverlessV2MinCapacity?: number;

    /**
     * Optional serverless v2 maximum capacity in ACUs (Aurora Capacity Units)
     * If specified, creates serverless instances instead of provisioned
     */
    readonly serverlessV2MaxCapacity?: number;

    /**
     * Optional number of reader instances (default: none)
     */
    readonly readers?: number;

    /**
     * Optional security groups that should have ingress access to the database
     */
    readonly ingressSecurityGroups?: ReadonlyArray<ISecurityGroup>;

    /**
     * Optional backup retention period in days (default: 7)
     * Minimum: 1 day, Maximum: 35 days
     */
    readonly backupRetentionDays?: number;

    /**
     * Optional cluster snapshot identifier to restore from
     */
    readonly snapshotIdentifier?: string;
}

/**
 * A CDK construct that creates an Aurora RDS database cluster
 * 
 * Features:
 * - Aurora PostgreSQL or MySQL support
 * - Deployed in private isolated subnets
 * - Automatic credential generation in Secrets Manager
 * - Storage encryption enabled
 * - 7-day backup retention
 * - Deletion protection enabled
 * - Support for read replicas
 * - Support for both provisioned and serverless v2 instances
 * 
 * @example
 * Provisioned instance:
 * ```typescript
 * const database = new RdsDatabase(this, 'Database', {
 *   name: 'my-app-db',
 *   vpc: myVpc,
 *   databaseName: 'appdata',
 *   instanceClass: RdsDatabase.InstanceClass.BURSTABLE4_GRAVITON,
 *   instanceSize: RdsDatabase.InstanceSize.MEDIUM,
 *   readers: 1,
 *   ingressSecurityGroups: [lambdaSecurityGroup],
 *   stack: { id: 'my-app', tags: [] },
 * });
 * ```
 * 
 * Serverless v2 instance:
 * ```typescript
 * const database = new RdsDatabase(this, 'Database', {
 *   name: 'my-app-db',
 *   vpc: myVpc,
 *   databaseName: 'appdata',
 *   serverlessV2MinCapacity: 0.5,
 *   serverlessV2MaxCapacity: 4,
 *   readers: 1,
 *   ingressSecurityGroups: [lambdaSecurityGroup],
 *   stack: { id: 'my-app', tags: [] },
 * });
 * ```
 * 
 * @example
 * // Grant access to additional security groups
 * database.addSecurityGroupIngressRule(bastionSecurityGroup);
 */
export class RdsDatabase extends Construct {
    /**
     * Re-export InstanceSize for convenience
     */
    static readonly InstanceSize = InstanceSize;

    /**
     * Re-export InstanceClass for convenience
     */
    static readonly InstanceClass = InstanceClass;

    #securityGroup: ISecurityGroup;
    #rds: DatabaseCluster | DatabaseClusterFromSnapshot;
    #port: number;

    constructor(scope: Construct, id: string, props: RdsDatabaseProps) {
        super(scope, id);

        const engine = props.engine ?? DatabaseClusterEngine.auroraPostgres({
            version: AuroraPostgresEngineVersion.VER_17_6,
        });

        const engineFamily = engine.engineFamily ?? '';
        this.#port = engineFamily.toLowerCase().includes('postgres') ? 5432 : 3306;

        this.#securityGroup = new SecurityGroup(this, 'SecurityGroup', {
            vpc: props.vpc,
            securityGroupName: `${props.name}-rds-databadse`,
        });
        Tags.of(this.#securityGroup).add('Name', `${props.name ?? props.stack.id}-rds-databadse`);

        if (props.ingressSecurityGroups) {
            props.ingressSecurityGroups.forEach((ingressSecurityGroup) => {
                this.#securityGroup.addIngressRule(ingressSecurityGroup, Port.tcp(this.#port));
            });
        }

        const isServerless = props.serverlessV2MinCapacity !== undefined || props.serverlessV2MaxCapacity !== undefined;

        let writer;
        let readers;

        if (isServerless) {
            writer = ClusterInstance.serverlessV2('writer');
            readers = props.readers
                ? Array.from({ length: props.readers }, (_, i) =>
                    ClusterInstance.serverlessV2(`reader-${i + 1}`),
                )
                : undefined;
        } else {
            const instanceType = InstanceType.of(
                props.instanceClass ?? InstanceClass.BURSTABLE4_GRAVITON,
                props.instanceSize ?? InstanceSize.SMALL,
            );
            writer = ClusterInstance.provisioned('writer', { instanceType });
            readers = props.readers
                ? Array.from({ length: props.readers }, (_, i) =>
                    ClusterInstance.provisioned(`reader-${i + 1}`, { instanceType }),
                )
                : undefined;
        }

        const baseClusterProps = {
            clusterIdentifier: props.name,
            engine,
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_ISOLATED,
                onePerAz: true,
            },
            securityGroups: [this.#securityGroup],
            writer,
            readers,
            ...(isServerless && {
                serverlessV2MinCapacity: props.serverlessV2MinCapacity,
                serverlessV2MaxCapacity: props.serverlessV2MaxCapacity,
            }),
            backup: {
                retention: Duration.days(props.backupRetentionDays ?? 7),
            },
            removalPolicy: RemovalPolicy.RETAIN,
        };

        if (props.snapshotIdentifier) {
            this.#rds = new DatabaseClusterFromSnapshot(this, 'Database', {
                ...baseClusterProps,
                snapshotIdentifier: props.snapshotIdentifier,
                snapshotCredentials: props.username
                    ? SnapshotCredentials.fromGeneratedSecret(props.username)
                    : undefined,
            });
        } else {
            this.#rds = new DatabaseCluster(this, 'Database', {
                ...baseClusterProps,
                defaultDatabaseName: props.databaseName ?? 'postgres',
                storageEncrypted: true,
                credentials: Credentials.fromGeneratedSecret(props.username ?? `${props.name}_admin`, {
                    secretName: props.secretName ?? `${props.name}-rds-credentials`,
                }),
            });
        }

        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#securityGroup).add(key, value);
            Tags.of(this.#rds).add(key, value);
        });

        new CfnOutput(this, 'RdsSecrentArn', {
            value: this.#rds.secret?.secretArn ?? '',
            description: ' RDS Database Secret ARN (Login information)',
            exportName: `${props.name}-secret-arn`,
        });

        new CfnOutput(this, 'RdsWriterEndpoint', {
            value: this.#rds.clusterEndpoint.hostname,
            description: 'RDS Writer Endpoint',
            exportName: `${props.name}-writer-endpoint`,
        });
    }

    /**
     * Gets the Secrets Manager secret containing database credentials
     */
    get secret(): ISecret | undefined {
        return this.#rds.secret;
    }

    /**
     * Gets the RDS database cluster
     */
    get cluster(): IDatabaseCluster {
        return this.#rds;
    }

    /**
     * Gets the ARN of the secret containing database credentials
     */
    get secretArn(): string {
        return this.#rds.secret?.secretArn ?? '';
    }

    /**
     * Gets the cluster endpoint for database connections
     */
    get clusterEndpoint(): Endpoint {
        return this.#rds.clusterEndpoint;
    }

    /**
     * Gets the security group attached to the database
     */
    get securityGroup(): ISecurityGroup {
        return this.#securityGroup;
    }

    /**
     * Adds an ingress rule to allow a security group to access the database
     * 
     * @param securityGroup - The security group to grant access to
     */
    addSecurityGroupIngressRule(securityGroup: ISecurityGroup): void {
        this.#securityGroup.addIngressRule(securityGroup, Port.tcp(this.#port));
    }

    /**
     * Helper method to create an Aurora PostgreSQL engine configuration
     * 
     * @param version - PostgreSQL version (default: 17.6)
     * @returns Configured Aurora PostgreSQL engine
     */
    static AuroraPostgresEngine(version: AuroraPostgresEngineVersion = AuroraPostgresEngineVersion.VER_17_6): IClusterEngine {
        return DatabaseClusterEngine.auroraPostgres({
            version,
        });
    }
}
