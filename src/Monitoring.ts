import { Construct } from 'constructs';
import { Duration, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { type ILogGroup, LogGroup, MetricFilter, FilterPattern, RetentionDays, SubscriptionFilter } from 'aws-cdk-lib/aws-logs';
import { LambdaDestination } from 'aws-cdk-lib/aws-logs-destinations';
import { Topic, type ITopic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Function as LambdaFunction, Runtime, Code, type IFunction } from 'aws-cdk-lib/aws-lambda';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Notification handler configuration
 */
export interface NotificationHandler {
    readonly type: 'slack' | 'teams' | 'googlechat';
    readonly webhookUrl: string;
    readonly channel?: string;
    readonly messagePrefix?: string;
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
     * Shared Lambda function for processing log errors
     * Created lazily on first use
     */
    private logErrorFunction?: IFunction;

    constructor(scope: Construct, id: string, props?: MonitoringProps) {
        super(scope, id);

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
        return new LambdaFunction(this, id, {
            runtime: Runtime.NODEJS_24_X,
            handler: 'handler.handler',
            code: Code.fromAsset(join(__dirname, 'assets/functions/monitoring/slack-notifier')),
            environment: {
                SLACK_WEBHOOK_URL: config.webhookUrl,
                SLACK_CHANNEL: config.channel ?? '',
                MESSAGE_PREFIX: config.messagePrefix ?? '',
            },
            timeout: Duration.seconds(30),
        });
    }

    /**
     * Creates a Teams notification function
     */
    private createTeamsFunction(id: string, config: NotificationHandler): IFunction {
        return new LambdaFunction(this, id, {
            runtime: Runtime.NODEJS_24_X,
            handler: 'handler.handler',
            code: Code.fromAsset(join(__dirname, 'assets/functions/monitoring/teams-notifier')),
            environment: {
                WEBHOOK_URL: config.webhookUrl,
                MESSAGE_PREFIX: config.messagePrefix ?? '',
            },
            timeout: Duration.seconds(30),
        });
    }

    /**
     * Creates a Google Chat notification function
     */
    private createGoogleChatFunction(id: string, config: NotificationHandler): IFunction {
        return new LambdaFunction(this, id, {
            runtime: Runtime.NODEJS_24_X,
            handler: 'handler.handler',
            code: Code.fromAsset(join(__dirname, 'assets/functions/monitoring/googlechat-notifier')),
            environment: {
                WEBHOOK_URL: config.webhookUrl,
                MESSAGE_PREFIX: config.messagePrefix ?? '',
            },
            timeout: Duration.seconds(30),
        });
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
        const alarm = new Alarm(this, id, {
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

        alarm.addAlarmAction(new SnsAction(this.topic));
        this.alarms.push(alarm);
        return alarm;
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
     */
    static slackNotifier(config: {
        slackWebhookUrl: string;
        slackChannel?: string;
        messagePrefix?: string;
    }): NotificationHandler {
        return {
            type: 'slack',
            webhookUrl: config.slackWebhookUrl,
            channel: config.slackChannel,
            messagePrefix: config.messagePrefix,
        };
    }

    /**
     * Static factory method to create a Teams notifier configuration
     */
    static teamsNotifier(config: {
        webhookUrl: string;
        messagePrefix?: string;
    }): NotificationHandler {
        return {
            type: 'teams',
            webhookUrl: config.webhookUrl,
            messagePrefix: config.messagePrefix,
        };
    }

    /**
     * Static factory method to create a Google Chat notifier configuration
     */
    static googleChatNotifier(config: {
        webhookUrl: string;
        messagePrefix?: string;
    }): NotificationHandler {
        return {
            type: 'googlechat',
            webhookUrl: config.webhookUrl,
            messagePrefix: config.messagePrefix,
        };
    }
}