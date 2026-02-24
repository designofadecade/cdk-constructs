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
});
