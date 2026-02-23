import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Server } from './Server.js';
describe('Server', () => {
    it('creates EC2 instance', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');
        new Server(stack, 'TestServer', {
            name: 'test-server',
            vpc,
            keyPairName: 'test-key',
            stack: { id: 'test', label: 'Test', tags: [] },
        });
        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::EC2::Instance', 1);
    });
    it('creates security group', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');
        new Server(stack, 'TestServer', {
            name: 'test-server',
            vpc,
            keyPairName: 'test-key',
            stack: { id: 'test', label: 'Test', tags: [] },
        });
        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::EC2::SecurityGroup', 2); // VPC default + server
    });
    it('associates Elastic IP when requested', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');
        new Server(stack, 'TestServer', {
            name: 'test-server',
            vpc,
            keyPairName: 'test-key',
            associateElasticIp: true,
            stack: { id: 'test', label: 'Test', tags: [] },
        });
        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::EC2::EIP', 1);
    });
    it('creates Route53 records when domain configured', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');
        new Server(stack, 'TestServer', {
            name: 'test-server',
            vpc,
            keyPairName: 'test-key',
            associateElasticIp: true,
            domain: {
                hostedZoneId: 'Z1234567890ABC',
                hostedZoneName: 'example.com',
                recordName: 'server.example.com',
            },
            stack: { id: 'test', label: 'Test', tags: [] },
        });
        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Route53::RecordSet', 1);
    });
    it('installs Docker by default', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');
        new Server(stack, 'TestServer', {
            name: 'test-server',
            vpc,
            keyPairName: 'test-key',
            stack: { id: 'test', label: 'Test', tags: [] },
        });
        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::EC2::Instance', {
            UserData: expect.any(Object),
        });
    });
    it('exposes instance and security group', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');
        const server = new Server(stack, 'TestServer', {
            name: 'test-server',
            vpc,
            keyPairName: 'test-key',
            stack: { id: 'test', label: 'Test', tags: [] },
        });
        expect(server.instance).toBeDefined();
        expect(server.securityGroup).toBeDefined();
    });
});
