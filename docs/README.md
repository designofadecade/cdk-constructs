# CDK Constructs Documentation

Comprehensive documentation for all CDK constructs in this library.

## Available Constructs

### Compute
- **[Function](./Function.md)** - AWS Lambda functions with concurrency and auto-scaling
- **[Server](./Server.md)** - EC2 servers with Docker support
- **[BastionHost](./BastionHost.md)** - Secure SSH access to VPC resources

### Networking
- **[Vpc](./Vpc.md)** - Virtual Private Cloud configuration
- **[HttpApi](./HttpApi.md)** - API Gateway HTTP APIs
- **[CloudFront](./CloudFront.md)** - CDN distributions

### Storage
- **[S3Bucket](./S3Bucket.md)** - S3 buckets with security best practices
- **[DynamoTable](./DynamoTable.md)** - DynamoDB tables

### Database
- **[RdsDatabase](./RdsDatabase.md)** - Aurora Serverless v2 databases

### Messaging & Events
- **[Sqs](./Sqs.md)** - SQS queues with dead letter queues
- **[EventBridge](./EventBridge.md)** - Scheduled Lambda triggers
- **[Ses](./Ses.md)** - Email service configuration

### Security & Identity
- **[Cognito](./Cognito.md)** - User authentication and authorization
- **[Secrets](./Secrets.md)** - Secrets Manager integration

## Quick Start Examples

### Serverless API with Database

```typescript
import {
  Function,
  HttpApi,
  DynamoTable,
  Cognito,
} from '@designofadecade/cdk-constructs';

// Database
const table = new DynamoTable(this, 'Users', {
  name: 'users',
  partitionKey: { name: 'userId', type: 'S' },
  stack: { id: 'my-app', tags: [] },
});

// API Handler
const api = new Function(this, 'ApiHandler', {
  name: 'api-handler',
  entry: './src/api.ts',
  environment: {
    TABLE_NAME: table.tableName,
  },
  reservedConcurrentExecutions: 50,
  provisionedConcurrentExecutions: 5,
  autoScaling: {
    minCapacity: 2,
    maxCapacity: 20,
    targetUtilization: 0.7,
  },
  stack: { id: 'my-app', tags: [] },
});

table.table.grantReadWriteData(api.function);

// API Gateway
const apiGateway = new HttpApi(this, 'Api', {
  name: 'my-api',
  handler: api.function,
  stack: { id: 'my-app', tags: [] },
});

// Authentication
const auth = new Cognito(this, 'Auth', {
  name: 'my-app-auth',
  mfa: true,
  stack: { id: 'my-app', tags: [] },
});
```

### Internal Portal with RDS

```typescript
import {
  Function,
  Vpc,
  RdsDatabase,
  Cognito,
} from '@designofadecade/cdk-constructs';

// VPC
const vpc = new Vpc(this, 'Vpc', {
  name: 'portal-vpc',
  maxAzs: 2,
  stack: { id: 'portal', tags: [] },
});

// Database
const db = new RdsDatabase(this, 'Database', {
  name: 'portal-db',
  vpc: vpc.vpc,
  engine: 'postgres',
  minCapacity: 0.5,
  maxCapacity: 2,
  stack: { id: 'portal', tags: [] },
});

// Portal Function
const portal = new Function(this, 'Portal', {
  name: 'company-portal',
  entry: './src/portal.ts',
  vpc: vpc.vpc,
  environment: {
    DB_ENDPOINT: db.endpoint,
    DB_SECRET_ARN: db.secret.secretArn,
  },
  memorySize: 1024,
  timeoutSeconds: 30,
  reservedConcurrentExecutions: 25,
  provisionedConcurrentExecutions: 2,
  autoScaling: {
    minCapacity: 1,
    maxCapacity: 10,
    targetUtilization: 0.8,
  },
  stack: { id: 'portal', tags: [] },
});

db.secret.grantRead(portal.function);
```

### Background Job Processing

```typescript
import {
  Function,
  Sqs,
  EventBridge,
} from '@designofadecade/cdk-constructs';

// Queue
const jobQueue = new Sqs(this, 'JobQueue', {
  name: 'job-queue',
  deadLetterQueue: true,
  maxReceiveCount: 3,
  visibilityTimeout: Duration.seconds(300),
  stack: { id: 'jobs', tags: [] },
});

// Processor
const processor = new Function(this, 'JobProcessor', {
  name: 'job-processor',
  entry: './src/process-job.ts',
  timeoutSeconds: 300,
  memorySize: 2048,
  reservedConcurrentExecutions: 10,
  stack: { id: 'jobs', tags: [] },
});

// Scheduled Job
const scheduler = new Function(this, 'Scheduler', {
  name: 'job-scheduler',
  entry: './src/schedule-jobs.ts',
  environment: {
    QUEUE_URL: jobQueue.queueUrl,
  },
  stack: { id: 'jobs', tags: [] },
});

new EventBridge(this, 'HourlySchedule', {
  name: 'hourly-job',
  schedule: 'rate(1 hour)',
  target: scheduler.function,
  stack: { id: 'jobs', tags: [] },
});

jobQueue.queue.grantSendMessages(scheduler.function);
```

## Best Practices by Use Case

### Public API
- ✅ Use reserved concurrency (50-100)
- ✅ Enable provisioned concurrency with auto-scaling
- ✅ Set target utilization to 0.6-0.7
- ✅ Use CloudFront for caching
- ✅ Enable throttling limits
- ✅ Monitor error rates and latency

### Internal Portal
- ✅ Use lower reserved concurrency (10-30)
- ✅ Use minimal provisioned concurrency (1-2)
- ✅ Set higher target utilization (0.8)
- ✅ Deploy in VPC for database access
- ✅ Use Cognito for authentication
- ✅ Consider session management

### Background Jobs
- ✅ Use SQS for job queue
- ✅ Set appropriate reserved concurrency
- ✅ Skip provisioned concurrency (cold starts OK)
- ✅ Use DLQ for failed jobs
- ✅ Implement idempotent processing
- ✅ Set visibility timeout > Lambda timeout

### Real-time/Webhooks
- ✅ Use provisioned concurrency (eliminate cold starts)
- ✅ Keep functions warm (min capacity 1-2)
- ✅ Set lower timeout (10-30s)
- ✅ Implement retry logic
- ✅ Monitor response times
- ✅ Use SQS for async processing if possible

## Cost Optimization

### Development
- ❌ No provisioned concurrency
- ❌ No reserved concurrency
- ✅ Use smaller instance types
- ✅ Single AZ for VPC
- ✅ Delete resources when not in use

### Production
- ✅ Use auto-scaling for provisioned concurrency
- ✅ Set appropriate reserved concurrency
- ✅ Right-size memory and timeout
- ✅ Use ARM64 architecture (20% savings)
- ✅ Enable cost allocation tags
- ✅ Monitor and optimize based on CloudWatch metrics

## Support

For issues, questions, or contributions, please refer to:
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [README.md](../README.md)
- [QUICKSTART.md](../QUICKSTART.md)
