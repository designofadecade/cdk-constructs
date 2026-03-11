import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';
import {
    Vpc as CdkVpc,
    SubnetType,
    type IVpc,
    InterfaceVpcEndpointAwsService,
    GatewayVpcEndpointAwsService,
    type IInterfaceVpcEndpoint,
    type IGatewayVpcEndpoint,
    NetworkAcl,
    AclTraffic,
    AclCidr,
    Action,
    TrafficDirection,
    SubnetSelection,
} from 'aws-cdk-lib/aws-ec2';

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
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
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

    /**
     * Enable restrictive Network ACLs for private subnets (default: false)
     * 
     * When enabled, private subnets will only allow traffic from within the VPC CIDR range,
     * providing an additional security layer beyond security groups.
     * 
     * **IMPORTANT**: Set to `true` for NEW VPCs to enable enhanced security.
     * Default is `false` to maintain backward compatibility with existing deployments.
     */
    readonly restrictPrivateSubnetNacls?: boolean;

    /**
     * Enable restrictive Network ACLs for public subnets (default: false)
     * 
     * When enabled, public subnets will only allow traffic from within the VPC CIDR range,
     * effectively blocking all internet traffic (0.0.0.0/0).
     * 
     * **Use case**: When all services are behind API Gateway and you don't need internet-facing resources.
     * 
     * **IMPORTANT**: Only enable this if you do NOT need:
     * - NAT Gateways (use VPC endpoints instead)
     * - Application Load Balancers in public subnets
     * - Any public-facing EC2 instances
     */
    readonly restrictPublicSubnetNacls?: boolean;

    /**
     * Specific TCP ports to allow in Network ACLs for inbound traffic (optional)
     * 
     * If not specified, all traffic (all ports) from VPC CIDR is allowed.
     * Use this to further restrict traffic to specific ports.
     * 
     * @example
     * allowedPorts: [80, 443] // Only allow HTTP and HTTPS
     * allowedPorts: [22, 3389] // Only allow SSH and RDP
     * allowedPorts: [5432] // Only allow PostgreSQL
     */
    readonly allowedPorts?: ReadonlyArray<number>;
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
export class Vpc extends Construct {
    #vpc: IVpc;

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

    constructor(scope: Construct, id: string, props: VpcProps) {
        super(scope, id);

        const vpcName = props.name ?? props.stack.id;

        this.#vpc = new CdkVpc(this, 'Vpc', {
            vpcName,
            maxAzs: props.maxAzs ?? 2,
            natGateways: props.natGateways ?? 0,
            subnetConfiguration: [
                {
                    name: `${vpcName}-public`,
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    name: `${vpcName}-private-egress`,
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
                {
                    name: `${vpcName}-private-isolated`,
                    subnetType: SubnetType.PRIVATE_ISOLATED,
                },
            ],
        });

