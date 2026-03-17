# Cognito Construct

CDK construct for creating Amazon Cognito User Pools with authentication flows.

## Features

- Email-based authentication
- Configurable password policies with predefined plans
- Password expiration with configurable days (requires Lambda triggers)
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

## Password Policy Configuration

The construct supports multiple predefined password policy plans and custom configurations:

```typescript
import { Cognito, PasswordPolicyPlan } from '@designofadecade/cdk-constructs';

// Use a predefined plan
const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  passwordPolicy: {
    plan: PasswordPolicyPlan.STRONG, // BASIC, STANDARD, STRONG, or ENTERPRISE
  },
});

// Customize specific settings on a plan
const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  passwordPolicy: {
    plan: PasswordPolicyPlan.STANDARD,
    minLength: 15,
    passwordHistorySize: 5,
  },
});

// Full custom configuration
const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  passwordPolicy: {
    plan: PasswordPolicyPlan.CUSTOM,
    minLength: 16,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    tempPasswordValidityDays: 5,
    passwordHistorySize: 8,
  },
});
```

### Password Policy Plans

| Plan | Min Length | Uppercase | Lowercase | Numbers | Symbols | History | Temp Valid |
|------|------------|-----------|-----------|---------|---------|---------|------------|
| **BASIC** | 8 | ❌ | ✅ | ✅ | ❌ | 0 | 7 days |
| **STANDARD** | 10 | ✅ | ✅ | ✅ | ✅ | 0 | 7 days |
| **STRONG** | 12 | ✅ | ✅ | ✅ | ✅ | 5 | 7 days |
| **ENTERPRISE** | 14 | ✅ | ✅ | ✅ | ✅ | 10 | 3 days |

### Password Policy Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `plan` | `PasswordPolicyPlan` | `STANDARD` | Predefined password policy plan |
| `minLength` | `number` | Varies by plan | Minimum password length (8-99) |
| `requireUppercase` | `boolean` | Varies by plan | Require uppercase letters |
| `requireLowercase` | `boolean` | `true` | Require lowercase letters |
| `requireNumbers` | `boolean` | `true` | Require numbers |
| `requireSymbols` | `boolean` | Varies by plan | Require special characters |
| `tempPasswordValidityDays` | `number` | 7 (3 for ENTERPRISE) | Temporary password validity |
| `passwordHistorySize` | `number` | 0-10 by plan | Number of passwords to remember |
| `passwordExpirationDays` | `number` | `undefined` | Days before password expires (requires Lambda triggers) |

## Password Expiration

The construct supports password expiration, requiring users to reset their passwords after a specified number of days. This feature requires Lambda triggers to track and enforce password age.

### Enabling Password Expiration

```typescript
import { Cognito, Function } from '@designofadecade/cdk-constructs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

// Step 1: Configure password expiration in the password policy
const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  passwordPolicy: {
    plan: PasswordPolicyPlan.STANDARD,
    passwordExpirationDays: 90, // Force password reset after 90 days
  },
  lambdaTriggers: {
    // Step 2: Add Lambda triggers to enforce password expiration
    preAuthentication: new Function(this, 'PreAuthFunction', {
      stack: { id: 'my-app', label: 'My App', tags: [] },
      entry: Cognito.PasswordExpirationPreAuthFunctionEntryPath(),
      runtime: Runtime.NODEJS_22_X,
      environment: {
        PASSWORD_EXPIRATION_DAYS: '90',
      },
    }).function,
    postAuthentication: new Function(this, 'PostAuthFunction', {
      stack: { id: 'my-app', label: 'My App', tags: [] },
      entry: Cognito.PasswordExpirationPostAuthFunctionEntryPath(),
      runtime: Runtime.NODEJS_22_X,
    }).function,
    postConfirmation: new Function(this, 'PostConfirmFunction', {
      stack: { id: 'my-app', label: 'My App', tags: [] },
      entry: Cognito.PasswordExpirationPostConfirmationFunctionEntryPath(),
      runtime: Runtime.NODEJS_22_X,
    }).function,
  },
});
```

