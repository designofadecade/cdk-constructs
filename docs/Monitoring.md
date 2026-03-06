# Monitoring

The Monitoring construct provides a complete monitoring solution with CloudWatch resources and multi-platform notifications. Build monitoring pipelines with log filters, alarms, SNS topics, and send notifications to Slack, Microsoft Teams, or Google Chat.

## Features

- 📊 **CloudWatch Log Groups**: Create log groups with configurable retention and removal policies
- � **Real-Time Error Monitoring**: Instant notifications for error logs via subscription filters
- 🔍 **Metric Filters**: Extract metrics from log patterns (ERROR, Exception, etc.)
- 🚨 **CloudWatch Alarms**: Create alarms that trigger on metric thresholds
- 📢 **SNS Topics**: Set up notification topics for alarm delivery
- 💬 **Multi-Platform Notifications**: Send formatted messages to Slack, Teams, or Google Chat
- 🎯 **Instance-Based API**: Create a monitoring construct and add alarms as needed
- 🔄 **Shared Lambda Functions**: Efficient resource usage with reusable processors
- ⚙️ **Sensible Defaults**: Pre-configured with production-ready settings
- 🔌 **Flexible Integration**: Works with any CloudWatch log group

## Quick Start

### Basic Monitoring Setup

```typescript
import { Monitoring } from '@designofadecade/cdk-constructs';

// Create a monitoring instance with SNS topic and notification handlers
const monitoring = new Monitoring(this, 'AppMonitoring', {
  topic: {
    topicName: 'app-alarms',
    displayName: 'Application Alarms',
  },
  notifications: [
    Monitoring.slackNotifier({
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
      slackChannel: '#alerts',
      messagePrefix: '[PROD]',
    }),
  ],
});

// Add a log-based alarm
const logGroup = myFunction.logGroup; // Or create one with CDK's LogGroup construct

monitoring.addLogAlarm('ErrorMonitoring', {
  logGroup,
  filterPattern: 'ERROR',
  threshold: 3, // Alert after 3 errors in 5 minutes
});
```

### Real-Time Error Monitoring

Monitor error logs in real-time with instant Slack notifications:

```typescript
import { Monitoring } from '@designofadecade/cdk-constructs';

const monitoring = new Monitoring(this, 'Monitoring', {
  notifications: [
    Monitoring.slackNotifier({
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
      slackChannel: '#errors',
    }),
  ],
});

// Monitor errors from any Lambda function or service
monitoring.monitorErrors('ApiErrors', {
  logGroup: apiFunction.logGroup,
});

// Monitor multiple error levels
monitoring.monitorErrors('CriticalErrors', {
  logGroup: databaseFunction.logGroup,
  errorLevels: ['ERROR', 'FATAL', 'CRITICAL'],
});
```

This creates CloudWatch subscription filters that instantly detect errors in JSON logs and send formatted notifications to Slack. Multiple monitors share a single Lambda function for efficiency.

### Multi-Platform Notifications

```typescript
const monitoring = new Monitoring(this, 'Monitoring', {
  topic: {
    topicName: 'production-alarms',
    displayName: 'Production Alarms',
  },
  notifications: [
    // Send to Slack
    Monitoring.slackNotifier({
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
      slackChannel: '#prod-alerts',
      messagePrefix: '[PROD]',
    }),
    // Send to Microsoft Teams
    Monitoring.teamsNotifier({
      webhookUrl: process.env.TEAMS_WEBHOOK_URL!,
      messagePrefix: '[PROD]',
    }),
    // Send to Google Chat
    Monitoring.googleChatNotifier({
      webhookUrl: process.env.GCHAT_WEBHOOK_URL!,
      messagePrefix: '[PROD]',
    }),
  ],
});
```

## Usage

### 1. Creating a Monitoring Instance

The Monitoring construct is the central hub for your monitoring setup:

```typescript
const monitoring = new Monitoring(this, 'AppMonitoring', {
  topic: {
    topicName: 'app-alarms',
    displayName: 'Application Alarms',
  },
  notifications: [
    Monitoring.slackNotifier({
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
      slackChannel: '#alerts',
      messagePrefix: '[PROD]',
    }),
  ],
});

// Access the SNS topic
const topic = monitoring.topic;

// Access notification functions
const functions = monitoring.notificationFunctions;

// Access all alarms
const alarms = monitoring.alarms;
```

