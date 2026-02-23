import { Construct } from 'constructs';
import { AuroraPostgresEngineVersion, type IClusterEngine, type Endpoint } from 'aws-cdk-lib/aws-rds';
import { InstanceSize, type IVpc, type ISecurityGroup } from 'aws-cdk-lib/aws-ec2';
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
        readonly tags: ReadonlyArray<{
            readonly key: string;
            readonly value: string;
        }>;
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
export declare class RdsDatabase extends Construct {
    #private;
    /**
     * Re-export InstanceSize for convenience
     */
    static readonly InstanceSize: typeof InstanceSize;
    constructor(scope: Construct, id: string, props: RdsDatabaseProps);
    /**
     * Gets the Secrets Manager secret containing database credentials
     */
    get secret(): ISecret | undefined;
    /**
     * Gets the ARN of the secret containing database credentials
     */
    get secretArn(): string;
    /**
     * Gets the cluster endpoint for database connections
     */
    get clusterEndpoint(): Endpoint;
    /**
     * Gets the security group attached to the database
     */
    get securityGroup(): ISecurityGroup;
    /**
     * Adds an ingress rule to allow a security group to access the database
     *
     * @param securityGroup - The security group to grant access to
     */
    addSecurityGroupIngressRule(securityGroup: ISecurityGroup): void;
    /**
     * Helper method to create an Aurora PostgreSQL engine configuration
     *
     * @param version - PostgreSQL version (default: 17.6)
     * @returns Configured Aurora PostgreSQL engine
     */
    static AuroraPostgresEngine(version?: AuroraPostgresEngineVersion): IClusterEngine;
}
