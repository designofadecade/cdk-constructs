import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Ses } from './Ses.js';

describe('Ses', () => {
    it('creates email identity', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Ses(stack, 'TestSes', {
            email: 'noreply@example.com',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::SES::EmailIdentity', {
            EmailIdentity: 'noreply@example.com',
        });
    });

    it('creates mail from domain configuration', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Ses(stack, 'TestSes', {
            email: 'noreply@example.com',
            mailFromDomain: 'mail.example.com',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::SES::EmailIdentity', {
            MailFromAttributes: {
                MailFromDomain: 'mail.example.com',
            },
        });
    });

    it('exposes email identity', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const ses = new Ses(stack, 'TestSes', {
            email: 'noreply@example.com',
            stack: { id: 'test', tags: [] },
        });

        expect(ses.emailIdentity).toBeDefined();
    });

    it('outputs email identity ARN', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Ses(stack, 'TestSes', {
            email: 'noreply@example.com',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasOutput('*', {
            Description: 'SES Email Identity ARN',
        });
    });
});