### How It Works

Password expiration uses three Lambda triggers:

1. **Pre-Authentication Trigger**: Checks if the password has expired before allowing sign-in. If expired, authentication is blocked with an error message.

2. **Post-Authentication Trigger**: Initializes the password change timestamp on first login if it doesn't exist.

3. **Post-Confirmation Trigger**: Updates the password change timestamp when users reset their password through the forgot password flow.

The construct automatically adds a custom attribute `custom:last-password-change` to track when each user last changed their password.

### Important Notes

- **Custom Attribute**: Setting `passwordExpirationDays` automatically adds a `custom:last-password-change` custom attribute to the User Pool. This stores the timestamp of the last password change.

- **Lambda Triggers Required**: Password expiration only works if you configure the three Lambda triggers shown above. The construct doesn't automatically create these to avoid conflicts with existing triggers.

- **First Login**: Users won't be blocked on their first login. The timestamp is initialized during the first authentication.

- **Password Resets**: The timestamp is updated when users complete the forgot password flow.

- **Environment Variable**: The `PASSWORD_EXPIRATION_DAYS` environment variable must match the `passwordExpirationDays` value in your password policy.

### Helper Methods

The construct provides static methods to get the Lambda function entry paths:

```typescript
// Get entry paths for password expiration Lambda handlers
Cognito.PasswordExpirationPreAuthFunctionEntryPath();
Cognito.PasswordExpirationPostAuthFunctionEntryPath();
Cognito.PasswordExpirationPostConfirmationFunctionEntryPath();
```

### Example Error Message

When a user tries to sign in with an expired password, they'll see:

```
Your password has expired. It has been 91 days since your last password change. Please reset your password to continue.
```

## MFA Configuration

The construct supports multiple MFA methods:

```typescript
// Simple boolean - enables optional MFA with TOTP (and Email/SMS if configured)
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

// SMS MFA Configuration
// Note: SMS MFA requires an IAM role with SNS publish permissions
// The role will be auto-created if not provided

// Option 1: Auto-create the SMS role (simplest)
const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  mfa: {
    required: true,
    mfaSecondFactor: {
      sms: true,    // SMS MFA
      otp: true,    // TOTP via authenticator app
      email: false,
    },
  },
  sms: {
    externalId: 'my-external-id', // Optional: for enhanced security
  },
});

// Option 2: Use the helper method to create the role
const smsRole = Cognito.createSmsRole(this, 'CognitoSmsRole');

const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  mfa: true,
  sms: {
    smsRole, // Use the helper-created role
    externalId: 'my-external-id',
  },
});

// Option 3: Create a custom role with specific permissions
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';

const smsRole = new Role(this, 'CognitoSmsRole', {
  assumedBy: new ServicePrincipal('cognito-idp.amazonaws.com'),
});

smsRole.addToPolicy(new PolicyStatement({
  actions: ['sns:Publish'],
  resources: ['*'],
}));

const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  mfa: {
    required: true,
    mfaSecondFactor: {
      sms: true,    // SMS MFA (requires SMS configuration)
      otp: true,    // TOTP via authenticator app
      email: false,
    },
  },
  sms: {
    smsRole,
    externalId: 'my-external-id', // Optional: for enhanced security
  },
});
```

**Important Notes:**
- **Email MFA** requires SES (Simple Email Service) configuration. Messages are charged separately by Amazon SES. Ensure you have:
  - SES configured in your AWS account
  - A verified domain or email address
  - Sufficient SES sending limits for your use case
- **SMS MFA** requires:
  - An IAM role with SNS publish permissions (auto-created if not provided)
  - The role must trust `cognito-idp.amazonaws.com` (automatically configured)
  - SMS messages are charged separately by Amazon SNS
  - Consider setting an external ID for enhanced security in production environments
  - Use `Cognito.createSmsRole()` helper method or let the construct auto-create the role

