import { Construct } from 'constructs';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Instance, type IVpc, type ISecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { type IHostedZone } from 'aws-cdk-lib/aws-route53';
/**
 * Volume configuration
 */
export interface VolumeConfig {
    /**
     * Optional label for the volume
     */
    readonly label?: string;
    /**
     * Size in GiB (default: 100)
     */
    readonly size?: number;
}
/**
 * Domain configuration for DNS records
 */
export interface DomainConfig {
    /**
     * The hosted zone
     */
    readonly hostedZone: IHostedZone;
    /**
     * Optional single record name
     */
    readonly recordName?: string;
    /**
     * Optional multiple record names
     */
    readonly recordNames?: ReadonlyArray<string>;
    /**
     * Whether to grant Route53 permissions for Let's Encrypt
     */
    readonly grandDomainSetRecord?: boolean;
}
/**
 * Project configuration
 */
export interface ProjectConfig {
    /**
     * Project ID
     */
    readonly id: string;
    /**
     * Project label/name
     */
    readonly label: string;
    /**
     * Project tag
     */
    readonly tag: string;
    /**
     * Clients tag
     */
    readonly tagClients: string;
    /**
     * Optional private access IP addresses
     */
    readonly privateAccess?: ReadonlyArray<string>;
}
/**
 * Properties for configuring an EC2 server
 */
export interface ServerProps {
    /**
     * The VPC to deploy in
     */
    readonly vpc: IVpc;
    /**
     * Project configuration
     */
    readonly project: ProjectConfig;
    /**
     * Environment tag (e.g., 'production', 'staging')
     */
    readonly tag: string;
    /**
     * Whether to allow public HTTP/HTTPS access
     */
    readonly publicAccess?: boolean;
    /**
     * Optional instance type (default: 't4g.small')
     */
    readonly instanceType?: string;
    /**
     * Optional domain configurations for DNS
     */
    readonly domains?: ReadonlyArray<DomainConfig>;
    /**
     * Optional additional volumes
     */
    readonly volumes?: ReadonlyArray<VolumeConfig>;
}
/**
 * A CDK construct for creating EC2 instances with Docker support
 *
 * Features:
 * - Amazon Linux 2 with Docker pre-installed
 * - EC2 Instance Connect support
 * - Elastic IP assignment
 * - Optional Route53 DNS integration
 * - Additional EBS volumes
 * - Public and private access controls
 *
 * @example
 * ```typescript
 * const server = new Server(this, 'AppServer', {
 *   vpc: myVpc,
 *   project: {
 *     id: 'my-app',
 *     label: 'My Application',
 *     tag: 'my-app',
 *     tagClients: 'ClientA,ClientB',
 *     privateAccess: ['1.2.3.4'],
 *   },
 *   tag: 'production',
 *   publicAccess: true,
 *   instanceType: 't4g.medium',
 *   domains: [{
 *     hostedZone: myZone,
 *     recordName: 'app',
 *   }],
 * });
 * ```
 */
export declare class Server extends Construct {
    /**
     * The security group for the server
     */
    securityGroup: ISecurityGroup;
    /**
     * The IAM role for the server
     */
    iamRole: Role;
    /**
     * The EC2 instance
     */
    ec2: Instance;
    constructor(scope: Construct, id: string, props: ServerProps);
}
