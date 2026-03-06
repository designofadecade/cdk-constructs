import { Construct } from 'constructs';
import { Tags, CfnOutput } from 'aws-cdk-lib';
import { StringParameter, type IParameter, ParameterTier } from 'aws-cdk-lib/aws-ssm';
import type { IGrantable } from 'aws-cdk-lib/aws-iam';

/**
 * Properties for configuring a Systems Manager Parameter Store parameter
 */
export interface ParameterStoreProps {
    /**
     * The name of the parameter (will be prefixed with stack's parameter name prefix)
     */
    readonly name: string;

    /**
     * The stack reference containing configuration and tags
     */
    readonly stack: {
        readonly config: {
            /**
             * Prefix to add to all parameter names for organization
             */
            readonly parameterNamePrefix: string;
        };
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    };

    /**
     * The parameter value - can be a string or object (will be JSON stringified)
     */
    readonly value: string | Record<string, unknown>;

    /**
     * Optional description for the parameter
     */
    readonly description?: string;

    /**
     * The tier of the parameter
     * @default ParameterTier.STANDARD
     */
    readonly tier?: ParameterTier;

    /**
     * Whether to allow updates to the parameter value
     * @default false
     */
    readonly allowedPattern?: string;
}

/**
 * A CDK construct for creating AWS Systems Manager Parameter Store parameters
 * 
 * Features:
 * - Support for string values and JSON objects
 * - Automatic tagging
 * - Convenient methods for granting access
 * - Support for standard string parameters
 * - Placeholder value constant for initial deployment
 * 
 * Note: SecureString parameters cannot be created via CDK/CloudFormation.
 * Use AWS Console, CLI, or SDK to create SecureString parameters, then import them.
 * 
 * @example
 * ```typescript
 * // Create a parameter with a string value
 * const apiEndpoint = new ParameterStore(this, 'ApiEndpoint', {
 *   name: '/app/api-endpoint',
 *   value: 'https://api.example.com',
 *   description: 'API endpoint URL',
 *   stack: { config: { parameterNamePrefix: '/prod/' }, tags: [] },
 * });
 * 
 * // Create a parameter with JSON value
 * const config = new ParameterStore(this, 'AppConfig', {
 *   name: '/app/config',
 *   value: {
 *     timeout: 30,
 *     retries: 3,
 *     endpoint: 'https://api.example.com'
 *   },
 *   stack: { config: { parameterNamePrefix: '/prod/' }, tags: [] },
 * });
 * 
 * // Create a placeholder parameter (to be replaced manually in AWS Console)
 * const apiKey = new ParameterStore(this, 'ApiKey', {
 *   name: '/app/api-key',
 *   value: ParameterStore.REPLACE_ME,
 *   stack: { config: { parameterNamePrefix: '/prod/' }, tags: [] },
 * });
 * 
 * // Grant read access to a Lambda function
 * apiEndpoint.grantRead(myFunction);
 * ```
 */
export class ParameterStore extends Construct {
    /**
     * A placeholder value that should be replaced manually in the AWS Console
     * Use this for sensitive parameters that should not be stored in code
     */
    static readonly REPLACE_ME = 'REPLACE_ME';

    #parameter: StringParameter;

    constructor(scope: Construct, id: string, props: ParameterStoreProps) {
        super(scope, id);

        const parameterName = `${props.stack.config.parameterNamePrefix}${props.name}`;
        const sanitizedId = props.name.replaceAll('/', '');

        // Convert object values to JSON string
        const stringValue = typeof props.value === 'string'
            ? props.value
            : JSON.stringify(props.value);

        this.#parameter = new StringParameter(this, `Parameter${sanitizedId}`, {
            parameterName,
            description: props.description ?? '',
            stringValue,
            tier: props.tier ?? ParameterTier.STANDARD,
            allowedPattern: props.allowedPattern,
        });

        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#parameter).add(key, value);
        });

        new CfnOutput(this, 'ParameterArn', {
            value: this.#parameter.parameterArn,
            description: 'Parameter ARN',
            exportName: `${parameterName.replaceAll('/', '-')}-arn`,
        });

        new CfnOutput(this, 'ParameterName', {
            value: this.#parameter.parameterName,
            description: 'Parameter Name',
            exportName: `${parameterName.replaceAll('/', '-')}-name`,
        });
    }

    /**
     * Gets the ARN of the parameter
     */
    get arn(): string {
        return this.#parameter.parameterArn;
    }

    /**
     * Gets the name of the parameter
     */
    get name(): string {
        return this.#parameter.parameterName;
    }

    /**
     * Gets the parameter value for use in CloudFormation
     * 
     * Note: Returns the string value of the parameter
     */
    get stringValue(): string {
        return this.#parameter.stringValue;
    }

    /**
     * Grants read permissions to the parameter
     * 
     * @param principal - The IAM principal to grant permissions to
     */
    grantRead(principal: IGrantable): void {
        this.#parameter.grantRead(principal);
    }

    /**
     * Grants write permissions to the parameter
     * 
     * @param principal - The IAM principal to grant permissions to
     */
    grantWrite(principal: IGrantable): void {
        this.#parameter.grantWrite(principal);
    }

    /**
     * Creates a JSON parameter with simplified props
     * 
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param props - Simplified props without parameterNamePrefix requirement
     * @returns A new ParameterStore instance
     */
    static json(
        scope: Construct,
        id: string,
        props: Omit<ParameterStoreProps, 'stack'> & { stack: { id: string; tags: ReadonlyArray<{ key: string; value: string }> } }
    ): ParameterStore {
        return new ParameterStore(scope, id, {
            ...props,
            stack: {
                config: { parameterNamePrefix: '' },
                tags: props.stack.tags,
            },
        });
    }

    /**
     * Creates a string parameter with simplified props
     * 
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param props - Simplified props without parameterNamePrefix requirement
     * @returns A new ParameterStore instance
     */
    static string(
        scope: Construct,
        id: string,
        props: Omit<ParameterStoreProps, 'stack'> & { stack: { id: string; tags: ReadonlyArray<{ key: string; value: string }> } }
    ): ParameterStore {
        return new ParameterStore(scope, id, {
            ...props,
            stack: {
                config: { parameterNamePrefix: '' },
                tags: props.stack.tags,
            },
        });
    }

    /**
     * Imports an existing parameter by name
     * 
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param parameterName - The name of the existing parameter
     * @returns An IParameter that can be used to reference the parameter
     */
    static fromExistingParameter(scope: Construct, id: string, parameterName: string): IParameter {
        return StringParameter.fromStringParameterName(scope, id, parameterName);
    }
}
