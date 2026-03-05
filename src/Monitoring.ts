import { Construct } from 'constructs';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';
import { LogGroup, RetentionDays, type ILogGroup, MetricFilter, FilterPattern } from 'aws-cdk-lib/aws-logs';
import { Topic, type ITopic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Alarm, ComparisonOperator, TreatMissingData, type IAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Function as LambdaFunction, Runtime, Code, type IFunction } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

/**
 * Configuration options for CloudWatch Log Group
 */
export interface LogGroupConfig {
    /**
     * The name of the log group (default: auto-generated)
     */
    readonly logGroupName?: string;

    /**
     * How long to retain logs (default: 7 days)
     */
    readonly retention?: RetentionDays;

    /**
     * Removal policy for the log group (default: DESTROY)
     */
    readonly removalPolicy?: RemovalPolicy;
}

/**
 * Configuration for metric filter
 */
export interface MetricFilterConfig {
    /**
     * The log group to create the filter on
     */
    readonly logGroup: ILogGroup;

    /**
     * The filter pattern to match log events
     * Common patterns: ERROR, Exception, "task timed out"
     */
    readonly filterPattern: string;

    /**
     * The name of the metric (default: auto-generated)
     */
    readonly metricName?: string;

    /**
     * The namespace for the metric (default: 'CustomMetrics')
     */
    readonly metricNamespace?: string;

    /**
     * The value to emit when the pattern matches (default: 1)
     */
    readonly metricValue?: string;
}

/**
 * Configuration for CloudWatch alarm
 */
export interface AlarmConfig {
    /**
     * The metric filter to create an alarm for
     */
    readonly metricFilter: MetricFilter;

    /**
     * The name of the alarm (default: auto-generated)
     */
    readonly alarmName?: string;

    /**
     * The description of the alarm
     */
    readonly alarmDescription?: string;

    /**
     * The threshold for the alarm (default: 1)
     */
    readonly threshold?: number;

    /**
     * Number of periods over which to evaluate (default: 1)
     */
    readonly evaluationPeriods?: number;

    /**
     * The comparison operator (default: GREATER_THAN_OR_EQUAL_TO_THRESHOLD)
     */
    readonly comparisonOperator?: ComparisonOperator;

    /**
     * How to treat missing data (default: NOT_BREACHING)
     */
    readonly treatMissingData?: TreatMissingData;
}

/**
 * Configuration for SNS topic
 */
export interface SnsTopicConfig {
    /**
     * The name of the topic (default: auto-generated)
     */
    readonly topicName?: string;

    /**
     * The display name for the topic
     */
    readonly displayName?: string;
}

/**
 * Configuration for Slack notification Lambda
 */
export interface SlackNotificationConfig {
    /**
     * The Slack webhook URL (should be stored in environment variable or Secrets Manager)
     */
    readonly slackWebhookUrl: string;

    /**
     * Optional Slack channel (default: from webhook)
     */
    readonly slackChannel?: string;

    /**
     * Optional custom message prefix
     */
    readonly messagePrefix?: string;
}

/**
 * Result of creating a complete monitoring setup
 */
export interface MonitoringSetup {
    readonly logGroup: ILogGroup;
    readonly metricFilter: MetricFilter;
    readonly alarm: Alarm;
    readonly snsTopic: ITopic;
    readonly slackFunction: IFunction;
}

export class Monitoring extends Construct {

    constructor(scope: Construct, id: string) {
        super(scope, id);
    }

    /**
     * Creates a CloudWatch Log Group with sensible defaults
     * 
     * @param scope - The construct scope
     * @param id - The construct id
     * @param config - Optional configuration for the log group
     * @returns The created CloudWatch Log Group
     * 
     * @example
     * ```typescript
     * const logGroup = Monitoring.createLogGroup(this, 'MyAppLogs', {
     *   logGroupName: '/aws/lambda/my-function',
     *   retention: RetentionDays.ONE_WEEK
     * });
     * ```
     */
    static createLogGroup(scope: Construct, id: string, config?: LogGroupConfig): ILogGroup {
        const logGroup = new LogGroup(scope, id, {
            logGroupName: config?.logGroupName,
            retention: config?.retention ?? RetentionDays.ONE_WEEK,
            removalPolicy: config?.removalPolicy ?? RemovalPolicy.DESTROY,
        });

        return logGroup;
    }

