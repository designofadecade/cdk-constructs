# Function Construct

CDK construct for creating AWS Lambda functions with best practices built-in.

## Features

- Support for both inline code and NodejsFunction with bundling
- Automatic VPC security group creation
- ARM64 architecture by default
- Node.js 24.x runtime
- ESM output format
- Asset copying support
- Function URL support
- Reserved concurrency limits
- Provisioned concurrency with auto-scaling
- Helper methods for common patterns

## Basic Usage

### Simple Function with Inline Code

```typescript
import { Function } from '@designofadecade/cdk-constructs';

const fn = new Function(this, 'SimpleFunction', {
  name: 'simple-function',
  code: Function.PlaceHolderCode(),
  stack: { id: 'my-app', tags: [] },
});
```

### Function from Entry File

```typescript
const fn = new Function(this, 'ApiFunction', {
  name: 'api-function',
  entry: './src/handlers/api.ts',
  environment: {
    TABLE_NAME: table.tableName,
    API_KEY: process.env.API_KEY!,
  },
  memorySize: 1024,
  timeoutSeconds: 30,
  stack: { id: 'my-app', tags: [] },
});
```

### Function with Function URL

```typescript
const fn = new Function(this, 'PublicApiFunction', {
  name: 'public-api',
  entry: './src/handlers/public-api.ts',
  functionUrl: {
    authType: 'NONE', // or 'AWS_IAM' for authenticated access
  },
  stack: { id: 'my-app', tags: [] },
});

// Access the function URL
console.log(fn.functionUrl?.url);
console.log(fn.urlDomainName); // Domain name without protocol/path
```

### VPC-Enabled Function

```typescript
const vpc = new Vpc(this, 'MyVpc', {
  name: 'my-vpc',
  stack: { id: 'my-app', tags: [] },
});

const fn = new Function(this, 'VpcFunction', {
  name: 'vpc-function',
  entry: './src/handlers/vpc-handler.ts',
  vpc: vpc.vpc,
  stack: { id: 'my-app', tags: [] },
});
```

## Concurrency & Auto-Scaling Best Practices

### Reserved Concurrency

Limits the maximum number of concurrent executions for a function. This is crucial for:
- **Protecting downstream services** from being overwhelmed
- **Preventing cost overruns** from runaway executions
- **Ensuring other functions** can access available concurrency

```typescript
// Example: API that calls external rate-limited service
const apiFunction = new Function(this, 'RateLimitedApi', {
  name: 'rate-limited-api',
  entry: './src/handlers/api.ts',
  reservedConcurrentExecutions: 50, // Limit to 50 concurrent executions
  stack: { id: 'my-app', tags: [] },
});
```

**When to use:**
- ✅ Functions calling rate-limited external APIs
- ✅ Functions accessing shared resources (databases, queues)
- ✅ Production workloads with predictable traffic patterns
- ❌ Development/testing environments
- ❌ Functions that need unlimited scaling

**Recommended Settings:**
- **Public API**: 50-100 (protects backend)
- **Internal Portal**: 10-30 (based on company size)
- **Background Jobs**: 5-20 (prevents resource exhaustion)
- **Critical Services**: No limit (let AWS handle)

### Provisioned Concurrency

Pre-warms Lambda instances to eliminate cold starts. Use when:
- Response time must be consistently fast (<100ms)
- Cold start latency is unacceptable (>1-2 seconds)
- Traffic is predictable and consistent

```typescript
// Example: Customer-facing API with strict SLA
const criticalApi = new Function(this, 'CriticalApi', {
  name: 'critical-api',
  entry: './src/handlers/critical.ts',
  provisionedConcurrentExecutions: 10, // Keep 10 instances warm
  stack: { id: 'my-app', tags: [] },
});
```

**Cost Impact:**
- ~$35/month per provisioned instance (ca-central-1)
- Charged even when idle
- More expensive than on-demand invocations

**When to use:**
- ✅ Customer-facing APIs with SLAs
- ✅ Real-time processing (webhooks, chat)
- ✅ Functions with large dependencies/cold start time
- ❌ Infrequent batch jobs
- ❌ Internal tools without strict latency requirements
- ❌ Development environments

### Provisioned Concurrency with Auto-Scaling

Automatically adjusts provisioned concurrency based on utilization. This is the **recommended approach** for most production workloads as it balances performance and cost.

```typescript
// Example: Production API with variable traffic
const scalableApi = new Function(this, 'ScalableApi', {
  name: 'scalable-api',
  entry: './src/handlers/api.ts',
  provisionedConcurrentExecutions: 5, // Initial capacity
  autoScaling: {
    minCapacity: 2,           // Scale down to 2 instances (off-peak)
    maxCapacity: 20,          // Scale up to 20 instances (peak)
    targetUtilization: 0.7,   // Target 70% utilization
  },
  stack: { id: 'my-app', tags: [] },
});
```

