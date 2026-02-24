# HttpApi Construct

CDK construct for creating API Gateway HTTP APIs with Lambda integration.

## Features

- HTTP API (v2) - lower latency and cost than REST API
- Lambda integration
- CORS support
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

## Properties

### HttpApiProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | API name |
| `handler` | `IFunction` | Required | Lambda handler |
| `stack` | `object` | Required | Stack ID and tags |
| `cors` | `CorsConfig` | - | CORS configuration |
| `authorizer` | `Authorizer` | - | API authorizer |

## Getters

- `api` - HTTP API
- `apiId` - API ID
- `apiUrl` - API URL

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
