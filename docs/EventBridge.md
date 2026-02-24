# EventBridge Construct

CDK construct for creating EventBridge scheduled rules for Lambda functions.

## Features

- Cron and rate-based schedules
- Lambda function targets
- Automatic permissions
- Dead letter queue support

## Basic Usage

```typescript
import { EventBridge, Function } from '@designofadecade/cdk-constructs';

const fn = new Function(this, 'ScheduledJob', {
  name: 'scheduled-job',
  entry: './src/handlers/job.ts',
  stack: { id: 'my-app', tags: [] },
});

// Run every hour
const hourly = new EventBridge(this, 'HourlyJob', {
  name: 'hourly-job',
  schedule: 'rate(1 hour)',
  target: fn.function,
  stack: { id: 'my-app', tags: [] },
});

// Run at 2 AM every day
const daily = new EventBridge(this, 'DailyJob', {
  name: 'daily-job',
  schedule: 'cron(0 2 * * ? *)',
  target: fn.function,
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### EventBridgeProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Rule name |
| `schedule` | `string` | Required | Cron or rate expression |
| `target` | `IFunction` | Required | Lambda function target |
| `stack` | `object` | Required | Stack ID and tags |

## Schedule Expressions

### Rate Expressions

- `rate(1 minute)` - Every minute
- `rate(5 minutes)` - Every 5 minutes
- `rate(1 hour)` - Every hour
- `rate(1 day)` - Every day

### Cron Expressions

Format: `cron(Minutes Hours Day-of-month Month Day-of-week Year)`

- `cron(0 12 * * ? *)` - Every day at 12:00 PM UTC
- `cron(0 9 ? * MON-FRI *)` - Weekdays at 9:00 AM UTC
- `cron(0 0 1 * ? *)` - First day of every month at midnight

## Best Practices

1. **Use rate expressions** for simple recurring tasks
2. **Use cron expressions** for specific time requirements
3. **Consider timezone** - EventBridge uses UTC
4. **Add retry logic** in Lambda function
5. **Monitor execution** with CloudWatch metrics
6. **Use dead letter queues** for failed invocations
7. **Set appropriate Lambda timeout** for long-running jobs

## Related Constructs

- [Function](./Function.md) - Lambda functions
- [Sqs](./Sqs.md) - SQS for dead letter queue
