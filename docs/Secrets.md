# Secrets Construct

CDK construct for creating AWS Secrets Manager secrets.

## Features

- JSON and string secret types
- Automatic rotation support
- Replication across regions
- Fine-grained access control

## Basic Usage

```typescript
import { Secrets } from '@designofadecade/cdk-constructs';

// JSON secret
const apiKeys = new Secrets(this, 'ApiKeys', {
  name: 'api-keys',
  secretType: 'json',
  jsonValue: {
    stripe: process.env.STRIPE_KEY!,
    sendgrid: process.env.SENDGRID_KEY!,
  },
  stack: { id: 'my-app', tags: [] },
});

// String secret
const token = new Secrets(this, 'Token', {
  name: 'auth-token',
  secretType: 'string',
  stringValue: process.env.AUTH_TOKEN!,
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### SecretsProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Secret name |
| `secretType` | `'json' \| 'string'` | Required | Secret type |
| `jsonValue` | `object` | - | JSON secret value |
| `stringValue` | `string` | - | String secret value |
| `stack` | `object` | Required | Stack ID and tags |

## Getters

- `secret` - Secrets Manager secret
- `secretArn` - Secret ARN
- `secretName` - Secret name

## Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for secret values at deploy time
3. **Enable rotation** for database credentials
4. **Use IAM policies** to restrict access
5. **Use resource policies** for cross-account access
6. **Monitor secret access** with CloudTrail
7. **Use VPC endpoints** for accessing secrets from VPC
8. **Cache secrets** in Lambda for performance

## Lambda Integration

```typescript
// Grant Lambda access to secret
const secret = new Secrets(this, 'DbPassword', {
  name: 'db-password',
  secretType: 'string',
  stringValue: 'changeme',
  stack: { id: 'my-app', tags: [] },
});

const fn = new Function(this, 'ApiFunction', {
  name: 'api-function',
  entry: './src/handlers/api.ts',
  environment: {
    SECRET_ARN: secret.secretArn,
  },
  stack: { id: 'my-app', tags: [] },
});

secret.secret.grantRead(fn.function);
```

## Parameters and Secrets Extension

For better performance, use the Parameters and Secrets Lambda Extension:

```typescript
const fn = new Function(this, 'ApiFunction', {
  name: 'api-function',
  entry: './src/handlers/api.ts',
  environment: {
    SECRET_ARN: secret.secretArn,
    SECRETS_EXTENSION_HTTP_PORT: '2773',
  },
  stack: { id: 'my-app', tags: [] },
});

fn.addParametersSecretsExtensionLayer();
```

## Related Constructs

- [Function](./Function.md) - Lambda functions
- [RdsDatabase](./RdsDatabase.md) - Database credentials