### 2. Notification Handlers

#### Slack Notifier

```typescript
Monitoring.slackNotifier({
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
  slackChannel: '#production-alerts', // Optional: override webhook's default channel
  messagePrefix: '[PROD]', // Optional: prefix for messages
})
```

#### Microsoft Teams Notifier

```typescript
Monitoring.teamsNotifier({
  webhookUrl: process.env.TEAMS_WEBHOOK_URL!,
  messagePrefix: '[STAGING]', // Optional
})
```

#### Google Chat Notifier

```typescript
Monitoring.googleChatNotifier({
  webhookUrl: process.env.GCHAT_WEBHOOK_URL!,
  messagePrefix: '[DEV]', // Optional
})
```

### 3. Real-Time Error Monitoring with monitorErrors()

The `monitorErrors()` method creates CloudWatch subscription filters that instantly detect and notify you of errors in your logs. This is faster than metric-based alarms because it sends notifications immediately when errors occur.

#### Basic Error Monitoring

Monitor JSON logs with `level: "ERROR"`:

```typescript
monitoring.monitorErrors('ApiErrors', {
  logGroup: apiFunction.logGroup,
});
```

This automatically:
- Creates a CloudWatch subscription filter for JSON logs with `{"level":"ERROR"}`
- Processes errors through a shared Lambda function
- Publishes to the SNS topic
- Sends formatted notifications to all configured handlers (Slack, Teams, etc.)

#### Monitor Multiple Error Levels

```typescript
monitoring.monitorErrors('CriticalIssues', {
  logGroup: databaseFunction.logGroup,
  errorLevels: ['ERROR', 'FATAL', 'CRITICAL'],
});
```

#### Custom Log Field Names

If your logs use different field names:

```typescript
monitoring.monitorErrors('ServiceErrors', {
  logGroup: serviceLogGroup,
  levelField: 'severity', // Instead of "level"
  errorLevels: ['error', 'fatal'], // Lowercase values
});
```

#### Multiple Log Groups

Monitor errors from multiple services - all share the same Lambda function:

```typescript
// API errors
monitoring.monitorErrors('ApiErrors', {
  logGroup: apiFunction.logGroup,
});

// Database errors
monitoring.monitorErrors('DatabaseErrors', {
  logGroup: databaseFunction.logGroup,
  errorLevels: ['ERROR', 'FATAL'],
});

// Authentication errors
monitoring.monitorErrors('AuthErrors', {
  logGroup: authFunction.logGroup,
});

// Only ONE Lambda function is created for all three monitors! 🎉
```

#### How It Works

1. **CloudWatch Subscription Filter**: Watches your log group for matching patterns
2. **Shared Lambda Function**: Processes log events (created once, reused by all monitors)
3. **SNS Topic**: Publishes structured error data
4. **Notification Handlers**: Sends formatted messages to Slack, Teams, or Google Chat

#### Benefits Over Metric Alarms

- ✅ **Instant notifications** - No delay waiting for metrics to aggregate
- ✅ **Full error context** - Includes all JSON fields from your logs
- ✅ **No metrics needed** - Direct log-to-notification pipeline
- ✅ **Cost efficient** - Shared Lambda function for all monitors

### 4. Adding Alarms

#### Add a Log-Based Alarm

Automatically creates a metric filter and alarm:

```typescript
monitoring.addLogAlarm('ErrorAlarm', {
  logGroup: myLogGroup,
  filterPattern: 'ERROR',
  threshold: 5, // Alert after 5 occurrences
  alarmName: 'HighErrorRate',
  alarmDescription: 'Error rate exceeded threshold',
  metricName: 'ErrorCount',
  metricNamespace: 'MyApp',
});
```

#### Add a Direct Alarm

For existing metric filters:

```typescript
const metricFilter = Monitoring.createMetricFilter(this, 'CustomFilter', {
  logGroup: myLogGroup,
  filterPattern: 'CUSTOM_PATTERN',
});

monitoring.addAlarm('CustomAlarm', {
  metricFilter,
  threshold: 10,
  evaluationPeriods: 2,
});
```

### 5. CloudWatch Log Groups

Create log groups using CDK's native `LogGroup` construct:

```typescript
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib';

const logGroup = new LogGroup(this, 'MyAppLogs', {
  logGroupName: '/aws/lambda/my-function',
  retention: RetentionDays.ONE_WEEK,
  removalPolicy: RemovalPolicy.DESTROY,
});
```

