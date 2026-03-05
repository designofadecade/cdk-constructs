# Monitoring

The Monitoring class provides static utility methods for creating CloudWatch resources with sensible defaults. Build complete monitoring pipelines with log filters, alarms, SNS topics, and Slack notifications.

## Features

- 📊 **CloudWatch Log Groups**: Create log groups with configurable retention and removal policies
- 🔍 **Metric Filters**: Extract metrics from log patterns (ERROR, Exception, etc.)
- 🚨 **CloudWatch Alarms**: Create alarms that trigger on metric thresholds
- 📢 **SNS Topics**: Set up notification topics for alarm delivery
- 💬 **Slack Notifications**: Send formatted alarm messages to Slack channels
- 🎯 **Complete Pipeline**: One-method setup for the entire monitoring flow
- 🔄 **Reusable References**: Returns interfaces that can be referenced by other resources
- ⚙️ **Sensible Defaults**: Pre-configured with production-ready settings

## Quick Start

### Complete Error Monitoring (One Command)

```typescript
import { Monitoring } from '@designofadecade/cdk-constructs';

// Create log group
const logGroup = Monitoring.createLogGroup(this, 'AppLogs', {
  logGroupName: '/aws/lambda/my-app',
});

// Set up complete monitoring pipeline: logs → filter → alarm → SNS → Slack
const monitoring = Monitoring.createErrorMonitoring(this, 'ErrorMonitoring', {
  logGroup,
  filterPattern: 'ERROR',
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
  slackChannel: '#alerts',
  threshold: 3, // Alert after 3 errors in 5 minutes
  messagePrefix: '[PROD]',
});
```

## Usage

### 1. CloudWatch Log Groups

#### Basic Log Group

```typescript
const logGroup = Monitoring.createLogGroup(this, 'MyAppLogs');
```

#### Custom Log Group Name

```typescript
const logGroup = Monitoring.createLogGroup(this, 'MyAppLogs', {
  logGroupName: '/aws/lambda/my-function',
});
```

#### Custom Retention Period

```typescript
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

const logGroup = Monitoring.createLogGroup(this, 'MyAppLogs', {
  retention: RetentionDays.ONE_MONTH, // 30 days
});
```

#### Retain Logs on Stack Deletion

```typescript
import { RemovalPolicy } from 'aws-cdk-lib';

const logGroup = Monitoring.createLogGroup(this, 'MyAppLogs', {
  removalPolicy: RemovalPolicy.RETAIN,
});
```

### 2. Metric Filters

Extract metrics from log patterns:

```typescript
const metricFilter = Monitoring.createMetricFilter(this, 'ErrorFilter', {
  logGroup: myLogGroup,
  filterPattern: 'ERROR',
  metricName: 'ErrorCount',
  metricNamespace: 'MyApp',
});
```

Common filter patterns:
- `'ERROR'` - Match ERROR keyword
- `'Exception'` - Match Exception keyword
- `'"task timed out"'` - Match exact phrase
- `'?ERROR ?Exception ?Failure'` - Match any of these terms

### 3. CloudWatch Alarms

Create alarms based on metric filters:

```typescript
const alarm = Monitoring.createAlarm(this, 'ErrorAlarm', {
  metricFilter: errorFilter,
  alarmName: 'HighErrorRate',
  alarmDescription: 'Alerts when error count exceeds threshold',
  threshold: 5, // Trigger after 5 occurrences
  evaluationPeriods: 2, // Over 2 consecutive periods
});
```

### 4. SNS Topics

Create notification topics:

```typescript
const topic = Monitoring.createSnsTopic(this, 'AlarmTopic', {
  topicName: 'app-alarms',
  displayName: 'Application Alarms',
});

// Add alarm action
alarm.addAlarmAction(new SnsAction(topic));
```

### 5. Slack Notifications

Create Lambda function to forward SNS messages to Slack:

