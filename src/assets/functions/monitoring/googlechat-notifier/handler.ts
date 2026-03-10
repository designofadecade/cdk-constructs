import type { SNSEvent } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import * as https from 'https';

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

interface GuardDutyFinding {
    schemaVersion?: string;
    accountId?: string;
    region?: string;
    partition?: string;
    id?: string;
    arn?: string;
    type?: string;
    resource?: any;
    service?: {
        serviceName?: string;
        detectorId?: string;
        action?: any;
        eventFirstSeen?: string;
        eventLastSeen?: string;
        archived?: boolean;
        count?: number;
    };
    severity?: number;
    title?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface EventBridgeMessage {
    version?: string;
    id?: string;
    'detail-type'?: string;
    source?: string;
    account?: string;
    time?: string;
    region?: string;
    detail?: GuardDutyFinding;
}

// Cache the webhook URL to avoid repeated SSM calls
let cachedWebhookUrl: string | null = null;

// Helper function to get webhook URL from SSM or environment variable
async function getWebhookUrl(): Promise<string> {
    // Return cached value if available
    if (cachedWebhookUrl) {
        return cachedWebhookUrl;
    }

    const directUrl = process.env.WEBHOOK_URL;
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

    throw new Error('Either WEBHOOK_URL or WEBHOOK_PARAMETER_ARN environment variable is required');
}

export const handler = async (event: SNSEvent): Promise<{ statusCode: number; body: string }> => {
    const webhookUrl = await getWebhookUrl();
    const messagePrefix = process.env.MESSAGE_PREFIX || '';

    const message = event.Records[0].Sns;
    const body = message.Message;
    const region = process.env.AWS_REGION || 'us-east-1';

    let parsedBody: CloudWatchAlarmMessage | ErrorLogMessage | EventBridgeMessage;
    try {
        parsedBody = JSON.parse(body);
    } catch (e) {
        parsedBody = { AlarmName: body };
    }

    let chatMessage: any;

    // Check if this is a GuardDuty finding from EventBridge
    if ('detail-type' in parsedBody && parsedBody['detail-type'] === 'GuardDuty Finding' && parsedBody.detail) {
        const ebMessage = parsedBody as EventBridgeMessage;
        const finding = ebMessage.detail!;

        const severity = finding.severity || 0;
        const severityLabel = severity >= 7 ? 'HIGH' : severity >= 4 ? 'MEDIUM' : 'LOW';
        const emoji = severity >= 7 ? '🔴' : severity >= 4 ? '🟠' : '🟡';

        // Build GuardDuty console URL
        const findingId = finding.id || '';
        const detectorId = finding.service?.detectorId || '';
        const findingRegion = ebMessage.region || region;
        const guardDutyUrl = detectorId && findingId
            ? `https://${findingRegion}.console.aws.amazon.com/guardduty/home?region=${findingRegion}#/findings?search=id%3D${findingId}`
            : `https://${findingRegion}.console.aws.amazon.com/guardduty/home?region=${findingRegion}`;

        let messageText = `*${messagePrefix}${messagePrefix ? ' ' : ''}${emoji} GuardDuty Finding*\n\n`;
        messageText += `*Title:* ${finding.title || 'Security Finding Detected'}\n`;
        messageText += `*Description:* ${finding.description || 'No description available'}\n`;
        messageText += `*Severity:* ${severityLabel} (${severity})\n`;
        messageText += `*Type:* ${finding.type || 'Unknown'}\n`;
        messageText += `*Account:* ${finding.accountId || ebMessage.account || 'Unknown'}\n`;
        messageText += `*Region:* ${finding.region || ebMessage.region || 'Unknown'}\n`;
        messageText += `*Time:* ${ebMessage.time || new Date().toISOString()}\n`;

        if (finding.service?.eventFirstSeen) {
            messageText += `*First Seen:* ${finding.service.eventFirstSeen}\n`;
        }
        if (finding.service?.count) {
            messageText += `*Count:* ${finding.service.count}\n`;
        }

        chatMessage = {
            text: messageText,
            cards: [
                {
                    header: {
                        title: `${emoji} GuardDuty Security Finding`,
                        subtitle: `${severityLabel} Severity`,
                    },
                    sections: [
                        {
                            widgets: [
                                {
                                    buttons: [
                                        {
                                            textButton: {
                                                text: 'VIEW IN GUARDDUTY',
                                                onClick: {
                                                    openLink: {
                                                        url: guardDutyUrl,
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
    // Check if this is an error log message from CloudWatch Logs
    else if ('source' in parsedBody && parsedBody.source === 'CloudWatchLogs') {
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

    const parsedUrl = new URL(webhookUrl);
    const postData = JSON.stringify(chatMessage);

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
                    resolve({ statusCode: 200, body: 'Sent to Google Chat' });
                } else {
                    reject(new Error(`Failed to send to Google Chat: ${res.statusCode} - ${responseBody}`));
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
