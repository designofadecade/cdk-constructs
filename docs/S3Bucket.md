# S3Bucket Construct

CDK construct for creating S3 buckets with security best practices.

## Features

- Encryption at rest (AWS managed)
- Block public access enabled
- Versioning support
- Lifecycle rules
- RETAIN removal policy
- Server access logging

## Basic Usage

```typescript
import { S3Bucket } from '@designofadecade/cdk-constructs';

const bucket = new S3Bucket(this, 'AssetBucket', {
  name: 'my-app-assets',
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### S3BucketProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Bucket name |
| `stack` | `object` | Required | Stack ID and tags |
| `versioned` | `boolean` | false | Enable versioning |
| `lifecycleRules` | `LifecycleRule[]` | - | Lifecycle rules |
| `cors` | `CorsRule[]` | - | CORS configuration |

## Getters

- `bucket` - S3 Bucket
- `bucketName` - Bucket name
- `bucketArn` - Bucket ARN

## Best Practices

1. **Block public access** by default (enabled)
2. **Enable encryption** at rest (default)
3. **Use versioning** for important data
4. **Set lifecycle rules** to expire old versions
5. **Enable access logging** for audit trail
6. **Use S3 Transfer Acceleration** for global uploads
7. **Set CORS** only for required origins
8. **Use bucket policies** to restrict access
9. **Enable object lock** for compliance requirements

## Lifecycle Rule Examples

```typescript
// Delete objects after 90 days
const bucket = new S3Bucket(this, 'TempBucket', {
  name: 'temp-files',
  lifecycleRules: [{
    enabled: true,
    expiration: Duration.days(90),
  }],
  stack: { id: 'my-app', tags: [] },
});

// Transition to cheaper storage
const bucket = new S3Bucket(this, 'ArchiveBucket', {
  name: 'archive-files',
  lifecycleRules: [{
    enabled: true,
    transitions: [{
      storageClass: StorageClass.INTELLIGENT_TIERING,
      transitionAfter: Duration.days(30),
    }, {
      storageClass: StorageClass.GLACIER,
      transitionAfter: Duration.days(90),
    }],
  }],
  stack: { id: 'my-app', tags: [] },
});
```

## Related Constructs

- [CloudFront](./CloudFront.md) - CDN for S3 content
- [Function](./Function.md) - Lambda functions accessing S3