```typescript
const slackFunction = Monitoring.createSlackNotifier(this, 'SlackNotifier', {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
  slackChannel: '#alerts',
  messagePrefix: '[PROD]',
});

// Subscribe to SNS topic
topic.addSubscription(new LambdaSubscription(slackFunction));
```

### 6. Complete Monitoring Setup

The easiest way - create everything at once:

```typescript
const monitoring = Monitoring.createErrorMonitoring(this, 'ErrorMonitoring', {
  logGroup: myLogGroup,
  filterPattern: 'ERROR',
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
  slackChannel: '#production-alerts',
  messagePrefix: '[PROD]',
  threshold: 3,
  metricName: 'ProductionErrors',
  metricNamespace: 'MyApp',
  alarmName: 'ProductionErrorAlarm',
  alarmDescription: 'Production error rate exceeded threshold',
});

// Access individual components if needed
console.log(monitoring.alarm);
console.log(monitoring.snsTopic);
console.log(monitoring.slackFunction);
```

## Configuration

### LogGroupConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `logGroupName` | `string` | auto-generated | The name of the log group |
| `retention` | `RetentionDays` | `ONE_WEEK` (7 days) | How long to retain logs |
| `removalPolicy` | `RemovalPolicy` | `DESTROY` | What to do when the stack is deleted |

### MetricFilterConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `logGroup` | `ILogGroup` | required | The log group to filter |
| `filterPattern` | `string` | required | Pattern to match in logs |
| `metricName` | `string` | auto-generated | Name of the metric |
| `metricNamespace` | `string` | `'CustomMetrics'` | Namespace for the metric |
| `metricValue` | `string` | `'1'` | Value to emit when pattern matches |

### AlarmConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `metricFilter` | `MetricFilter` | required | The metric filter to alarm on |
| `alarmName` | `string` | auto-generated | Name of the alarm |
| `alarmDescription` | `string` | undefined | Description of the alarm |
| `threshold` | `number` | `1` | Threshold value to trigger alarm |
| `evaluationPeriods` | `number` | `1` | Number of periods to evaluate |
| `comparisonOperator` | `ComparisonOperator` | `GREATER_THAN_OR_EQUAL_TO_THRESHOLD` | Comparison operator |
| `treatMissingData` | `TreatMissingData` | `NOT_BREACHING` | How to handle missing data |

### SlackNotificationConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `slackWebhookUrl` | `string` | required | Slack incoming webhook URL |
| `slackChannel` | `string` | undefined | Override webhook's default channel |
| `messagePrefix` | `string` | undefined | Prefix for messages (e.g., '[PROD]') |

## Common Retention Periods

- `RetentionDays.ONE_DAY` - 1 day
- `RetentionDays.THREE_DAYS` - 3 days
- `RetentionDays.ONE_WEEK` - 7 days (default)
- `RetentionDays.TWO_WEEKS` - 14 days
- `RetentionDays.ONE_MONTH` - 30 days
- `RetentionDays.THREE_MONTHS` - 90 days
- `RetentionDays.SIX_MONTHS` - 180 days
- `RetentionDays.ONE_YEAR` - 365 days
- `RetentionDays.INFINITE` - Never expire

## Getting Slack Webhook URL

1. Go to your Slack workspace settings
2. Navigate to **Apps** → **Incoming Webhooks**
3. Click **Add to Slack**
4. Select the channel for notifications
5. Copy the webhook URL
6. Store it securely (use AWS Secrets Manager or environment variable)

