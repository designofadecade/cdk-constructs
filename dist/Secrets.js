import { Construct } from 'constructs';
import { Tags, SecretValue, CfnOutput } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
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
    static REPLACE_ME = SecretValue.unsafePlainText('REPLACE_ME');
    #secret;
    constructor(scope, id, props) {
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
        }
        else {
            this.#secret = new Secret(this, `Secret${sanitizedId}`, {
                secretName,
                description: props.description ?? '',
                secretObjectValue: props.value,
                generateSecretString: props.generateSecretString,
            });
        }
        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#secret).add(key, value);
        });
        new CfnOutput(this, 'SecretArn', {
            value: this.#secret.secretArn,
            description: 'Secret ARN',
            exportName: `${secretName.replaceAll('/', '-')}-arn`,
        });
    }
    /**
     * Gets the ARN of the secret
     */
    get arn() {
        return this.#secret.secretArn;
    }
    /**
     * Gets the secret value for use in CloudFormation
     *
     * Note: Use with caution as this may expose the secret value in CloudFormation templates
     */
    get secretValue() {
        return this.#secret.secretValue;
    }
    /**
     * Grants read permissions to the secret
     *
     * @param principal - The IAM principal to grant permissions to
     */
    grantRead(principal) {
        this.#secret.grantRead(principal);
    }
    /**
     * Creates a JSON secret with simplified props
     *
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param props - Simplified props without secretNamePrefix requirement
     * @returns A new Secrets instance
     */
    static json(scope, id, props) {
        return new Secrets(scope, id, {
            ...props,
            stack: {
                config: { secretNamePrefix: '' },
                tags: props.stack.tags,
            },
        });
    }
    /**
     * Creates a string secret with simplified props
     *
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param props - Simplified props without secretNamePrefix requirement
     * @returns A new Secrets instance
     */
    static string(scope, id, props) {
        return new Secrets(scope, id, {
            ...props,
            stack: {
                config: { secretNamePrefix: '' },
                tags: props.stack.tags,
            },
        });
    }
    /**
     * Imports an existing secret by name
     *
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param secretName - The name of the existing secret
     * @returns An ISecret that can be used to reference the secret
     */
    static fromExistingSecret(scope, id, secretName) {
        return Secret.fromSecretNameV2(scope, id, secretName);
    }
}
