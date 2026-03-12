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
    origin: CloudFront.S3BucketOrigin('origin', myBucket),
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
    origin: CloudFront.S3BucketOrigin('origin', myBucket),
  },
  logging: {
    bucket: logBucket.bucket,
    prefix: 'cloudfront/',        // Optional: organize logs in a folder
    includeCookies: true,          // Optional: include cookies in logs (default: false)
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Modern (Web) Log Format

CloudFront supports a modern JSON-based log format that provides additional fields and better parsing capabilities. Use `CloudFront.LOG_FORMAT_WEB` to enable the new Amazon S3 (Modern) log format.

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';

const distribution = new CloudFront(this, 'Distribution', {
  name: 'my-distribution',
  defaultBehavior: {
    origin: CloudFront.S3BucketOrigin('origin', myBucket),
  },
  logging: {
    bucket: logBucket.bucket,
    prefix: 'cloudfront/',
    logFormat: CloudFront.LOG_FORMAT_WEB,  // Modern JSON format
  },
  stack: { id: 'my-app', tags: [] },
});
```

**Benefits of the Web (Modern) format:**
- JSON-based for easier parsing and analysis
- Additional fields including HTTP version, TLS details, and more
- Better integration with log analysis tools
- Improved query performance in Amazon Athena

**Available log formats:**
- `CloudFront.LOG_FORMAT_STANDARD` - Legacy tab-delimited format (default)
- `CloudFront.LOG_FORMAT_WEB` - Modern JSON format

### Logging Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `bucket` | `IBucket` | Required | S3 bucket for storing logs |
| `prefix` | `string` | `''` | Prefix for log file names (e.g., 'cloudfront/') |
| `includeCookies` | `boolean` | `false` | Whether to include cookies in access logs |
| `logFormat` | `CloudFrontLogFormat` | `LOG_FORMAT_STANDARD` | Log format: STANDARD (legacy) or WEB (modern JSON) |

### Log Fields

CloudFront access logs include:
- Request date/time
- Client IP address
- Request method and path
- Response status code
- User agent
- Referrer
- Cookies (if `includeCookies: true`)
- **Additional fields in Web (Modern) format:**
  - HTTP protocol version (HTTP/1.1, HTTP/2, HTTP/3)
  - TLS version and cipher
  - Time to first byte (TTFB)
  - SSL/TLS protocol details
  - Content type
  - And many more...

### Best Practices for Logging

1. **Use modern log format** - Consider using `LOG_FORMAT_WEB` for new projects
2. **Separate log bucket** - Use a dedicated bucket for logs, not your origin bucket
2. **Enable S3 lifecycle policies** - Automatically archive or delete old logs to save costs
3. **Analyze logs** - Use Amazon Athena or CloudWatch Logs Insights for analysis
4. **Secure the log bucket** - Restrict access to authorized personnel only
5. **Consider costs** - Logging generates storage costs based on traffic volume

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
