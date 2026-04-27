import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Access, S3Bucket, CloudFront } from '@designofadecade/cdk-constructs';

/**
 * Example showing how to create a GitHub Actions deployment role
 * using the Access construct
 */
export class MyAppStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Your existing resources
        const bucket = new S3Bucket(this, 'AppBucket', {
            name: 'my-app-bucket',
            stack: {
                id: 'my-app',
                tags: [{ key: 'Environment', value: 'production' }],
            },
        });

        const artifactsBucket = new S3Bucket(this, 'ArtifactsBucket', {
            name: 'my-app-artifacts',
            stack: {
                id: 'my-app',
                tags: [{ key: 'Environment', value: 'production' }],
            },
        });

        const cloudFront = new CloudFront(this, 'Distribution', {
            // ... your CloudFront config
            name: 'my-app-cdn',
            stack: {
                id: 'my-app',
                tags: [{ key: 'Environment', value: 'production' }],
            },
            defaultBehavior: {
                origin: {
                    type: 's3',
                    bucket: bucket.bucket,
                },
            },
        });

        // GitHub OIDC Provider ARN (create this once per AWS account)
        const githubOidcProviderArn = 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com';
        
        // GitHub repository
        const githubRepository = 'my-org/my-repo';
        
        // Environment configuration
        const environment = 'production'; // or 'staging'
        const allowedBranch = environment === 'production' ? 'main' : 'staging';

        // Create GitHub Actions deployment role using Access construct
        const githubActionsRole = new Access(this, 'GitHubActionsRole', {
            name: 'github-actions-role',
            description: `GitHub Actions deployment role for ${environment} environment`,
            stack: {
                id: 'my-app',
                tags: [{ key: 'Environment', value: environment }],
            },
            githubOidc: {
                providerArn: githubOidcProviderArn,
                repository: githubRepository,
                allowedBranch: allowedBranch,
                environmentName: environment,
            },
            s3Access: [
                {
                    bucket: bucket.bucket,
                    prefixes: ['dashboard/*', 'public/*', 'website/*', 'm-*'],
                },
                {
                    bucket: artifactsBucket.bucket,
                    prefixes: ['functions/*'],
                    actions: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
                },
            ],
            cloudFrontAccess: [
                {
                    distribution: cloudFront.distribution,
                },
            ],
            lambdaAccess: [
                {
                    functionPrefix: 'my-app-*',
                    region: this.region,
                    accountId: this.account,
                },
            ],
        });

        // The role ARN is automatically exported as a CloudFormation output
        // You can access it in your GitHub workflow as:
        // role-to-assume: arn:aws:iam::123456789012:role/my-app-github-actions-role
    }
}
