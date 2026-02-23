import { Construct } from 'constructs';
import { Tags, CfnOutput, RemovalPolicy, Size } from 'aws-cdk-lib';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { SecurityGroup, Instance, InstanceType, Volume, Peer, Port, MachineImage, SubnetType, KeyPair, CfnEIP, CfnEIPAssociation, } from 'aws-cdk-lib/aws-ec2';
import { ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
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
export class Server extends Construct {
    /**
     * The security group for the server
     */
    securityGroup;
    /**
     * The IAM role for the server
     */
    iamRole;
    /**
     * The EC2 instance
     */
    ec2;
    constructor(scope, id, props) {
        super(scope, id);
        const keyPair = new KeyPair(this, 'KeyPair', {
            keyPairName: `${props.project.id.replace(/-/g, '')}-${props.tag}-server`,
        });
        this.securityGroup = new SecurityGroup(this, 'SecurityGroup', {
            vpc: props.vpc,
            securityGroupName: `${props.project.id}-server-${props.tag}`,
        });
        Tags.of(this.securityGroup).add('Name', `${props.project.label} / server / ${props.tag}`);
        this.securityGroup.addIngressRule(Peer.ipv4('35.183.92.176/29'), Port.tcp(22));
        if (props.publicAccess) {
            this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));
            this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443));
            this.securityGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(80));
            this.securityGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(443));
        }
        if (props.project.privateAccess) {
            props.project.privateAccess.forEach((ip) => {
                if (!props.publicAccess) {
                    this.securityGroup.addIngressRule(Peer.ipv4(`${ip}/32`), Port.tcp(80));
                    this.securityGroup.addIngressRule(Peer.ipv4(`${ip}/32`), Port.tcp(443));
                }
                this.securityGroup.addIngressRule(Peer.ipv4(`${ip}/32`), Port.tcp(22));
            });
        }
        this.iamRole = new Role(this, 'Role', {
            roleName: `${props.project.id}-server-${props.tag}`,
            assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
        });
        const eip = new CfnEIP(this, `${props.project.id}-server-${props.tag}`);
        Tags.of(eip).add('Name', `${props.project.label} / server / ${props.tag}`);
        this.ec2 = new Instance(this, 'DesignEdit', {
            instanceName: `${props.project.label} / ${props.tag}`,
            machineImage: MachineImage.genericLinux({
                'ca-central-1': 'ami-0c56a75f8e0cb7e65',
            }),
            instanceType: new InstanceType(props.instanceType ?? 't4g.small'),
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
            },
            securityGroup: this.securityGroup,
            keyPair,
            role: this.iamRole,
        });
        this.ec2.addUserData([
            'sudo yum update -y\n',
            'sudo yum install -y docker\n',
            'sudo service docker start\n',
            'sudo systemctl enable docker\n',
            'sudo usermod -a -G docker ec2-user\n',
            'sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose\n',
            'sudo chmod +x /usr/local/bin/docker-compose\n',
        ].join(''));
        new CfnEIPAssociation(this, 'Ec2Association', {
            allocationId: eip.attrAllocationId,
            instanceId: this.ec2.instanceId,
        });
        if (props.domains) {
            props.domains.forEach((domain) => {
                const recordTarget = RecordTarget.fromIpAddresses(eip.ref);
                if (domain.recordName) {
                    new ARecord(this, `AliasRecord${domain.hostedZone.zoneName}-${domain.recordName}`, {
                        zone: domain.hostedZone,
                        recordName: domain.recordName,
                        target: recordTarget,
                    });
                }
                if (domain.recordNames) {
                    domain.recordNames.forEach((recordName) => {
                        new ARecord(this, `AliasRecord${domain.hostedZone.zoneName}-${recordName}`, {
                            zone: domain.hostedZone,
                            recordName,
                            target: recordTarget,
                        });
                    });
                }
                if (domain.grandDomainSetRecord) {
                    this.iamRole.addToPolicy(new PolicyStatement({
                        actions: ['route53:ListHostedZones', 'route53:GetChange'],
                        resources: ['*'],
                    }));
                    this.iamRole.addToPolicy(new PolicyStatement({
                        actions: ['route53:ChangeResourceRecordSets'],
                        resources: [domain.hostedZone.hostedZoneArn],
                    }));
                }
            });
        }
        if (props.volumes && props.volumes.length > 0) {
            props.volumes.forEach((options) => {
                const volume = new Volume(this, 'Volume', {
                    volumeName: `${props.project.label} / ${props.tag} / ${options.label ?? 'additional'}`,
                    availabilityZone: this.ec2.instanceAvailabilityZone,
                    size: Size.gibibytes(options.size ?? 100),
                    encrypted: false,
                    removalPolicy: RemovalPolicy.RETAIN,
                });
                Tags.of(volume).add('project', props.project.tag);
                Tags.of(volume).add('Clients', props.project.tagClients);
            });
        }
        Tags.of(this.securityGroup).add('project', props.project.tag);
        Tags.of(this.ec2).add('project', props.project.tag);
        Tags.of(this.iamRole).add('project', props.project.tag);
        Tags.of(eip).add('project', props.project.tag);
        Tags.of(this.securityGroup).add('Clients', props.project.tagClients);
        Tags.of(this.ec2).add('Clients', props.project.tagClients);
        Tags.of(this.iamRole).add('Clients', props.project.tagClients);
        Tags.of(eip).add('Clients', props.project.tagClients);
        new CfnOutput(this, 'KeyPairId', {
            value: keyPair.keyPairId,
            description: `${props.tag} / Server Key Pair ID`,
            exportName: `server-${props.tag}-keypair-id`,
        });
        new CfnOutput(this, 'InstanceId', {
            value: this.ec2.instanceId,
            description: `${props.tag} / Server Instance ID`,
            exportName: `server-${props.tag}-id`,
        });
        new CfnOutput(this, 'InstanceIp', {
            value: this.ec2.instancePublicIp,
            description: `${props.tag} / Server Public IP`,
            exportName: `server-${props.tag}-ip`,
        });
    }
}
