import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';
import { Vpc as CdkVpc, SubnetType, InterfaceVpcEndpointAwsService, GatewayVpcEndpointAwsService, } from 'aws-cdk-lib/aws-ec2';
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
    #vpc;
    /**
     * The SQS VPC endpoint (if created)
     */
    sqsEndpoint;
    /**
     * The Secrets Manager VPC endpoint (if created)
     */
    secretsManagerEndpoint;
    /**
     * The S3 VPC endpoint (if created)
     */
    s3Endpoint;
    constructor(scope, id, props) {
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
                Tags.of(this.sqsEndpoint).add(key, value);
            });
        }
        if (props.endpoints?.includes('secrets-manager')) {
            this.secretsManagerEndpoint = this.#vpc.addInterfaceEndpoint('secrets-manager-interface', {
                service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            });
            Tags.of(this.secretsManagerEndpoint).add('Name', `${vpcName}-secrets-manager-interface`);
            props.stack.tags.forEach(({ key, value }) => {
                Tags.of(this.secretsManagerEndpoint).add(key, value);
            });
        }
        if (props.endpoints?.includes('s3')) {
            this.s3Endpoint = this.#vpc.addGatewayEndpoint('s3-interface', {
                service: GatewayVpcEndpointAwsService.S3,
            });
            Tags.of(this.s3Endpoint).add('Name', `${vpcName}-s3-gateway`);
            props.stack.tags.forEach(({ key, value }) => {
                Tags.of(this.s3Endpoint).add(key, value);
            });
        }
        // Tag the VPC itself
        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#vpc).add(key, value);
        });
    }
    /**
     * Gets the VPC instance
     */
    get vpc() {
        return this.#vpc;
    }
}
