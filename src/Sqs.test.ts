import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Sqs } from './Sqs.js';

describe('Sqs', () => {
    it('creates SQS queue', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Sqs(stack, 'TestQueue', {
            name: 'test-queue',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::SQS::Queue', {
            QueueName: 'test-queue',
        });
    });

    it('creates dead letter queue', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Sqs(stack, 'TestQueue', {
            name: 'test-queue',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::SQS::Queue', 2); // Main queue + DLQ
    });

    it('enables SQS managed encryption', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Sqs(stack, 'TestQueue', {
            name: 'test-queue',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::SQS::Queue', {
            SqsManagedSseEnabled: true,
        });
    });

    it('sets max receive count for dead letter queue', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Sqs(stack, 'TestQueue', {
            name: 'test-queue',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::SQS::Queue', {
            RedrivePolicy: {
                maxReceiveCount: 3,
            },
        });
    });

    it('exposes queue property', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const sqs = new Sqs(stack, 'TestQueue', {
            name: 'test-queue',
            stack: { id: 'test', tags: [] },
        });

        expect(sqs.queue).toBeDefined();
        expect(sqs.queueUrl).toBeDefined();
    });

    it('outputs queue URL', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Sqs(stack, 'TestQueue', {
            name: 'test-queue',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasOutput('*', {
            Description: 'SQS Queue URL',
        });
    });
});