#### Custom Retention Period

```typescript
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

const logGroup = new LogGroup(this, 'MyAppLogs', {
  retention: RetentionDays.ONE_MONTH, // 30 days
});
```

#### Retain Logs on Stack Deletion

```typescript
import { RemovalPolicy } from 'aws-cdk-lib';

const logGroup = new LogGroup(this, 'MyAppLogs', {
  removalPolicy: RemovalPolicy.RETAIN,
});
```

### 6. Metric Filters and Alarms

Use the `addLogAlarm` method which creates both the metric filter and alarm:
- `'ERROR'` - Match ERROR keyword
- `'Exception'` - Match Exception keyword
- `'"task timed out"'` - Match exact phrase
- `'?ERROR ?Exception ?Failure'` - Match any of these terms

## Configuration

### MonitoringProps

Main configuration for the Monitoring construct:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `stack` | `Stack` | undefined | Optional stack reference |
| `topic` | `SnsTopicConfig` | undefined | SNS topic configuration |
| `notifications` | `NotificationHandler[]` | `[]` | Array of notification handlers |

### NotificationHandler

Configuration for notification platforms (created via factory methods):

```typescript
// Slack
Monitoring.slackNotifier({
  slackWebhookUrl: string;      // Required: Slack incoming webhook URL
  slackChannel?: string;         // Optional: Override default channel
  messagePrefix?: string;        // Optional: Message prefix (e.g., '[PROD]')
})

// Microsoft Teams
Monitoring.teamsNotifier({
  webhookUrl: string;            // Required: Teams incoming webhook URL
  messagePrefix?: string;        // Optional: Message prefix
})

// Google Chat
Monitoring.googleChatNotifier({
  webhookUrl: string;            // Required: Google Chat webhook URL
  messagePrefix?: string;        // Optional: Message prefix
})
```

### SnsTopicConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `topicName` | `string` | auto-generated | The name of the SNS topic |
| `displayName` | `string` | undefined | Display name for the topic |

### AlarmConfig

Used with `monitoring.addAlarm()`:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `metricFilter` | `MetricFilter` | required | The metric filter to alarm on |
| `alarmName` | `string` | auto-generated | Name of the alarm |
| `alarmDescription` | `string` | undefined | Description of the alarm |
| `threshold` | `number` | `1` | Threshold value to trigger alarm |
| `evaluationPeriods` | `number` | `1` | Number of periods to evaluate |
| `comparisonOperator` | `ComparisonOperator` | `GREATER_THAN_OR_EQUAL_TO_THRESHOLD` | Comparison operator |
| `treatMissingData` | `TreatMissingData` | `NOT_BREACHING` | How to handle missing data |

### addLogAlarm Config

Used with `monitoring.addLogAlarm()`:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `logGroup` | `ILogGroup` | required | The log group to monitor |
| `filterPattern` | `string` | required | Pattern to match in logs |
| `threshold` | `number` | `1` | Threshold value to trigger alarm |
| `metricName` | `string` | auto-generated | Name of the metric |
| `metricNamespace` | `string` | `'CustomMetrics'` | Namespace for the metric |
| `alarmName` | `string` | auto-generated | Name of the alarm |
| `alarmDescription` | `string` | auto-generated | Description of the alarm |

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

## Getting Webhook URLs

### Slack Webhook

1. Go to your Slack workspace settings
2. Navigate to **Apps** → **Incoming Webhooks**
3. Click **Add to Slack**
4. Select the channel for notifications
5. Copy the webhook URL

### Microsoft Teams Webhook

1. Open the Teams channel where you want notifications
2. Click **•••** (More options) next to the channel name
3. Select **Connectors**
4. Find **Incoming Webhook** and click **Configure**
5. Give it a name (e.g., "AWS Alarms") and optionally upload an image
6. Copy the webhook URL

### Google Chat Webhook

1. Open the Google Chat space where you want notifications
2. Click the space name at the top
3. Select **Apps & integrations**
4. Click **Add webhooks**
5. Give it a name (e.g., "AWS CloudWatch")
6. Copy the webhook URL

### Storing Webhooks Securely

```bash
# Add to your .env file (don't commit!)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/YOUR/WEBHOOK/URL
GCHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/YOUR/WEBHOOK
```

Or use AWS Secrets Manager for production:

