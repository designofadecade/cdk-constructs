# Quick Start Guide

This guide will help you get started with `@designofadecade/cdk-constructs` in under 10 minutes.

## Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 20 or higher installed
- ✅ AWS CLI configured with credentials
- ✅ AWS CDK CLI installed globally: `npm install -g aws-cdk`
- ✅ An AWS account with appropriate permissions

## Step 1: Create a New CDK Project

```bash
# Create a new directory
mkdir my-infrastructure
cd my-infrastructure

# Initialize CDK project
cdk init app --language typescript

# Install the package
npm install @designofadecade/cdk-constructs
```

## Step 2: Create Your First Stack

Replace the content of `lib/my-infrastructure-stack.ts` with:

```typescript
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc, S3Bucket, Function } from '@designofadecade/cdk-constructs';
import { Runtime, Code } from 'aws-cdk-lib/aws-lambda';

export class MyInfrastructureStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new Vpc(this, 'MyVpc', {
      maxAzs: 2,
    });

    // Create an S3 bucket
    const bucket = new S3Bucket(this, 'MyBucket', {
      versioned: true,
    });

    // Create a Lambda function
    const fn = new Function(this, 'MyFunction', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Hello from CDK!' }),
          };
        };
      `),
      environment: {
        BUCKET_NAME: bucket.bucket.bucketName,
      },
    });

    // Grant the function read access to the bucket
    bucket.bucket.grantRead(fn.function);
  }
}
```

## Step 3: Bootstrap Your AWS Environment

If this is your first time using CDK in your AWS account:

```bash
cdk bootstrap
```

## Step 4: Deploy Your Stack

```bash
# Preview what will be created
cdk diff

# Deploy the stack
cdk deploy
```

The deployment will create:
- ✅ A VPC with public and private subnets
- ✅ An S3 bucket with versioning enabled
- ✅ A Lambda function with access to the bucket

## Step 5: Test Your Deployment

After deployment completes, test your Lambda function:

```bash
aws lambda invoke \
  --function-name MyInfrastructureStack-MyFunction123ABC \
  --payload '{}' \
  response.json

cat response.json
```

## Common Use Cases

### Use Case 1: Static Website with CloudFront

```typescript
import { CloudFront, S3Bucket } from '@designofadecade/cdk-constructs';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';

// Create bucket for website content
const websiteBucket = new S3Bucket(this, 'WebsiteBucket', {
  websiteIndexDocument: 'index.html',
});

// Get your ACM certificate (must be in us-east-1 for CloudFront)
const certificate = Certificate.fromCertificateArn(
  this,
  'Certificate',
  'arn:aws:acm:us-east-1:123456789012:certificate/abc-123'
);

// Create CloudFront distribution
const distribution = new CloudFront(this, 'Distribution', {
  domainNames: ['www.example.com'],
  certificate,
  defaultBehavior: {
    origin: websiteBucket.bucket,
  },
});
```

### Use Case 2: REST API with DynamoDB

```typescript
import { HttpApi, Function, DynamoTable } from '@designofadecade/cdk-constructs';
import { Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';

// Create DynamoDB table
const table = new DynamoTable(this, 'UsersTable', {
  partitionKey: { name: 'userId', type: AttributeType.STRING },
});

// Create Lambda function
const getUsers = new Function(this, 'GetUsers', {
  runtime: Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: Code.fromAsset('lambda/get-users'),
  environment: {
    TABLE_NAME: table.table.tableName,
  },
});

// Grant table access
table.table.grantReadData(getUsers.function);

// Create API
const api = new HttpApi(this, 'UsersApi', {
  corsConfiguration: {
    allowOrigins: ['*'],
    allowMethods: ['GET'],
  },
});

// Add route
api.addFunctionIntegration({
  path: '/users',
  method: 'GET',
  function: getUsers,
});
```

### Use Case 3: User Authentication with Cognito

```typescript
import { Cognito, HttpApi } from '@designofadecade/cdk-constructs';

// Create Cognito User Pool
const cognito = new Cognito(this, 'UserPool', {
  selfSignUpEnabled: true,
  mfa: {
    mfaRequired: false,
    enableTotp: true,
  },
  callbackUrls: ['https://myapp.com/callback'],
  logoutUrls: ['https://myapp.com/logout'],
});

// Create protected API
const api = new HttpApi(this, 'ProtectedApi');

// Add JWT authorizer
api.createJwtAuthorizer({
  identitySource: ['$request.header.Authorization'],
  issuerUrl: cognito.userPool.userPoolProviderUrl,
  audience: [cognito.webClient.userPoolClientId],
});

// Add protected route
api.addFunctionIntegration({
  path: '/protected',
  method: 'GET',
  function: myProtectedFunction,
  authorizationType: 'JWT',
});
```

## Next Steps

Now that you have a basic understanding, explore more:

1. **Read the full documentation** in [README.md](README.md)
2. **Review examples** for each construct
3. **Check best practices** in the documentation
4. **Join discussions** on [GitHub](https://github.com/designofadecade/cdk-constructs/discussions)

## Troubleshooting

### Issue: CDK Bootstrap Failed

**Solution**: Ensure your AWS credentials have sufficient permissions:

```bash
aws sts get-caller-identity  # Verify credentials
aws configure                 # Reconfigure if needed
```

### Issue: Deployment Failed

**Solution**: Check CloudFormation events:

```bash
aws cloudformation describe-stack-events \
  --stack-name MyInfrastructureStack \
  --max-items 10
```

### Issue: Lambda Function Not Working

**Solution**: Check CloudWatch logs:

```bash
aws logs tail /aws/lambda/MyFunction --follow
```

## Cleanup

To avoid charges, destroy your stack when done:

```bash
cdk destroy
```

Confirm the deletion when prompted.

## Getting Help

- 📖 [Full Documentation](README.md)
- 💬 [GitHub Discussions](https://github.com/designofadecade/cdk-constructs/discussions)
- 🐛 [Report Issues](https://github.com/designofadecade/cdk-constructs/issues)
- 📧 Email: support@designofadecade.com

## What's Next?

Ready to build more complex infrastructure? Check out our advanced guides:

- **[Multi-Environment Deployments](docs/multi-environment.md)** - Dev, staging, and production
- **[CI/CD Integration](docs/cicd.md)** - Automate deployments with GitHub Actions
- **[Security Best Practices](SECURITY.md)** - Secure your infrastructure
- **[Cost Optimization](docs/cost-optimization.md)** - Reduce AWS costs

Happy building! 🚀
