# Cognito Construct

CDK construct for creating Amazon Cognito User Pools with authentication flows.

## Features

- Email-based authentication
- Optional MFA with multiple methods:
  - TOTP (Time-based One-Time Password)
  - SMS (text message)
  - Email OTP (One-Time Password via email)
- Custom message handling
- Pre-token generation hooks
- OAuth 2.0 support
- User pool client configuration

## Basic Usage

```typescript
import { Cognito } from '@designofadecade/cdk-constructs';

const auth = new Cognito(this, 'Auth', {
  name: 'my-app-auth',
  mfa: true, // Enable MFA
  stack: { id: 'my-app', tags: [] },
});
```

## MFA Configuration

The construct supports multiple MFA methods:

```typescript
// Simple boolean - enables optional MFA with TOTP (and Email if SES is configured)
const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  mfa: true,
});

// Detailed configuration - required MFA with email
// Note: Email MFA requires SES configuration
const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  mfa: {
    required: true,
    mfaSecondFactor: {
      sms: false,
      otp: true,    // TOTP via authenticator app
      email: true,  // Email OTP (requires SES configuration)
    },
  },
  sesEmail: {
    fromEmail: 'noreply@example.com',
    verifiedDomain: 'example.com',
  },
});
```

**Important:** Email MFA requires SES (Simple Email Service) configuration. Messages are charged separately by Amazon SES. Ensure you have:
- SES configured in your AWS account
- A verified domain or email address
- Sufficient SES sending limits for your use case

## Properties

### CognitoProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | User pool name |
| `stack` | `object` | Required | Stack ID and tags |
| `mfa` | `boolean \| MfaConfig` | false | MFA configuration |
| `customMessageFunction` | `IFunction` | - | Custom message Lambda |
| `preTokenGenerationFunction` | `IFunction` | - | Pre-token generation Lambda |

## Getters

- `userPool` - Cognito User Pool
- `userPoolClient` - User Pool Client
- `userPoolId` - User Pool ID
- `clientId` - Client ID

## Best Practices

1. **Enable MFA** for sensitive applications
2. **Use custom domains** instead of Cognito domain
3. **Set appropriate password policies**
4. **Enable advanced security features** (adaptive authentication)
5. **Configure token expiration** based on security requirements
6. **Use Lambda triggers** for custom authentication flows
7. **Enable user pool analytics** for monitoring

## Related Constructs

- [Function](./Function.md) - Lambda functions for Cognito triggers
- [HttpApi](./HttpApi.md) - API with Cognito authorization
