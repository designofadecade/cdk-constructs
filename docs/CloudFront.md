# CloudFront Construct

CDK construct for creating CloudFront distributions with security best practices.

## Features

- Automatic SSL/TLS certificate management
- Security headers by default
- HTTP/2 and HTTP/3 enabled
- S3 bucket origin support
- Custom domain support
- WAF integration ready
- **Access logging to S3**

## Basic Usage

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';

const distribution = new CloudFront(this, 'Distribution', {
  name: 'my-distribution',
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'my-app', tags: [] },
});
```

## Access Logging

CloudFront can write access logs to an S3 bucket for monitoring, analysis, and compliance.

### Enable Logging

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { S3Bucket } from '@designofadecade/cdk-constructs';

// Create a bucket for logs
const logBucket = new S3Bucket(this, 'CloudFrontLogs', {
  name: 'cloudfront-logs',
  stack: { id: 'my-app', tags: [] },
});

// Create distribution with logging
const distribution = new CloudFront(this, 'Distribution', {
  name: 'my-distribution',
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  logging: {
    bucket: logBucket.bucket,
    prefix: 'cloudfront/',        // Optional: organize logs in a folder
    includeCookies: true,          // Optional: include cookies in logs (default: false)
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Logging Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `bucket` | `IBucket` | Required | S3 bucket for storing logs |
| `prefix` | `string` | `''` | Prefix for log file names (e.g., 'cloudfront/') |
| `includeCookies` | `boolean` | `false` | Whether to include cookies in access logs |

### Log Fields

CloudFront access logs include:
- Request date/time
- Client IP address
- Request method and path
- Response status code
- User agent
- Referrer
- Cookies (if `includeCookies: true`)

### Best Practices for Logging

1. **Separate log bucket** - Use a dedicated bucket for logs, not your origin bucket
2. **Enable S3 lifecycle policies** - Automatically archive or delete old logs to save costs
3. **Analyze logs** - Use Amazon Athena or CloudWatch Logs Insights for analysis
4. **Secure the log bucket** - Restrict access to authorized personnel only
5. **Consider costs** - Logging generates storage costs based on traffic volume

## Custom CloudFront Functions

CloudFront Functions are lightweight JavaScript functions that run on CloudFront edge locations. They're ideal for simple request/response transformations with low latency.

### Creating Custom Functions

Use `CloudFront.createFunction()` to create custom CloudFront Functions that can be assigned to behaviors:

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { FunctionEventType } from 'aws-cdk-lib/aws-cloudfront';

// Create a custom function to transform URIs
const moderationFunction = CloudFront.createFunction(
  this,
  'ModerationBehaviorFunction',
  `function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var prefix = '/m-7f3d9e2a8c4b';
    
    if (!uri.includes('/res/')) {
      uri = uri.toLowerCase();
      var relative = uri.startsWith(prefix) ? uri.slice(prefix.length) : uri;
      
      if (relative === '' || relative === '/') {
        request.uri = prefix + '/index.html';
      } else if (!relative.includes('.')) {
        request.uri = prefix + '/' + relative.replace(/^\\//, '') + '.html';
      } else {
        request.uri = uri;
      }
    }
    
    return request;
  }`
);

// Create distribution
const distribution = new CloudFront(this, 'Distribution', {
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'my-app', tags: [] },
});

// Add behavior with custom function
distribution.addBehavior('/m-*', CloudFront.s3BucketOrigin('moderation', moderationBucket), {
  functions: [moderationFunction],
});
```

### Function Event Types

CloudFront Functions can run at different stages:

```typescript
// Viewer Request (default) - runs before CloudFront cache lookup
const requestFunction = CloudFront.createFunction(
  this,
  'RequestFunction',
  `function handler(event) { return event.request; }`
);

// Viewer Response - runs after receiving response from origin
const responseFunction = CloudFront.createFunction(
  this,
  'ResponseFunction',
  `function handler(event) {
    var response = event.response;
    response.headers['x-custom-header'] = { value: 'custom-value' };
    return response;
  }`,
  FunctionEventType.VIEWER_RESPONSE
);
```

### Use Cases for Custom Functions

1. **URL Rewriting** - Transform request URIs to match your origin structure
2. **Header Manipulation** - Add, modify, or remove HTTP headers
3. **Authentication** - Validate tokens or signed cookies
4. **A/B Testing** - Route requests to different origins based on cookies
5. **Redirects** - Implement custom redirect logic
6. **Normalization** - Standardize URLs (e.g., lowercase, remove query strings)

