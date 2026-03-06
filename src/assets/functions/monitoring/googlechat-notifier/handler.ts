import type { SNSEvent } from 'aws-lambda';
import * as https from 'https';
import * as url from 'url';

interface CloudWatchAlarmMessage {
    AlarmName?: string;
    NewStateValue?: string;
    NewStateReason?: string;
    StateChangeTime?: string;
    Region?: string;
    AlarmArn?: string;
}

interface ErrorLogMessage {
    source?: string;
    errorLevel?: string;
    logGroup?: string;
    logStream?: string;
    timestamp?: string;
    message?: string;
    additionalData?: Record<string, any>;
    formattedMessage?: string;
}

export const handler = async (event: SNSEvent): Promise<{ statusCode: number; body: string }> => {
    const webhookUrl = process.env.WEBHOOK_URL;
    const messagePrefix = process.env.MESSAGE_PREFIX || '';

    if (!webhookUrl) {
        throw new Error('WEBHOOK_URL environment variable is required');
    }

    const message = event.Records[0].Sns;
    const body = message.Message;
    const region = process.env.AWS_REGION || 'us-east-1';

    let parsedBody: CloudWatchAlarmMessage | ErrorLogMessage;
    try {
        parsedBody = JSON.parse(body);
    } catch (e) {
        parsedBody = { AlarmName: body };
    }

    let chatMessage: any;

    // Check if this is an error log message from CloudWatch Logs
    if ('source' in parsedBody && parsedBody.source === 'CloudWatchLogs') {
        const errorLog = parsedBody as ErrorLogMessage;
        const emoji = errorLog.errorLevel === 'FATAL' || errorLog.errorLevel === 'CRITICAL' ? '🔥' : '🚨';

        // Build CloudWatch Logs console URL
        const logGroupEncoded = encodeURIComponent(errorLog.logGroup || '');
        const logStreamEncoded = encodeURIComponent(errorLog.logStream || '');
        const cloudwatchUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${logGroupEncoded}/log-events/${logStreamEncoded}`;

        // Build message with all available information
        let messageText = `*${messagePrefix}${messagePrefix ? ' ' : ''}${emoji} ${errorLog.errorLevel || 'ERROR'} in ${errorLog.logGroup}*\n\n`;
        messageText += `*Message:* ${errorLog.message || 'No message'}\n`;
        messageText += `*Level:* ${errorLog.errorLevel || 'ERROR'}\n`;
        messageText += `*Time:* ${errorLog.timestamp || new Date().toISOString()}\n`;
        messageText += `*Log Group:* ${errorLog.logGroup || 'Unknown'}\n`;
        messageText += `*Log Stream:* ${errorLog.logStream || 'Unknown'}\n`;

        // Add additional data fields if present
        if (errorLog.additionalData) {
            Object.entries(errorLog.additionalData).forEach(([key, value]) => {
                if (key !== 'timestamp' && key !== 'level' && key !== 'message' && value !== undefined) {
                    const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                    // Truncate very long values
                    const truncatedValue = displayValue.length > 200 ? displayValue.substring(0, 200) + '...' : displayValue;
                    messageText += `*${key}:* ${truncatedValue}\n`;
                }
            });
        }

        chatMessage = {
            text: messageText,
            cards: [
                {
                    header: {
                        title: `CloudWatch Logs Error`,
                        subtitle: errorLog.logGroup,
                    },
                    sections: [
                        {
                            widgets: [
                                {
                                    buttons: [
                                        {
                                            textButton: {
                                                text: 'VIEW IN CLOUDWATCH LOGS',
                                                onClick: {
                                                    openLink: {
                                                        url: cloudwatchUrl,
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };
    } else {
        // Handle CloudWatch Alarm messages
        const alarm = parsedBody as CloudWatchAlarmMessage;
        const alarmName = alarm.AlarmName || 'Unknown Alarm';
        const newState = alarm.NewStateValue || 'ALARM';
        const reason = alarm.NewStateReason || 'No reason provided';
        const timestamp = alarm.StateChangeTime || new Date().toISOString();

        // Build CloudWatch Alarms console URL
        const alarmNameEncoded = encodeURIComponent(alarmName);
        const cloudwatchUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#alarmsV2:alarm/${alarmNameEncoded}`;

        chatMessage = {
            text:
                `*${messagePrefix}${messagePrefix ? ' ' : ''}${alarmName}*\n\n` +
                `*State:* ${newState}\n` +
                `*Time:* ${timestamp}\n` +
                `*Reason:* ${reason}`,
            cards: [
                {
                    header: {
                        title: 'AWS CloudWatch Alarm',
                        subtitle: alarmName,
                    },
                    sections: [
                        {
                            widgets: [
                                {
                                    buttons: [
                                        {
                                            textButton: {
                                                text: 'VIEW IN CLOUDWATCH',
                                                onClick: {
                                                    openLink: {
                                                        url: cloudwatchUrl,
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };
    }

    const parsedUrl = url.parse(webhookUrl);
    const postData = JSON.stringify(chatMessage);

    const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
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
                if (res.statusCode === 200) {
                    resolve({ statusCode: 200, body: 'Sent to Google Chat' });
                } else {
                    reject(new Error(`Failed to send to Google Chat: ${res.statusCode}`));
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
