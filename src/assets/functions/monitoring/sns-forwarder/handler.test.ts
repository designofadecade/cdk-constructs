import { describe, it, expect, beforeEach } from 'vitest';
import type { SNSEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { SNS, PublishCommand } from '@aws-sdk/client-sns';
import { handler } from './handler.js';

const snsMock = mockClient(SNS);

// Set environment variables before importing handler
process.env.TARGET_TOPIC_ARN = 'arn:aws:sns:ca-central-1:123456789012:target-topic';
process.env.TARGET_REGION = 'ca-central-1';

describe('SNS Forwarder Handler', () => {
    beforeEach(() => {
        snsMock.reset();
        snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id-123' });
    });

    it('forwards SNS message to target region', async () => {
        const event: SNSEvent = {
            Records: [
                {
                    EventSource: 'aws:sns',
                    EventVersion: '1.0',
                    EventSubscriptionArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                    Sns: {
                        Type: 'Notification',
                        MessageId: 'source-message-id',
                        TopicArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                        Subject: 'Test Alert',
                        Message: JSON.stringify({ alert: 'Test message' }),
                        Timestamp: '2024-01-01T00:00:00.000Z',
                        SignatureVersion: '1',
                        Signature: 'test-signature',
                        SigningCertUrl: 'https://test.com/cert.pem',
                        UnsubscribeUrl: 'https://test.com/unsubscribe',
                        MessageAttributes: {},
                    },
                },
            ],
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(snsMock.calls()).toHaveLength(1);
        expect(snsMock.call(0).args[0].input).toMatchObject({
            TopicArn: 'arn:aws:sns:ca-central-1:123456789012:target-topic',
            Message: JSON.stringify({ alert: 'Test message' }),
            Subject: 'Test Alert',
        });
    });

    it('forwards multiple SNS messages', async () => {
        const event: SNSEvent = {
            Records: [
                {
                    EventSource: 'aws:sns',
                    EventVersion: '1.0',
                    EventSubscriptionArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                    Sns: {
                        Type: 'Notification',
                        MessageId: 'message-1',
                        TopicArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                        Subject: 'Alert 1',
                        Message: 'Message 1',
                        Timestamp: '2024-01-01T00:00:00.000Z',
                        SignatureVersion: '1',
                        Signature: 'test-signature',
                        SigningCertUrl: 'https://test.com/cert.pem',
                        UnsubscribeUrl: 'https://test.com/unsubscribe',
                        MessageAttributes: {},
                    },
                },
                {
                    EventSource: 'aws:sns',
                    EventVersion: '1.0',
                    EventSubscriptionArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                    Sns: {
                        Type: 'Notification',
                        MessageId: 'message-2',
                        TopicArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                        Subject: 'Alert 2',
                        Message: 'Message 2',
                        Timestamp: '2024-01-01T00:01:00.000Z',
                        SignatureVersion: '1',
                        Signature: 'test-signature',
                        SigningCertUrl: 'https://test.com/cert.pem',
                        UnsubscribeUrl: 'https://test.com/unsubscribe',
                        MessageAttributes: {},
                    },
                },
            ],
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(snsMock.calls()).toHaveLength(2);
    });

    it('forwards message with String message attributes', async () => {
        const event: SNSEvent = {
            Records: [
                {
                    EventSource: 'aws:sns',
                    EventVersion: '1.0',
                    EventSubscriptionArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                    Sns: {
                        Type: 'Notification',
                        MessageId: 'message-id',
                        TopicArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                        Subject: 'Test',
                        Message: 'Test message',
                        Timestamp: '2024-01-01T00:00:00.000Z',
                        SignatureVersion: '1',
                        Signature: 'test-signature',
                        SigningCertUrl: 'https://test.com/cert.pem',
                        UnsubscribeUrl: 'https://test.com/unsubscribe',
                        MessageAttributes: {
                            customAttribute: {
                                Type: 'String',
                                Value: 'custom-value',
                            },
                        },
                    },
                },
            ],
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        const publishInput = snsMock.call(0).args[0].input as any;
        expect(publishInput.MessageAttributes).toMatchObject({
            customAttribute: {
                DataType: 'String',
                StringValue: 'custom-value',
            },
        });
    });

    it('uses default subject when not provided', async () => {
        const event: SNSEvent = {
            Records: [
                {
                    EventSource: 'aws:sns',
                    EventVersion: '1.0',
                    EventSubscriptionArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                    Sns: {
                        Type: 'Notification',
                        MessageId: 'message-id',
                        TopicArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                        Subject: undefined,
                        Message: 'Test message',
                        Timestamp: '2024-01-01T00:00:00.000Z',
                        SignatureVersion: '1',
                        Signature: 'test-signature',
                        SigningCertUrl: 'https://test.com/cert.pem',
                        UnsubscribeUrl: 'https://test.com/unsubscribe',
                        MessageAttributes: {},
                    },
                },
            ],
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        const publishInput = snsMock.call(0).args[0].input as any;
        expect(publishInput.Subject).toBe('Forwarded Message');
    });

    it('throws error when forwarding fails', async () => {
        snsMock.on(PublishCommand).rejects(new Error('SNS publish failed'));

        const event: SNSEvent = {
            Records: [
                {
                    EventSource: 'aws:sns',
                    EventVersion: '1.0',
                    EventSubscriptionArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                    Sns: {
                        Type: 'Notification',
                        MessageId: 'message-id',
                        TopicArn: 'arn:aws:sns:us-east-1:123456789012:source-topic',
                        Subject: 'Test',
                        Message: 'Test message',
                        Timestamp: '2024-01-01T00:00:00.000Z',
                        SignatureVersion: '1',
                        Signature: 'test-signature',
                        SigningCertUrl: 'https://test.com/cert.pem',
                        UnsubscribeUrl: 'https://test.com/unsubscribe',
                        MessageAttributes: {},
                    },
                },
            ],
        };

        await expect(handler(event)).rejects.toThrow('SNS publish failed');
    });
});
