import type { SNSEvent } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import * as https from 'https';

interface CloudWatchAlarmMessage {
    AlarmName?: string;
    NewStateValue?: string;
    NewStateReason?: string;
    StateChangeTime?: string;
}

interface CloudWatchLogMessage {
    source: 'CloudWatchLogs';
    errorLevel: string;
    logGroup: string;
    logStream: string;
    timestamp: string;
    message: string;
    additionalData?: Record<string, any>;
    formattedMessage: string;
}

// Cache the webhook URL to avoid repeated SSM calls
let cachedWebhookUrl: string | null = null;

// Helper function to get webhook URL from SSM or environment variable
async function getWebhookUrl(): Promise<string> {
    // Return cached value if available
    if (cachedWebhookUrl) {
        return cachedWebhookUrl;
    }

    const directUrl = process.env.SLACK_WEBHOOK_URL;
    const parameterArn = process.env.WEBHOOK_PARAMETER_ARN;

    if (directUrl) {
        cachedWebhookUrl = directUrl;
        return cachedWebhookUrl;
    }

    if (parameterArn) {
        const client = new SSMClient({});
        // Extract parameter name from ARN: arn:aws:ssm:region:account:parameter/name
        const match = parameterArn.match(/parameter\/(.+)$/);
        if (!match) {
            throw new Error(`Invalid parameter ARN format: ${parameterArn}`);
        }
        const parameterName = `/${match[1]}`;

        const command = new GetParameterCommand({
            Name: parameterName,
            WithDecryption: true,
        });

        const response = await client.send(command);
        if (!response.Parameter?.Value) {
            throw new Error(`Failed to retrieve parameter: ${parameterName}`);
        }

        cachedWebhookUrl = response.Parameter.Value;
        return cachedWebhookUrl;
    }

    throw new Error('Either SLACK_WEBHOOK_URL or WEBHOOK_PARAMETER_ARN environment variable is required');
}

export const handler = async (event: SNSEvent): Promise<{ statusCode: number; body: string }> => {
    const webhookUrl = await getWebhookUrl();
    const channel = process.env.SLACK_CHANNEL;
    const messagePrefix = process.env.MESSAGE_PREFIX || '';

    const message = event.Records[0].Sns;
    const subject = message.Subject || 'AWS Notification';
    const body = message.Message;
    const region = process.env.AWS_REGION || 'us-east-1';

    let parsedBody: CloudWatchAlarmMessage | CloudWatchLogMessage;
    try {
        parsedBody = JSON.parse(body);
    } catch (e) {
        parsedBody = { AlarmName: body };
    }

    let slackMessage;

    // Check if this is a CloudWatch Logs message
    if ('source' in parsedBody && parsedBody.source === 'CloudWatchLogs') {
        // Handle CloudWatch Logs error message
        const logMsg = parsedBody as CloudWatchLogMessage;
        const color =
            logMsg.errorLevel === 'FATAL' || logMsg.errorLevel === 'CRITICAL'
                ? '#8B0000' // Dark red for critical
                : 'danger'; // Red for errors

        // Build CloudWatch Logs console URL
        const logGroupEncoded = encodeURIComponent(logMsg.logGroup || '');
        const logStreamEncoded = encodeURIComponent(logMsg.logStream || '');
        const cloudwatchUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${logGroupEncoded}/log-events/${logStreamEncoded}`;

        const fields: { title: string; value: string; short: boolean }[] = [
            { title: 'Level', value: logMsg.errorLevel, short: true },
            { title: 'Time', value: logMsg.timestamp, short: true },
            { title: 'Log Group', value: logMsg.logGroup, short: false },
            { title: 'Log Stream', value: logMsg.logStream, short: false },
        ];

        // Add additional fields if present
        if (logMsg.additionalData) {
            const excludedKeys = ['timestamp', 'level', 'message'];
            Object.keys(logMsg.additionalData).forEach(key => {
                if (!excludedKeys.includes(key) && logMsg.additionalData![key] !== undefined) {
                    const value = typeof logMsg.additionalData![key] === 'object'
                        ? JSON.stringify(logMsg.additionalData![key])
                        : String(logMsg.additionalData![key]);
                    fields.push({ title: key, value, short: true });
                }
            });
        }

        slackMessage = {
            channel: channel,
            username: 'CloudWatch Logs',
            icon_emoji: ':rotating_light:',
            attachments: [
                {
                    color,
                    title: messagePrefix ? `${messagePrefix} ${logMsg.errorLevel}` : logMsg.errorLevel,
                    text: logMsg.message,
                    fields,
                    footer: 'CloudWatch Logs',
                    ts: Math.floor(Date.parse(logMsg.timestamp) / 1000),
                    actions: [
                        {
                            type: 'button',
                            text: 'View in CloudWatch Logs',
                            url: cloudwatchUrl,
                        },
                    ],
                },
            ],
        };
    } else {
        // Handle CloudWatch Alarm message (existing logic)
        const alarmMsg = parsedBody as CloudWatchAlarmMessage;
        const alarmName = alarmMsg.AlarmName || 'Unknown Alarm';
        const newState = alarmMsg.NewStateValue || 'ALARM';
        const reason = alarmMsg.NewStateReason || 'No reason provided';
        const timestamp = alarmMsg.StateChangeTime || new Date().toISOString();

        // Build CloudWatch Alarms console URL
        const alarmNameEncoded = encodeURIComponent(alarmName);
        const cloudwatchUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#alarmsV2:alarm/${alarmNameEncoded}`;

        const color = newState === 'ALARM' ? 'danger' : newState === 'OK' ? 'good' : 'warning';

        slackMessage = {
            channel: channel,
            username: 'AWS CloudWatch',
            icon_emoji: ':warning:',
            attachments: [
                {
                    color: color,
                    title: `${messagePrefix} ${alarmName}`,
                    text: reason,
                    fields: [
                        { title: 'State', value: newState, short: true },
                        { title: 'Time', value: timestamp, short: true },
                    ],
                    footer: 'AWS CloudWatch Alarms',
                    ts: Math.floor(Date.parse(timestamp) / 1000),
                    actions: [
                        {
                            type: 'button',
                            text: 'View in CloudWatch',
                            url: cloudwatchUrl,
                        },
                    ],
                },
            ],
        };
    }

    const parsedUrl = new URL(webhookUrl);
    const postData = JSON.stringify(slackMessage);

    const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => (responseBody += chunk));
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 202) {
                    resolve({ statusCode: 200, body: 'Sent to Slack' });
                } else {
                    reject(new Error(`Failed to send to Slack: ${res.statusCode} - ${responseBody}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
};