**How it works:**
- Monitors the ratio of concurrent executions to provisioned concurrency
- Scales up when utilization exceeds target (default 70%)
- Scales down when utilization drops below target
- Changes take ~2-3 minutes to take effect

**Target Utilization Guidelines:**
- **0.7 (70%)** - Default, balanced performance/cost
- **0.5-0.6 (50-60%)** - More headroom for sudden spikes (e-commerce, events)
- **0.8-0.9 (80-90%)** - Cost-optimized for internal tools with gradual traffic changes

**Configuration Examples:**

```typescript
// E-commerce site (traffic spikes during sales)
provisionedConcurrentExecutions: 10,
autoScaling: {
  minCapacity: 5,
  maxCapacity: 50,
  targetUtilization: 0.6, // More headroom for sudden spikes
}

// Internal company portal (business hours only)
provisionedConcurrentExecutions: 2,
autoScaling: {
  minCapacity: 1,
  maxCapacity: 10,
  targetUtilization: 0.8, // Higher utilization acceptable
}

// Financial API (consistent traffic, strict SLA)
provisionedConcurrentExecutions: 20,
autoScaling: {
  minCapacity: 15,
  maxCapacity: 40,
  targetUtilization: 0.7,
}

// Background processing (predictable load)
provisionedConcurrentExecutions: 3,
autoScaling: {
  minCapacity: 1,
  maxCapacity: 15,
  targetUtilization: 0.8,
}
```

## Use Case Recommendations

### Public-Facing API