```bash
# Add to your .env file (don't commit!)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## Complete Example

```typescript
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Monitoring, Function } from '@designofadecade/cdk-constructs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export class MonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create your Lambda function
    const myFunction = new Function(this, 'MyFunction', {
      // ... function config
    });

    // Create log group
    const logGroup = Monitoring.createLogGroup(this, 'FunctionLogs', {
      logGroupName: `/aws/lambda/${myFunction.functionName}`,
      retention: RetentionDays.TWO_WEEKS,
    });

    // Set up error monitoring with Slack notifications
    const errorMonitoring = Monitoring.createErrorMonitoring(this, 'ErrorMonitoring', {
      logGroup,
      filterPattern: 'ERROR',
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
      slackChannel: '#production-alerts',
      messagePrefix: '[PROD]',
      threshold: 5, // Alert after 5 errors
      alarmName: 'ProductionErrors',
      alarmDescription: 'High error rate detected in production',
    });

    // Set up timeout monitoring
    const timeoutMonitoring = Monitoring.createErrorMonitoring(this, 'TimeoutMonitoring', {
      logGroup,
      filterPattern: 'Task timed out',
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
      slackChannel: '#production-alerts',
      messagePrefix: '[PROD TIMEOUT]',
      threshold: 3,
      alarmName: 'FunctionTimeouts',
    });

    // Set up custom metric monitoring
    const logGroup2 = Monitoring.createLogGroup(this, 'ApiLogs', {
      logGroupName: '/aws/apigateway/my-api',
    });

    const customMonitoring = Monitoring.createErrorMonitoring(this, 'HighLatency', {
      logGroup: logGroup2,
      filterPattern: 'latency > 3000',
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
      slackChannel: '#performance',
      messagePrefix: '[HIGH LATENCY]',
      threshold: 10,
      metricName: 'HighLatencyCount',
      metricNamespace: 'API',
    });
  }
}
```

## Slack Message Format

The Lambda function sends formatted messages to Slack with:
- **Color coding**: Red for ALARM, Green for OK, Orange for INSUFFICIENT_DATA
- **Alarm name**: Shows in the message title
- **State**: Current alarm state
- **Reason**: Why the alarm triggered
- **Timestamp**: When the alarm state changed
- **Footer**: AWS CloudWatch Alarms branding

## Best Practices

1. **Use descriptive log group names**: Follow AWS naming conventions (e.g., `/aws/lambda/function-name`)
2. **Set appropriate retention**: Balance cost with compliance requirements
3. **Use meaningful alarm names**: Make it clear what's being monitored
4. **Set appropriate thresholds**: Avoid alert fatigue with too-sensitive alarms
5. **Use RETAIN for critical logs**: Set `RemovalPolicy.RETAIN` for audit logs
6. **Secure webhook URLs**: Store Slack webhook URLs in Secrets Manager, not in code
7. **Test your alarms**: Use CloudWatch alarm testing features to verify Slack integration
8. **Monitor multiple patterns**: Create separate monitoring setups for different error types
9. **Use message prefixes**: Differentiate between environments ([PROD], [STAGING])
10. **Channel organization**: Use different Slack channels for different severity levels

## Return Types

### createLogGroup
Returns `ILogGroup` - Standard CloudWatch Log Group interface

### createMetricFilter
Returns `MetricFilter` - Can be used to create alarms

### createAlarm
Returns `IAlarm` - Can have actions added

### createSnsTopic
Returns `ITopic` - Can have subscriptions added

### createSlackNotifier
Returns `IFunction` - Lambda function for Slack notifications

### createErrorMonitoring
Returns `MonitoringSetup`:
```typescript
{
  logGroup: ILogGroup;
  metricFilter: MetricFilter;
  alarm: IAlarm;
  snsTopic: ITopic;
  slackFunction: IFunction;
}
```

## Troubleshooting

### Slack messages not appearing

1. Verify webhook URL is correct
2. Check Lambda CloudWatch logs for errors
3. Verify SNS subscription is confirmed
4. Test alarm manually in AWS Console

### Alarm not triggering

1. Check metric filter pattern matches your logs
2. Verify evaluation period and threshold settings
3. Check CloudWatch metrics to see if data is being collected
4. Review alarm history in AWS Console

### Lambda timeout

1. Default timeout is 30 seconds - should be sufficient
2. Check Lambda logs for network issues
3. Verify webhook URL is accessible
