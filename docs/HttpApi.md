# HttpApi Construct

CDK construct for creating API Gateway HTTP APIs with Lambda integration.

## Features

- HTTP API (v2) - lower latency and cost than REST API
- Multiple Lambda function integrations per API
- Support for multiple HTTP methods per route
- CORS support (configurable or default)
- Access logs to CloudWatch Logs
- Lambda authorizers with caching
- Automatic tagging

## Basic Usage

```typescript
import { HttpApi, Function } from '@designofadecade/cdk-constructs';

// Create Lambda functions
const usersHandler = new Function(this, 'UsersHandler', {
  name: 'users-handler',
  entry: './src/handlers/users.ts',
  stack: { id: 'my-app', tags: [] },
});

const healthHandler = new Function(this, 'HealthHandler', {
  name: 'health-handler',
  entry: './src/handlers/health.ts',
  stack: { id: 'my-app', tags: [] },
});

// Create API
const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  stack: { id: 'my-app', tags: [] },
});

// Add route integrations
api.addFunctionIntegration('/users', usersHandler.function, ['GET', 'POST']);
api.addFunctionIntegration('/users/{id}', usersHandler.function, ['GET', 'PUT', 'DELETE']);
api.addFunctionIntegration('/health', healthHandler.function, ['GET']);
```

## CORS Configuration

### Enable CORS with Defaults

```typescript
// Enable CORS with default configuration (allow all origins, common methods)
const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  cors: true,
  stack: { id: 'my-app', tags: [] },
});
```

### Custom CORS Configuration

```typescript
import { CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';

const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  cors: {
    allowOrigins: ['https://myapp.com', 'https://app.myapp.com'],
    allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.DELETE],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowCredentials: true,
  },
  stack: { id: 'my-app', tags: [] },
});
```

## Access Logs

### Enable Access Logging

API Gateway access logs are sent to CloudWatch Logs:

```typescript
const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  accessLogs: true, // Enable with defaults (7 day retention, auto-generated log group name)
  stack: { id: 'my-app', tags: [] },
});
```

### Custom Log Configuration with Retention

```typescript
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  accessLogs: {
    retention: RetentionDays.THIRTEEN_MONTHS,
    logGroupName: '/aws/apigateway/my-api', // Optional custom name
  },
  stack: { id: 'my-app', tags: [] },
});

// Access the log group
const logGroup = api.logGroup;
```

### Use Existing Log Group (by Object)

