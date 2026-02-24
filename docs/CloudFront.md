# CloudFront Construct

CDK construct for creating CloudFront distributions with security best practices.

## Features

- Automatic SSL/TLS certificate management
- Security headers by default
- HTTP/2 and HTTP/3 enabled
- S3 bucket origin support
- Custom domain support
- WAF integration ready

## Basic Usage

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';

const distribution = new CloudFront(this, 'Distribution', {
  name: 'my-distribution',
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### CloudFrontProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Distribution name |
| `stack` | `object` | Required | Stack ID and tags |
| `domainName` | `string` | - | Custom domain name |
| `certificate` | `ICertificate` | - | ACM certificate for custom domain |
| `originBucket` | `IBucket` | - | S3 bucket origin |

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
