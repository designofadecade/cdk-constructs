# Access

A CDK construct that creates IAM roles with OIDC federation for GitHub Actions and other CI/CD workflows. The `Access` construct simplifies setting up secure, least-privilege IAM roles for automated deployments.

## Features

- ✅ **GitHub OIDC Provider** - Secure authentication using GitHub Actions OIDC
- ✅ **Granular Permissions** - Fine-grained S3, CloudFront, and Lambda permissions
- ✅ **Branch Protection** - Restrict deployments to specific branches
- ✅ **Environment Targeting** - Support for GitHub environment deployments
- ✅ **Tag-based Releases** - Allow deployments from Git tags
- ✅ **Automatic Tagging** - Apply stack tags to the IAM role
- ✅ **CloudFormation Outputs** - Export role ARN for use in GitHub workflows

## Basic Usage

### GitHub Actions Deployment Role

```typescript
import { Access } from '@designofadecade/cdk-constructs';

const githubRole = new Access(this, 'GitHubActionsRole', {
  name: 'github-actions-role',
  description: 'GitHub Actions deployment role for production',
  stack: {
    id: 'my-app',
    tags: [
      { key: 'Environment', value: 'production' },
      { key: 'ManagedBy', value: 'CDK' },
    ],
  },
  githubOidc: {
    providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
    repository: 'my-org/my-repo',
    allowedBranch: 'main',
    environmentName: 'production',
  },
});
```

## Common Scenarios

### Full Deployment Role with S3, CloudFront, and Lambda

```typescript
const deploymentRole = new Access(this, 'DeploymentRole', {
  name: 'github-deployment-role',
  description: 'GitHub Actions deployment role',
  stack: {
    id: 'my-app-production',
    tags: [],
  },
  githubOidc: {
    providerArn: githubOidcProviderArn,
    repository: 'my-org/my-app',
    allowedBranch: 'main',
    environmentName: 'production',
  },
  s3Access: [
    {
      bucket: websiteBucket,
      prefixes: ['dashboard/*', 'public/*', 'website/*'],
    },
    {
      bucket: artifactsBucket,
      prefixes: ['functions/*'],
      actions: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
    },
  ],
  cloudFrontAccess: [
    {
      distribution: myDistribution,
    },
  ],
  lambdaAccess: [
    {
      functionPrefix: 'my-app-production-*',
      region: this.region,
      accountId: this.account,
    },
  ],
});
```

### Staging Environment with Different Branch

```typescript
const stagingRole = new Access(this, 'StagingDeploymentRole', {
  name: 'github-staging-role',
  stack: {
    id: 'my-app-staging',
    tags: [],
  },
  githubOidc: {
    providerArn: githubOidcProviderArn,
    repository: 'my-org/my-app',
    allowedBranch: 'staging',
    environmentName: 'staging',
    allowTags: false, // Don't allow tag-based deployments in staging
  },
  s3Access: [
    {
      bucket: stagingBucket,
      prefixes: ['*'], // Full bucket access for staging
    },
  ],
});
```

### Lambda-Only Deployment Role

```typescript
const lambdaDeployRole = new Access(this, 'LambdaDeployRole', {
  name: 'lambda-deploy-role',
  stack: {
    id: 'my-app',
    tags: [],
  },
  githubOidc: {
    providerArn: githubOidcProviderArn,
    repository: 'my-org/my-app',
    allowedBranch: 'main',
  },
  lambdaAccess: [
    {
      functionPrefix: 'my-app-*',
      region: 'us-east-1',
      accountId: '123456789012',
      actions: [
        'lambda:UpdateFunctionCode',
        'lambda:GetFunction',
        'lambda:PublishVersion',
      ],
    },
  ],
});
```

### Adding Custom Permissions

```typescript
const role = new Access(this, 'CustomRole', {
  name: 'custom-role',
  stack: { id: 'my-app', tags: [] },
  githubOidc: {
    providerArn: githubOidcProviderArn,
    repository: 'my-org/my-app',
    allowedBranch: 'main',
  },
});

// Add custom DynamoDB permissions
role.addToPolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'dynamodb:PutItem',
    'dynamodb:GetItem',
    'dynamodb:UpdateItem',
  ],
  resources: [
    `arn:aws:dynamodb:${this.region}:${this.account}:table/MyTable`,
  ],
}));

// Add CloudWatch Logs permissions
role.addToPolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'logs:CreateLogStream',
    'logs:PutLogEvents',
  ],
  resources: [
    `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`,
  ],
}));
```

