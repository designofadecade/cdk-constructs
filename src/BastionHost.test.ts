import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { BastionHost } from '../src/BastionHost.js';

describe('BastionHost', () => {
    it('creates an EC2 instance in public subnet', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');

        new BastionHost(stack, 'TestBastion', {
            vpc,
            name: 'test-bastion',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::EC2::Instance', {
            InstanceType: 't4g.micro',
        });
    });

    it('creates a security group', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');

        new BastionHost(stack, 'TestBastion', {
            vpc,
            name: 'test-bastion',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::EC2::SecurityGroup', 3); // VPC default + bastion + VPC endpoints
    });

    it('uses ARM64 architecture', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');

        new BastionHost(stack, 'TestBastion', {
            vpc,
            name: 'test-bastion',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::EC2::Instance', {
            InstanceType: 't4g.micro',
        });
    });

    it('outputs instance ID', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');

        new BastionHost(stack, 'TestBastion', {
            vpc,
            name: 'test-bastion',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasOutput('*', {
            Description: 'Bastion Host Instance ID (use with SSM Session Manager)',
        });
    });
});
