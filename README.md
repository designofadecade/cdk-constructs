# @designofadecade/cdk-constructs

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive collection of opinionated AWS CDK constructs for rapid infrastructure deployment. This library provides high-level abstractions that simplify common AWS infrastructure patterns while following best practices.

## 📦 Installation

This package is published to GitHub Packages. To install:

1. **Create or update `.npmrc` in your project root:**
   ```
   @designofadecade:registry=https://npm.pkg.github.com
   ```

2. **Authenticate with GitHub Packages:**
   ```bash
   npm login --registry=https://npm.pkg.github.com
   # Username: your-github-username
   # Password: your-github-personal-access-token (with read:packages permission)
   ```

3. **Install the package:**
   ```bash
   npm install @designofadecade/cdk-constructs
   ```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install aws-cdk-lib constructs
```

## 🚀 Quick Start

```typescript
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc, S3Bucket, CloudFront } from '@designofadecade/cdk-constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a VPC with best practice defaults
    const vpc = new Vpc(this, 'MyVpc', {
      maxAzs: 3,
      natGateways: 1,
    });

    // Create an S3 bucket with versioning enabled
    const bucket = new S3Bucket(this, 'MyBucket', {
      versioned: true,
    });

    // Create a CloudFront distribution
    const distribution = new CloudFront(this, 'MyDistribution', {
      defaultBehavior: {
        origin: bucket.bucket,
      },
    });
  }
}
```

## 📚 Available Constructs

### Infrastructure

- **[Vpc](#vpc)** - Virtual Private Cloud with configurable subnets and VPC endpoints
- **[BastionHost](#bastionhost)** - EC2 bastion host for secure SSH access
- **[Server](#server)** - EC2 instance with customizable configuration

### Storage

- **[S3Bucket](#s3bucket)** - S3 bucket with encryption, versioning, and lifecycle policies
- **[DynamoTable](#dynamotable)** - DynamoDB table with global secondary indexes

### Content Delivery

- **[CloudFront](#cloudfront)** - CDN distribution with custom domains and security headers

### Compute

- **[Function](#function)** - Lambda function with simplified configuration
- **[HttpApi](#httpapi)** - API Gateway HTTP API with Lambda integrations

### Database

- **[RdsDatabase](#rdsdatabase)** - RDS PostgreSQL database with automated backups

### Authentication & Authorization

- **[Cognito](#cognito)** - User pools with OAuth, MFA, and custom domains

### Messaging & Events

- **[Sqs](#sqs)** - SQS queues with dead letter queue support
- **[EventBridge](#eventbridge)** - EventBridge rules with scheduled tasks
- **[Ses](#ses)** - Simple Email Service configuration

### Secrets Management

- **[Secrets](#secrets)** - Secrets Manager with automatic rotation support

## 📖 Construct Documentation

### Vpc

Creates a VPC with public, private, and isolated subnets across multiple availability zones.

```typescript
const vpc = new Vpc(this, 'MyVpc', {
  maxAzs: 3,
  natGateways: 1,
  endpoints: ['s3', 'dynamodb', 'secretsmanager'],
});
```

**Key Features:**
- Configurable number of availability zones
- Optional NAT gateways for private subnet internet access
- VPC endpoints for AWS services (S3, DynamoDB, Secrets Manager, etc.)
- Flow logs enabled by default

### S3Bucket

Creates an S3 bucket with security best practices enabled.

```typescript
const bucket = new S3Bucket(this, 'MyBucket', {
  versioned: true,
  lifecycleRules: [{
    enabled: true,
    transitions: [{
      storageClass: StorageClass.INTELLIGENT_TIERING,
      transitionAfter: Duration.days(30),
    }],
  }],
});
```

**Key Features:**
- Encryption at rest with AWS managed keys
- Block public access by default
- Optional versioning
- Lifecycle rules support
- CORS configuration

### CloudFront

Creates a CloudFront distribution with custom domains and security headers.

```typescript
const distribution = new CloudFront(this, 'MyDistribution', {
  domainNames: ['example.com', 'www.example.com'],
  certificate: myCertificate,
  defaultBehavior: {
    origin: bucket.bucket,
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
  responseHeadersPolicy: {
    securityHeaders: {
      strictTransportSecurity: {
        accessControlMaxAge: Duration.days(365),
        includeSubdomains: true,
      },
    },
  },
});
```

**Key Features:**
- Custom domain support with ACM certificates
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Origin access identity for S3 buckets
- Custom behaviors and caching policies
- Lambda@Edge function association

### Function

Creates a Lambda function with simplified configuration.

```typescript
const fn = new Function(this, 'MyFunction', {
  handler: 'index.handler',
  runtime: Runtime.NODEJS_20_X,
  code: Code.fromAsset('lambda'),
  environment: {
    TABLE_NAME: table.tableName,
  },
  timeout: Duration.seconds(30),
});
```

**Key Features:**
- TypeScript and Node.js support
- Environment variables
- VPC integration
- Function URLs
- Layer support

### HttpApi

Creates an API Gateway HTTP API with Lambda integrations.

```typescript
const api = new HttpApi(this, 'MyApi', {
  corsConfiguration: {
    allowOrigins: ['https://example.com'],
    allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST],
  },
});