        // Create VPC endpoints if requested
        if (props.endpoints?.includes('sqs')) {
            this.sqsEndpoint = this.#vpc.addInterfaceEndpoint('sqs-interface', {
                service: InterfaceVpcEndpointAwsService.SQS,
            });
            Tags.of(this.sqsEndpoint).add('Name', `${vpcName}-sqs-interface`);
            props.stack.tags.forEach(({ key, value }) => {
                Tags.of(this.sqsEndpoint!).add(key, value);
            });
        }

        if (props.endpoints?.includes('secrets-manager')) {
            this.secretsManagerEndpoint = this.#vpc.addInterfaceEndpoint('secrets-manager-interface', {
                service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            });
            Tags.of(this.secretsManagerEndpoint).add('Name', `${vpcName}-secrets-manager-interface`);
            props.stack.tags.forEach(({ key, value }) => {
                Tags.of(this.secretsManagerEndpoint!).add(key, value);
            });
        }

        if (props.endpoints?.includes('s3')) {
            this.s3Endpoint = this.#vpc.addGatewayEndpoint('s3-interface', {
                service: GatewayVpcEndpointAwsService.S3,
            });
            Tags.of(this.s3Endpoint).add('Name', `${vpcName}-s3-gateway`);
            props.stack.tags.forEach(({ key, value }) => {
                Tags.of(this.s3Endpoint!).add(key, value);
            });
        }

        // Configure restrictive Network ACLs for private subnets
        if (props.restrictPrivateSubnetNacls === true) {
            this.#configurePrivateSubnetNacls(vpcName, props.allowedPorts);
        }

        // Configure restrictive Network ACLs for public subnets
        if (props.restrictPublicSubnetNacls === true) {
            this.#configurePublicSubnetNacls(vpcName);
        }

        // Tag the VPC itself
        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#vpc).add(key, value);
        });
    }

    /**
     * Configures restrictive Network ACLs for private subnets
     * Private subnets should only accept traffic from within the VPC CIDR
     */
    #configurePrivateSubnetNacls(vpcName: string, allowedPorts?: ReadonlyArray<number>): void {
        const vpcCidr = this.#vpc.vpcCidrBlock;

        // Create NACL for private subnets with egress
        const privateEgressNacl = new NetworkAcl(this, 'PrivateEgressNacl', {
            vpc: this.#vpc,
            networkAclName: `${vpcName}-private-egress-nacl`,
        });

        // Inbound: Allow traffic from VPC CIDR (all ports or specific ports)
        if (allowedPorts && allowedPorts.length > 0) {
            // Add specific port rules
            allowedPorts.forEach((port, index) => {
                privateEgressNacl.addEntry(`AllowInboundPort${port}`, {
                    cidr: AclCidr.ipv4(vpcCidr),
                    ruleNumber: 100 + index,
                    traffic: AclTraffic.tcpPort(port),
                    direction: TrafficDirection.INGRESS,
                    ruleAction: Action.ALLOW,
                });
            });
            // Allow ephemeral ports for return traffic (required for stateless NACLs)
            privateEgressNacl.addEntry('AllowEphemeralPorts', {
                cidr: AclCidr.ipv4(vpcCidr),
                ruleNumber: 200,
                traffic: AclTraffic.tcpPortRange(1024, 65535),
                direction: TrafficDirection.INGRESS,
                ruleAction: Action.ALLOW,
            });
        } else {
            // Allow all traffic from VPC CIDR
            privateEgressNacl.addEntry('AllowInboundFromVpc', {
                cidr: AclCidr.ipv4(vpcCidr),
                ruleNumber: 100,
                traffic: AclTraffic.allTraffic(),
                direction: TrafficDirection.INGRESS,
                ruleAction: Action.ALLOW,
            });
        }

        // Outbound: Allow all traffic (for VPC endpoints, NAT gateway, etc.)
        privateEgressNacl.addEntry('AllowAllOutbound', {
            cidr: AclCidr.anyIpv4(),
            ruleNumber: 100,
            traffic: AclTraffic.allTraffic(),
            direction: TrafficDirection.EGRESS,
            ruleAction: Action.ALLOW,
        });

        // Associate with all private egress subnets using subnet selection
        this.#vpc.privateSubnets.forEach((subnet, index) => {
            privateEgressNacl.associateWithSubnet(`PrivateEgressAssoc${index}`, {
                subnets: [subnet],
            });
        });

        // Create NACL for isolated private subnets
        const privateIsolatedNacl = new NetworkAcl(this, 'PrivateIsolatedNacl', {
            vpc: this.#vpc,
            networkAclName: `${vpcName}-private-isolated-nacl`,
        });

        // Inbound: Allow traffic from VPC CIDR (all ports or specific ports)
        if (allowedPorts && allowedPorts.length > 0) {
            // Add specific port rules
            allowedPorts.forEach((port, index) => {
                privateIsolatedNacl.addEntry(`AllowInboundPort${port}`, {
                    cidr: AclCidr.ipv4(vpcCidr),
                    ruleNumber: 100 + index,
                    traffic: AclTraffic.tcpPort(port),
                    direction: TrafficDirection.INGRESS,
                    ruleAction: Action.ALLOW,
                });
            });
            // Allow ephemeral ports for return traffic
            privateIsolatedNacl.addEntry('AllowEphemeralPorts', {
                cidr: AclCidr.ipv4(vpcCidr),
                ruleNumber: 200,
                traffic: AclTraffic.tcpPortRange(1024, 65535),
                direction: TrafficDirection.INGRESS,
                ruleAction: Action.ALLOW,
            });
        } else {
            // Allow all traffic from VPC CIDR
            privateIsolatedNacl.addEntry('AllowInboundFromVpc', {
                cidr: AclCidr.ipv4(vpcCidr),
                ruleNumber: 100,
                traffic: AclTraffic.allTraffic(),
                direction: TrafficDirection.INGRESS,
                ruleAction: Action.ALLOW,
            });
        }

        // Outbound: Allow traffic only to VPC CIDR (fully isolated)
        privateIsolatedNacl.addEntry('AllowOutboundToVpc', {
            cidr: AclCidr.ipv4(vpcCidr),
            ruleNumber: 100,
            traffic: AclTraffic.allTraffic(),
            direction: TrafficDirection.EGRESS,
            ruleAction: Action.ALLOW,
        });

        // Associate with all isolated subnets
        this.#vpc.isolatedSubnets.forEach((subnet, index) => {
            privateIsolatedNacl.associateWithSubnet(`PrivateIsolatedAssoc${index}`, {
                subnets: [subnet],
            });
        });
    }

    /**
     * Configures restrictive Network ACLs for public subnets
     * Blocks all internet traffic to prevent public access when not needed
     */
    #configurePublicSubnetNacls(vpcName: string): void {
        const vpcCidr = this.#vpc.vpcCidrBlock;

        // Create NACL for public subnets
        const publicNacl = new NetworkAcl(this, 'PublicNacl', {
            vpc: this.#vpc,
            networkAclName: `${vpcName}-public-nacl`,
        });

        // Inbound: Only allow traffic from VPC CIDR (block internet)
        publicNacl.addEntry('AllowInboundFromVpc', {
            cidr: AclCidr.ipv4(vpcCidr),
            ruleNumber: 100,
            traffic: AclTraffic.allTraffic(),
            direction: TrafficDirection.INGRESS,
            ruleAction: Action.ALLOW,
        });

        // Outbound: Only allow traffic to VPC CIDR (block internet)
        publicNacl.addEntry('AllowOutboundToVpc', {
            cidr: AclCidr.ipv4(vpcCidr),
            ruleNumber: 100,
            traffic: AclTraffic.allTraffic(),
            direction: TrafficDirection.EGRESS,
            ruleAction: Action.ALLOW,
        });

        // Associate with all public subnets
        this.#vpc.publicSubnets.forEach((subnet, index) => {
            publicNacl.associateWithSubnet(`PublicAssoc${index}`, {
                subnets: [subnet],
            });
        });
    }

    /**
     * Gets the VPC instance
     */
    get vpc(): IVpc {
        return this.#vpc;
    }
}