```typescript
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

// Create or reference a custom log group
const customLogGroup = new LogGroup(this, 'CustomLogs', {
  logGroupName: '/my-custom/api-logs',
  retention: RetentionDays.ONE_YEAR,
});

const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  accessLogs: {
    logGroup: customLogGroup, // Use existing log group
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Use Existing Log Group (by Name)

```typescript
const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  accessLogs: {
    logGroup: '/my-existing/log-group', // Reference existing log group by name
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Default Log Format (Enhanced for Audit)

By default, access logs include comprehensive audit-friendly fields:

**Request Identification:**
- `requestId` - Unique request identifier
- `requestTime` - Human-readable timestamp
- `requestTimeEpoch` - Unix timestamp

**Client Information:**
- `ip` - Source IP address
- `userAgent` - Client user agent string

**Request Details:**
- `httpMethod` - HTTP method (GET, POST, etc.)
- `path` - Actual request path (e.g., `/api/v1/dashboard/chart/123`)
- `routeKey` - Matched route pattern (e.g., `GET /api/v1/dashboard/{proxy+}`)
- `protocol` - HTTP protocol version
- `domainName` - API domain name

**Response Details:**
- `status` - HTTP status code
- `responseLength` - Response size in bytes

**Performance Metrics:**
- `integrationLatency` - Backend processing time (ms)
- `responseLatency` - Total response time (ms)

**Authorization & Security:**
- `principalId` - Authenticated principal (from authorizer)
- `userId` - User ID from JWT claims (sub claim)

**Error Tracking:**
- `errorMessage` - Error message if request failed
- `errorType` - Error type/category
- `integrationError` - Backend integration errors

These fields provide comprehensive audit trails for compliance, security monitoring, and debugging.

### Custom Log Format

You can override the default format with a custom one:

```typescript
const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  accessLogs: {
    format: JSON.stringify({
      requestId: '$context.requestId',
      userAgent: '$context.identity.userAgent',
      sourceIp: '$context.identity.sourceIp',
      requestTime: '$context.requestTime',
      httpMethod: '$context.httpMethod',
      routeKey: '$context.routeKey',
      status: '$context.status',
    }),
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Exporting to S3

To export CloudWatch Logs to S3:

1. **Manual Export**: Use AWS Console or CLI to export log groups to S3
2. **Automated Export**: Set up CloudWatch Logs subscription filter with Kinesis Firehose to S3
3. **Scheduled Export**: Use EventBridge + Lambda to periodically export logs

```typescript
import { Bucket } from 'aws-cdk-lib/aws-s3';

// Create S3 bucket for log exports
const logsBucket = new Bucket(this, 'ApiLogsBucket', {
  bucketName: 'my-api-logs-export',
});

// Note: Configure CloudWatch Logs export to S3 separately
// The s3Bucket reference can be used for setting up export jobs
const api = new HttpApi(this, 'Api', {
  name: 'my-api',
  accessLogs: {
    s3Bucket: logsBucket, // Reference for export configuration
    retention: RetentionDays.ONE_MONTH,
  },
  stack: { id: 'my-app', tags: [] },
});
```

## Lambda Authorizers

### Create an Authorizer

```typescript
import { Function } from '@designofadecade/cdk-constructs';

// Create authorizer function
const authFunction = new Function(this, 'AuthFunction', {
  name: 'api-authorizer',
  entry: './src/handlers/authorizer.ts',
  stack: { id: 'my-app', tags: [] },
});

// Create authorizer with caching (default 300 seconds)
const authorizer = HttpApi.createAuthorizerFunction(
  'MyAuthorizer',
  authFunction.function,
  { resultsCacheTtl: 300 }
);
```

### Use Authorizer on Routes

```typescript
// Protected routes with authorizer
api.addFunctionIntegration('/users', usersHandler.function, ['GET', 'POST'], {
  authorizer,
});

api.addFunctionIntegration('/admin', adminHandler.function, ['GET', 'PUT', 'DELETE'], {
  authorizer,
});

// Public route without authorizer
api.addFunctionIntegration('/health', healthHandler.function, ['GET']);
```

## Properties

### HttpApiProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Stack ID | API name |
| `cors` | `CorsConfig \| boolean` | - | CORS configuration (disabled by default) |
| `accessLogs` | `AccessLogsConfig \| boolean` | - | Access logs configuration (disabled by default) |
| `stack` | `object` | Required | Stack ID and tags |

### CorsConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `allowOrigins` | `string[]` | `['*']` | Allowed origins |
| `allowMethods` | `CorsHttpMethod[]` | GET, POST, PUT, DELETE, OPTIONS | Allowed HTTP methods |
| `allowHeaders` | `string[]` | - | Allowed headers |
| `allowCredentials` | `boolean` | - | Whether to allow credentials |

### AccessLogsConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `logGroup` | `LogGroup \| string` | - | Custom log group (object or name) |
| `logGroupName` | `string` | `/aws/apigateway/{api-name}` | Log group name (when creating new) |
| `retention` | `RetentionDays` | `ONE_WEEK` | CloudWatch log retention period |
| `format` | `string` | Default JSON format | Custom log format string |
| `s3Bucket` | `IBucket` | - | S3 bucket reference for exports |

### CreateAuthorizerFunctionProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `resultsCacheTtl` | `number` | 300 | Cache TTL in seconds for authorization results |

## Methods

### addFunctionIntegration()

Adds a Lambda function integration to the HTTP API.

```typescript
addFunctionIntegration(
  path: string,
  lambdaFunction: IFunction,
  methods?: HttpMethodType[],
  options?: AddFunctionIntegrationOptions
): void
```

**Parameters:**
- `path` - Route path (e.g., '/users', '/items/{id}')
- `lambdaFunction` - Lambda function to integrate
- `methods` - HTTP methods (default: ['GET'])
- `options` - Optional configuration including authorizer

**Examples:**
```typescript
api.addFunctionIntegration('/items', itemsFunction, ['GET', 'POST']);
api.addFunctionIntegration('/items/{id}', itemFunction, ['GET', 'PUT', 'DELETE'], {
  authorizer: myAuthorizer,
});
```

### HttpApi.createAuthorizerFunction()

Static method to create a Lambda authorizer for HTTP API routes.

```typescript
static createAuthorizerFunction(
  id: string,
  authorizerFunction: IFunction,
  props?: CreateAuthorizerFunctionProps
): HttpLambdaAuthorizer
```

**Parameters:**
- `id` - Unique identifier for the authorizer
- `authorizerFunction` - Lambda function that validates requests
- `props` - Optional configuration (cache TTL)

**Returns:** Configured HTTP Lambda authorizer

The authorizer:
- Uses simple response type
- Reads identity from cookie header
- Caches results for specified TTL (default 300 seconds)

**Example:**
```typescript
const authorizer = HttpApi.createAuthorizerFunction(
  'CookieAuth',
  authFunction,
  { resultsCacheTtl: 600 }
);
```

## Getters

- `api` - HTTP API instance (`AwsHttpApi`)
- `apiId` - API ID (`string`)
- `apiEndpoint` - API endpoint URL (`string`)
- `domainName` - API domain name without protocol (`string`)
- `logGroup` - CloudWatch Log Group if access logs enabled (`ILogGroup | undefined`)

## Best Practices

1. **Use HTTP API** over REST API for lower cost and latency (up to 71% cheaper)
2. **Enable CORS** only for required origins in production
3. **Use Lambda authorizers** for custom authentication logic with caching
4. **Enable access logging** for monitoring, debugging, and audit compliance
5. **Use default log format** for comprehensive audit trails (includes user identity, performance metrics, and errors)
6. **Set appropriate log retention** to balance cost and compliance needs (consider 13+ months for audit requirements)
7. **Export logs to S3** for long-term storage and analytics
8. **Use CloudWatch Insights** to query logs for security analysis and performance monitoring
9. **Monitor authorization failures** using the `principalId` and error fields
10. **Use path parameters** for RESTful resource identifiers (e.g., `/users/{id}`)
11. **Group related routes** to the same Lambda function for efficiency

## Related Constructs

- [Function](./Function.md) - Lambda function handlers
- [Cognito](./Cognito.md) - User authentication with built-in HTTP API integration
- [Monitoring](./Monitoring.md) - CloudWatch alarms and notifications