    /**
     * Creates a metric filter to extract metrics from log patterns
     * 
     * @param scope - The construct scope
     * @param id - The construct id
     * @param config - Configuration for the metric filter
     * @returns The created metric filter
     * 
     * @example
     * ```typescript
     * const filter = Monitoring.createMetricFilter(this, 'ErrorFilter', {
     *   logGroup: myLogGroup,
     *   filterPattern: 'ERROR',
     *   metricName: 'ErrorCount',
     *   metricNamespace: 'MyApp'
     * });
     * ```
     */
    static createMetricFilter(scope: Construct, id: string, config: MetricFilterConfig): MetricFilter {
        const filter = new MetricFilter(scope, id, {
            logGroup: config.logGroup,
            filterPattern: FilterPattern.anyTerm(config.filterPattern),
            metricName: config.metricName ?? `${id}Metric`,
            metricNamespace: config.metricNamespace ?? 'CustomMetrics',
            metricValue: config.metricValue ?? '1',
        });

        return filter;
    }

    /**
     * Creates a CloudWatch alarm for a metric filter
     * 
     * @param scope - The construct scope
     * @param id - The construct id
     * @param config - Configuration for the alarm
     * @returns The created alarm
     * 
     * @example
     * ```typescript
     * const alarm = Monitoring.createAlarm(this, 'ErrorAlarm', {
     *   metricFilter: errorFilter,
     *   alarmName: 'HighErrorRate',
     *   threshold: 5,
     *   evaluationPeriods: 2
     * });
     * ```
     */
    static createAlarm(scope: Construct, id: string, config: AlarmConfig): Alarm {
        const alarm = new Alarm(scope, id, {
            alarmName: config.alarmName,
            alarmDescription: config.alarmDescription,
            metric: config.metricFilter.metric({
                statistic: 'Sum',
                period: Duration.minutes(5),
            }),
            threshold: config.threshold ?? 1,
            evaluationPeriods: config.evaluationPeriods ?? 1,
            comparisonOperator: config.comparisonOperator ?? ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: config.treatMissingData ?? TreatMissingData.NOT_BREACHING,
        });

        return alarm;
    }

    /**
     * Creates an SNS topic for notifications
     * 
     * @param scope - The construct scope
     * @param id - The construct id
     * @param config - Optional configuration for the SNS topic
     * @returns The created SNS topic
     * 
     * @example
     * ```typescript
     * const topic = Monitoring.createSnsTopic(this, 'AlarmTopic', {
     *   topicName: 'app-alarms',
     *   displayName: 'Application Alarms'
     * });
     * ```
     */
    static createSnsTopic(scope: Construct, id: string, config?: SnsTopicConfig): ITopic {
        const topic = new Topic(scope, id, {
            topicName: config?.topicName,
            displayName: config?.displayName,
        });

        return topic;
    }

