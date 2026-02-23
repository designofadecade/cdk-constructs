import { Construct } from 'constructs';
import { Duration, Tags, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import {
    DatabaseCluster,
    DatabaseClusterEngine,
    Credentials,
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
     * Optional instance size (default: SMALL)
     */
    readonly instanceSize?: InstanceSize;

    /**
     * Optional number of reader instances (default: none)
     */
    readonly readers?: number;

    /**
     * Optional security groups that should have ingress access to the database
     */
    readonly ingressSecurityGroups?: ReadonlyArray<ISecurityGroup>;
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
 * 
 * @example
 * ```typescript
 * const database = new RdsDatabase(this, 'Database', {
 *   name: 'my-app-db',
 *   vpc: myVpc,
 *   databaseName: 'appdata',
 *   instanceSize: RdsDatabase.InstanceSize.MEDIUM,
 *   readers: 1,
 *   ingressSecurityGroups: [lambdaSecurityGroup],
 *   stack: { id: 'my-app', tags: [] },
 * });
 * 
 * // Grant access to additional security groups
 * database.addSecurityGroupIngressRule(bastionSecurityGroup);
 * ```
 */
export class RdsDatabase extends Construct {
    /**
     * Re-export InstanceSize for convenience
     */
    static readonly InstanceSize = InstanceSize;

    #securityGroup: ISecurityGroup;
    #rds: DatabaseCluster;
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

        this.#rds = new DatabaseCluster(this, 'Database', {
            clusterIdentifier: props.name,
            engine,
            defaultDatabaseName: props.databaseName ?? 'postgres',
            storageEncrypted: true,
            credentials: Credentials.fromGeneratedSecret(props.username ?? `${props.name}_admin`, {
                secretName: props.secretName ?? `${props.name}-rds-credentials`,
            }),
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_ISOLATED,
                onePerAz: true,
            },
            securityGroups: [this.#securityGroup],
            writer: ClusterInstance.provisioned('writer', {
                instanceType: InstanceType.of(
                    InstanceClass.BURSTABLE4_GRAVITON,
                    props.instanceSize ?? InstanceSize.SMALL,
                ),
            }),
            readers: props.readers
                ? Array.from({ length: props.readers }, (_, i) =>
                    ClusterInstance.provisioned(`reader-${i + 1}`, {
                        instanceType: InstanceType.of(
                            InstanceClass.BURSTABLE4_GRAVITON,
                            props.instanceSize ?? InstanceSize.SMALL,
                        ),
                    }),
                )
                : undefined,
            backup: {
                retention: Duration.days(7),
            },
            removalPolicy: RemovalPolicy.RETAIN,
        });

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
