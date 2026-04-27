import { Construct } from 'constructs';
import { Tags, CfnOutput, Stack } from 'aws-cdk-lib';
import { Role, FederatedPrincipal, PolicyStatement, Effect, type IRole } from 'aws-cdk-lib/aws-iam';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import type { IDistribution } from 'aws-cdk-lib/aws-cloudfront';

/**
 * Configuration for GitHub OIDC authentication
 */
export interface GitHubOidcConfig {
    /**
     * ARN of the GitHub OIDC provider
     * 
     * @example
     * ```
     * arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com
     * ```
     */
    readonly providerArn: string;

    /**
     * GitHub repository in format 'owner/repo'
     * 
     * @example
     * ```
     * designofadecade/my-app
     * ```
     */
    readonly repository: string;

    /**
     * Allowed branch for deployments
     * 
     * @example
     * ```
     * main
     * ```
     */
    readonly allowedBranch?: string;

    /**
     * Environment name for the deployment
     * 
     * @example
     * ```
     * production
     * ```
     */
    readonly environmentName?: string;

    /**
     * Allow deployment from tags
     * 
     * @default true
     */
    readonly allowTags?: boolean;
}

/**
 * Configuration for S3 bucket access permissions
 */
export interface S3AccessConfig {
    /**
     * The S3 bucket to grant access to
     */
    readonly bucket: IBucket;

    /**
     * Prefixes/paths to allow access to
     * 
     * @example
     * ```typescript
     * ['dashboard/*', 'public/*', 'website/*']
     * ```
     */
    readonly prefixes: ReadonlyArray<string>;

    /**
     * Actions to allow
     * 
     * @default ['s3:PutObject', 's3:GetObject', 's3:DeleteObject', 's3:ListBucket']
     */
    readonly actions?: ReadonlyArray<string>;
}

/**
 * Configuration for CloudFront access permissions
 */
export interface CloudFrontAccessConfig {
    /**
     * The CloudFront distribution to grant access to
     */
    readonly distribution: IDistribution;

    /**
     * Actions to allow
     * 
     * @default ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation']
     */
    readonly actions?: ReadonlyArray<string>;
}

/**
 * Configuration for Lambda function access permissions
 */
export interface LambdaAccessConfig {
    /**
     * Function name prefix to grant access to
     * 
     * @example
     * ```
     * my-app-production-*
     * ```
     */
    readonly functionPrefix: string;

    /**
     * AWS region where the functions are deployed
     */
    readonly region: string;

    /**
     * AWS account ID where the functions are deployed
     */
    readonly accountId: string;

    /**
     * Actions to allow
     * 
     * @default ['lambda:UpdateFunctionCode', 'lambda:GetFunction', 'lambda:GetFunctionConfiguration', 'lambda:PublishVersion']
     */
    readonly actions?: ReadonlyArray<string>;
}

/**
 * Properties for configuring an Access role
 */
export interface AccessProps {
    /**
     * The name of the IAM role
     */
    readonly name: string;

    /**
     * Description of the role's purpose
     */
    readonly description?: string;

    /**
     * The stack reference containing tags and ID
     */
    readonly stack: {
        readonly id: string;
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    };

    /**
     * GitHub OIDC configuration for GitHub Actions
     */
    readonly githubOidc?: GitHubOidcConfig;

    /**
     * S3 bucket access configurations
     */
    readonly s3Access?: ReadonlyArray<S3AccessConfig>;

    /**
     * CloudFront access configurations
     */
    readonly cloudFrontAccess?: ReadonlyArray<CloudFrontAccessConfig>;

    /**
     * Lambda function access configurations
     */
    readonly lambdaAccess?: ReadonlyArray<LambdaAccessConfig>;

    /**
     * Create a CloudFormation output with the role ARN
     * 
     * @default true
     */
    readonly createOutput?: boolean;

    /**
     * Custom output name for the role ARN
     * 
     * @default `${name}Arn`
     */
    readonly outputName?: string;

    /**
     * Custom export name for the CloudFormation output
     * 
     * @default `${stack.id}-${name}-arn`
     */
    readonly exportName?: string;
}

/**
 * A CDK construct that creates IAM roles with OIDC federation for GitHub Actions and other CI/CD workflows
 * 
 * Features:
 * - GitHub OIDC provider support for secure deployments
 * - Granular S3, CloudFront, and Lambda permissions
 * - Automatic tagging
 * - CloudFormation output with role ARN
 * 
 * @example
 * ```typescript
 * // Create a GitHub Actions deployment role
 * const githubRole = new Access(this, 'GitHubActionsRole', {
 *   name: 'github-actions-role',
 *   description: 'GitHub Actions deployment role for production',
 *   stack: { id: 'my-app', tags: [] },
 *   githubOidc: {
 *     providerArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
 *     repository: 'my-org/my-repo',
 *     allowedBranch: 'main',
 *     environmentName: 'production',
 *   },
 *   s3Access: [
 *     {
 *       bucket: myBucket,
 *       prefixes: ['dashboard/*', 'public/*'],
 *     },
 *   ],
 *   cloudFrontAccess: [
 *     {
 *       distribution: myDistribution,
 *     },
 *   ],
 *   lambdaAccess: [
 *     {
 *       functionPrefix: 'my-app-*',
 *       region: this.region,
 *       accountId: this.account,
 *     },
 *   ],
 * });
 * ```
 */