// Add routes
api.addFunctionIntegration({
  path: '/users',
  method: 'GET',
  function: getUsersFunction,
});

// Add JWT authorizer
api.createJwtAuthorizer({
  identitySource: ['$request.header.Authorization'],
  issuerUrl: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxx',
  audience: ['client-id'],
});
```

**Key Features:**
- CORS configuration
- JWT authorization with Cognito
- Lambda function integrations
- Custom domains
- Request/response transformations

### Cognito

Creates a Cognito User Pool with advanced features.

```typescript
const cognito = new Cognito(this, 'MyUserPool', {
  selfSignUpEnabled: true,
  mfa: {
    mfaRequired: true,
    enableSms: false,
    enableTotp: true,
  },
  standardAttributes: {
    email: { required: true, mutable: false },
    phoneNumber: { required: false, mutable: true },
  },
  customDomain: {
    domainPrefix: 'auth-myapp',
  },
  callbackUrls: ['https://myapp.com/callback'],
  logoutUrls: ['https://myapp.com/logout'],
});
```

**Key Features:**
- OAuth 2.0 flows (authorization code, implicit)
- Multi-factor authentication (SMS, TOTP)
- Custom domains
- Email/SMS verification
- Lambda triggers (pre-authentication, custom message, etc.)
- User pool clients with branding

### DynamoTable

Creates a DynamoDB table with best practices.

```typescript
const table = new DynamoTable(this, 'MyTable', {
  partitionKey: { name: 'userId', type: AttributeType.STRING },
  sortKey: { name: 'timestamp', type: AttributeType.NUMBER },
  billingMode: BillingMode.PAY_PER_REQUEST,
  globalSecondaryIndexes: [{
    indexName: 'EmailIndex',
    partitionKey: { name: 'email', type: AttributeType.STRING },
    projectionType: ProjectionType.ALL,
  }],
  pointInTimeRecovery: true,
});
```

**Key Features:**
- On-demand or provisioned billing
- Global secondary indexes
- Point-in-time recovery
- Encryption at rest
- Time-to-live (TTL) support

### RdsDatabase

Creates an RDS PostgreSQL database with automated backups.

```typescript
const database = new RdsDatabase(this, 'MyDatabase', {
  vpc,
  engine: DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_15 }),
  instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.SMALL),
  allocatedStorage: 20,
  multiAz: true,
  backupRetention: Duration.days(7),
});
```

**Key Features:**
- Multi-AZ deployment
- Automated backups
- Encryption at rest
- VPC placement
- Security group configuration
- Secrets Manager integration for credentials

### Sqs

Creates SQS queues with DLQ support.

```typescript
const queue = new Sqs(this, 'MyQueue', {
  visibilityTimeout: Duration.seconds(300),
  retentionPeriod: Duration.days(14),
  deadLetterQueue: {
    maxReceiveCount: 3,
  },
  encryption: QueueEncryption.KMS_MANAGED,
});
```

**Key Features:**
- Dead letter queue configuration
- Encryption with KMS
- FIFO queue support
- Visibility timeout configuration
- Message retention policies

### EventBridge

Creates EventBridge rules for scheduled tasks.

```typescript
const eventBridge = new EventBridge(this, 'MyScheduler', {
  tasks: [{
    name: 'DailyBackup',
    schedule: Schedule.cron({ hour: '2', minute: '0' }),
    target: backupFunction,
  }],
});
```

**Key Features:**
- CloudWatch Events integration
- Cron and rate expressions
- Lambda function targets
- Custom event patterns

### Ses

Configures SES for sending emails.

```typescript
const ses = new Ses(this, 'MyEmailService', {
  fromEmail: 'noreply@example.com',
  replyToEmail: 'support@example.com',
  configurationSetName: 'MyConfigSet',
});
```

**Key Features:**
- Email identity verification
- Configuration sets
- Bounce and complaint handling
- Sending quotas

### BastionHost

Creates a bastion host for secure access to private resources.

```typescript
const bastion = new BastionHost(this, 'MyBastion', {
  vpc,
  instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
  allowedCidr: '203.0.113.0/24',
});
```

**Key Features:**
- Systems Manager Session Manager support
- Security group with SSH access
- CloudWatch logging
- Elastic IP

### Server

Creates an EC2 server with customizable configuration.

```typescript
const server = new Server(this, 'MyServer', {
  vpc,
  instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
  machineImage: MachineImage.latestAmazonLinux2(),
  volumes: [{
    deviceName: '/dev/sda1',
    volumeSize: 30,
    volumeType: EbsDeviceVolumeType.GP3,
  }],
  userData: UserData.forLinux(),
});
```

**Key Features:**
- Custom AMI support
- EBS volumes configuration
- User data scripts
- IAM role attachment
- VPC placement

### Secrets

Manages secrets in AWS Secrets Manager.

```typescript
const secret = new Secrets(this, 'MySecret', {
  secretName: 'my-app/database',
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: 'admin' }),
    generateStringKey: 'password',
    excludePunctuation: true,
  },
});
```

**Key Features:**
- Automatic secret generation
- Rotation configuration
- KMS encryption
- Cross-account access

## 🎯 Best Practices

### Security

1. **Always use encryption at rest and in transit**
   ```typescript
   const bucket = new S3Bucket(this, 'Bucket', {
     encryption: BucketEncryption.KMS_MANAGED,
   });
   ```

2. **Enable MFA for sensitive operations**
   ```typescript
   const cognito = new Cognito(this, 'UserPool', {
     mfa: { mfaRequired: true, enableTotp: true },
   });
   ```

3. **Use least privilege IAM policies**
   ```typescript
   myFunction.addToRolePolicy(new PolicyStatement({
     actions: ['dynamodb:GetItem'],
     resources: [table.tableArn],
   }));
   ```

4. **Enable logging and monitoring**
   ```typescript
   const vpc = new Vpc(this, 'Vpc', {
     flowLogs: true, // Enabled by default
   });
   ```

### Cost Optimization

1. **Use appropriate instance types**
   - Start with smaller instances (t3.micro, t3.small)
   - Monitor and scale based on metrics

2. **Enable S3 lifecycle policies**
   ```typescript
   const bucket = new S3Bucket(this, 'Bucket', {
     lifecycleRules: [{
       transitions: [{
         storageClass: StorageClass.INTELLIGENT_TIERING,
         transitionAfter: Duration.days(30),
       }],
     }],
   });
   ```

3. **Use on-demand billing for DynamoDB when appropriate**
   ```typescript
   const table = new DynamoTable(this, 'Table', {
     billingMode: BillingMode.PAY_PER_REQUEST,
   });
   ```

### High Availability

1. **Deploy across multiple AZs**
   ```typescript
   const vpc = new Vpc(this, 'Vpc', { maxAzs: 3 });
   const rds = new RdsDatabase(this, 'Db', { multiAz: true });
   ```

2. **Configure auto-scaling**
   ```typescript
   table.autoScaleReadCapacity({
     minCapacity: 1,
     maxCapacity: 100,
   });
   ```

3. **Use CloudFront for global distribution**
   ```typescript
   const distribution = new CloudFront(this, 'CDN', {
     defaultBehavior: { origin: bucket.bucket },
   });
   ```

### Performance

1. **Enable caching where appropriate**
   ```typescript
   const distribution = new CloudFront(this, 'CDN', {
     defaultBehavior: {
       cachePolicy: CachePolicy.CACHING_OPTIMIZED,
     },
   });
   ```

2. **Use VPC endpoints to reduce latency**
   ```typescript
   const vpc = new Vpc(this, 'Vpc', {
     endpoints: ['s3', 'dynamodb', 'secretsmanager'],
   });
   ```

3. **Configure Lambda memory and timeout appropriately**
   ```typescript
   const fn = new Function(this, 'Fn', {
     memorySize: 1024, // More memory = more CPU
     timeout: Duration.seconds(30),
   });
   ```

## 🚢 Deployment

### Prerequisites

- Node.js 20+ installed
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed: `npm install -g aws-cdk`

### Deployment Steps

1. **Initialize your CDK app**
   ```bash
   mkdir my-infrastructure
   cd my-infrastructure
   cdk init app --language typescript
   ```

2. **Install the package**
   ```bash
   npm install @designofadecade/cdk-constructs
   ```

3. **Create your stack**
   ```typescript
   // lib/my-stack.ts
   import { Stack, StackProps } from 'aws-cdk-lib';
   import { Construct } from 'constructs';
   import { Vpc, S3Bucket } from '@designofadecade/cdk-constructs';

   export class MyStack extends Stack {
     constructor(scope: Construct, id: string, props?: StackProps) {
       super(scope, id, props);
       
       const vpc = new Vpc(this, 'Vpc');
       const bucket = new S3Bucket(this, 'Bucket');
     }
   }
   ```

4. **Bootstrap your AWS environment (first time only)**
   ```bash
   cdk bootstrap aws://ACCOUNT-NUMBER/REGION
   ```

5. **Deploy your stack**
   ```bash
   # Preview changes
   cdk diff
   
   # Deploy
   cdk deploy
   
   # Deploy all stacks
   cdk deploy --all
   ```

### Multi-Environment Deployment

```typescript
// bin/app.ts
import { App } from 'aws-cdk-lib';
import { MyStack } from '../lib/my-stack';

