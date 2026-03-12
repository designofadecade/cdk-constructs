import { Construct } from 'constructs';
import { Duration, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { type ILogGroup, LogGroup, MetricFilter, FilterPattern, RetentionDays, SubscriptionFilter } from 'aws-cdk-lib/aws-logs';
import { LambdaDestination } from 'aws-cdk-lib/aws-logs-destinations';
import { Topic, type ITopic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Function as LambdaFunction, Runtime, Code, type IFunction } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Rule, type IRule } from 'aws-cdk-lib/aws-events';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Notification handler configuration
 */
export interface NotificationHandler {
    readonly type: 'slack' | 'teams' | 'googlechat';
    /**
     * Direct webhook URL (deprecated - use webhookParameterArn instead)
     */
    readonly webhookUrl?: string;
    /**
     * ARN of the Systems Manager Parameter containing the webhook URL
     * The parameter can be a String or SecureString type
     */
    readonly webhookParameterArn?: string;
    readonly channel?: string;
    readonly messagePrefix?: string;
    readonly functionName?: string;
}

/**
 * GuardDuty severity levels
 */
export type GuardDutySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * GuardDuty monitoring configuration
 */
export interface GuardDutyConfig {
    /**
     * Enable GuardDuty findings monitoring
     * Note: GuardDuty must be enabled in your AWS account
     */
    readonly enabled: boolean;

    /**
     * Minimum severity level to alert on (default: MEDIUM)
     * Findings with this severity or higher will trigger notifications
     */
    readonly minSeverity?: GuardDutySeverity;

    /**
     * EventBridge rule name (default: auto-generated)
     */
    readonly ruleName?: string;

    /**
     * EventBridge rule description
     */
    readonly ruleDescription?: string;
}

/**
 * IAM Access Analyzer monitoring configuration
 */
export interface AccessAnalyzerConfig {
    /**
     * Enable IAM Access Analyzer findings monitoring
     * Note: Access Analyzer must be enabled in your AWS account
     */
    readonly enabled: boolean;

    /**
     * Resource types to monitor (default: all)
     * Examples: 'AWS::S3::Bucket', 'AWS::IAM::Role', 'AWS::KMS::Key', 'AWS::Lambda::Function'
     */
    readonly resourceTypes?: string[];

    /**
     * Only alert on ACTIVE findings (default: true)
     * Set to false to also include ARCHIVED and RESOLVED findings
     */
    readonly activeOnly?: boolean;

    /**
     * EventBridge rule name (default: auto-generated)
     */
    readonly ruleName?: string;

    /**
     * EventBridge rule description
     */
    readonly ruleDescription?: string;
}

/**
 * Configuration options for the Monitoring construct
 */
export interface MonitoringProps {
    /**
     * The stack this monitoring is for (optional)
     */
    readonly stack?: Stack;

    /**
     * SNS topic configuration
     */
    readonly topic?: SnsTopicConfig;

    /**
     * Notification handlers to add to the topic
     */
    readonly notifications?: NotificationHandler[];

    /**
     * Optional name for the shared log error processing function
     */
    readonly logErrorFunctionName?: string;

    /**
     * GuardDuty monitoring configuration
     * When enabled, GuardDuty findings will be sent to the same SNS topic
     */
    readonly guardDuty?: GuardDutyConfig;

    /**
     * IAM Access Analyzer monitoring configuration
     * When enabled, Access Analyzer findings will be sent to the same SNS topic
     */
    readonly accessAnalyzer?: AccessAnalyzerConfig;
}

/**
 * Configuration for CloudWatch alarm
 */
export interface AlarmConfig {
    /**
     * The metric filter to create an alarm for
     * Either metricFilter or metric must be provided
     */
    readonly metricFilter?: MetricFilter;

    /**
     * The metric to create an alarm for (alternative to metricFilter)
     * Either metricFilter or metric must be provided
     */
    readonly metric?: import('aws-cdk-lib/aws-cloudwatch').IMetric;

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
 * Configuration for CloudWatch Log Group
 */
export interface LogGroupConfig {
    /**
     * The name of the log group (default: auto-generated)
     */
    readonly logGroupName?: string;