export class Access extends Construct {
    /**
     * The IAM role
     */
    public readonly role: Role;

    constructor(scope: Construct, id: string, private readonly props: AccessProps) {
        super(scope, id);

        // Create the role with GitHub OIDC federation
        if (props.githubOidc) {
            this.role = this.createGitHubOidcRole();
        } else {
            throw new Error('At least one authentication method (githubOidc) must be provided');
        }

        // Add S3 permissions
        if (props.s3Access) {
            this.addS3Permissions();
        }

        // Add CloudFront permissions
        if (props.cloudFrontAccess) {
            this.addCloudFrontPermissions();
        }

        // Add Lambda permissions
        if (props.lambdaAccess) {
            this.addLambdaPermissions();
        }

        // Apply tags
        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.role).add(key, value);
        });

        // Create output
        if (props.createOutput !== false) {
            const outputName = props.outputName || `${props.name}Arn`;
            const exportName = props.exportName || `${props.stack.id}-${props.name}-arn`;

            new CfnOutput(this, 'RoleArn', {
                value: this.role.roleArn,
                description: props.description || `IAM Role ARN for ${props.name}`,
                exportName: exportName,
            });
        }
    }

    /**
     * Create a role with GitHub OIDC federation
     */
    private createGitHubOidcRole(): Role {
        const config = this.props.githubOidc!;
        const conditions: Record<string, unknown> = {
            StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            },
        };

        // Build the subject claims for repository access
        const subClaims: string[] = [];

        if (config.allowedBranch) {
            subClaims.push(`repo:${config.repository}:ref:refs/heads/${config.allowedBranch}`);
        }

        if (config.environmentName) {
            subClaims.push(`repo:${config.repository}:environment:${config.environmentName}`);
        }

        if (config.allowTags !== false) {
            subClaims.push(`repo:${config.repository}:ref:refs/tags/*`);
        }

        if (subClaims.length > 0) {
            conditions['ForAnyValue:StringLike'] = {
                'token.actions.githubusercontent.com:sub': subClaims,
            };
        }

        return new Role(this, 'Role', {
            roleName: `${this.props.stack.id}-${this.props.name}`,
            description: this.props.description,
            assumedBy: new FederatedPrincipal(
                config.providerArn,
                conditions,
                'sts:AssumeRoleWithWebIdentity'
            ),
        });
    }

    /**
     * Add S3 bucket permissions
     */
    private addS3Permissions(): void {
        this.props.s3Access?.forEach((config, index) => {
            const actions = config.actions || [
                's3:PutObject',
                's3:GetObject',
                's3:DeleteObject',
                's3:ListBucket',
            ];

            const resources: string[] = [
                config.bucket.bucketArn,
            ];

            // Add prefix-specific permissions
            config.prefixes.forEach(prefix => {
                resources.push(`${config.bucket.bucketArn}/${prefix}`);
            });

            this.role.addToPolicy(new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [...actions],
                resources: resources,
            }));
        });
    }

    /**
     * Add CloudFront permissions
     */
    private addCloudFrontPermissions(): void {
        this.props.cloudFrontAccess?.forEach((config, index) => {
            const actions = config.actions || [
                'cloudfront:CreateInvalidation',
                'cloudfront:GetInvalidation',
            ];

            // Get account from Stack.of()
            const stack = Stack.of(this);
            const accountId = stack.account;

            this.role.addToPolicy(new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [...actions],
                resources: [
                    `arn:aws:cloudfront::${accountId}:distribution/${config.distribution.distributionId}`,
                ],
            }));
        });
    }

    /**
     * Add Lambda function permissions
     */
    private addLambdaPermissions(): void {
        this.props.lambdaAccess?.forEach((config, index) => {
            const actions = config.actions || [
                'lambda:UpdateFunctionCode',
                'lambda:GetFunction',
                'lambda:GetFunctionConfiguration',
                'lambda:PublishVersion',
            ];

            this.role.addToPolicy(new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [...actions],
                resources: [
                    `arn:aws:lambda:${config.region}:${config.accountId}:function:${config.functionPrefix}`,
                ],
            }));
        });
    }

    /**
     * Add a custom policy statement to the role
     * 
     * @param statement The policy statement to add
     */
    public addToPolicy(statement: PolicyStatement): void {
        this.role.addToPolicy(statement);
    }

    /**
     * Get the role ARN
     */
    public get roleArn(): string {
        return this.role.roleArn;
    }

    /**
     * Get the role name
     */
    public get roleName(): string {
        return this.role.roleName;
    }
}
