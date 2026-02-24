import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Ses } from './Ses.js';

describe('Ses', () => {
    it('creates email identity', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const hostedZone = HostedZone.fromHostedZoneAttributes(stack, 'Zone', {
            hostedZoneId: 'Z1234567890ABC',
            zoneName: 'example.com',
        });

        new Ses(stack, 'TestSes', {
            name: 'test',
            hostedZone,
            stack: { tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::SES::EmailIdentity', {
            EmailIdentity: 'example.com',
        });
    });

    it('creates mail from domain configuration', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const hostedZone = HostedZone.fromHostedZoneAttributes(stack, 'Zone', {
            hostedZoneId: 'Z1234567890ABC',
            zoneName: 'example.com',
        });

        new Ses(stack, 'TestSes', {
            name: 'test',
            hostedZone,
            stack: { tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::SES::EmailIdentity', {
            MailFromAttributes: {
                MailFromDomain: 'mail.example.com',
            },
        });
    });

    it('exposes configuration set name', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const hostedZone = HostedZone.fromHostedZoneAttributes(stack, 'Zone', {
            hostedZoneId: 'Z1234567890ABC',
            zoneName: 'example.com',
        });

        const ses = new Ses(stack, 'TestSes', {
            name: 'test',
            hostedZone,
            stack: { tags: [] },
        });

        expect(ses.configurationSetName).toBe('test');
    });

    it('creates click tracking CNAME record', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const hostedZone = HostedZone.fromHostedZoneAttributes(stack, 'Zone', {
            hostedZoneId: 'Z1234567890ABC',
            zoneName: 'example.com',
        });

        new Ses(stack, 'TestSes', {
            name: 'test',
            hostedZone,
            stack: { tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            Name: 'tracking.example.com.',
            Type: 'CNAME',
        });
    });
});
