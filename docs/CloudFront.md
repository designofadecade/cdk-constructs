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
