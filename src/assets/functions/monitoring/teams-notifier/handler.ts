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

    let teamsMessage: any;

    // Check if this is an error log message from CloudWatch Logs
    if ('source' in parsedBody && parsedBody.source === 'CloudWatchLogs') {
        const errorLog = parsedBody as ErrorLogMessage;
        const emoji = errorLog.errorLevel === 'FATAL' || errorLog.errorLevel === 'CRITICAL' ? '🔥' : '🚨';

        // Build CloudWatch Logs console URL
        const logGroupEncoded = encodeURIComponent(errorLog.logGroup || '');
        const logStreamEncoded = encodeURIComponent(errorLog.logStream || '');
        const cloudwatchUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${logGroupEncoded}/log-events/${logStreamEncoded}`;

        // Build facts array with all available information
        const facts: Array<{ title: string; value: string }> = [
            { title: 'Level', value: errorLog.errorLevel || 'ERROR' },
            { title: 'Time', value: errorLog.timestamp || new Date().toISOString() },
            { title: 'Log Group', value: errorLog.logGroup || 'Unknown' },
            { title: 'Log Stream', value: errorLog.logStream || 'Unknown' },
            { title: 'Message', value: errorLog.message || 'No message' },
        ];

        // Add additional data fields if present
        if (errorLog.additionalData) {
            Object.entries(errorLog.additionalData).forEach(([key, value]) => {
                if (key !== 'timestamp' && key !== 'level' && key !== 'message' && value !== undefined) {
                    const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                    // Truncate very long values
                    facts.push({
                        title: key,
                        value: displayValue.length > 200 ? displayValue.substring(0, 200) + '...' : displayValue
                    });
                }
            });
        }

        // Use Adaptive Card format for better compatibility
        teamsMessage = {
            type: 'message',
            attachments: [
                {
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    content: {
                        type: 'AdaptiveCard',
                        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                        version: '1.4',
                        msteams: {
                            width: 'Full',
                        },
                        body: [
                            {
                                type: 'Container',
                                style: 'emphasis',
                                items: [
                                    {
                                        type: 'TextBlock',
                                        text: `${messagePrefix}${messagePrefix ? ' ' : ''}${emoji} ${errorLog.errorLevel || 'ERROR'}`,
                                        weight: 'Bolder',
                                        size: 'Large',
                                        wrap: true,
                                        color: 'Attention',
                                    },
                                    {
                                        type: 'TextBlock',
                                        text: errorLog.logGroup || 'Unknown',
                                        size: 'Medium',
                                        wrap: true,
                                        spacing: 'None',
                                    },
                                ],
                            },
                            {
                                type: 'FactSet',
                                facts: facts,
                                separator: true,
                                spacing: 'Medium',
                            },
                        ],
                        actions: [
                            {
                                type: 'Action.OpenUrl',
                                title: 'View in CloudWatch Logs',
                                url: cloudwatchUrl,
                                style: 'positive',
                            },
                        ],
                    },
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

        const color = newState === 'ALARM' ? 'Attention' : newState === 'OK' ? 'Good' : 'Warning';

        // Use Adaptive Card format for better compatibility
        teamsMessage = {
            type: 'message',
            attachments: [
                {
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    content: {
                        type: 'AdaptiveCard',
                        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                        version: '1.4',
                        msteams: {
                            width: 'Full',
                        },
                        body: [
                            {
                                type: 'Container',
                                style: 'emphasis',
                                items: [
                                    {
                                        type: 'TextBlock',
                                        text: `${messagePrefix}${messagePrefix ? ' ' : ''}${alarmName}`,
                                        weight: 'Bolder',
                                        size: 'Large',
                                        wrap: true,
                                        color: color,
                                    },
                                    {
                                        type: 'TextBlock',
                                        text: 'AWS CloudWatch Alarm',
                                        size: 'Medium',
                                        wrap: true,
                                        spacing: 'None',
                                    },
                                ],
                            },
                            {
                                type: 'FactSet',
                                facts: [
                                    { title: 'State', value: newState },
                                    { title: 'Time', value: timestamp },
                                    { title: 'Reason', value: reason },
                                ],
                                separator: true,
                                spacing: 'Medium',
                            },
                        ],
                        actions: [
                            {
                                type: 'Action.OpenUrl',
                                title: 'View in CloudWatch',
                                url: cloudwatchUrl,
                                style: 'positive',
                            },
                        ],
                    },
                },
            ],
        };
    }

    const parsedUrl = url.parse(webhookUrl);
    const postData = JSON.stringify(teamsMessage);

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
                    resolve({ statusCode: 200, body: 'Sent to Teams' });
                } else {
                    reject(new Error(`Failed to send to Teams: ${res.statusCode}`));
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