```typescript
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

const slackWebhook = Secret.fromSecretNameV2(this, 'SlackWebhook', 'slack-webhook-url');

const monitoring = new Monitoring(this, 'Monitoring', {
  notifications: [
    Monitoring.slackNotifier({
      slackWebhookUrl: slackWebhook.secretValue.unsafeUnwrap(),
    }),
  ],
});
```

## Complete Example

```typescript
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Monitoring, Function } from '@designofadecade/cdk-constructs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Runtime, Code } from 'aws-cdk-lib/aws-lambda';

export class MonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create your Lambda function
    const myFunction = new Function(this, 'MyFunction', {
      runtime: Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
    });

    // Create log group
    const logGroup = new LogGroup(this, 'FunctionLogs', {
      logGroupName: `/aws/lambda/${myFunction.functionName}`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.RETAIN, // Keep logs even if stack is deleted
    });

    // Create monitoring instance with multi-platform notifications
    const monitoring = new Monitoring(this, 'Monitoring', {
      topic: {
        topicName: `${this.stackName}-alarms`,
        displayName: 'Production Alarms',
      },
      notifications: [
        Monitoring.slackNotifier({
          slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
          slackChannel: '#prod-alerts',
          messagePrefix: '[PROD]',
        }),
        Monitoring.teamsNotifier({
          webhookUrl: process.env.TEAMS_WEBHOOK_URL!,
          messagePrefix: '[PROD]',
        }),
      ],
    });

    // Monitor errors
    monitoring.addLogAlarm('ErrorMonitoring', {
      logGroup,
      filterPattern: 'ERROR',
      threshold: 5,
      alarmName: 'HighErrorRate',
      alarmDescription: 'Error rate exceeded 5 in 5 minutes',
    });

    // Monitor timeouts
    monitoring.addLogAlarm('TimeoutMonitoring', {
      logGroup,
      filterPattern: 'Task timed out',
      threshold: 3,
      alarmName: 'FunctionTimeouts',
      alarmDescription: 'Function timeout detected',
    });

    // Monitor custom business metrics
    monitoring.addLogAlarm('BusinessMetric', {
      logGroup,
      filterPattern: 'CUSTOM_METRIC payment_failed',
      threshold: 10,
      metricName: 'PaymentFailures',
      metricNamespace: 'Business',
      alarmName: 'HighPaymentFailureRate',
    });

    // Access monitoring resources
    console.log('SNS Topic:', monitoring.topic.topicArn);
    console.log('Notification Functions:', monitoring.notificationFunctions.length);
    console.log('Active Alarms:', monitoring.alarms.length);
  }
}
```

## Multi-Environment Example

```typescript
interface MonitoringConfig {
  env: string;
  slackChannel: string;
  threshold: number;
}

const configs: Record<string, MonitoringConfig> = {
  dev: {
    env: 'DEV',
    slackChannel: '#dev-alerts',
    threshold: 10,
  },
  staging: {
    env: 'STAGING',
    slackChannel: '#staging-alerts',
    threshold: 5,
  },
  prod: {
    env: 'PROD',
    slackChannel: '#prod-alerts',
    threshold: 3,
  },
};

const config = configs[process.env.ENVIRONMENT || 'dev'];

const monitoring = new Monitoring(this, 'Monitoring', {
  topic: {
    topicName: `${config.env.toLowerCase()}-alarms`,
    displayName: `${config.env} Alarms`,
  },
  notifications: [
    Monitoring.slackNotifier({
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL!,
      slackChannel: config.slackChannel,
      messagePrefix: `[${config.env}]`,
    }),
  ],
});

monitoring.addLogAlarm('ErrorMonitoring', {
  logGroup,
  filterPattern: 'ERROR',
  threshold: config.threshold,
});
```

## Notification Message Formats

### Slack

Sends formatted messages with:
- **Color coding**: Red for ALARM, Green for OK, Orange for INSUFFICIENT_DATA
- **Alarm name**: Shows in the message title
- **State**: Current alarm state (ALARM/OK/INSUFFICIENT_DATA)
- **Reason**: Why the alarm triggered
- **Timestamp**: When the alarm state changed
- **Footer**: AWS CloudWatch Alarms branding
- **Icon**: Warning emoji

### Microsoft Teams

Sends Adaptive Cards with:
- **Color coding**: Red for ALARM, Green for OK
- **Alarm name**: Card title
- **Facts section**: State, Time, and Reason displayed in structured format
- **Activity title**: AWS CloudWatch Alarm label

