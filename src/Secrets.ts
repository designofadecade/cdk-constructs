import { Construct } from 'constructs';
import { Tags, SecretValue } from 'aws-cdk-lib';
import { Secret, type ISecret, type SecretStringGenerator } from 'aws-cdk-lib/aws-secretsmanager';
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
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
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
export class Secrets extends Construct {
    /**
     * A placeholder SecretValue that should be replaced manually in the AWS Console
     * Use this for secrets that should not be stored in code
     */
    static readonly REPLACE_ME = SecretValue.unsafePlainText('REPLACE_ME');

    #secret: ISecret;

    constructor(scope: Construct, id: string, props: SecretsProps) {
        super(scope, id);

        const secretName = `${props.stack.config.secretNamePrefix}${props.name}`;
        const sanitizedId = props.name.replaceAll('/', '');

        if (props.value instanceof SecretValue) {
            this.#secret = new Secret(this, `Secret${sanitizedId}`, {
                secretName,
                description: props.description ?? '',
                secretStringValue: props.value,
                generateSecretString: props.generateSecretString,
            });
        } else {
            this.#secret = new Secret(this, `Secret${sanitizedId}`, {
                secretName,
                description: props.description ?? '',
                secretObjectValue: props.value as Record<string, SecretValue> | undefined,
                generateSecretString: props.generateSecretString,
            });
        }

        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#secret).add(key, value);
        });
    }

    /**
     * Gets the ARN of the secret
     */
    get arn(): string {
        return this.#secret.secretArn;
    }

    /**
     * Gets the secret value for use in CloudFormation
     * 
     * Note: Use with caution as this may expose the secret value in CloudFormation templates
     */
    get secretValue(): SecretValue {
        return this.#secret.secretValue;
    }

    /**
     * Grants read permissions to the secret
     * 
     * @param principal - The IAM principal to grant permissions to
     */
    grantRead(principal: IGrantable): void {
        this.#secret.grantRead(principal);
    }
}
