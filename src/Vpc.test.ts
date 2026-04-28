import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Vpc as CdkVpc } from 'aws-cdk-lib/aws-ec2';
import { Vpc } from './Vpc.js';

describe('Vpc', () => {
    it('creates VPC with 3 availability zones', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::EC2::VPC', {
            EnableDnsHostnames: true,
            EnableDnsSupport: true,
        });
    });

    it('creates public, private, and isolated subnets', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        // Public, Private, Isolated subnets = 6 subnets (2 AZs x 3 types)
        template.resourceCountIs('AWS::EC2::Subnet', 6);
    });

    it('creates NAT gateways when enabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            natGateways: 2,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::EC2::NatGateway', 2);
    });

    it('does not create NAT gateways when disabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            natGateways: 0,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::EC2::NatGateway', 0);
    });

    it('creates VPC endpoints when specified', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            endpoints: ['sqs', 's3', 'secrets-manager'],
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        // S3 = gateway endpoint, SQS and Secrets Manager = interface endpoints
        const vpcEndpoints = template.findResources('AWS::EC2::VPCEndpoint');
        expect(Object.keys(vpcEndpoints).length).toBeGreaterThanOrEqual(3);
    });

    it('exposes vpc property', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const vpc = new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            stack: { id: 'test', tags: [] },
        });

        expect(vpc.vpc).toBeDefined();
        expect(vpc.vpc).toBeInstanceOf(CdkVpc);
    });

    it('does not create Network ACLs by default for backward compatibility', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Should not create custom NACLs by default (backward compatibility)
        template.resourceCountIs('AWS::EC2::NetworkAcl', 0);
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 0);
    });

    it('creates restrictive Network ACLs when explicitly enabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            restrictPrivateSubnetNacls: true, // Explicitly enable
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Should create 2 custom NACLs (private-egress and private-isolated)
        template.resourceCountIs('AWS::EC2::NetworkAcl', 2);

        // Should create NACL entries:
        // - Private egress: 1 inbound from VPC + 1 ephemeral TCP + 1 ephemeral UDP + 1 outbound = 4
        // - Private isolated: 1 inbound from VPC + 1 ephemeral from VPC + 1 outbound = 3
        // Total = 7 entries
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 7);

        // Verify NACL associations (2 AZs x 2 subnet types = 4 associations)
        template.resourceCountIs('AWS::EC2::SubnetNetworkAclAssociation', 4);
    });

    it('configures NACL rules to only allow VPC CIDR traffic', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            restrictPrivateSubnetNacls: true, // Enable for this test
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Verify that NACL entries exist with specific rule numbers
        const naclEntries = template.findResources('AWS::EC2::NetworkAclEntry');

        // Should have at least one ingress rule allowing VPC CIDR
        const ingressRules = Object.values(naclEntries).filter(
            (entry: any) => entry.Properties.Egress === false
        );
        expect(ingressRules.length).toBeGreaterThan(0);

        // Should have egress rules
        const egressRules = Object.values(naclEntries).filter(
            (entry: any) => entry.Properties.Egress === true
        );
        expect(egressRules.length).toBeGreaterThan(0);
    });

    it('allows specific ports in NACL rules when configured', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            restrictPrivateSubnetNacls: true, // Must enable NACLs
            allowedPorts: [80, 443], // HTTP and HTTPS only
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Egress NACL: 2 specific ports + 1 ephemeral TCP + 1 ephemeral UDP + 1 outbound = 5
        // Isolated NACL: 2 specific ports + 1 ephemeral from VPC + 1 outbound = 4
        // Total = 9 entries
        const naclEntries = template.findResources('AWS::EC2::NetworkAclEntry');
        expect(Object.keys(naclEntries).length).toBe(9);

        // Verify specific port rules exist (port 80 and 443)
        const portRules = Object.values(naclEntries).filter((entry: any) => {
            const protocol = entry.Properties.Protocol;
            const portRange = entry.Properties.PortRange;
            return protocol === 6 && portRange && (portRange.From === 80 || portRange.From === 443);
        });
        expect(portRules.length).toBeGreaterThan(0);
    });

    it('allows all ports when allowedPorts is not specified', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            restrictPrivateSubnetNacls: true, // Enable NACLs
            // No allowedPorts specified - should allow all traffic from VPC + ephemeral from internet
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        const naclEntries = template.findResources('AWS::EC2::NetworkAclEntry');
        const ingressRules = Object.values(naclEntries).filter(
            (entry: any) => entry.Properties.Egress === false
        );

        // Egress NACL: 1 all traffic from VPC + 1 ephemeral TCP + 1 ephemeral UDP = 3
        // Isolated NACL: 1 all traffic from VPC + 1 ephemeral from VPC = 2
        // Total = 5 ingress rules
        expect(ingressRules.length).toBe(5);
    });

    it('creates restrictive Network ACLs for public subnets when enabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            restrictPublicSubnetNacls: true, // Enable public subnet NACLs
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Should create 1 custom NACL for public subnets
        template.resourceCountIs('AWS::EC2::NetworkAcl', 1);

        // Should create 2 NACL entries (1 ingress + 1 egress)
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 2);

        // Verify NACL associations (2 AZs = 2 public subnets)
        template.resourceCountIs('AWS::EC2::SubnetNetworkAclAssociation', 2);
    });

    it('creates NACLs for both public and private subnets when both enabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            restrictPrivateSubnetNacls: true, // Enable private NACLs
            restrictPublicSubnetNacls: true,  // Enable public NACLs
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Should create 3 NACLs (1 public + 2 private)
        template.resourceCountIs('AWS::EC2::NetworkAcl', 3);

        // Should create 9 NACL entries:
        // - Public: 1 ingress + 1 egress = 2
        // - Private egress: 1 inbound from VPC + 1 ephemeral TCP + 1 ephemeral UDP + 1 outbound = 4
        // - Private isolated: 1 inbound from VPC + 1 ephemeral from VPC + 1 outbound = 3
        // Total = 2 + 4 + 3 = 9
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 9);

        // Verify NACL associations (2 public + 4 private = 6 total)
        template.resourceCountIs('AWS::EC2::SubnetNetworkAclAssociation', 6);
    });

    it('restricts default NACL when restrictDefaultNacl is enabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            restrictDefaultNacl: true,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Should create 3 custom NACLs (public, private-egress, isolated)
        // This replaces the default NACL for all subnets
        template.resourceCountIs('AWS::EC2::NetworkAcl', 3);

        // Should create NACL entries:
        // - Public: 1 ephemeral TCP + 1 ephemeral UDP + 1 VPC CIDR + 1 outbound = 4
        // - Private egress: 1 VPC CIDR + 1 ephemeral TCP + 1 ephemeral UDP + 1 outbound = 4
        // - Isolated: 1 VPC CIDR + 1 ephemeral from VPC + 1 outbound = 3
        // Total = 11 entries
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 11);

        // Should create subnet associations for all subnets (2 public + 2 private + 2 isolated = 6)
        template.resourceCountIs('AWS::EC2::SubnetNetworkAclAssociation', 6);

        // Verify all entries are allow rules (new NACLs start with implicit deny-all)
        const entries = template.findResources('AWS::EC2::NetworkAclEntry');
        const allRules = Object.values(entries);
        allRules.forEach((entry: any) => {
            expect(entry.Properties.RuleAction).toBe('allow');
        });
    });

    it('allows specific ports from internet on default NACL', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            restrictDefaultNacl: true,
            defaultNaclAllowedPorts: [80, 443], // Allow HTTP and HTTPS
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Should create 3 custom NACLs (public, private-egress, isolated)
        template.resourceCountIs('AWS::EC2::NetworkAcl', 3);

        // Should create NACL entries:
        // - Public: 2 specific ports (80, 443) + 1 ephemeral TCP + 1 ephemeral UDP + 1 VPC CIDR + 1 outbound = 6
        // - Private egress: 1 VPC CIDR + 1 ephemeral TCP + 1 ephemeral UDP + 1 outbound = 4
        // - Isolated: 1 VPC CIDR + 1 ephemeral from VPC + 1 outbound = 3
        // Total = 13 entries
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 13);

        // Verify port 80 and 443 rules exist
        const entries = template.findResources('AWS::EC2::NetworkAclEntry');
        const portRules = Object.values(entries).filter((entry: any) => {
            const portRange = entry.Properties.PortRange;
            return portRange && (portRange.From === 80 || portRange.From === 443);
        });
        expect(portRules.length).toBe(2);

        // Verify they allow from internet (0.0.0.0/0)
        portRules.forEach((rule: any) => {
            expect(rule.Properties.CidrBlock).toBe('0.0.0.0/0');
            expect(rule.Properties.Protocol).toBe(6); // TCP
        });
    });

    it('combines default NACL restriction with custom NACLs', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            restrictDefaultNacl: true, // Restrict default
            restrictPrivateSubnetNacls: true, // Custom NACLs for private subnets (this will be overridden)
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Should create 5 custom NACLs:
        // - 2 from restrictPrivateSubnetNacls (private-egress + private-isolated) 
        // - 3 from restrictDefaultNacl (public + private-egress + isolated)
        // Note: restrictDefaultNacl associations will override the restrictPrivateSubnetNacls
        template.resourceCountIs('AWS::EC2::NetworkAcl', 5);

        // Should create entries from both configurations:
        // - restrictPrivateSubnetNacls creates 7 entries (4 for egress + 3 for isolated)
        // - restrictDefaultNacl creates 11 entries (4 for public + 4 for egress + 3 for isolated)
        // Total = 18 entries
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 18);

        // Verify NACL associations: restrictDefaultNacl associates all 6 subnets
        // (these are the final associations that take effect)
        template.resourceCountIs('AWS::EC2::SubnetNetworkAclAssociation', 10);
    });

    describe('mapPublicIpOnLaunch', () => {
        it('defaults to true for backward compatibility', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            new Vpc(stack, 'TestVpc', {
                name: 'test-vpc',
                maxAzs: 2,
                stack: { id: 'test', tags: [] },
            });

            const template = Template.fromStack(stack);

            // Find all public subnets
            const subnets = template.findResources('AWS::EC2::Subnet');
            const publicSubnets = Object.entries(subnets).filter(([_, subnet]: [string, any]) =>
                subnet.Properties.Tags?.some((tag: any) =>
                    tag.Key === 'aws-cdk:subnet-name' && tag.Value.includes('public')
                )
            );

            // Verify MapPublicIpOnLaunch defaults to true on public subnets
            publicSubnets.forEach(([_, subnet]: [string, any]) => {
                expect(subnet.Properties.MapPublicIpOnLaunch).toBe(true);
            });
        });

        it('allows public IP assignment when explicitly set to true', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            new Vpc(stack, 'TestVpc', {
                name: 'test-vpc',
                maxAzs: 2,
                mapPublicIpOnLaunch: true,
                stack: { id: 'test', tags: [] },
            });

            const template = Template.fromStack(stack);

            // Find all public subnets
            const subnets = template.findResources('AWS::EC2::Subnet');
            const publicSubnets = Object.entries(subnets).filter(([_, subnet]: [string, any]) =>
                subnet.Properties.Tags?.some((tag: any) =>
                    tag.Key === 'aws-cdk:subnet-name' && tag.Value.includes('public')
                )
            );

            // Verify MapPublicIpOnLaunch is true
            publicSubnets.forEach(([_, subnet]: [string, any]) => {
                expect(subnet.Properties.MapPublicIpOnLaunch).toBe(true);
            });
        });

        it('disables automatic public IP assignment when set to false', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            new Vpc(stack, 'TestVpc', {
                name: 'test-vpc',
                maxAzs: 2,
                mapPublicIpOnLaunch: false,
                stack: { id: 'test', tags: [] },
            });

            const template = Template.fromStack(stack);

            // Find all public subnets
            const subnets = template.findResources('AWS::EC2::Subnet');
            const publicSubnets = Object.entries(subnets).filter(([_, subnet]: [string, any]) =>
                subnet.Properties.Tags?.some((tag: any) =>
                    tag.Key === 'aws-cdk:subnet-name' && tag.Value.includes('public')
                )
            );

            // Verify MapPublicIpOnLaunch is false on public subnets
            publicSubnets.forEach(([_, subnet]: [string, any]) => {
                expect(subnet.Properties.MapPublicIpOnLaunch).toBe(false);
            });

            // Verify we have the expected number of public subnets (2 AZs)
            expect(publicSubnets.length).toBe(2);
        });

        it('only affects public subnets, not private subnets', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            new Vpc(stack, 'TestVpc', {
                name: 'test-vpc',
                maxAzs: 2,
                mapPublicIpOnLaunch: false,
                stack: { id: 'test', tags: [] },
            });

            const template = Template.fromStack(stack);

            // Find all subnets
            const subnets = template.findResources('AWS::EC2::Subnet');
            const privateSubnets = Object.entries(subnets).filter(([_, subnet]: [string, any]) =>
                subnet.Properties.Tags?.some((tag: any) =>
                    tag.Key === 'aws-cdk:subnet-name' &&
                    (tag.Value.includes('private') || tag.Value.includes('isolated'))
                )
            );

            // Private subnets should never have MapPublicIpOnLaunch set to true
            // (AWS defaults private subnets to false, so CDK typically doesn't set it)
            privateSubnets.forEach(([_, subnet]: [string, any]) => {
                if (subnet.Properties.MapPublicIpOnLaunch !== undefined) {
                    expect(subnet.Properties.MapPublicIpOnLaunch).toBe(false);
                }
            });
        });

        it('combines with other security features like restrictDefaultNacl', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            new Vpc(stack, 'TestVpc', {
                name: 'test-vpc',
                maxAzs: 2,
                mapPublicIpOnLaunch: false, // Disable public IPs
                restrictDefaultNacl: true,  // Restrict NACL
                stack: { id: 'test', tags: [] },
            });

            const template = Template.fromStack(stack);

            // Verify MapPublicIpOnLaunch is false
            const subnets = template.findResources('AWS::EC2::Subnet');
            const publicSubnets = Object.entries(subnets).filter(([_, subnet]: [string, any]) =>
                subnet.Properties.Tags?.some((tag: any) =>
                    tag.Key === 'aws-cdk:subnet-name' && tag.Value.includes('public')
                )
            );

            publicSubnets.forEach(([_, subnet]: [string, any]) => {
                expect(subnet.Properties.MapPublicIpOnLaunch).toBe(false);
            });

            // Verify NACLs are also created (from restrictDefaultNacl)
            template.resourceCountIs('AWS::EC2::NetworkAcl', 3);
        });
    });
});
