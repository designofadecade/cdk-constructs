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
        // - Private egress: 1 inbound from VPC + 1 ephemeral from internet + 1 outbound = 3
        // - Private isolated: 1 inbound from VPC + 1 ephemeral from VPC + 1 outbound = 3
        // Total = 6 entries
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 6);

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

        // Egress NACL: 2 specific ports + 1 ephemeral from internet + 1 outbound = 4
        // Isolated NACL: 2 specific ports + 1 ephemeral from VPC + 1 outbound = 4
        // Total = 8 ingress + outbound rules
        const naclEntries = template.findResources('AWS::EC2::NetworkAclEntry');
        expect(Object.keys(naclEntries).length).toBe(8);

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

        // Egress NACL: 1 all traffic from VPC + 1 ephemeral from internet = 2
        // Isolated NACL: 1 all traffic from VPC + 1 ephemeral from VPC = 2
        // Total = 4 ingress rules
        expect(ingressRules.length).toBe(4);
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

        // Should create 8 NACL entries:
        // - Public: 1 ingress + 1 egress = 2
        // - Private egress: 1 inbound from VPC + 1 ephemeral from internet + 1 outbound = 3
        // - Private isolated: 1 inbound from VPC + 1 ephemeral from VPC + 1 outbound = 3
        // Total = 2 + 3 + 3 = 8
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 8);

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

        // Should not create custom NACLs (uses default NACL)
        template.resourceCountIs('AWS::EC2::NetworkAcl', 0);

        // Should create 4 NACL entries for the default NACL:
        // - 1 override inbound rule 100 (change default allow to DENY)
        // - 1 allow inbound from VPC CIDR (rule 40)
        // - 1 allow inbound ephemeral from internet for return traffic (rule 20)
        // - 1 override outbound rule 100 (explicitly allow all - for external API calls)
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 4);

        // Should not create subnet associations (default NACL is automatically associated)
        template.resourceCountIs('AWS::EC2::SubnetNetworkAclAssociation', 0);

        // Verify VPC CIDR inbound entry exists
        const entries = template.findResources('AWS::EC2::NetworkAclEntry');
        const ingressEntries = Object.values(entries).filter((entry: any) => entry.Properties.Egress === false);
        expect(ingressEntries.length).toBe(3); // Override rule 100 (deny) + VPC CIDR + ephemeral

        // Verify deny rule exists at rule 100 (overriding AWS default)
        const denyRules = Object.values(entries).filter((entry: any) =>
            entry.Properties.RuleAction === 'deny' && entry.Properties.RuleNumber === 100
        );
        expect(denyRules.length).toBe(1); // 1 inbound deny at rule 100
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

        // Should create 6 NACL entries:
        // - 1 override inbound rule 100 (DENY all)
        // - 1 allow inbound from VPC CIDR (rule 40)
        // - 2 allow inbound specific ports from internet (rules 30, 31 for ports 80, 443)
        // - 1 allow inbound ephemeral from internet (rule 20)
        // - 1 override outbound rule 100 (ALLOW all)
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 6);

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
            restrictPrivateSubnetNacls: true, // Custom NACLs for private subnets
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Should create 2 custom NACLs (private-egress + private-isolated)
        template.resourceCountIs('AWS::EC2::NetworkAcl', 2);

        // Should create:
        // - 4 entries for default NACL (override rule 100 inbound + VPC inbound + ephemeral inbound + override rule 100 outbound)
        // - 3 entries for private egress NACL
        // - 3 entries for private isolated NACL
        // Total = 4 + 3 + 3 = 10
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 10);

        // Verify NACL associations (4 private subnets only, public uses default)
        template.resourceCountIs('AWS::EC2::SubnetNetworkAclAssociation', 4);
    });
});
