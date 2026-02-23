import { Construct } from 'constructs';
import { Code, type IFunction, type FunctionUrl } from 'aws-cdk-lib/aws-lambda';
import { type IVpc, type ISecurityGroup } from 'aws-cdk-lib/aws-ec2';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
/**
 * Asset configuration for copying files into the Lambda bundle
 */
export interface AssetConfig {
    /**
     * Source path of the asset (absolute or relative to entry file)
     */
    readonly source: string;
    /**
     * Optional target path in the Lambda bundle (default: basename of source)
     */
    readonly target?: string;
}
/**
 * Function URL authentication type
 */
export type FunctionUrlAuthTypeOption = 'NONE' | 'AWS_IAM';
/**
 * Configuration for Lambda Function URL
 */
export interface FunctionUrlConfig {
    /**
     * Authentication type for the function URL
     */
    readonly authType?: FunctionUrlAuthTypeOption;
}
/**
 * Properties for configuring a Lambda function
 */
export interface FunctionProps {
    /**
     * The name of the Lambda function
     */
    readonly name: string;
    /**
     * The stack reference containing tags and ID
     */
    readonly stack: {
        readonly id: string;
        readonly tags: ReadonlyArray<{
            readonly key: string;
            readonly value: string;
        }>;
    };
    /**
     * Optional VPC to deploy the function in
     */
    readonly vpc?: IVpc;
    /**
     * Optional security group for the function (if not provided and VPC is specified, one will be created)
     */
    readonly securityGroup?: ISecurityGroup;
    /**
     * Optional environment variables for the function
     */
    readonly environment?: Record<string, string>;
    /**
     * Optional memory size in MB (default: 512)
     */
    readonly memorySize?: number;
    /**
     * Optional timeout in seconds (default: 30)
     */
    readonly timeoutSeconds?: number;
    /**
     * Optional inline code (takes precedence over entry)
     */
    readonly code?: Code;
    /**
     * Optional entry file path for NodejsFunction
     */
    readonly entry?: string;
    /**
     * Optional additional assets to copy into the Lambda bundle
     */
    readonly assets?: ReadonlyArray<string | AssetConfig>;
    /**
     * Whether to add the CJS dynamic import fix banner (for ESM modules importing CJS)
     */
    readonly fixCsjDynamicImportIssue?: boolean;
    /**
     * Optional Function URL configuration
     */
    readonly url?: FunctionUrlConfig;
}
/**
 * Properties for creating placeholder code in an S3 bucket
 */
export interface CodeFromBucketProps {
    /**
     * Optional object version
     */
    readonly objectVersion?: string;
}
/**
 * A CDK construct for creating Lambda functions with common configurations
 *
 * Features:
 * - Support for both inline code and NodejsFunction with bundling
 * - Automatic VPC security group creation
 * - ARM64 architecture by default
 * - Node.js 24.x runtime
 * - ESM output format
 * - Asset copying support
 * - Function URL support
 * - Helper methods for common patterns
 *
 * @example
 * ```typescript
 * // Create a function from an entry file
 * const fn = new Function(this, 'MyFunction', {
 *   name: 'my-function',
 *   entry: './src/handler.ts',
 *   environment: { TABLE_NAME: table.tableName },
 *   memorySize: 1024,
 *   timeoutSeconds: 60,
 *   url: { authType: 'NONE' },
 *   stack: { id: 'my-app', tags: [] },
 * });
 *
 * // Create a function with inline code
 * const simple = new Function(this, 'Simple', {
 *   name: 'simple-function',
 *   code: Function.PlaceHolderCode(),
 *   stack: { id: 'my-app', tags: [] },
 * });
 *
 * // Add Parameters and Secrets Extension
 * fn.addParametersSecretsExtensionLayer();
 * ```
 */
export declare class Function extends Construct {
    #private;
    constructor(scope: Construct, id: string, props: FunctionProps);
    /**
     * Gets the function name
     */
    get name(): string;
    /**
     * Gets the domain name of the function URL (without protocol and path)
     */
    get urlDomainName(): string | null;
    /**
     * Gets the Lambda function
     */
    get function(): IFunction;
    /**
     * Gets the function URL (if configured)
     */
    get functionUrl(): FunctionUrl | undefined;
    /**
     * Gets the security group (if VPC-enabled and auto-created)
     */
    get securityGroup(): ISecurityGroup | undefined;
    /**
     * Adds the AWS Parameters and Secrets Lambda Extension layer
     *
     * This layer allows the function to retrieve parameters and secrets
     * via HTTP requests to localhost instead of SDK calls.
     */
    addParametersSecretsExtensionLayer(): void;
    /**
     * Creates a Code object from an S3 bucket with placeholder initial content
     *
     * This is useful for Lambda functions that will have their code uploaded
     * separately after deployment.
     *
     * @param scope - The construct scope
     * @param codeBucket - The S3 bucket containing the code
     * @param codeKey - The S3 key for the code file
     * @param props - Optional properties
     * @returns Lambda Code object
     *
     * @example
     * ```typescript
     * const code = Function.CodeFromBucket(
     *   this,
     *   myBucket,
     *   'functions/my-function.zip'
     * );
     * ```
     */
    static CodeFromBucket(scope: Construct, codeBucket: IBucket, codeKey: string, props?: CodeFromBucketProps): Code;
    /**
     * Creates a simple placeholder code that returns 501 Not Implemented
     *
     * Useful for creating functions that will be deployed with actual code later.
     *
     * @returns Lambda Code object with placeholder handler
     */
    static PlaceHolderCode(): Code;
}