## Customizing User Messages

The construct includes Lambda triggers that style user authentication messages using HTML templates for emails and text templates for SMS messages. To use custom message styling:

```typescript
import { Cognito } from '@designofadecade/cdk-constructs';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';

// Create the custom message Lambda function
const customMessageFn = new LambdaFunction(this, 'CustomMessage', {
  runtime: Runtime.NODEJS_20_X,
  handler: 'handler.handler',
  code: Code.fromAsset(Cognito.CustomMessageFunctionEntryPath()),
  environment: {
    // Optional: Customize email subjects
    COGNITO_SIGNUP_SUBJECT: 'Verify Your Account',
    COGNITO_FORGOT_PASSWORD_SUBJECT: 'Reset Your Password',
    COGNITO_MFA_SUBJECT: 'Your Security Code',
  },
});

// Create Cognito with the custom message trigger
const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  mfa: {
    required: true,
    mfaSecondFactor: { sms: false, otp: true, email: true },
  },
  sesEmail: {
    fromEmail: 'noreply@example.com',
    verifiedDomain: 'example.com',
  },
  sms: {
    externalId: 'my-app-external-id',
  },
  lambdaTriggers: {
    customMessage: customMessageFn,
  },
});
```

The custom message handler automatically styles:
- **Signup Verification Emails** - Welcome message with account verification code
- **Signup Verification SMS** - Concise text message with verification code
- **Password Reset Emails** - Modern HTML template with reset code
- **Password Reset SMS** - Concise text message with reset code
- **MFA Emails** - Security-focused design with authentication code
- **MFA SMS** - Short text message with verification code

Email templates include:
- Responsive design for mobile and desktop
- Clear security warnings and instructions
- Professional styling matching your brand
- Auto-updating copyright year

SMS templates provide:
- Concise messages under 160 characters
- Clear code presentation
- Professional tone

### Customizing Templates

The function bundle includes default templates that you can modify:
- **Email Templates**: `signup.html`, `forgotpassword.html`, and `mfa.html`
- **SMS Templates**: `signup-sms.txt`, `forgotpassword-sms.txt`, and `mfa-sms.txt`

All templates support the `{code}` placeholder which is replaced with the actual verification code. Email templates also support `{year}` for copyright notices.

## Threat Protection (Advanced Security)

AWS Cognito Advanced Security features provide risk-based adaptive authentication, account takeover prevention, and compromised credentials detection.

### Threat Protection Modes

Cognito offers two types of threat protection based on your feature plan:

#### Standard Threat Protection (ESSENTIALS Feature Plan)

- **NO_ENFORCEMENT** - Cognito doesn't gather metrics or take preventative actions (default)
- **AUDIT_ONLY** - Cognito gathers metrics but doesn't take automatic action (useful for testing)
- **FULL_FUNCTION** - Cognito takes preventative actions based on risk levels

#### Custom Threat Protection (PLUS Feature Plan)

- **AUDIT_ONLY** - Cognito gathers metrics but doesn't take automatic action
- **FULL_FUNCTION** - Cognito takes preventative actions with custom risk configurations

### Basic Configuration

```typescript
import { Cognito, StandardThreatProtectionMode } from '@designofadecade/cdk-constructs';

const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  featurePlan: Cognito.FeaturePlan.ESSENTIALS,
  threatProtection: {
    standardThreatProtectionMode: StandardThreatProtectionMode.FULL_FUNCTION,
  },
});
```

### Account Takeover Prevention

Configure different actions for different risk levels:

