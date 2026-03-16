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

interface AccessAnalyzerFinding {
    id?: string;
    status?: 'ACTIVE' | 'ARCHIVED' | 'RESOLVED';
    resourceType?: string;
    resourceOwnerAccount?: string;
    resource?: string;
    principal?: Record<string, any>;
    action?: string[];
    condition?: Record<string, any>;
    findingType?: string;
    isPublic?: boolean;
    createdAt?: string;
    analyzedAt?: string;
    updatedAt?: string;
    error?: string;
}

interface EventBridgeMessage {
    version?: string;
    id?: string;
    'detail-type'?: string;
    source?: string;
    account?: string;
    time?: string;
    region?: string;
    detail?: GuardDutyFinding | AccessAnalyzerFinding;
}

// Type guard to check if finding is a GuardDuty finding
function isGuardDutyFinding(finding: GuardDutyFinding | AccessAnalyzerFinding): finding is GuardDutyFinding {
    return 'severity' in finding || 'type' in finding || 'service' in finding;
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

    // Log the raw message for debugging
    console.log('SNS Subject:', subject);
    console.log('SNS Message Body:', body);

    let parsedBody: CloudWatchAlarmMessage | CloudWatchLogMessage | EventBridgeMessage;
    try {
        parsedBody = JSON.parse(body);
        console.log('Parsed message:', JSON.stringify(parsedBody, null, 2));
    } catch (e) {
        console.log('Failed to parse message as JSON, treating as plain text');
        parsedBody = { AlarmName: body };
    }

    let slackMessage;

    // Check if this is an Access Analyzer finding from EventBridge
    if ('detail-type' in parsedBody && parsedBody['detail-type'] === 'Access Analyzer Finding' && parsedBody.detail) {
        const ebMessage = parsedBody as EventBridgeMessage;
        const finding = ebMessage.detail as AccessAnalyzerFinding;

        const status = finding.status || 'ACTIVE';
        const isActive = status === 'ACTIVE';
        const emoji = isActive ? ':warning:' : ':white_check_mark:';
        const color = isActive ? 'warning' : 'good';

        // Build IAM Access Analyzer console URL
        const findingId = finding.id || '';
        const findingRegion = ebMessage.region || region;
        const analyzerUrl = findingId
            ? `https://${findingRegion}.console.aws.amazon.com/access-analyzer/home?region=${findingRegion}#/findings/${encodeURIComponent(findingId)}`
            : `https://${findingRegion}.console.aws.amazon.com/access-analyzer/home?region=${findingRegion}`;

        // Extract principal information
        const principalStr = finding.principal ? Object.entries(finding.principal)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join(', ') : 'Unknown';

        const fields: { title: string; value: string; short: boolean }[] = [
            { title: 'Status', value: status, short: false },
            { title: 'Resource Type', value: finding.resourceType || 'Unknown', short: false },
            { title: 'Resource', value: finding.resource || 'Unknown', short: false },
            { title: 'Principal', value: principalStr, short: false },
            { title: 'Finding Type', value: finding.findingType || 'Unknown', short: false },
        ];

        if (finding.isPublic !== undefined) {
            fields.push({ title: 'Public Access', value: finding.isPublic ? 'Yes' : 'No', short: false });
        }
        if (finding.action && finding.action.length > 0) {
            fields.push({ title: 'Actions', value: finding.action.join(', '), short: false });
        }
        if (finding.createdAt) {
            fields.push({ title: 'Created', value: finding.createdAt, short: false });
        }

        slackMessage = {
            channel: channel,
            username: 'AWS Access Analyzer',
            icon_emoji: ':mag:',
            attachments: [
                {
                    color,
                    title: `${messagePrefix}${messagePrefix ? ' ' : ''}${emoji} IAM Access Analyzer Finding`,
                    text: `Unintended resource access detected for ${finding.resourceType || 'resource'}`,
                    fields,
                    footer: 'AWS IAM Access Analyzer',
                    ts: Math.floor(Date.parse(ebMessage.time || new Date().toISOString()) / 1000),
                    actions: [
                        {
                            type: 'button',
                            text: 'View in Access Analyzer',
                            url: analyzerUrl,
                        },
                    ],
                },
            ],
        };
    }
    // Check if this is a GuardDuty finding from EventBridge
    else if ('detail-type' in parsedBody && parsedBody['detail-type'] === 'GuardDuty Finding' && parsedBody.detail) {
        const ebMessage = parsedBody as EventBridgeMessage;
        const finding = ebMessage.detail!;

        if (!isGuardDutyFinding(finding)) {
            throw new Error('Invalid GuardDuty finding structure');
        }

        const severity = finding.severity || 0;
        const severityLabel = severity >= 7 ? 'HIGH' : severity >= 4 ? 'MEDIUM' : 'LOW';
        const emoji = severity >= 7 ? ':red_circle:' : severity >= 4 ? ':large_orange_circle:' : ':large_yellow_circle:';

        // Build GuardDuty console URL
        const findingId = finding.id || '';
        const detectorId = finding.service?.detectorId || '';
        const findingRegion = ebMessage.region || region;
        const guardDutyUrl = detectorId && findingId
            ? `https://${findingRegion}.console.aws.amazon.com/guardduty/home?region=${findingRegion}#/findings?search=id%3D${findingId}`
            : `https://${findingRegion}.console.aws.amazon.com/guardduty/home?region=${findingRegion}`;

        const color = severity >= 7 ? 'danger' : severity >= 4 ? 'warning' : '#FFD700';

        const fields: { title: string; value: string; short: boolean }[] = [
            { title: 'Severity', value: `${severityLabel} (${severity})`, short: false },
            { title: 'Type', value: finding.type || 'Unknown', short: false },
            { title: 'Account', value: finding.accountId || ebMessage.account || 'Unknown', short: false },
            { title: 'Region', value: finding.region || ebMessage.region || 'Unknown', short: false },
        ];

        if (finding.service?.eventFirstSeen) {
            fields.push({ title: 'First Seen', value: finding.service.eventFirstSeen, short: false });
        }
        if (finding.service?.count) {
            fields.push({ title: 'Count', value: String(finding.service.count), short: false });
        }

        slackMessage = {
            channel: channel,
            username: 'AWS GuardDuty',
            icon_emoji: ':shield:',
            attachments: [
                {
                    color,
                    title: `${messagePrefix}${messagePrefix ? ' ' : ''}${emoji} ${finding.title || 'GuardDuty Finding'}`,
                    text: finding.description || 'Security finding detected',
                    fields,
                    footer: 'AWS GuardDuty',
                    ts: Math.floor(Date.parse(ebMessage.time || new Date().toISOString()) / 1000),
                    actions: [
                        {
                            type: 'button',
                            text: 'View in GuardDuty',
                            url: guardDutyUrl,
                        },
                    ],
                },
            ],
        };
    }
    // Check if this is a CloudWatch Logs message
    else if ('source' in parsedBody && parsedBody.source === 'CloudWatchLogs') {
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
            { title: 'Level', value: logMsg.errorLevel, short: false },
            { title: 'Time', value: logMsg.timestamp, short: false },
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
                    fields.push({ title: key, value, short: false });
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
        // Use Subject as fallback for alarm name (Subject often contains "ALARM: <AlarmName> in <Region>")
        let alarmName = alarmMsg.AlarmName || 'Unknown Alarm';
        if (alarmName === 'Unknown Alarm' && subject && subject.includes('ALARM:')) {
            // Extract alarm name from subject like "ALARM: MyAlarmName in us-east-1"
            const match = subject.match(/ALARM:\s*(.+?)(?:\s+in\s+|$)/);
            if (match && match[1]) {
                alarmName = match[1].trim();
            }
        }
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
                        { title: 'State', value: newState, short: false },
                        { title: 'Time', value: timestamp, short: false },
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