```typescript
const publicApi = new Function(this, 'PublicApi', {
  name: 'public-api',
  entry: './src/handlers/api.ts',
  memorySize: 512,
  timeoutSeconds: 30,
  reservedConcurrentExecutions: 100,
  provisionedConcurrentExecutions: 10,
  autoScaling: {
    minCapacity: 5,
    maxCapacity: 50,
    targetUtilization: 0.7,
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Internal Company Portal

```typescript
const portal = new Function(this, 'CompanyPortal', {
  name: 'company-portal',
  entry: './src/handlers/portal.ts',
  memorySize: 1024,
  timeoutSeconds: 30,
  reservedConcurrentExecutions: 25,
  provisionedConcurrentExecutions: 2,
  autoScaling: {
    minCapacity: 1,
    maxCapacity: 10,
    targetUtilization: 0.8,
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Background Job Processor

```typescript
const jobProcessor = new Function(this, 'JobProcessor', {
  name: 'job-processor',
  entry: './src/handlers/jobs.ts',
  memorySize: 2048,
  timeoutSeconds: 300,
  reservedConcurrentExecutions: 10,
  // No provisioned concurrency - cold starts acceptable
  stack: { id: 'my-app', tags: [] },
});
```

### Webhook Handler (External Service)

```typescript
const webhook = new Function(this, 'WebhookHandler', {
  name: 'webhook-handler',
  entry: './src/handlers/webhook.ts',
  memorySize: 512,
  timeoutSeconds: 30,
  reservedConcurrentExecutions: 20,
  provisionedConcurrentExecutions: 2,
  // Keep some warm to respond quickly
  stack: { id: 'my-app', tags: [] },
});
```

### Development/Testing Function

```typescript
const devFunction = new Function(this, 'DevFunction', {
  name: 'dev-function',
  entry: './src/handlers/dev.ts',
  memorySize: 512,
  timeoutSeconds: 60,
  // No concurrency limits in dev
  stack: { id: 'my-app-dev', tags: [] },
});
```

## Advanced Features

### Asset Copying

Copy additional files (templates, data files) into the Lambda bundle:

```typescript
const fn = new Function(this, 'TemplateFunction', {
  name: 'template-function',
  entry: './src/handlers/template.ts',
  assets: [
    './templates/email.html',
    './data/config.json',
    {
      source: './templates/invoice.pdf',
      target: 'pdf/invoice.pdf', // Custom path in bundle
    },
  ],
  stack: { id: 'my-app', tags: [] },
});
```

### CJS Dynamic Import Fix

Fix ESM modules importing CommonJS modules:

```typescript
const fn = new Function(this, 'CjsFunction', {
  name: 'cjs-function',
  entry: './src/handlers/cjs.ts',
  fixCsjDynamicImportIssue: true,
  stack: { id: 'my-app', tags: [] },
});
```

### Parameters and Secrets Extension

Add AWS Parameters and Secrets Lambda Extension for efficient secret retrieval:

```typescript
const fn = new Function(this, 'SecureFunction', {
  name: 'secure-function',
  entry: './src/handlers/secure.ts',
  environment: {
    SECRETS_EXTENSION_HTTP_PORT: '2773',
    SECRETS_MANAGER_TTL: '300',
  },
  stack: { id: 'my-app', tags: [] },
});

fn.addParametersSecretsExtensionLayer();
```

### Code from S3 Bucket

Deploy placeholder code initially, update later:

```typescript
const code = Function.CodeFromBucket(
  this,
  myBucket,
  'functions/my-function.zip'
);

const fn = new Function(this, 'S3Function', {
  name: 's3-function',
  code,
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### FunctionProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Function name |
| `stack` | `object` | Required | Stack ID and tags |
| `entry` | `string` | - | Entry file path for NodejsFunction |
| `code` | `Code` | - | Inline code (takes precedence over entry) |
| `vpc` | `IVpc` | - | VPC to deploy function in |
| `securityGroup` | `ISecurityGroup` | - | Security group (auto-created if VPC set) |
| `environment` | `Record<string, string>` | - | Environment variables |
| `memorySize` | `number` | 512 | Memory in MB |
| `timeoutSeconds` | `number` | 30 | Timeout in seconds |
| `assets` | `Array<string \| AssetConfig>` | - | Additional assets to bundle |
| `fixCsjDynamicImportIssue` | `boolean` | false | Add CJS import fix banner |
| `url` / `functionUrl` | `FunctionUrlConfig` | - | Function URL configuration |
| `reservedConcurrentExecutions` | `number` | - | Maximum concurrent executions |
| `provisionedConcurrentExecutions` | `number` | - | Pre-warmed instances |
| `autoScaling` | `ProvisionedConcurrencyAutoScalingConfig` | - | Auto-scaling configuration |

### ProvisionedConcurrencyAutoScalingConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `minCapacity` | `number` | 1 | Minimum provisioned instances |
| `maxCapacity` | `number` | Required | Maximum provisioned instances |
| `targetUtilization` | `number` | 0.7 | Target utilization ratio (0-1) |

## Getters

- `name` - Function name
- `functionName` - Lambda function name
- `functionArn` - Lambda function ARN
- `function` - IFunction instance
- `functionUrl` - Function URL (if configured)
- `urlDomainName` - Domain name without protocol/path
- `securityGroup` - Auto-created security group (if VPC-enabled)
- `alias` - Lambda alias (if provisioned concurrency configured)
- `autoScalingTarget` - Auto-scaling target (if auto-scaling configured)

## Static Methods

### `Function.PlaceHolderCode()`

Creates placeholder code that returns 501 Not Implemented.

```typescript
const code = Function.PlaceHolderCode();
```

### `Function.CodeFromBucket(scope, bucket, key, props?)`

Creates code from S3 bucket with initial placeholder deployment.

```typescript
const code = Function.CodeFromBucket(
  this,
  myBucket,
  'functions/my-function.zip',
  { objectVersion: 'v1' }
);
```

## Best Practices Summary

1. **Always set `reservedConcurrentExecutions`** for production workloads that access shared resources
2. **Use provisioned concurrency with auto-scaling** for customer-facing APIs with variable traffic
3. **Start with lower provisioned capacity** and let auto-scaling handle peaks
4. **Set target utilization to 0.6-0.7** for traffic with sudden spikes
5. **Set target utilization to 0.8-0.9** for gradual traffic changes (internal tools)
6. **Skip provisioned concurrency** for infrequent, time-insensitive workloads
7. **Monitor CloudWatch metrics**: `ConcurrentExecutions`, `ProvisionedConcurrencyUtilization`
8. **Use ARM64 architecture** (default) for 20% cost savings
9. **Right-size memory** - more memory = faster CPU and network
10. **Keep functions focused** - one responsibility per function

## Common Pitfalls

❌ **Not setting reserved concurrency for API functions**
- Can exhaust account concurrency, affecting other functions

❌ **Using provisioned concurrency without auto-scaling**
- Wastes money during off-peak hours

❌ **Setting target utilization too high (>0.9)**
- Doesn't leave headroom for traffic spikes

❌ **Setting min capacity equal to max capacity**
- Defeats the purpose of auto-scaling

❌ **Using provisioned concurrency in development**
- Unnecessary cost for dev/test environments

## Monitoring

Key CloudWatch metrics to monitor:

- `ConcurrentExecutions` - Current concurrent executions
- `ProvisionedConcurrencyUtilization` - Utilization of provisioned capacity
- `ProvisionedConcurrencyInvocations` - Invocations handled by provisioned instances
- `ProvisionedConcurrencySpilloverInvocations` - Invocations exceeding provisioned capacity
- `Throttles` - Invocations throttled due to concurrency limits
- `Duration` - Function execution time
- `Errors` - Function errors

## Related Constructs

- [HttpApi](./HttpApi.md) - API Gateway HTTP API
- [Vpc](./Vpc.md) - VPC configuration
- [Secrets](./Secrets.md) - Secrets Manager integration
- [EventBridge](./EventBridge.md) - Scheduled function triggers