```typescript
import { 
  Cognito, 
  StandardThreatProtectionMode,
  AccountTakeoverActionType 
} from '@designofadecade/cdk-constructs';

const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  featurePlan: Cognito.FeaturePlan.ESSENTIALS,
  threatProtection: {
    standardThreatProtectionMode: StandardThreatProtectionMode.FULL_FUNCTION,
    accountTakeoverRisk: {
      lowAction: {
        eventAction: AccountTakeoverActionType.NO_ACTION,
        notify: true, // Send notification email
      },
      mediumAction: {
        eventAction: AccountTakeoverActionType.MFA_IF_CONFIGURED,
        notify: true,
      },
      highAction: {
        eventAction: AccountTakeoverActionType.MFA_REQUIRED,
        notify: true,
      },
    },
    // SES email configuration for notifications
    notifyConfiguration: {
      sourceArn: 'arn:aws:ses:us-east-1:123456789012:identity/example.com',
      from: 'security@example.com',
      replyTo: 'support@example.com',
      // Custom email templates
      mfaEmail: {
        subject: 'MFA Required for Security',
        htmlBody: '<p>We detected unusual activity. Please verify: {####}</p>',
        textBody: 'We detected unusual activity. Please verify: {####}',
      },
      blockEmail: {
        subject: 'Login Blocked for Security',
        htmlBody: '<p>We blocked a suspicious login attempt to your account.</p>',
        textBody: 'We blocked a suspicious login attempt to your account.',
      },
      noActionEmail: {
        subject: 'Security Alert',
        htmlBody: '<p>We detected a login from a new device or location.</p>',
        textBody: 'We detected a login from a new device or location.',
      },
    },
  },
});
```

### Compromised Credentials Detection

Automatically detect and block compromised credentials:

```typescript
import { 
  Cognito, 
  CustomThreatProtectionMode,
  CompromisedCredentialsActionType 
} from '@designofadecade/cdk-constructs';

const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  featurePlan: Cognito.FeaturePlan.PLUS,
  threatProtection: {
    customThreatProtectionMode: CustomThreatProtectionMode.FULL_FUNCTION,
    compromisedCredentialsRisk: {
      eventAction: CompromisedCredentialsActionType.BLOCK,
    },
  },
});
```

### Complete Threat Protection Example

