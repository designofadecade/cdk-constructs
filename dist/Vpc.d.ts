import { Construct } from 'constructs';
import { type IVpc, type IInterfaceVpcEndpoint, type IGatewayVpcEndpoint } from 'aws-cdk-lib/aws-ec2';
/**
 * VPC endpoint types that can be created
 */
export type VpcEndpointType = 'sqs' | 'secrets-manager' | 's3';
/**
 * Properties for configuring a VPC
 */
export interface VpcProps {
    /**
     * Optional name for the VPC. If not provided, uses the stack ID
     */
    readonly name?: string;
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
     * Maximum number of Availability Zones to use (default: 2)
     */
    readonly maxAzs?: number;
    /**
     * Number of NAT Gateways to create (default: 0)
     *
     * Note: NAT Gateways incur costs. Use 0 for cost optimization if private
     * subnets don't need internet access.
     */
    readonly natGateways?: number;
    /**
     * Optional list of VPC endpoints to create
     *
     * Available endpoints:
     * - 'sqs': Interface endpoint for Amazon SQS
     * - 'secrets-manager': Interface endpoint for AWS Secrets Manager
     * - 's3': Gateway endpoint for Amazon S3
     */
    readonly endpoints?: ReadonlyArray<VpcEndpointType>;
}
/**
 * A CDK construct that creates a VPC with standard subnet configuration
 *
 * Features:
 * - Three subnet types: public, private with egress, and private isolated
 * - Configurable number of AZs and NAT Gateways
 * - Optional VPC endpoints for AWS services
 * - Automatic tagging of all resources
 *
 * @example
 * ```typescript
 * const vpc = new Vpc(this, 'AppVpc', {
 *   name: 'my-app',
 *   maxAzs: 2,
 *   natGateways: 1,
 *   endpoints: ['sqs', 'secrets-manager', 's3'],
 *   stack: { id: 'my-app', tags: [] },
 * });
 *
 * // Use the VPC
 * const lambda = new Lambda(this, 'Function', {
 *   vpc: vpc.vpc,
 *   // ...
 * });
 * ```
 */
export declare class Vpc extends Construct {
    #private;
    /**
     * The SQS VPC endpoint (if created)
     */
    sqsEndpoint?: IInterfaceVpcEndpoint;
    /**
     * The Secrets Manager VPC endpoint (if created)
     */
    secretsManagerEndpoint?: IInterfaceVpcEndpoint;
    /**
     * The S3 VPC endpoint (if created)
     */
    s3Endpoint?: IGatewayVpcEndpoint;
    constructor(scope: Construct, id: string, props: VpcProps);
    /**
     * Gets the VPC instance
     */
    get vpc(): IVpc;
}