    /**
     * Creates a Lambda function to send SNS notifications to Slack
     * 
     * @param scope - The construct scope
     * @param id - The construct id
     * @param config - Configuration for Slack notifications
     * @returns The created Lambda function
     * 
     * @example
     * ```typescript
     * const slackFunction = Monitoring.createSlackNotifier(this, 'SlackNotifier', {
     *   slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
     *   slackChannel: '#alerts',
     *   messagePrefix: '[PROD]'
     * });
     * ```
     */
    static createSlackNotifier(scope: Construct, id: string, config: SlackNotificationConfig): IFunction {
        const slackFunction = new LambdaFunction(scope, id, {
            runtime: Runtime.NODEJS_24_X,
            handler: 'index.handler',
            code: Code.fromInline(`
const https = require('https');
const url = require('url');

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const channel = process.env.SLACK_CHANNEL;
    const messagePrefix = process.env.MESSAGE_PREFIX || '';
    
    if (!webhookUrl) {
        throw new Error('SLACK_WEBHOOK_URL environment variable is required');
    }
    
    const message = event.Records[0].Sns;
    const subject = message.Subject || 'AWS Notification';
    const body = message.Message;
    
    let parsedBody;
    try {
        parsedBody = JSON.parse(body);
    } catch (e) {
        parsedBody = { message: body };
    }
    
    const alarmName = parsedBody.AlarmName || 'Unknown Alarm';
    const newState = parsedBody.NewStateValue || 'ALARM';
    const reason = parsedBody.NewStateReason || 'No reason provided';
    const timestamp = parsedBody.StateChangeTime || new Date().toISOString();
    
    const color = newState === 'ALARM' ? 'danger' : newState === 'OK' ? 'good' : 'warning';
    
    const slackMessage = {
        channel: channel,
        username: 'AWS CloudWatch',
        icon_emoji: ':warning:',
        attachments: [{
            color: color,
            title: \`\${messagePrefix} \${alarmName}\`,
            text: reason,
            fields: [
                { title: 'State', value: newState, short: true },
                { title: 'Time', value: timestamp, short: true }
            ],
            footer: 'AWS CloudWatch Alarms',
            ts: Math.floor(Date.parse(timestamp) / 1000)
        }]
    };
    
    const parsedUrl = url.parse(webhookUrl);
    const postData = JSON.stringify(slackMessage);
    
    const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('Successfully sent to Slack');
                    resolve({ statusCode: 200, body: 'Sent to Slack' });
                } else {
                    console.error('Failed to send to Slack:', res.statusCode, responseBody);
                    reject(new Error(\`Failed to send to Slack: \${res.statusCode}\`));
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('Error sending to Slack:', error);
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
};
            `),
            environment: {
                SLACK_WEBHOOK_URL: config.slackWebhookUrl,
                SLACK_CHANNEL: config.slackChannel ?? '',
                MESSAGE_PREFIX: config.messagePrefix ?? '',
            },
            timeout: Duration.seconds(30),
        });

        return slackFunction;
    }

    /**
     * Creates a complete monitoring setup: log filter → alarm → SNS → Slack
     * 
     * @param scope - The construct scope
     * @param id - The construct id prefix
     * @param config - Combined configuration object
     * @returns Object containing all created resources
     * 
     * @example
     * ```typescript
     * const monitoring = Monitoring.createErrorMonitoring(this, 'ErrorMonitoring', {
     *   logGroup: myLogGroup,
     *   filterPattern: 'ERROR',
     *   slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
     *   slackChannel: '#alerts',
     *   threshold: 3
     * });
     * ```
     */
    static createErrorMonitoring(
        scope: Construct,
        id: string,
        config: {
            logGroup: ILogGroup;
            filterPattern: string;
            slackWebhookUrl: string;
            slackChannel?: string;
            messagePrefix?: string;
            metricName?: string;
            metricNamespace?: string;
            threshold?: number;
            alarmName?: string;
            alarmDescription?: string;
        }
    ): MonitoringSetup {
        // Create metric filter
        const metricFilter = Monitoring.createMetricFilter(scope, `${id}MetricFilter`, {
            logGroup: config.logGroup,
            filterPattern: config.filterPattern,
            metricName: config.metricName ?? `${id}Count`,
            metricNamespace: config.metricNamespace ?? 'CustomMetrics',
        });

        // Create SNS topic
        const snsTopic = Monitoring.createSnsTopic(scope, `${id}Topic`, {
            topicName: `${id}-topic`,
            displayName: `${id} Notifications`,
        });

        // Create alarm
        const alarm = Monitoring.createAlarm(scope, `${id}Alarm`, {
            metricFilter,
            alarmName: config.alarmName ?? `${id}Alarm`,
            alarmDescription: config.alarmDescription ?? `Alarm for ${config.filterPattern} pattern in logs`,
            threshold: config.threshold ?? 1,
            evaluationPeriods: 1,
        });

        // Add SNS action to alarm
        alarm.addAlarmAction(new SnsAction(snsTopic));

        // Create Slack notifier Lambda
        const slackFunction = Monitoring.createSlackNotifier(scope, `${id}SlackNotifier`, {
            slackWebhookUrl: config.slackWebhookUrl,
            slackChannel: config.slackChannel,
            messagePrefix: config.messagePrefix,
        });

        // Subscribe Lambda to SNS topic
        snsTopic.addSubscription(new LambdaSubscription(slackFunction));

        return {
            logGroup: config.logGroup,
            metricFilter,
            alarm,
            snsTopic,
            slackFunction,
        };
    }
}