## GitHub Actions Workflow

After deploying the Access construct, use the role in your GitHub Actions workflow:

```yaml
name: Deploy

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/my-app-github-actions-role
          aws-region: us-east-1
      
      - name: Deploy to S3
        run: |
          aws s3 sync ./dist/ s3://my-bucket/website/ --delete
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id E1234567890ABC \
            --paths "/*"
      
      - name: Update Lambda Function
        run: |
          aws lambda update-function-code \
            --function-name my-app-production-api \
            --zip-file fileb://function.zip
```

## Configuration

### GitHubOidcConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `providerArn` | `string` | Yes | ARN of the GitHub OIDC provider |
| `repository` | `string` | Yes | GitHub repository in format 'owner/repo' |
| `allowedBranch` | `string` | No | Branch allowed for deployments |
| `environmentName` | `string` | No | GitHub environment name |
| `allowTags` | `boolean` | No | Allow deployments from Git tags (default: `true`) |

### S3AccessConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `bucket` | `IBucket` | Yes | S3 bucket to grant access to |
| `prefixes` | `string[]` | Yes | Paths/prefixes to allow access to |
| `actions` | `string[]` | No | S3 actions to allow (default: PutObject, GetObject, DeleteObject, ListBucket) |

### CloudFrontAccessConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `distribution` | `IDistribution` | Yes | CloudFront distribution to grant access to |
| `actions` | `string[]` | No | CloudFront actions to allow (default: CreateInvalidation, GetInvalidation) |

### LambdaAccessConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `functionPrefix` | `string` | Yes | Function name prefix (e.g., 'my-app-*') |
| `region` | `string` | Yes | AWS region |
| `accountId` | `string` | Yes | AWS account ID |
| `actions` | `string[]` | No | Lambda actions to allow (default: UpdateFunctionCode, GetFunction, GetFunctionConfiguration, PublishVersion) |

## Setting Up GitHub OIDC Provider

Before using the Access construct, you need to create a GitHub OIDC provider in your AWS account. This only needs to be done once per account:

### Using AWS Console

1. Go to IAM → Identity providers → Add provider
2. Select "OpenID Connect"
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Click "Add provider"

### Using AWS CLI

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### Using CDK

```typescript
import { OpenIdConnectProvider } from 'aws-cdk-lib/aws-iam';

const provider = new OpenIdConnectProvider(this, 'GitHubProvider', {
  url: 'https://token.actions.githubusercontent.com',
  clientIds: ['sts.amazonaws.com'],
});

// Use the provider ARN in Access construct
const role = new Access(this, 'GitHubRole', {
  // ...
  githubOidc: {
    providerArn: provider.openIdConnectProviderArn,
    // ...
  },
});
```

## Properties

### role

```typescript
public readonly role: IRole
```

The underlying IAM role created by the construct.

### roleArn

```typescript
public get roleArn(): string
```

The ARN of the IAM role.

### roleName

```typescript
public get roleName(): string
```

The name of the IAM role.

## Methods

### addToPolicy

```typescript
public addToPolicy(statement: PolicyStatement): void
```

Add a custom policy statement to the role.

**Example:**

```typescript
role.addToPolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['secretsmanager:GetSecretValue'],
  resources: ['arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-*'],
}));
```

## Security Best Practices

1. **Least Privilege**: Only grant the minimum permissions required for deployments
2. **Branch Protection**: Restrict deployments to specific branches
3. **Environment Protection**: Use GitHub environments with required reviewers for production
4. **Prefix-Based Access**: Use S3 prefixes to limit access to specific paths
5. **Tag-Based Releases**: Consider disabling tag-based deployments for non-production environments
6. **Audit CloudTrail**: Monitor role usage via AWS CloudTrail logs

## Related Constructs

- [S3Bucket](./S3Bucket.md) - For creating S3 buckets
- [CloudFront](./CloudFront.md) - For creating CloudFront distributions
- [Function](./Function.md) - For creating Lambda functions

## Examples

See the [examples directory](./examples/) for complete CDK stack examples using the Access construct.