### Built-in Functions

The construct also provides built-in helper functions:

```typescript
// Index rewriting - adds /index.html to directory paths
const indexFunction = distribution.getIndexRewriteFunction();

// SPA routing - rewrites non-file requests to /index.html
const spaFunction = distribution.getSpaRewriteFunction('/app');

// Use in behaviors
distribution.addBehavior('/app/*', appOrigin, {
  functions: [spaFunction],
});
```

### Function Limitations

CloudFront Functions have some constraints:
- Maximum execution time: < 1ms
- Memory limit: 2MB
- Cannot make network requests
- Limited to JavaScript ES5.1
- Best for simple, fast transformations

For complex logic or external API calls, consider using Lambda@Edge instead.

> 📖 **For comprehensive examples and best practices**, see the [CloudFront Custom Functions](./CloudFrontCustomFunctions.md) guide.

## Route 53 DNS Records

Easily add Route 53 DNS records that point to your CloudFront distribution. The construct automatically creates both A and AAAA records for IPv4 and IPv6 support.

### Automatic DNS Configuration

Configure DNS records during distribution creation:

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { HostedZone } from 'aws-cdk-lib/aws-route53';

const hostedZone = HostedZone.fromLookup(this, 'Zone', {
  domainName: 'example.com',
});

const distribution = new CloudFront(this, 'Distribution', {
  name: 'my-distribution',
  domain: {
    names: ['example.com', 'www.example.com'],
    certificate: myCertificate,
    dns: {
      hostedZone,
      records: ['example.com', 'www.example.com'], // Creates A and AAAA for each
    },
  },
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Adding DNS Records Manually

Use the `addRoute53Records()` helper method to add DNS records after distribution creation:

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { HostedZone } from 'aws-cdk-lib/aws-route53';

const hostedZone = HostedZone.fromLookup(this, 'Zone', {
  domainName: 'example.com',
});

const distribution = new CloudFront(this, 'Distribution', {
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'my-app', tags: [] },
});

// Add single record (creates both A and AAAA)
distribution.addRoute53Records(hostedZone, 'www.example.com');

// Add multiple records at once
distribution.addRoute53Records(hostedZone, [
  'example.com',
  'www.example.com',
  'cdn.example.com',
]);
```

### Multi-Language Domain Example

Here's a practical example for multi-language sites:

```typescript
const stagingZone = HostedZone.fromLookup(this, 'StagingZone', {
  domainName: 'staging.example.com',
});

const distribution = new CloudFront(this, 'StagingDistribution', {
  domain: {
    names: ['en.staging.example.com', 'fr.staging.example.com'],
    certificate: stagingCertificate,
  },
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'staging', tags: [] },
});

// Add DNS records for both English and French domains
distribution.addRoute53Records(stagingZone, [
  'en.staging.example.com',
  'fr.staging.example.com',
]);
```

### What Gets Created

For each record name, the helper automatically creates:
- **A Record** - IPv4 alias pointing to CloudFront
- **AAAA Record** - IPv6 alias pointing to CloudFront

This ensures your distribution is accessible via both IPv4 and IPv6.

## Properties

### CloudFrontProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Distribution name |
| `stack` | `object` | Required | Stack ID and tags |
| `defaultBehavior` | `object` | Required | Default origin and behavior |
| `domainName` | `string` | - | Custom domain name |
| `certificate` | `ICertificate` | - | ACM certificate for custom domain |
| `logging` | `LoggingConfig` | - | Access logging configuration |

## Getters

- `distribution` - CloudFront distribution
- `distributionId` - Distribution ID
- `distributionDomainName` - CloudFront domain name

## Best Practices

1. **Always use HTTPS** - Enforce secure connections
2. **Enable HTTP/3** - Better performance (enabled by default)
3. **Add security headers** - Protect against common attacks (enabled by default)
4. **Use Origin Access Identity** for S3 origins
5. **Enable access logging** for audit trail
6. **Consider WAF** for DDoS protection
7. **Set appropriate cache policies** based on content type

## Related Constructs

- [S3Bucket](./S3Bucket.md) - S3 bucket for origin content
- [CloudFront Custom Functions](./CloudFrontCustomFunctions.md) - Detailed guide for creating custom edge functions
