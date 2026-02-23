import { Construct } from 'constructs';
import { Tags, CfnOutput } from 'aws-cdk-lib';
import { Instance, InstanceType, InstanceClass, InstanceSize, MachineImage, SubnetType, UserData, SecurityGroup, AmazonLinuxCpuType, } from 'aws-cdk-lib/aws-ec2';
import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
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
export class BastionHost extends Construct {
    #instance;
    #securityGroup;
    constructor(scope, id, props) {
        super(scope, id);
        this.#securityGroup = new SecurityGroup(this, 'SecurityGroup', {
            vpc: props.vpc,
            securityGroupName: `${props.name}-bastion`,
            description: 'Security group for bastion host',
        });
        const role = new Role(this, 'Role', {
            assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
            ],
        });
        if (props.bucket) {
            props.bucket.grantRead(role);
        }
        const userData = UserData.forLinux();
        userData.addCommands('dnf update -y', 'dnf install -y postgresql15', 'echo "PostgreSQL client installed successfully"');
        this.#instance = new Instance(this, 'Instance', {
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            },
            instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
            machineImage: MachineImage.latestAmazonLinux2023({
                cpuType: AmazonLinuxCpuType.ARM_64,
            }),
            securityGroup: this.#securityGroup,
            role,
            userData,
        });
        Tags.of(this.#instance).add('Name', `${props.name}-bastion`);
        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#instance).add(key, value);
            Tags.of(this.#securityGroup).add(key, value);
        });
        new CfnOutput(this, 'InstanceId', {
            value: this.#instance.instanceId,
            description: 'Bastion Host Instance ID (use with SSM Session Manager)',
            exportName: `${props.name}-bastion-instance-id`,
        });
        new CfnOutput(this, 'ConnectCommand', {
            value: `aws ssm start-session --target ${this.#instance.instanceId} --profile ${props.profile || 'default'}`,
            description: 'Command to connect to bastion host',
        });
    }
    /**
     * Gets the EC2 instance for the bastion host
     */
    get instance() {
        return this.#instance;
    }
    /**
     * Gets the security group attached to the bastion host
     */
    get securityGroup() {
        return this.#securityGroup;
    }
}
