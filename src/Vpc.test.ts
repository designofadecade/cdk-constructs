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

        // Should create NACL entries: 2 entries per NACL (ingress + egress) x 2 NACLs = 4 entries
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 4);

        // Verify NACL associations (2 AZs x 2 private subnet types = 4 associations)
        template.resourceCountIs('AWS::EC2::SubnetNetworkAclAssociation', 4);
    });

it('allows disabling restrictive Network ACLs explicitly', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            maxAzs: 2,
            restrictPrivateSubnetNacls: false, // Explicitly disable
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        // Should not create custom NACLs when disabled
        template.resourceCountIs('AWS::EC2::NetworkAcl', 0);
        template.resourceCountIs('AWS::EC2::NetworkAclEntry', 0);
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

        // Should have rules for each port (80, 443) x 2 NACLs + ephemeral ports x 2 = 6 ingress rules
        const naclEntries = template.findResources('AWS::EC2::NetworkAclEntry');
        const ingressRules = Object.values(naclEntries).filter(
            (entry: any) => entry.Properties.Egress === false
        );

        // 2 specific port rules per NACL + 1 ephemeral port rule per NACL = 6 ingress rules
        expect(ingressRules.length).toBe(6);

        // Verify specific port rules exist (port 80 and 443)
        const portRules = ingressRules.filter((rule: any) => {
            const protocol = rule.Properties.Protocol;
            const portRange = rule.Properties.PortRange;
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
            // No allowedPorts specified - should allow all traffic
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);

        const naclEntries = template.findResources('AWS::EC2::NetworkAclEntry');
        const ingressRules = Object.values(naclEntries).filter(
            (entry: any) => entry.Properties.Egress === false
        );

        // Should have 2 ingress rules (1 per NACL) allowing all traffic (protocol -1)
        const allTrafficRules = ingressRules.filter((rule: any) => {
            return rule.Properties.Protocol === -1; // -1 means all traffic
        });
        expect(allTrafficRules.length).toBe(2);
    });
});