### Google Chat

Sends text-based messages with:
- **Bold alarm name** with prefix
- **Structured fields**: State, Time, and Reason on separate lines
- **Markdown formatting** for emphasis

## Instance Properties

When you create a Monitoring instance, you get access to:

```typescript
const monitoring = new Monitoring(this, 'Monitoring', { ... });

// The SNS topic
monitoring.topic: ITopic

// Array of all notification Lambda functions
monitoring.notificationFunctions: IFunction[]

// Array of all alarms created via addAlarm/addLogAlarm
monitoring.alarms: Alarm[]
```

## Factory Methods

The Monitoring class provides static factory methods to create notification handler configurations:

### slackNotifier()
Returns `NotificationHandler` - Configuration for Slack notifications

### teamsNotifier()
Returns `NotificationHandler` - Configuration for Microsoft Teams notifications

### googleChatNotifier()
Returns `NotificationHandler` - Configuration for Google Chat notifications

## Best Practices

1. **Organize by environment**: Use different Slack channels or Teams for dev/staging/prod
2. **Use descriptive log group names**: Follow AWS naming conventions (e.g., `/aws/lambda/function-name`)
3. **Set appropriate retention**: Balance cost with compliance requirements (7-30 days typical)
4. **Set appropriate thresholds**: Avoid alert fatigue with too-sensitive alarms
5. **Use RETAIN for critical logs**: Set `RemovalPolicy.RETAIN` for audit or compliance logs
6. **Secure webhook URLs**: Store webhook URLs in Secrets Manager or environment variables, never in code
7. **Test your alarms**: Use CloudWatch manual alarm testing to verify integration
8. **Monitor multiple patterns**: Create separate alarms for errors, timeouts, and business metrics
9. **Use message prefixes**: Differentiate between environments `[PROD]`, `[STAGING]`, `[DEV]`
10. **Multi-platform notifications**: Send critical alarms to multiple platforms for redundancy
12. **Group related alarms**: Use one Monitoring instance per application or microservice

## Common Retention Periods

- `RetentionDays.ONE_DAY` - 1 day (development)
- `RetentionDays.THREE_DAYS` - 3 days (development)
- `RetentionDays.ONE_WEEK` - 7 days (default, staging)
- `RetentionDays.TWO_WEEKS` - 14 days (staging)
- `RetentionDays.ONE_MONTH` - 30 days (production)
- `RetentionDays.THREE_MONTHS` - 90 days (compliance)
- `RetentionDays.SIX_MONTHS` - 180 days (compliance)
- `RetentionDays.ONE_YEAR` - 365 days (audit)
- `RetentionDays.INFINITE` - Never expire (legal hold)

## Troubleshooting

### Notifications not appearing

1. **Verify webhook URL is correct** - Test it with curl or Postman
2. **Check Lambda CloudWatch logs** - Look for errors in the notification function
3. **Verify SNS subscription is confirmed** - Check SNS console
4. **Test alarm manually** - Use CloudWatch alarm testing feature
5. **Check IAM permissions** - Lambda needs permission to be invoked by SNS

### Alarm not triggering

1. **Check metric filter pattern** - Verify it matches your log messages
2. **Review evaluation period and threshold** - Might be too high
3. **Check CloudWatch metrics** - Verify data is being collected
4. **Review alarm history** - Check AWS Console for state transitions
5. **Verify log group association** - Ensure logs are going to the right log group

### Lambda timeout errors

1. **Default timeout is 30 seconds** - Should be sufficient for webhook calls
2. **Check Lambda logs** - Look for network issues
3. **Verify webhook URL is accessible** - Check network/VPC configuration
4. **Test webhook manually** - Use curl to verify external connectivity

### Multiple notifications for same alarm

1. **Check alarm evaluation periods** - Might be set to retrigger frequently
2. **Review threshold settings** - May be breaching repeatedly
3. **Consider alarm actions** - Use OK actions to notify when resolved

### Messages not formatted correctly

1. **Verify JSON parsing** - CloudWatch sends JSON-encoded messages
2. **Check Lambda logs** - Look for parsing errors
3. **Update handler code** - Notification handlers are in `src/assets/functions/monitoring/`
4. **Test with sample payload** - Manually invoke Lambda with CloudWatch Alarm JSON
