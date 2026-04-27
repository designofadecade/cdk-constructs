import { describe, it, expect, beforeEach } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { GitHubAccess } from './GitHubAccess.js';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

describe('GitHubAccess', () => {
    let app: App;
    let stack: Stack;

    beforeEach(() => {
        app = new App();
        stack = new Stack(app, 'TestStack', {
            env: {
                account: '123456789012',
                region: 'us-east-1',
            },
        });
    });

    it('should create a GitHub Actions role with OIDC federation', () => {
        new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-actions-role',
            description: 'GitHub Actions deployment role',
            stack: {
                id: 'test-app',
                tags: [{ key: 'Environment', value: 'test' }],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'main',
                environmentName: 'production',
            },
        });

        const template = Template.fromStack(stack);

        // Check role exists
        template.hasResourceProperties('AWS::IAM::Role', {
            RoleName: 'test-app-github-actions-role',
            Description: 'GitHub Actions deployment role',
            AssumeRolePolicyDocument: {
                Statement: [
                    {
                        Action: 'sts:AssumeRoleWithWebIdentity',
                        Condition: {
                            StringEquals: {
                                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                            },
                            'ForAnyValue:StringLike': {
                                'token.actions.githubusercontent.com:sub': [
                                    'repo:my-org/my-repo:ref:refs/heads/main',
                                    'repo:my-org/my-repo:environment:production',
                                    'repo:my-org/my-repo:ref:refs/tags/*',
                                ],
                            },
                        },
                        Effect: 'Allow',
                        Principal: {
                            Federated: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                        },
                    },
                ],
            },
        });

        // Check tags
        template.hasResourceProperties('AWS::IAM::Role', {
            Tags: Match.arrayWith([
                {
                    Key: 'Environment',
                    Value: 'test',
                },
            ]),
        });

        // Check output
        template.hasOutput('*', {
            Description: 'GitHub Actions deployment role',
            Export: {
                Name: 'test-app-github-actions-role-arn',
            },
        });
    });

    it('should support GitHub OIDC with only branch access', () => {
        new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-role',
            stack: {
                id: 'test-app',
                tags: [],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'staging',
                allowTags: false,
            },
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::IAM::Role', {
            AssumeRolePolicyDocument: {
                Statement: [
                    {
                        Condition: {
                            'ForAnyValue:StringLike': {
                                'token.actions.githubusercontent.com:sub': [
                                    'repo:my-org/my-repo:ref:refs/heads/staging',
                                ],
                            },
                        },
                    },
                ],
            },
        });
    });

    it('should add S3 bucket permissions', () => {
        const bucket = new Bucket(stack, 'Bucket', {
            bucketName: 'test-bucket',
        });

        new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-role',
            stack: {
                id: 'test-app',
                tags: [],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'main',
            },
            s3Access: [
                {
                    bucket: bucket,
                    prefixes: ['dashboard/*', 'public/*'],
                },
            ],
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    {
                        Action: [
                            's3:PutObject',
                            's3:GetObject',
                            's3:DeleteObject',
                            's3:ListBucket',
                        ],
                        Effect: 'Allow',
                        Resource: Match.arrayWith([
                            {
                                'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('Bucket'), 'Arn']),
                            },
                            {
                                'Fn::Join': [
                                    '',
                                    Match.arrayWith(['/dashboard/*']),
                                ],
                            },
                        ]),
                    },
                ]),
            },
        });
    });

    it('should add CloudFront invalidation permissions', () => {
        const bucket = new Bucket(stack, 'Bucket');
        const distribution = new Distribution(stack, 'Distribution', {
            defaultBehavior: {
                origin: new S3Origin(bucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
        });

        new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-role',
            stack: {
                id: 'test-app',
                tags: [],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'main',
            },
            cloudFrontAccess: [
                {
                    distribution: distribution,
                },
            ],
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    {
                        Action: [
                            'cloudfront:CreateInvalidation',
                            'cloudfront:GetInvalidation',
                        ],
                        Effect: 'Allow',
                        Resource: {
                            'Fn::Join': [
                                '',
                                Match.arrayWith([
                                    'arn:aws:cloudfront::123456789012:distribution/',
                                ]),
                            ],
                        },
                    },
                ]),
            },
        });
    });

    it('should add Lambda function permissions', () => {
        new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-role',
            stack: {
                id: 'test-app',
                tags: [],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'main',
            },
            lambdaAccess: [
                {
                    functionPrefix: 'test-app-*',
                    region: 'us-east-1',
                    accountId: '123456789012',
                },
            ],
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    {
                        Action: [
                            'lambda:UpdateFunctionCode',
                            'lambda:GetFunction',
                            'lambda:GetFunctionConfiguration',
                            'lambda:PublishVersion',
                        ],
                        Effect: 'Allow',
                        Resource: 'arn:aws:lambda:us-east-1:123456789012:function:test-app-*',
                    },
                ]),
            },
        });
    });

    it('should support custom S3 actions', () => {
        const bucket = new Bucket(stack, 'Bucket');

        new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-role',
            stack: {
                id: 'test-app',
                tags: [],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'main',
            },
            s3Access: [
                {
                    bucket: bucket,
                    prefixes: ['logs/*'],
                    actions: ['s3:GetObject', 's3:ListBucket'],
                },
            ],
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Action: [
                            's3:GetObject',
                            's3:ListBucket',
                        ],
                        Effect: 'Allow',
                    }),
                ]),
            },
        });
    });

    it('should disable output when createOutput is false', () => {
        new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-role',
            stack: {
                id: 'test-app',
                tags: [],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'main',
            },
            createOutput: false,
        });

        const template = Template.fromStack(stack);

        // Should not have outputs
        expect(Object.keys(template.findOutputs('*'))).toHaveLength(0);
    });

    it('should support custom output names', () => {
        new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-role',
            stack: {
                id: 'test-app',
                tags: [],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'main',
            },
            outputName: 'CustomRoleArn',
            exportName: 'custom-export-name',
        });

        const template = Template.fromStack(stack);

        template.hasOutput('*', {
            Export: {
                Name: 'custom-export-name',
            },
        });
    });

    it('should allow adding custom policy statements', () => {
        const access = new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-role',
            stack: {
                id: 'test-app',
                tags: [],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'main',
            },
        });

        access.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['dynamodb:GetItem'],
                resources: ['arn:aws:dynamodb:us-east-1:123456789012:table/MyTable'],
            })
        );

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Action: 'dynamodb:GetItem',
                        Resource: 'arn:aws:dynamodb:us-east-1:123456789012:table/MyTable',
                    }),
                ]),
            },
        });
    });

    it('should expose role properties', () => {
        const access = new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-role',
            stack: {
                id: 'test-app',
                tags: [],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'main',
            },
        });

        expect(access.role).toBeDefined();
        expect(access.roleArn).toBeDefined();
        expect(access.roleName).toBeDefined();
    });

    it('should combine multiple S3 bucket permissions', () => {
        const bucket1 = new Bucket(stack, 'Bucket1');
        const bucket2 = new Bucket(stack, 'Bucket2');

        new GitHubAccess(stack, 'GitHubRole', {
            name: 'github-role',
            stack: {
                id: 'test-app',
                tags: [],
            },
            githubOidc: {
                providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
                repository: 'my-org/my-repo',
                allowedBranch: 'main',
            },
            s3Access: [
                {
                    bucket: bucket1,
                    prefixes: ['public/*'],
                },
                {
                    bucket: bucket2,
                    prefixes: ['artifacts/*'],
                },
            ],
        });

        const template = Template.fromStack(stack);

        // Should have 2 policy statements for S3
        const policy = template.findResources('AWS::IAM::Policy');
        const policyDoc = Object.values(policy)[0]?.Properties?.PolicyDocument;
        const s3Statements = policyDoc?.Statement?.filter((s: any) =>
            s.Action?.some((a: string) => a.startsWith('s3:'))
        );

        expect(s3Statements).toHaveLength(2);
    });

    it('should throw error when no authentication method is provided', () => {
        expect(() => {
            new GitHubAccess(stack, 'GitHubRole', {
                name: 'github-role',
                stack: {
                    id: 'test-app',
                    tags: [],
                },
            });
        }).toThrow('At least one authentication method (githubOidc) must be provided');
    });
});
