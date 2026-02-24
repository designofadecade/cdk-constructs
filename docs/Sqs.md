# Sqs Construct

CDK construct for creating SQS queues with best practices.

## Features

- Standard and FIFO queues
- Dead letter queue support
- SQS-managed encryption (SSE-SQS)
- Configurable message retention
- Visibility timeout configuration
- CloudWatch metrics

## Basic Usage

```typescript
import { Sqs } from '@designofadecade/cdk-constructs';

const queue = new Sqs(this, 'JobQueue', {
  name: 'job-queue',
  deadLetterQueue: true,
  maxReceiveCount: 3,
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### SqsProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Queue name |
| `stack` | `object` | Required | Stack ID and tags |
| `deadLetterQueue` | `boolean` | false | Enable DLQ |
| `maxReceiveCount` | `number` | 3 | Max receives before DLQ |
| `visibilityTimeout` | `Duration` | 30s | Visibility timeout |
| `retentionPeriod` | `Duration` | 14d | Message retention |
| `fifo` | `boolean` | false | FIFO queue |

## Getters

- `queue` - SQS Queue
- `queueUrl` - Queue URL
- `queueArn` - Queue ARN
- `deadLetterQueue` - DLQ (if configured)

## Best Practices

1. **Use dead letter queues** to handle failures (default for construct)
2. **Set appropriate visibility timeout** based on processing time
3. **Enable SQS-managed encryption** (default)
4. **Use FIFO queues** only when strict ordering needed
5. **Set max receive count** to 3-5 attempts
6. **Monitor queue metrics** (age, depth, failed messages)
7. **Implement idempotent consumers** for at-least-once delivery
8. **Use batch operations** to reduce costs

## Queue Types

### Standard Queue
- Unlimited throughput
- At-least-once delivery
- Best-effort ordering
- Lower cost

```typescript
const queue = new Sqs(this, 'StandardQueue', {
  name: 'standard-queue',
  stack: { id: 'my-app', tags: [] },
});
```

### FIFO Queue
- Up to 3,000 messages/second (with batching)
- Exactly-once processing
- Strict FIFO ordering
- Higher cost
- Name must end with `.fifo`

```typescript
const queue = new Sqs(this, 'FifoQueue', {
  name: 'order-queue.fifo',
  fifo: true,
  stack: { id: 'my-app', tags: [] },
});
```

## Lambda Integration

```typescript
import { Sqs, Function } from '@designofadecade/cdk-constructs';

const queue = new Sqs(this, 'JobQueue', {
  name: 'job-queue',
  deadLetterQueue: true,
  visibilityTimeout: Duration.seconds(300), // Match Lambda timeout
  stack: { id: 'my-app', tags: [] },
});

const processor = new Function(this, 'JobProcessor', {
  name: 'job-processor',
  entry: './src/handlers/process-job.ts',
  timeoutSeconds: 300,
  reservedConcurrentExecutions: 10, // Limit concurrent processing
  stack: { id: 'my-app', tags: [] },
});

// Add SQS event source
processor.function.addEventSource(
  new SqsEventSource(queue.queue, {
    batchSize: 10, // Process 10 messages at a time
    maxBatchingWindow: Duration.seconds(5),
    reportBatchItemFailures: true, // Partial batch failure support
  })
);
```

## Visibility Timeout Guidelines

Set based on Lambda execution time:
- Lambda timeout: 30s → Visibility: 30-60s
- Lambda timeout: 5min → Visibility: 5-10min
- Lambda timeout: 15min → Visibility: 15-30min

## Related Constructs

- [Function](./Function.md) - Lambda functions processing messages
- [EventBridge](./EventBridge.md) - Alternative for event-driven architecture