const app = new App();

// Development environment
new MyStack(app, 'MyStack-Dev', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  tags: {
    Environment: 'Development',
  },
});

// Production environment
new MyStack(app, 'MyStack-Prod', {
  env: {
    account: process.env.PROD_ACCOUNT,
    region: 'us-west-2',
  },
  tags: {
    Environment: 'Production',
  },
});
```

### CI/CD Integration

#### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: CDK Diff
        run: npx cdk diff
        
      - name: CDK Deploy
        if: github.ref == 'refs/heads/main'
        run: npx cdk deploy --require-approval never
```

## 🔧 Development & Maintenance

### Setting Up Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/designofadecade/cdk-constructs.git
   cd cdk-constructs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run tests**
   ```bash
   npm test
   ```

4. **Watch mode for development**
   ```bash
   npm run test:watch
   npm run watch  # TypeScript compilation
   ```

### Testing

This library uses Vitest for unit testing. All constructs have comprehensive test coverage.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Building

```bash
# Build TypeScript to JavaScript
npm run build

# Watch for changes
npm run watch
```

### Publishing to GitHub Packages

1. **Update version in package.json**
   ```json
   {
     "version": "0.3.0"
   }
   ```

2. **Build the package**
   ```bash
   npm run build
   ```

3. **Run tests**
   ```bash
   npm test
   ```

