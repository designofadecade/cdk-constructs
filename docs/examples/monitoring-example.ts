import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Monitoring, Function } from '@designofadecade/cdk-constructs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Code } from 'aws-cdk-lib/aws-lambda';

/**
 * Example stack demonstrating complete monitoring setup with Slack notifications
 */
export class MonitoringExampleStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Ensure you have SLACK_WEBHOOK_URL in your environment
        const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
        if (!slackWebhookUrl) {
            throw new Error('SLACK_WEBHOOK_URL environment variable is required');
        }

        // Example 1: Monitor a Lambda function for errors
        const myFunction = new Function(this, 'MyFunction', {
            name: 'my-application-function',
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            stack: {
                id: 'example',
                tags: [{ key: 'Environment', value: 'Production' }],
            },
        });

        // Create log group
        const functionLogGroup = Monitoring.createLogGroup(this, 'FunctionLogs', {
            logGroupName: `/aws/lambda/${myFunction.functionName}`,
            retention: RetentionDays.TWO_WEEKS,
        });

        // Set up error monitoring with Slack notifications
        const errorMonitoring = Monitoring.createErrorMonitoring(this, 'ErrorMonitoring', {
            logGroup: functionLogGroup,
            filterPattern: 'ERROR',
            slackWebhookUrl,
            slackChannel: '#production-alerts',
            messagePrefix: '[PROD ERROR]',
            threshold: 5, // Alert after 5 errors in 5 minutes
            alarmName: 'ProductionErrorAlarm',
            alarmDescription: 'Production error rate exceeded threshold',
            metricName: 'ErrorCount',
            metricNamespace: 'MyApp/Production',
        });

        // Example 2: Monitor Lambda timeouts
        const timeoutMonitoring = Monitoring.createErrorMonitoring(this, 'TimeoutMonitoring', {
            logGroup: functionLogGroup,
            filterPattern: 'Task timed out',
            slackWebhookUrl,
            slackChannel: '#production-alerts',
            messagePrefix: '[PROD TIMEOUT]',
            threshold: 3,
            alarmName: 'FunctionTimeoutAlarm',
            alarmDescription: 'Lambda function timing out frequently',
            metricName: 'TimeoutCount',
            metricNamespace: 'MyApp/Production',
        });

        // Example 3: Monitor custom log patterns
        const customMonitoring = Monitoring.createErrorMonitoring(this, 'DatabaseErrorMonitoring', {
            logGroup: functionLogGroup,
            filterPattern: 'DatabaseConnectionError',
            slackWebhookUrl,
            slackChannel: '#database-alerts',
            messagePrefix: '[DB ERROR]',
            threshold: 2,
            alarmName: 'DatabaseConnectionAlarm',
            alarmDescription: 'Database connection errors detected',
            metricName: 'DatabaseErrorCount',
            metricNamespace: 'MyApp/Database',
        });

        // Example 4: Build custom monitoring pipeline step by step
        const apiLogGroup = Monitoring.createLogGroup(this, 'ApiLogs', {
            logGroupName: '/aws/apigateway/my-api',
            retention: RetentionDays.ONE_MONTH,
        });

        // Create metric filter
        const highLatencyFilter = Monitoring.createMetricFilter(this, 'HighLatencyFilter', {
            logGroup: apiLogGroup,
            filterPattern: 'latency > 3000',
            metricName: 'HighLatencyCount',
            metricNamespace: 'MyApp/API',
        });

        // Create SNS topic
        const alertTopic = Monitoring.createSnsTopic(this, 'AlertTopic', {
            topicName: 'api-performance-alerts',
            displayName: 'API Performance Alerts',
        });

        // Create alarm
        const latencyAlarm = Monitoring.createAlarm(this, 'HighLatencyAlarm', {
            metricFilter: highLatencyFilter,
            alarmName: 'APIHighLatencyAlarm',
            alarmDescription: 'API latency exceeding 3 seconds',
            threshold: 10, // More than 10 slow requests
            evaluationPeriods: 2, // Over 2 consecutive 5-minute periods (10 minutes total)
        });

        // Add SNS action
        const { SnsAction } = require('aws-cdk-lib/aws-cloudwatch-actions');
        latencyAlarm.addAlarmAction(new SnsAction(alertTopic));

        // Create Slack notifier
        const slackNotifier = Monitoring.createSlackNotifier(this, 'LatencySlackNotifier', {
            slackWebhookUrl,
            slackChannel: '#performance',
            messagePrefix: '[PERF]',
        });

        // Subscribe Lambda to SNS
        const { LambdaSubscription } = require('aws-cdk-lib/aws-sns-subscriptions');
        alertTopic.addSubscription(new LambdaSubscription(slackNotifier));

        // Access individual components if needed
        console.log('Error monitoring alarm:', errorMonitoring.alarm.alarmArn);
        console.log('SNS topic:', errorMonitoring.snsTopic.topicArn);
        console.log('Slack function:', errorMonitoring.slackFunction.functionArn);
    }
}