```typescript
import { 
  Cognito, 
  CustomThreatProtectionMode,
  AccountTakeoverActionType,
  CompromisedCredentialsActionType 
} from '@designofadecade/cdk-constructs';

const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  featurePlan: Cognito.FeaturePlan.PLUS, // PLUS plan required for custom threat protection
  mfa: {
    required: false, // MFA can be triggered by risk level
    mfaSecondFactor: {
      sms: false,
      otp: true,
      email: true,
    },
  },
  sesEmail: {
    fromEmail: 'noreply@example.com',
    verifiedDomain: 'example.com',
  },
  threatProtection: {
    customThreatProtectionMode: CustomThreatProtectionMode.FULL_FUNCTION,
    // Account takeover prevention
    accountTakeoverRisk: {
      lowAction: {
        eventAction: AccountTakeoverActionType.NO_ACTION,
        notify: true,
      },
      mediumAction: {
        eventAction: AccountTakeoverActionType.MFA_IF_CONFIGURED,
        notify: true,
      },
      highAction: {
        eventAction: AccountTakeoverActionType.MFA_REQUIRED,
        notify: true,
      },
    },
    // Compromised credentials detection
    compromisedCredentialsRisk: {
      eventAction: CompromisedCredentialsActionType.BLOCK,
    },
    // Email notification configuration
    notifyConfiguration: {
      sourceArn: 'arn:aws:ses:us-east-1:123456789012:identity/example.com',
      from: 'security@example.com',
      replyTo: 'support@example.com',
      mfaEmail: {
        subject: 'Security Verification Required',
        htmlBody: `
          <h2>Additional Verification Required</h2>
          <p>We detected unusual activity on your account.</p>
          <p>Please enter this code: <strong>{####}</strong></p>
          <p>If this wasn't you, please contact support immediately.</p>
        `,
        textBody: 'We detected unusual activity. Verification code: {####}',
      },
      blockEmail: {
        subject: 'Suspicious Login Blocked',
        htmlBody: `
          <h2>Login Attempt Blocked</h2>
          <p>We blocked a suspicious login attempt to your account.</p>
          <p>If this wasn't you, your account is safe. If this was you, please try again.</p>
        `,
        textBody: 'We blocked a suspicious login attempt to your account.',
      },
      noActionEmail: {
        subject: 'New Login Detected',
        htmlBody: `
          <h2>New Login Detected</h2>
          <p>We detected a login from a new device or location.</p>
          <p>If this wasn't you, please secure your account immediately.</p>
        `,
        textBody: 'We detected a login from a new device or location.',
      },
    },
  },
});
```

### Threat Protection Options

#### Account Takeover Actions

| Action Type | Description |
|------------|-------------|
| `BLOCK` | Block the sign-in attempt |
| `MFA_IF_CONFIGURED` | Require MFA if the user has it configured |
| `MFA_REQUIRED` | Always require MFA regardless of user configuration |
| `NO_ACTION` | Allow the sign-in but log the event |

#### Compromised Credentials Actions

| Action Type | Description |
|------------|-------------|
| `BLOCK` | Block sign-ins with compromised credentials |
| `NO_ACTION` | Allow sign-ins but log the event |

### Important Notes

1. **Costs**: Advanced Security features incur additional charges from AWS
2. **SES Required**: Email notifications require a verified SES domain/email
3. **Testing**: Use `AUDIT` mode first to test without affecting users
4. **Feature Plan**: Advanced Security requires Cognito ESSENTIALS or PLUS plan
5. **Email Templates**: The `{####}` placeholder is required in email bodies for verification codes

## WAF Integration

Protect your Cognito User Pool from web-based attacks by attaching an AWS WAF (Web Application Firewall) Web ACL.

### Basic WAF Integration

```typescript
import { Cognito, Waf } from '@designofadecade/cdk-constructs';

// Create a regional WAF (must be REGIONAL scope for Cognito)
const waf = new Waf(this, 'CognitoWAF', {
  scope: Waf.SCOPE_REGIONAL, // Required for Cognito
  enableManagedRules: true,
  rateLimit: {
    limit: 2000,
    priority: 1,
  },
  stack: { id: 'my-app', tags: [] },
});

// Create Cognito with WAF protection
const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  mfa: true,
  waf: waf, // Attach WAF to User Pool
});
```

### Advanced WAF Configuration

Protect against common attacks and bot traffic:

```typescript
import { Cognito, Waf } from '@designofadecade/cdk-constructs';

// Create WAF with comprehensive security rules
const waf = new Waf(this, 'CognitoWAF', {
  scope: Waf.SCOPE_REGIONAL,
  enableManagedRules: true, // AWS Managed Rules (recommended)
  
  // Rate limiting to prevent brute force attacks
  rateLimit: {
    limit: 1000, // Max 1000 requests per 5 minutes from a single IP
    priority: 1,
  },
  
  // Geographic blocking
  geoBlock: {
    countryCodes: ['CN', 'RU', 'KP'], // Block specific countries
    priority: 2,
  },
  
  // IP allowlist for trusted sources
  ipSets: [
    {
      name: 'AllowedIPs',
      addresses: ['203.0.113.0/24'], // Your office/trusted IPs
      action: 'ALLOW',
      priority: 0, // Highest priority
    },
  ],
  
  stack: { id: 'my-app', tags: [] },
});

const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  mfa: true,
  waf: waf,
});
```

### Combining WAF with Threat Protection

For maximum security, combine WAF (network-level protection) with Cognito's Advanced Security (application-level protection):

```typescript
import { 
  Cognito, 
  Waf,
  CustomThreatProtectionMode,
  AccountTakeoverActionType 
} from '@designofadecade/cdk-constructs';

// Network-level protection with WAF
const waf = new Waf(this, 'CognitoWAF', {
  scope: Waf.SCOPE_REGIONAL,
  enableManagedRules: true,
  rateLimit: {
    limit: 1000,
    priority: 1,
  },
  stack: { id: 'my-app', tags: [] },
});

// Application-level protection with threat protection
const auth = new Cognito(this, 'Auth', {
  stack: { id: 'my-app', label: 'My App', tags: [] },
  featurePlan: Cognito.FeaturePlan.PLUS,
  mfa: {
    required: false,
    mfaSecondFactor: { sms: false, otp: true, email: true },
  },
  
  // WAF for network-level protection
  waf: waf,
  
  // Custom Threat Protection for application-level protection
  threatProtection: {
    customThreatProtectionMode: CustomThreatProtectionMode.FULL_FUNCTION,
    accountTakeoverRisk: {
      lowAction: {
        eventAction: AccountTakeoverActionType.NO_ACTION,
        notify: true,
      },
      mediumAction: {
        eventAction: AccountTakeoverActionType.MFA_IF_CONFIGURED,
        notify: true,
      },
      highAction: {
        eventAction: AccountTakeoverActionType.MFA_REQUIRED,
        notify: true,
      },
    },
    notifyConfiguration: {
      sourceArn: 'arn:aws:ses:us-east-1:123456789012:identity/example.com',
      from: 'security@example.com',
    },
  },
});
```

### WAF Integration Notes

1. **Regional Scope Required**: Cognito User Pools require WAF with `REGIONAL` scope (not `CLOUDFRONT`)
2. **Automatic Association**: The WAF is automatically associated with the User Pool ARN
3. **Rate Limiting**: Protects against credential stuffing and brute force attacks
4. **AWS Managed Rules**: Includes protection against OWASP Top 10 vulnerabilities
5. **Cost Considerations**: WAF incurs additional charges based on rules and requests
6. **Multiple Layers**: WAF provides network-level protection; combine with Advanced Security for comprehensive protection

### Security Best Practices

**Use Both WAF and Threat Protection:**
- **WAF** - Blocks malicious traffic before it reaches Cognito (DDoS, SQL injection, etc.)
- **Threat Protection** - Analyzes user behavior and credentials (account takeover, compromised passwords)

**Recommended Security Stack:**
1. WAF with AWS Managed Rules + Rate Limiting
2. Advanced Security in ENFORCED mode
3. MFA enabled (optional or required based on risk)
4. Strong password policy (STRONG or ENTERPRISE plans)

## Properties

### CognitoProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `stack` | `object` | Required | Stack ID, label, and tags |
| `featurePlan` | `FeaturePlan` | `ESSENTIALS` | Cognito feature plan (LITE, ESSENTIALS, PLUS) |
| `mfa` | `boolean \| MfaConfig` | `false` | MFA configuration |
| `passwordPolicy` | `PasswordPolicyConfig` | `STANDARD` | Password policy configuration |
| `customAttributes` | `Record<string, ICustomAttribute>` | - | Custom user attributes |
| `lambdaTriggers` | `UserPoolTriggers` | - | Lambda triggers for Cognito events |
| `sesEmail` | `SesEmailConfig` | - | SES email configuration |
| `customDomain` | `CustomDomainConfig` | - | Custom domain with certificate |
| `clients` | `UserPoolClientConfig[]` | - | Multiple app clients configuration |
| `readAttributes` | `ClientAttributes` | - | Readable user attributes |
| `writeAttributes` | `ClientAttributes` | - | Writable user attributes |
| `preventUserExistenceErrors` | `boolean` | `true` | Prevent revealing if user exists |
| `logs` | `CognitoLogsConfig` | - | CloudWatch Logs configuration |
| `threatProtection` | `ThreatProtectionConfig` | - | Advanced Security features |
| `waf` | `Waf` | - | WAF Web ACL for network protection |

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
- [Waf](./Waf.md) - Web Application Firewall for network security