4. **Authenticate with GitHub**
   ```bash
   npm login --registry=https://npm.pkg.github.com
   # Username: your-github-username
   # Password: your-github-token (with write:packages permission)
   ```

5. **Publish**
   ```bash
   npm publish
   ```

The package is configured to publish only to GitHub Packages via the `publishConfig` in package.json.

### Versioning Strategy

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version (x.0.0): Breaking changes
- **MINOR** version (0.x.0): New features, backwards compatible
- **PATCH** version (0.0.x): Bug fixes, backwards compatible

```bash
# Bump patch version (0.2.2 -> 0.2.3)
npm version patch

# Bump minor version (0.2.2 -> 0.3.0)
npm version minor

# Bump major version (0.2.2 -> 1.0.0)
npm version major
```

### Maintenance Checklist

#### Regular Tasks

- [ ] Update dependencies monthly
  ```bash
  npm outdated
  npm update
  ```

- [ ] Review and merge dependabot PRs
- [ ] Monitor GitHub issues and discussions
- [ ] Update documentation for new features
- [ ] Run security audits
  ```bash
  npm audit
  npm audit fix
  ```

#### Before Each Release

- [ ] Run full test suite: `npm test`
- [ ] Generate and review coverage: `npm run test:coverage`
- [ ] Update CHANGELOG.md
- [ ] Update version in package.json
- [ ] Update README.md if needed
- [ ] Create GitHub release with release notes
- [ ] Tag the release: `git tag v0.3.0`
- [ ] Push tags: `git push --tags`

#### Quarterly Review

- [ ] Review AWS CDK compatibility
- [ ] Update peer dependencies
- [ ] Review and update security best practices
- [ ] Audit construct defaults
- [ ] Review performance benchmarks
- [ ] Update examples and documentation

### Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Add tests for new functionality
5. Run tests: `npm test`
6. Commit your changes: `git commit -am 'Add new feature'`
7. Push to the branch: `git push origin feature/my-feature`
8. Submit a pull request

#### Code Style

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Write tests for all new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/designofadecade/cdk-constructs/issues)
- **Discussions**: [GitHub Discussions](https://github.com/designofadecade/cdk-constructs/discussions)
- **Email**: support@designofadecade.com

## 🗺️ Roadmap

- [ ] Additional AWS services (AppSync, Step Functions, etc.)
- [ ] Enhanced monitoring and alerting constructs
- [ ] Multi-region deployment patterns
- [ ] Cost optimization utilities
- [ ] Infrastructure testing helpers
- [ ] Migration guides from other CDK libraries

## 📊 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## 🙏 Acknowledgments

Built with ❤️ using [AWS CDK](https://aws.amazon.com/cdk/)

---

**Made by Design of a Decade** | [Website](https://designofadecade.com) | [GitHub](https://github.com/designofadecade)
