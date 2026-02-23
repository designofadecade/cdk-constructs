import { Construct } from 'constructs';
import { Instance, type IVpc, type ISecurityGroup } from 'aws-cdk-lib/aws-ec2';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
/**
 * Properties for configuring a BastionHost instance
 */
export interface BastionHostProps {
    /**
     * The VPC where the bastion host will be deployed
     */
    readonly vpc: IVpc;
    /**
     * The name prefix for the bastion host resources
     */
    readonly name: string;
    /**
     * The stack reference containing tags and metadata
     */
    readonly stack: {
        readonly tags: ReadonlyArray<{
            readonly key: string;
            readonly value: string;
        }>;
    };
    /**
     * Optional S3 bucket to grant read access to the bastion host
     */
    readonly bucket?: IBucket;
    /**
     * Optional AWS CLI profile name for the connect command
     */
    readonly profile?: string;
}
/**
 * A CDK construct that creates a secure bastion host for accessing private resources
 *
 * Features:
 * - Deployed in private subnet with egress
 * - Uses AWS Systems Manager Session Manager for secure access
 * - Runs on ARM64 Amazon Linux 2023
 * - Includes PostgreSQL 15 client pre-installed
 * - No SSH keys required
 *
 * @example
 * ```typescript
 * const bastion = new BastionHost(this, 'Bastion', {
 *   vpc: myVpc,
 *   name: 'my-app',
 *   stack: { tags: [{ key: 'Environment', value: 'production' }] },
 *   bucket: myBucket,
 *   profile: 'production',
 * });
 * ```
 */
export declare class BastionHost extends Construct {
    #private;
    constructor(scope: Construct, id: string, props: BastionHostProps);
    /**
     * Gets the EC2 instance for the bastion host
     */
    get instance(): Instance;
    /**
     * Gets the security group attached to the bastion host
     */
    get securityGroup(): ISecurityGroup;
}
