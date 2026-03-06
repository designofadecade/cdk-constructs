import type { CloudWatchLogsEvent, CloudWatchLogsDecodedData } from 'aws-lambda';
import { SNS } from '@aws-sdk/client-sns';
import * as zlib from 'zlib';

interface ErrorLogMessage {
    timestamp?: string;
    level?: string;
    message?: string;
    [key: string]: any;
}

const sns = new SNS({});

export const handler = async (event: CloudWatchLogsEvent): Promise<{ statusCode: number; body: string }> => {
    const topicArn = process.env.SNS_TOPIC_ARN;

    if (!topicArn) {
        throw new Error('SNS_TOPIC_ARN environment variable is required');
    }

    // Decode and decompress CloudWatch Logs data
    const payload = Buffer.from(event.awslogs.data, 'base64');
    const decompressed = zlib.gunzipSync(payload);
    const logData: CloudWatchLogsDecodedData = JSON.parse(decompressed.toString('utf8'));

    // Process each log event and publish to SNS
    for (const logEvent of logData.logEvents) {
        let errorLog: ErrorLogMessage;

        try {
            // Try to parse as JSON
            errorLog = JSON.parse(logEvent.message);
        } catch (e) {
            // If not JSON, treat as plain text
            errorLog = { message: logEvent.message };
        }

        const timestamp = new Date(logEvent.timestamp).toISOString();
        const logMessage = errorLog.message || logEvent.message;
        const errorLevel = errorLog.level || 'ERROR';

        // Determine appropriate emoji for error level
        const emoji = errorLevel === 'FATAL' || errorLevel === 'CRITICAL' ? '🔥' : '🚨';

        // Build detailed message
        const messageLines = [
            `${emoji} ${errorLevel}`,
            '',
            `Message: ${logMessage}`,
            `Time: ${timestamp}`,
            `Log Group: ${logData.logGroup}`,
            `Log Stream: ${logData.logStream}`,
        ];

        // Add additional fields from the error log
        const excludedKeys = ['timestamp', 'level', 'message'];
        Object.keys(errorLog).forEach(key => {
            if (!excludedKeys.includes(key) && errorLog[key] !== undefined) {
                const value = typeof errorLog[key] === 'object'
                    ? JSON.stringify(errorLog[key])
                    : String(errorLog[key]);
                messageLines.push(`${key}: ${value}`);
            }
        });

        const snsMessage = messageLines.join('\n');

        // Publish to SNS topic with structured data
        const snsParams = {
            TopicArn: topicArn,
            Subject: `${emoji} ${errorLevel} in ${logData.logGroup}`,
            Message: JSON.stringify({
                source: 'CloudWatchLogs',
                errorLevel,
                logGroup: logData.logGroup,
                logStream: logData.logStream,
                timestamp,
                message: logMessage,
                additionalData: { ...errorLog },
                formattedMessage: snsMessage,
            }),
        };

        try {
            await sns.publish(snsParams);
        } catch (error) {
            throw error;
        }
    }

    return {
        statusCode: 200,
        body: `Processed ${logData.logEvents.length} error log(s) and published to SNS`,
    };
};
