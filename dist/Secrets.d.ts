import { Construct } from 'constructs';
import { SecretValue } from 'aws-cdk-lib';
import { type ISecret, type SecretStringGenerator } from 'aws-cdk-lib/aws-secretsmanager';
import type { IGrantable } from 'aws-cdk-lib/aws-iam';
/**
 * Properties for configuring a Secrets Manager secret
 */
export interface SecretsProps {
    /**
     * The name of the secret (will be prefixed with stack's secret name prefix)
     */
    readonly name: string;
    /**
     * The stack reference containing configuration and tags
     */
    readonly stack: {
        readonly config: {
            /**
             * Prefix to add to all secret names for organization
             */
            readonly secretNamePrefix: string;
        };
        readonly tags: ReadonlyArray<{
            readonly key: string;
            readonly value: string;
        }>;
    };
    /**
     * The secret value - can be a SecretValue, plain object, or undefined for generated secrets
     */
    readonly value?: SecretValue | Record<string, unknown>;
    /**
     * Optional description for the secret
     */
    readonly description?: string;
    /**
     * Optional configuration for auto-generating a secret string
     */
    readonly generateSecretString?: SecretStringGenerator;
}
/**
 * A CDK construct for creating AWS Secrets Manager secrets
 *
 * Features:
 * - Support for string values, JSON objects, and auto-generated secrets
 * - Automatic tagging
 * - Convenient methods for granting access
 * - Placeholder value constant for initial deployment
 *
 * @example
 * ```typescript
 * // Create a secret with a string value
 * const apiKey = new Secrets(this, 'ApiKey', {
 *   name: '/app/api-key',
 *   value: SecretValue.unsafePlainText('my-secret-key'),
 *   description: 'API key for external service',
 *   stack: { config: { secretNamePrefix: 'prod/' }, tags: [] },
 * });
 *
 * // Create a secret with JSON value
 * const dbCreds = new Secrets(this, 'DbCreds', {
 *   name: '/app/database',
 *   value: {
 *     username: 'admin',
 *     password: Secrets.REPLACE_ME,
 *   },
 *   stack: { config: { secretNamePrefix: 'prod/' }, tags: [] },
 * });
 *
 * // Grant read access to a Lambda function
 * apiKey.grantRead(myFunction);
 * ```
 */
export declare class Secrets extends Construct {
    #private;
    /**
     * A placeholder SecretValue that should be replaced manually in the AWS Console
     * Use this for secrets that should not be stored in code
     */
    static readonly REPLACE_ME = "__REPLACE_ME__";
    constructor(scope: Construct, id: string, props: SecretsProps);
    /**
     * Gets the ARN of the secret
     */
    get arn(): string;
    /**
     * Gets the secret value for use in CloudFormation
     *
     * Note: Use with caution as this may expose the secret value in CloudFormation templates
     */
    get secretValue(): SecretValue;
    /**
     * Grants read permissions to the secret
     *
     * @param principal - The IAM principal to grant permissions to
     */
    grantRead(principal: IGrantable): void;
    /**
     * Creates a JSON secret with simplified props
     *
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param props - Simplified props without secretNamePrefix requirement
     * @returns A new Secrets instance
     */
    static json(scope: Construct, id: string, props: Omit<SecretsProps, 'stack'> & {
        stack: {
            id: string;
            tags: ReadonlyArray<{
                key: string;
                value: string;
            }>;
        };
    }): Secrets;
    /**
     * Creates a string secret with simplified props
     *
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param props - Simplified props without secretNamePrefix requirement
     * @returns A new Secrets instance
     */
    static string(scope: Construct, id: string, props: Omit<SecretsProps, 'stack'> & {
        stack: {
            id: string;
            tags: ReadonlyArray<{
                key: string;
                value: string;
            }>;
        };
    }): Secrets;
    /**
     * Imports an existing secret by name
     *
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param secretName - The name of the existing secret
     * @returns An ISecret that can be used to reference the secret
     */
    static fromExistingSecret(scope: Construct, id: string, secretName: string): ISecret;
}
