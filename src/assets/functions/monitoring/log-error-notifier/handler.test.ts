import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './handler';
import type { CloudWatchLogsEvent } from 'aws-lambda';
import * as zlib from 'zlib';
import { mockClient } from 'aws-sdk-client-mock';
import { SNS, PublishCommand } from '@aws-sdk/client-sns';

const snsMock = mockClient(SNS);

describe('log-error-notifier handler', () => {
    beforeEach(() => {
        snsMock.reset();
        process.env.SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:test-topic';
    });

    const createCloudWatchLogsEvent = (logEvents: any[]): CloudWatchLogsEvent => {
        const logData = {
            messageType: 'DATA_MESSAGE',
            owner: '123456789012',
            logGroup: '/aws/lambda/test-function',
            logStream: '2026/03/05/[$LATEST]abcdef123456',
            subscriptionFilters: ['test-filter'],
            logEvents,
        };

        const compressed = zlib.gzipSync(JSON.stringify(logData));
        const encoded = compressed.toString('base64');

        return {
            awslogs: {
                data: encoded,
            },
        };
    };

    it('processes JSON error log and publishes to SNS', async () => {
        const event = createCloudWatchLogsEvent([
            {
                id: '1',
                timestamp: new Date('2026-03-05T23:35:36.636Z').getTime(),
                message: JSON.stringify({
                    timestamp: '2026-03-05T23:35:36.636Z',
                    level: 'ERROR',
                    message: 'Database connection failed',
                    errorCode: 'DB_CONN_ERR',
                }),
            },
        ]);

        snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(result.body).toContain('Processed 1 error log(s)');

        // Verify SNS publish was called
        const publishCalls = snsMock.commandCalls(PublishCommand);
        expect(publishCalls).toHaveLength(1);

        const publishParams = publishCalls[0].args[0].input;
        expect(publishParams.TopicArn).toBe('arn:aws:sns:us-east-1:123456789012:test-topic');
        expect(publishParams.Subject).toContain('ERROR');

        // Verify message structure
        const message = JSON.parse(publishParams.Message!);
        expect(message.source).toBe('CloudWatchLogs');
        expect(message.errorLevel).toBe('ERROR');
        expect(message.message).toBe('Database connection failed');
        expect(message.additionalData.errorCode).toBe('DB_CONN_ERR');
    });

    it('processes multiple error logs', async () => {
        const event = createCloudWatchLogsEvent([
            {
                id: '1',
                timestamp: new Date('2026-03-05T23:35:36.636Z').getTime(),
                message: JSON.stringify({
                    level: 'ERROR',
                    message: 'Error 1',
                }),
            },
            {
                id: '2',
                timestamp: new Date('2026-03-05T23:35:37.636Z').getTime(),
                message: JSON.stringify({
                    level: 'FATAL',
                    message: 'Error 2',
                }),
            },
        ]);

        snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(result.body).toContain('Processed 2 error log(s)');

        // Should publish to SNS twice
        const publishCalls = snsMock.commandCalls(PublishCommand);
        expect(publishCalls).toHaveLength(2);

        // Verify first message
        const message1 = JSON.parse(publishCalls[0].args[0].input.Message!);
        expect(message1.errorLevel).toBe('ERROR');
        expect(message1.message).toBe('Error 1');

        // Verify second message
        const message2 = JSON.parse(publishCalls[1].args[0].input.Message!);
        expect(message2.errorLevel).toBe('FATAL');
        expect(message2.message).toBe('Error 2');
    });

    it('handles plain text log messages', async () => {
        const event = createCloudWatchLogsEvent([
            {
                id: '1',
                timestamp: new Date('2026-03-05T23:35:36.636Z').getTime(),
                message: 'Plain text error message',
            },
        ]);

        snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });

        const result = await handler(event);

        expect(result.statusCode).toBe(200);

        const publishCalls = snsMock.commandCalls(PublishCommand);
        const message = JSON.parse(publishCalls[0].args[0].input.Message!);
        expect(message.message).toBe('Plain text error message');
        expect(message.errorLevel).toBe('ERROR');
    });

    it('includes additional fields from error log', async () => {
        const event = createCloudWatchLogsEvent([
            {
                id: '1',
                timestamp: new Date('2026-03-05T23:35:36.636Z').getTime(),
                message: JSON.stringify({
                    level: 'ERROR',
                    message: 'Test error',
                    userId: '12345',
                    requestId: 'abc-def-ghi',
                    stackTrace: 'Error at line 42',
                }),
            },
        ]);

        snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });

        const result = await handler(event);

        expect(result.statusCode).toBe(200);

        const publishCalls = snsMock.commandCalls(PublishCommand);
        const message = JSON.parse(publishCalls[0].args[0].input.Message!);

        expect(message.additionalData.userId).toBe('12345');
        expect(message.additionalData.requestId).toBe('abc-def-ghi');
        expect(message.additionalData.stackTrace).toBe('Error at line 42');
        expect(message.formattedMessage).toContain('userId: 12345');
        expect(message.formattedMessage).toContain('requestId: abc-def-ghi');
    });

    it('throws error if SNS_TOPIC_ARN is not set', async () => {
        delete process.env.SNS_TOPIC_ARN;

        const event = createCloudWatchLogsEvent([
            {
                id: '1',
                timestamp: Date.now(),
                message: JSON.stringify({ level: 'ERROR', message: 'Test' }),
            },
        ]);

        await expect(handler(event)).rejects.toThrow('SNS_TOPIC_ARN environment variable is required');
    });
});