    /**
     * The retention period for logs (default: 7 days)
     */
    readonly retention?: RetentionDays;

    /**
     * The removal policy (default: DESTROY)
     */
    readonly removalPolicy?: RemovalPolicy;
}

export class Monitoring extends Construct {
    /**
     * GuardDuty minimum severity: LOW (1.0-3.9)
     */
    public static readonly GUARD_DUTY_MIN_SEVERITY_LOW: GuardDutySeverity = 'LOW';

    /**
     * GuardDuty minimum severity: MEDIUM (4.0-6.9)
     */
    public static readonly GUARD_DUTY_MIN_SEVERITY_MEDIUM: GuardDutySeverity = 'MEDIUM';

    /**
     * GuardDuty minimum severity: HIGH (7.0-8.9)
     */
    public static readonly GUARD_DUTY_MIN_SEVERITY_HIGH: GuardDutySeverity = 'HIGH';

    /**
     * GuardDuty minimum severity: CRITICAL (9.0+)
     */
    public static readonly GUARD_DUTY_MIN_SEVERITY_CRITICAL: GuardDutySeverity = 'CRITICAL';

    /**
     * The SNS topic for this monitoring setup
     */
    public readonly topic: ITopic;

    /**
     * List of notification functions
     */
    public readonly notificationFunctions: IFunction[] = [];

    /**
     * List of alarms
     */
    public readonly alarms: Alarm[] = [];

    /**
     * GuardDuty EventBridge rule (if enabled)
     */
    public readonly guardDutyRule?: IRule;

    /**
     * IAM Access Analyzer EventBridge rule (if enabled)
     */
    public readonly accessAnalyzerRule?: IRule;

    /**
     * Shared Lambda function for processing log errors
     * Created lazily on first use
     */
    private logErrorFunction?: IFunction;

    /**
     * Configuration props stored for lazy initialization
     */
    private readonly props?: MonitoringProps;

    constructor(scope: Construct, id: string, props?: MonitoringProps) {
        super(scope, id);
        this.props = props;

        // Create SNS topic
        this.topic = new Topic(this, 'Topic', {
            topicName: props?.topic?.topicName,
            displayName: props?.topic?.displayName,
        });

        // Add notification handlers
        if (props?.notifications) {
            for (const notification of props.notifications) {
                const handler = this.createNotificationFunction(notification);
                this.topic.addSubscription(new LambdaSubscription(handler));
                this.notificationFunctions.push(handler);
            }
        }

        // Setup GuardDuty monitoring if enabled
        if (props?.guardDuty?.enabled) {
            this.guardDutyRule = this.createGuardDutyRule(props.guardDuty);
        }

        // Setup Access Analyzer monitoring if enabled
        if (props?.accessAnalyzer?.enabled) {
            this.accessAnalyzerRule = this.createAccessAnalyzerRule(props.accessAnalyzer);
        }
    }

    /**
     * Creates a notification function based on the handler type
     */
    private createNotificationFunction(config: NotificationHandler): IFunction {
        const id = `${config.type.charAt(0).toUpperCase() + config.type.slice(1)}Notifier`;

        switch (config.type) {
            case 'slack':
                return this.createSlackFunction(id, config);
            case 'teams':
                return this.createTeamsFunction(id, config);
            case 'googlechat':
                return this.createGoogleChatFunction(id, config);
            default:
                throw new Error(`Unknown notification type: ${config.type}`);
        }
    }

