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

    let teamsMessage: any;

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

        // Build facts array
        const facts: Array<{ title: string; value: string }> = [
            { title: 'Severity', value: `${severityLabel} (${severity})` },
            { title: 'Type', value: finding.type || 'Unknown' },
            { title: 'Account', value: finding.accountId || ebMessage.account || 'Unknown' },
            { title: 'Region', value: finding.region || ebMessage.region || 'Unknown' },
            { title: 'Time', value: ebMessage.time || new Date().toISOString() },
        ];

        if (finding.service?.eventFirstSeen) {
            facts.push({ title: 'First Seen', value: finding.service.eventFirstSeen });
        }
        if (finding.service?.count) {
            facts.push({ title: 'Count', value: String(finding.service.count) });
        }

        // Use Adaptive Card format
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
                                        text: `${messagePrefix}${messagePrefix ? ' ' : ''}${emoji} GuardDuty Finding`,
                                        weight: 'Bolder',
                                        size: 'Large',
                                        wrap: true,
                                        color: severity >= 7 ? 'Attention' : 'Warning',
                                    },
                                    {
                                        type: 'TextBlock',
                                        text: finding.title || 'Security Finding Detected',
                                        size: 'Medium',
                                        wrap: true,
                                        spacing: 'None',
                                    },
                                ],
                            },
                            {
                                type: 'TextBlock',
                                text: finding.description || 'No description available',
                                wrap: true,
                                spacing: 'Medium',
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
                                title: 'View in GuardDuty',
                                url: guardDutyUrl,
                                style: 'positive',
                            },
                        ],
                    },
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

    const parsedUrl = new URL(webhookUrl);
    const postData = JSON.stringify(teamsMessage);

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
                    resolve({ statusCode: 200, body: 'Sent to Teams' });
                } else {
                    reject(new Error(`Failed to send to Teams: ${res.statusCode} - ${responseBody}`));
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
