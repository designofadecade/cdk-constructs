# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :x:                |

## Reporting a Vulnerability

We take the security of our software seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

Send an email to **security@designofadecade.com** with:

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Potential impact** of the vulnerability
4. **Suggested fix** (if any)

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

### What to Expect

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days with either:
  - Confirmation of the issue and estimated fix timeline
  - Explanation if we determine it's not a security issue
- **Fix Timeline**: Critical issues will be addressed within 14 days
- **Disclosure**: We will coordinate with you on public disclosure timing

## Security Best Practices

When using this library, follow these security best practices:

### 1. Secrets Management

**Never** hardcode secrets in your CDK code:

```typescript
// ❌ BAD - Hardcoded secrets
const db = new RdsDatabase(this, 'Database', {
  masterUsername: 'admin',
  masterPassword: 'my-password-123', // Never do this!
});

// ✅ GOOD - Use Secrets Manager
const dbPassword = new Secret(this, 'DBPassword', {
  generateSecretString: {
    excludePunctuation: true,
  },
});

const db = new RdsDatabase(this, 'Database', {
  masterUsername: 'admin',
  masterPassword: SecretValue.secretsManager(dbPassword.secretName),
});
```

### 2. Encryption

Always enable encryption for sensitive data:

```typescript
// S3 Buckets
const bucket = new S3Bucket(this, 'Bucket', {
  encryption: BucketEncryption.KMS_MANAGED, // Or use customer-managed keys
});

// DynamoDB Tables
const table = new DynamoTable(this, 'Table', {
  encryption: TableEncryption.CUSTOMER_MANAGED, // Use KMS keys
});

// RDS Databases
const database = new RdsDatabase(this, 'Database', {
  storageEncrypted: true,
});
```

### 3. Network Security

Use VPCs and security groups properly:

```typescript
const vpc = new Vpc(this, 'Vpc', {
  maxAzs: 3,
  natGateways: 1,
});

// Place sensitive resources in private subnets
const database = new RdsDatabase(this, 'Database', {
  vpc,
  vpcSubnets: {
    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
  },
});

// Use bastion host for access
const bastion = new BastionHost(this, 'Bastion', {
  vpc,
  allowedCidr: '203.0.113.0/24', // Restrict to known IPs
});
```

### 4. IAM Permissions

Follow the principle of least privilege:

```typescript
// ❌ BAD - Too permissive
fn.addToRolePolicy(new PolicyStatement({
  actions: ['*'],
  resources: ['*'],
}));

// ✅ GOOD - Specific permissions
fn.addToRolePolicy(new PolicyStatement({
  actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
  resources: [table.tableArn],
}));
```

### 5. Public Access

Block public access by default:

```typescript
// S3 buckets should block public access
const bucket = new S3Bucket(this, 'Bucket', {
  blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
});

// Use CloudFront with OAI for public-facing content
const distribution = new CloudFront(this, 'Distribution', {
  defaultBehavior: {
    origin: bucket.bucket,
    originAccessIdentity: new OriginAccessIdentity(this, 'OAI'),
  },
});
```

### 6. Authentication & Authorization

Enable MFA and strong authentication:

```typescript
const cognito = new Cognito(this, 'UserPool', {
  mfa: {
    mfaRequired: true,
    enableTotp: true,
  },
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireDigits: true,
    requireSymbols: true,
  },
});
```

### 7. Logging & Monitoring

Enable logging for audit trails:

```typescript
// VPC Flow Logs
const vpc = new Vpc(this, 'Vpc', {
  flowLogs: true,
});

// S3 Access Logs
const bucket = new S3Bucket(this, 'Bucket', {
  serverAccessLogsEnabled: true,
});

// CloudTrail for API logging
const trail = new Trail(this, 'Trail', {
  bucket: logBucket,
});
```

## Security Updates

Security updates will be released as patch versions (e.g., 0.2.2 → 0.2.3) and announced via:

- GitHub Security Advisories
- Release notes
- npm security advisories

Subscribe to repository notifications to stay informed.

## Dependencies

We regularly update dependencies to patch known vulnerabilities:

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

We use Dependabot to automatically create PRs for dependency updates.

## Compliance

This library is designed to help you build infrastructure that can meet various compliance requirements:

- **HIPAA**: Enable encryption, logging, and access controls
- **PCI DSS**: Implement network segmentation and encryption
- **SOC 2**: Enable audit logging and monitoring
- **GDPR**: Implement data encryption and access controls

However, **using this library does not guarantee compliance**. You are responsible for:
- Properly configuring constructs according to your compliance requirements
- Implementing appropriate policies and procedures
- Regular security audits
- Employee training

## Additional Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [AWS CDK Security Considerations](https://docs.aws.amazon.com/cdk/latest/guide/security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services)

## Contact

For security concerns, contact: security@designofadecade.com

For general questions: support@designofadecade.com
