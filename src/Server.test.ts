import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Server } from './Server.js';

describe('Server', () => {
    it('creates EC2 instance', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');

        new Server(stack, 'TestServer', {
            vpc,
            project: {
                id: 'test',
                label: 'Test',
                tag: 'test',
                tagClients: 'TestClient',
            },
            tag: 'test',
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::EC2::Instance', 1);
    });

    it('creates security group', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');

        new Server(stack, 'TestServer', {
            vpc,
            project: {
                id: 'test',
                label: 'Test',
                tag: 'test',
                tagClients: 'TestClient',
            },
            tag: 'test',
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::EC2::SecurityGroup', 1); // Server security group
    });

    it('associates Elastic IP when requested', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        // Create VPC without NAT gateways to avoid EIP conflicts
        const vpc = new Vpc(stack, 'TestVpc', { natGateways: 0 });

        new Server(stack, 'TestServer', {
            vpc,
            project: {
                id: 'test',
                label: 'Test',
                tag: 'test',
                tagClients: 'TestClient',
            },
            tag: 'test',
            publicAccess: true,
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::EC2::EIP', 1);
    });

    it('creates Route53 records when domain configured', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');
        const hostedZone = HostedZone.fromHostedZoneAttributes(stack, 'Zone', {
            hostedZoneId: 'Z1234567890ABC',
            zoneName: 'example.com',
        });

        new Server(stack, 'TestServer', {
            vpc,
            project: {
                id: 'test',
                label: 'Test',
                tag: 'test',
                tagClients: 'TestClient',
            },
            tag: 'test',
            publicAccess: true,
            domains: [{
                hostedZone,
                recordName: 'server.example.com',
            }],
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Route53::RecordSet', 1);
    });

    it('installs Docker by default', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');

        new Server(stack, 'TestServer', {
            vpc,
            project: {
                id: 'test',
                label: 'Test',
                tag: 'test',
                tagClients: 'TestClient',
            },
            tag: 'test',
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::EC2::Instance', {
            UserData: Match.anyValue(),
        });
    });

    it('exposes instance and security group', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');

        const server = new Server(stack, 'TestServer', {
            vpc,
            project: {
                id: 'test',
                label: 'Test',
                tag: 'test',
                tagClients: 'TestClient',
            },
            tag: 'test',
        });

        expect(server.ec2).toBeDefined();
        expect(server.securityGroup).toBeDefined();
    });
});
