# HttpApi Construct

CDK construct for creating API Gateway HTTP APIs with Lambda integration.

## Features

- HTTP API (v2) - lower latency and cost than REST API
- Lambda integration
- CORS support
- Access logs to CloudWatch and S3
- Custom domain support
- JWT/Cognito authorization
- Request validation

## Basic Usage

```typescript
import { HttpApi, Function } from '@designofadecade/cdk-constructs';

const fn = new Function(this, 'ApiHandler', {
  name: 'api-handler',
  entry: './src/handlers/api.ts',
  stack: { id: 'my-app', tags: [] },
});

const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  handler: fn.function,
  stack: { id: 'my-app', tags: [] },
});
```

## Access Logs

### Enable Access Logging

API Gateway access logs are sent to CloudWatch Logs:

```typescript
const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  accessLogs: true, // Enable with defaults (7 day retention)
  stack: { id: 'my-app', tags: [] },
});
```

### Custom Log Configuration

```typescript
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';

const logsBucket = new Bucket(this, 'ApiLogsBucket', {
  bucketName: 'my-api-logs',
});

const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  accessLogs: {
    retention: RetentionDays.ONE_MONTH,
    s3Bucket: logsBucket, // Reference for CloudWatch to S3 export
  },
  stack: { id: 'my-app', tags: [] },
});

// Access the log group
const logGroup = api.logGroup;
```

### Log Format

By default, logs include:
- Request ID
- Source IP address
- Request time
- HTTP method
- Route key
- Response status
- Protocol
- Response length

You can customize the format:

```typescript
const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  accessLogs: {
    format: JSON.stringify({
      requestId: '$context.requestId',
      userAgent: '$context.identity.userAgent',
      sourceIp: '$context.identity.sourceIp',
      requestTime: '$context.requestTime',
    }),
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Exporting to S3

To export CloudWatch Logs to S3, you can:

1. **Manual Export**: Use AWS Console or CLI to export log groups to S3
2. **Automated Export**: Set up CloudWatch Logs subscription filter with Kinesis Firehose
3. **Scheduled Export**: Use EventBridge + Lambda to periodically export logs

## Properties

### HttpApiProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | - | API name (defaults to stack ID) |
| `cors` | `CorsConfig \| boolean` | - | CORS configuration |
| `accessLogs` | `AccessLogsConfig \| boolean` | - | Access logs configuration |
| `stack` | `object` | Required | Stack ID and tags |

### AccessLogsConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `s3Bucket` | `IBucket` | - | S3 bucket for log exports |
| `retention` | `RetentionDays` | `ONE_WEEK` | CloudWatch log retention |
| `format` | `string` | Default JSON | Custom log format |

## Getters

- `api` - HTTP API instance
- `apiId` - API ID
- `apiEndpoint` - API endpoint URL
- `domainName` - API domain name (without protocol)
- `logGroup` - CloudWatch Log Group (if access logs enabled)

## Best Practices

1. **Use HTTP API** over REST API for lower cost and latency
2. **Enable CORS** only for required origins
3. **Use JWT authorizers** for token-based auth
4. **Enable access logging** for monitoring
5. **Set throttling limits** to protect backend
6. **Use custom domains** for production
7. **Version your API** for backwards compatibility

## Related Constructs

- [Function](./Function.md) - Lambda handlers
- [Cognito](./Cognito.md) - User authentication