    /**
     * Creates a Slack notification function
     */
    private createSlackFunction(id: string, config: NotificationHandler): IFunction {
        if (!config.webhookUrl && !config.webhookParameterArn) {
            throw new Error('Either webhookUrl or webhookParameterArn must be provided');
        }

        const environment: Record<string, string> = {
            SLACK_CHANNEL: config.channel ?? '',
            MESSAGE_PREFIX: config.messagePrefix ?? '',
        };

        if (config.webhookUrl) {
            environment.SLACK_WEBHOOK_URL = config.webhookUrl;
        }
        if (config.webhookParameterArn) {
            environment.WEBHOOK_PARAMETER_ARN = config.webhookParameterArn;
        }

        const fn = new LambdaFunction(this, id, {
            runtime: Runtime.NODEJS_24_X,
            handler: 'handler.handler',
            code: Code.fromAsset(join(__dirname, 'assets/functions/monitoring/slack-notifier')),
            functionName: config.functionName,
            environment,
            timeout: Duration.seconds(30),
        });

        // Grant permission to read from SSM if parameter ARN is provided
        if (config.webhookParameterArn) {
            fn.addToRolePolicy(new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'ssm:GetParameter',
                    'ssm:GetParameters',
                ],
                resources: [config.webhookParameterArn],
            }));
            // Add KMS decrypt permission for SecureString parameters
            fn.addToRolePolicy(new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['kms:Decrypt'],
                resources: ['*'],
                conditions: {
                    StringEquals: {
                        'kms:ViaService': `ssm.${Stack.of(this).region}.amazonaws.com`,
                    },
                },
            }));
        }

        return fn;
    }

    /**
     * Creates a Teams notification function
     */
    private createTeamsFunction(id: string, config: NotificationHandler): IFunction {
        if (!config.webhookUrl && !config.webhookParameterArn) {
            throw new Error('Either webhookUrl or webhookParameterArn must be provided');
        }

        const environment: Record<string, string> = {
            MESSAGE_PREFIX: config.messagePrefix ?? '',
        };

        if (config.webhookUrl) {
            environment.WEBHOOK_URL = config.webhookUrl;
        }
        if (config.webhookParameterArn) {
            environment.WEBHOOK_PARAMETER_ARN = config.webhookParameterArn;
        }

        const fn = new LambdaFunction(this, id, {
            runtime: Runtime.NODEJS_24_X,
            handler: 'handler.handler',
            code: Code.fromAsset(join(__dirname, 'assets/functions/monitoring/teams-notifier')),
            functionName: config.functionName,
            environment,
            timeout: Duration.seconds(30),
        });

        // Grant permission to read from SSM if parameter ARN is provided
        if (config.webhookParameterArn) {
            fn.addToRolePolicy(new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'ssm:GetParameter',
                    'ssm:GetParameters',
                ],
                resources: [config.webhookParameterArn],
            }));
            // Add KMS decrypt permission for SecureString parameters
            fn.addToRolePolicy(new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['kms:Decrypt'],
                resources: ['*'],
                conditions: {
                    StringEquals: {
                        'kms:ViaService': `ssm.${Stack.of(this).region}.amazonaws.com`,
                    },
                },
            }));
        }

        return fn;
    }

    /**
     * Creates a Google Chat notification function
     */
    private createGoogleChatFunction(id: string, config: NotificationHandler): IFunction {
        if (!config.webhookUrl && !config.webhookParameterArn) {
            throw new Error('Either webhookUrl or webhookParameterArn must be provided');
        }

        const environment: Record<string, string> = {
            MESSAGE_PREFIX: config.messagePrefix ?? '',
        };

        if (config.webhookUrl) {
            environment.WEBHOOK_URL = config.webhookUrl;
        }
        if (config.webhookParameterArn) {
            environment.WEBHOOK_PARAMETER_ARN = config.webhookParameterArn;
        }

        const fn = new LambdaFunction(this, id, {
            runtime: Runtime.NODEJS_24_X,
            handler: 'handler.handler',
            code: Code.fromAsset(join(__dirname, 'assets/functions/monitoring/googlechat-notifier')),
            functionName: config.functionName,
            environment,
            timeout: Duration.seconds(30),
        });

        // Grant permission to read from SSM if parameter ARN is provided
        if (config.webhookParameterArn) {
            fn.addToRolePolicy(new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'ssm:GetParameter',
                    'ssm:GetParameters',
                ],
                resources: [config.webhookParameterArn],
            }));
            // Add KMS decrypt permission for SecureString parameters
            fn.addToRolePolicy(new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['kms:Decrypt'],
                resources: ['*'],
                conditions: {
                    StringEquals: {
                        'kms:ViaService': `ssm.${Stack.of(this).region}.amazonaws.com`,
                    },
                },
            }));
        }

        return fn;
    }

    /**
     * Creates an EventBridge rule to monitor GuardDuty findings
     */
    private createGuardDutyRule(config: GuardDutyConfig): IRule {
        const minSeverity = config.minSeverity ?? 'MEDIUM';
        const severityMap: Record<GuardDutySeverity, number> = {
            'LOW': 1,
            'MEDIUM': 4,
            'HIGH': 7,
            'CRITICAL': 8.5,
        };

        const minSeverityValue = severityMap[minSeverity];

        // Create EventBridge rule for GuardDuty findings
        // See: https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_findings_cloudwatch.html
        const rule = new Rule(this, 'GuardDutyRule', {
            ruleName: config.ruleName,
            description: config.ruleDescription ?? `GuardDuty findings with severity >= ${minSeverity}`,
            eventPattern: {
                source: ['aws.guardduty'],
                detailType: ['GuardDuty Finding'],
                detail: {
                    severity: [
                        {
                            // Match numeric range based on severity
                            // LOW: 1-3.9, MEDIUM: 4-6.9, HIGH: 7-8.9, CRITICAL: 9+
                            numeric: ['>=', minSeverityValue],
                        },
                    ],
                },
            },
        });

        // Add SNS topic as target
        rule.addTarget(new SnsTopic(this.topic));

        return rule;
    }

    /**
     * Creates an EventBridge rule to monitor IAM Access Analyzer findings
     */
    private createAccessAnalyzerRule(config: AccessAnalyzerConfig): IRule {
        const activeOnly = config.activeOnly ?? true;

        // Build event pattern based on configuration
        const detail: any = {};

        // Filter by status (ACTIVE only by default)
        if (activeOnly) {
            detail.status = ['ACTIVE'];
        }

        // Filter by resource types if specified
        if (config.resourceTypes && config.resourceTypes.length > 0) {
            detail.resourceType = config.resourceTypes;
        }

        // Create EventBridge rule for Access Analyzer findings
        // See: https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-eventbridge.html
        const rule = new Rule(this, 'AccessAnalyzerRule', {
            ruleName: config.ruleName,
            description: config.ruleDescription ?? 'IAM Access Analyzer findings for unintended resource access',
            eventPattern: {
                source: ['aws.access-analyzer'],
                detailType: ['Access Analyzer Finding'],
                detail: Object.keys(detail).length > 0 ? detail : undefined,
            },
        });

        // Add SNS topic as target
        rule.addTarget(new SnsTopic(this.topic));

        return rule;
    }

    /**
     * Gets or creates the shared Lambda function for processing log errors
     * This function is reused across all log subscriptions
     */
    private getOrCreateLogErrorFunction(): IFunction {
        if (!this.logErrorFunction) {
            this.logErrorFunction = new LambdaFunction(this, 'LogErrorFunction', {
                runtime: Runtime.NODEJS_24_X,
                handler: 'handler.handler',
                code: Code.fromAsset(join(__dirname, 'assets/functions/monitoring/log-error-notifier')),
                functionName: this.props?.logErrorFunctionName,
                environment: {
                    SNS_TOPIC_ARN: this.topic.topicArn,
                },
                timeout: Duration.seconds(30),
                description: 'Processes error logs and publishes to SNS',
            });

            // Grant publish permission to SNS topic
            this.topic.grantPublish(this.logErrorFunction);
        }

        return this.logErrorFunction;
    }

    /**
     * Creates an alarm and adds it to this monitoring setup
     */
    public addAlarm(id: string, config: AlarmConfig): Alarm {
        if (!config.metricFilter && !config.metric) {
            throw new Error('Either metricFilter or metric must be provided in AlarmConfig');
        }

        // Get the metric from either metricFilter or direct metric
        const metric = config.metric ?? config.metricFilter!.metric({
            statistic: 'Sum',
            period: Duration.minutes(5),
        });

        const alarm = new Alarm(this, id, {
            alarmName: config.alarmName,
            alarmDescription: config.alarmDescription,
            metric,
            threshold: config.threshold ?? 1,
            evaluationPeriods: config.evaluationPeriods ?? 1,
            comparisonOperator: config.comparisonOperator ?? ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: config.treatMissingData ?? TreatMissingData.NOT_BREACHING,
        });

        alarm.addAlarmAction(new SnsAction(this.topic));
        this.alarms.push(alarm);
        return alarm;
    }

    /**
     * Creates an alarm from a metric and adds it to this monitoring setup
     * This is a convenience method for creating alarms from Lambda or other AWS service metrics
     * 
     * @example
     * ```typescript
     * monitoring.addMetricAlarm('FunctionErrors', {
     *   metric: myFunction.metricErrors(),
     *   threshold: 5,
     *   alarmName: 'MyFunction-Errors',
     *   alarmDescription: 'Alert when function has more than 5 errors',
     * });
     * ```
     */
    public addMetricAlarm(
        id: string,
        config: {
            metric: import('aws-cdk-lib/aws-cloudwatch').IMetric;
            alarmName?: string;
            alarmDescription?: string;
            threshold?: number;
            evaluationPeriods?: number;
            comparisonOperator?: ComparisonOperator;
            treatMissingData?: TreatMissingData;
        }
    ): Alarm {
        return this.addAlarm(id, config);
    }

    /**
     * Creates a metric filter on a log group and adds an alarm for it
     */
    public addLogAlarm(
        id: string,
        config: {
            logGroup: ILogGroup;
            filterPattern: string;
            metricName?: string;
            metricNamespace?: string;
            threshold?: number;
            alarmName?: string;
            alarmDescription?: string;
        }
    ): { metricFilter: MetricFilter; alarm: Alarm } {
        // Create metric filter
        const metricFilter = new MetricFilter(this, `${id}MetricFilter`, {
            logGroup: config.logGroup,
            filterPattern: FilterPattern.anyTerm(config.filterPattern),
            metricName: config.metricName ?? `${id}Count`,
            metricNamespace: config.metricNamespace ?? 'CustomMetrics',
            metricValue: '1',
        });

        // Create alarm
        const alarm = this.addAlarm(`${id}Alarm`, {
            metricFilter,
            alarmName: config.alarmName ?? `${id}Alarm`,
            alarmDescription: config.alarmDescription ?? `Alarm for ${config.filterPattern} pattern in logs`,
            threshold: config.threshold ?? 1,
            evaluationPeriods: 1,
        });

        return { metricFilter, alarm };
    }

    /**
     * Monitors a CloudWatch log group for error logs and sends notifications in real-time
     * JSON logs are parsed automatically to extract error details
     * 
     * Multiple monitors share the same Lambda function for efficiency.
     * 
     * @param id - Unique identifier for this monitor
     * @param config - Configuration for the error log monitor
     * @returns Object containing the subscription filter and shared Lambda function
     * 
     * @example
     * ```typescript
     * const monitoring = new Monitoring(this, 'Monitoring', {
     *   notifications: [
     *     Monitoring.slackNotifier({
     *       slackWebhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
     *       slackChannel: '#alerts',
     *     }),
     *   ],
     * });
     * 
     * monitoring.monitorErrors('ApiErrors', {
     *   logGroup: myFunction.logGroup,
     * });
     * ```
     */
    public monitorErrors(
        id: string,
        config: {
            /**
             * The log group to monitor
             */
            logGroup: ILogGroup;
            /**
             * The JSON field to check (default: "level")
             */
            levelField?: string;
            /**
             * The error level values to match (default: ["ERROR"])
             * Can include multiple levels like ["ERROR", "FATAL", "CRITICAL"]
             */
            errorLevels?: string[];
            /**
             * Subscription filter name (default: auto-generated)
             */
            filterName?: string;
        }
    ): { subscriptionFilter: SubscriptionFilter; logFunction: IFunction } {
        const levelField = config.levelField ?? 'level';
        const errorLevels = config.errorLevels ?? ['ERROR'];

        // Create filter pattern for JSON logs with ERROR level
        // Matches logs like: {"level":"ERROR","timestamp":"...","message":"..."}
        const filterPattern = errorLevels.length === 1
            ? FilterPattern.stringValue(`$.${levelField}`, '=', errorLevels[0])
            : FilterPattern.any(
                ...errorLevels.map(level =>
                    FilterPattern.stringValue(`$.${levelField}`, '=', level)
                )
            );

        // Get or create the shared Lambda function
        const logFunction = this.getOrCreateLogErrorFunction();

        // Create subscription filter
        const subscriptionFilter = new SubscriptionFilter(this, `${id}Subscription`, {
            logGroup: config.logGroup,
            destination: new LambdaDestination(logFunction),
            filterPattern,
            filterName: config.filterName,
        });

        return { subscriptionFilter, logFunction };
    }

    /**
     * Creates a CloudWatch Log Group with configurable retention
     */
    static createLogGroup(scope: Construct, id: string, config?: LogGroupConfig): ILogGroup {
        return new LogGroup(scope, id, {
            logGroupName: config?.logGroupName,
            retention: config?.retention ?? RetentionDays.ONE_WEEK,
            removalPolicy: config?.removalPolicy ?? RemovalPolicy.DESTROY,
        });
    }

    /**
     * Static factory method to create a Slack notifier configuration
     * 
     * @example With direct webhook URL (deprecated, use parameter ARN for better security):
     * ```typescript
     * Monitoring.slackNotifier({
     *   slackWebhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
     *   slackChannel: '#alerts',
     * })
     * ```
     * 
     * @example With Systems Manager Parameter ARN (recommended):
     * ```typescript
     * Monitoring.slackNotifier({
     *   webhookParameterArn: 'arn:aws:ssm:us-east-1:123456789012:parameter/slack-webhook',
     *   slackChannel: '#alerts',
     * })
     * ```
     */
    static slackNotifier(config: {
        slackWebhookUrl?: string;
        webhookParameterArn?: string;
        slackChannel?: string;
        messagePrefix?: string;
        functionName?: string;
    }): NotificationHandler {
        return {
            type: 'slack',
            webhookUrl: config.slackWebhookUrl,
            webhookParameterArn: config.webhookParameterArn,
            channel: config.slackChannel,
            messagePrefix: config.messagePrefix,
            functionName: config.functionName,
        };
    }

    /**
     * Static factory method to create a Teams notifier configuration
     * 
     * @example With direct webhook URL (deprecated, use parameter ARN for better security):
     * ```typescript
     * Monitoring.teamsNotifier({
     *   webhookUrl: 'https://outlook.office.com/webhook/YOUR-WEBHOOK-URL',
     * })
     * ```
     * 
     * @example With Systems Manager Parameter ARN (recommended):
     * ```typescript
     * Monitoring.teamsNotifier({
     *   webhookParameterArn: 'arn:aws:ssm:us-east-1:123456789012:parameter/teams-webhook',
     * })
     * ```
     */
    static teamsNotifier(config: {
        webhookUrl?: string;
        webhookParameterArn?: string;
        messagePrefix?: string;
        functionName?: string;
    }): NotificationHandler {
        return {
            type: 'teams',
            webhookUrl: config.webhookUrl,
            webhookParameterArn: config.webhookParameterArn,
            messagePrefix: config.messagePrefix,
            functionName: config.functionName,
        };
    }

    /**
     * Static factory method to create a Google Chat notifier configuration
     * 
     * @example With direct webhook URL (deprecated, use parameter ARN for better security):
     * ```typescript
     * Monitoring.googleChatNotifier({
     *   webhookUrl: 'https://chat.googleapis.com/v1/spaces/YOUR-WEBHOOK-URL',
     * })
     * ```
     * 
     * @example With Systems Manager Parameter ARN (recommended):
     * ```typescript
     * Monitoring.googleChatNotifier({
     *   webhookParameterArn: 'arn:aws:ssm:us-east-1:123456789012:parameter/googlechat-webhook',
     * })
     * ```
     */
    static googleChatNotifier(config: {
        webhookUrl?: string;
        webhookParameterArn?: string;
        messagePrefix?: string;
        functionName?: string;
    }): NotificationHandler {
        return {
            type: 'googlechat',
            webhookUrl: config.webhookUrl,
            webhookParameterArn: config.webhookParameterArn,
            messagePrefix: config.messagePrefix,
            functionName: config.functionName,
        };
    }
}