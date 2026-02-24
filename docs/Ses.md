# Ses Construct

CDK construct for configuring Amazon Simple Email Service (SES).

## Features

- Email identity verification
- MAIL FROM domain configuration
- DKIM signing
- Custom tracking domain
- Domain verification records

## Basic Usage

```typescript
import { Ses } from '@designofadecade/cdk-constructs';

const ses = new Ses(this, 'Email', {
  domain: 'example.com',
  mailFromDomain: 'mail.example.com',
  hostedZoneId: 'Z1234567890ABC',
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### SesProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `domain` | `string` | Required | Email domain |
| `mailFromDomain` | `string` | Required | MAIL FROM domain |
| `hostedZoneId` | `string` | Required | Route53 hosted zone ID |
| `stack` | `object` | Required | Stack ID and tags |

## Getters

- `emailIdentity` - SES email identity
- `mailFromDomain` - MAIL FROM domain

## Best Practices

1. **Use custom MAIL FROM domain** to improve deliverability
2. **Enable DKIM signing** (default)
3. **Move out of sandbox** for production sending
4. **Monitor bounce and complaint rates**
5. **Use dedicated IP addresses** for high volume
6. **Implement SPF and DMARC** records
7. **Use configuration sets** for tracking
8. **Set up bounce/complaint notifications**

## Moving Out of SES Sandbox

By default, SES accounts are in sandbox mode:
- Can only send to verified addresses
- Limited to 200 emails/day
- Maximum 1 email/second

To move out:
1. Open AWS Support case
2. Describe use case
3. Confirm handling bounces/complaints
4. Wait for approval (typically 24 hours)

## Email Templates

```typescript
// Use SES template for transactional emails
// Create templates separately via AWS CLI or console
const templateData = {
  userName: 'John Doe',
  orderNumber: '12345',
  orderTotal: '$99.99',
};
```

## Related Constructs

- [Function](./Function.md) - Lambda functions sending emails
