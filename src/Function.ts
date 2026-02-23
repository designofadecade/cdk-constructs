import { Construct } from 'constructs';
import { Tags, Fn, CfnOutput, Duration } from 'aws-cdk-lib';
import { NodejsFunction, OutputFormat, type BundlingOptions } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
    Function as LambdaFunction,
    Runtime,
    FunctionUrlAuthType,
    Architecture,
    LayerVersion,
    Code,
    type IFunction,
    type FunctionUrl,
} from 'aws-cdk-lib/aws-lambda';
import { SecurityGroup, type IVpc, type ISecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import { basename, dirname, isAbsolute, normalize, resolve } from 'node:path';

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
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
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
export class Function extends Construct {
    #name: string;
    #fn: IFunction;
    #fcnUrl?: FunctionUrl;
    #securityGroup?: ISecurityGroup;

    constructor(scope: Construct, id: string, props: FunctionProps) {
        super(scope, id);

        if (!props.securityGroup && props.vpc) {
            this.#securityGroup = new SecurityGroup(this, 'SecurityGroup', {
                vpc: props.vpc,
                securityGroupName: props.name ?? `${props.stack.id}-lambda-function`,
            });

            Tags.of(this.#securityGroup).add('Name', `${props.name ?? props.stack.id}-lambda-function`);
            props.stack.tags.forEach(({ key, value }) => {
                Tags.of(this.#securityGroup!).add(key, value);
            });
        }

        this.#name = props.name;

        if (props.code) {
            this.#fn = new LambdaFunction(this, 'Function', {
                functionName: props.name,
                vpc: props.vpc,
                securityGroups: props.securityGroup
                    ? [props.securityGroup]
                    : this.#securityGroup
                        ? [this.#securityGroup]
                        : undefined,
                runtime: Runtime.NODEJS_24_X,
                handler: 'index.handler',
                code: props.code,
                architecture: Architecture.ARM_64,
                environment: props.environment,
                memorySize: props.memorySize ?? 512,
                timeout: Duration.seconds(props.timeoutSeconds ?? 30),
            });
        } else {
            const entryPath = props.entry ? props.entry.replace('file:/', '') : undefined;
            const extraAssets = Array.isArray(props.assets) ? props.assets : [];
            let bundling: any = {
                format: OutputFormat.ESM,
            };

            if (props.fixCsjDynamicImportIssue) {
                bundling.banner = "import { createRequire } from 'module'; const require = createRequire(import.meta.url);";
            }

            if (entryPath && extraAssets.length > 0) {
                const entryDir = dirname(entryPath);
                const resolvedAssets = extraAssets.map((asset) => {
                    if (typeof asset === 'string') {
                        const source = resolve(entryDir, asset);
                        return {
                            source,
                            target: basename(source),
                        };
                    }

                    const source = isAbsolute(asset.source) ? asset.source : resolve(entryDir, asset.source);

                    return {
                        source,
                        target: asset.target ?? basename(source),
                    };
                });

                bundling.commandHooks = {
                    beforeBundling(_inputDir: string, outputDir: string): string[] {
                        return resolvedAssets.map(({ source, target }) => {
                            const normalizedTarget = normalize(target).replace(/^\.{1,2}[\\/]+/, '');
                            const targetPath = `${outputDir}/${normalizedTarget}`;
                            const targetDir = dirname(targetPath);
                            return `mkdir -p "${targetDir}" && cp "${source}" "${targetPath}"`;
                        });
                    },
                    beforeInstall(): string[] {
                        return [];
                    },
                    afterBundling(): string[] {
                        return [];
                    },
                };
            }

            if (!entryPath) {
                throw new Error('Either code or entry must be provided');
            }

            this.#fn = new NodejsFunction(this, 'Function', {
                functionName: props.name,
                vpc: props.vpc,
                securityGroups: props.securityGroup
                    ? [props.securityGroup]
                    : this.#securityGroup
                        ? [this.#securityGroup]
                        : undefined,
                runtime: Runtime.NODEJS_24_X,
                entry: entryPath,
                architecture: Architecture.ARM_64,
                memorySize: props.memorySize ?? 512,
                timeout: Duration.seconds(props.timeoutSeconds ?? 30),
                environment: props.environment,
                bundling,
            });
        }

        if (props.url) {
            this.#fcnUrl = this.#fn.addFunctionUrl({
                authType: props.url.authType === 'AWS_IAM' ? FunctionUrlAuthType.AWS_IAM : FunctionUrlAuthType.NONE,
            });

            new CfnOutput(this, 'FunctionUrl', {
                value: this.#fcnUrl.url,
                description: `Function: ${props.name}`,
                exportName: `${props.name}-url`,
            });
        }

        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#fn).add(key, value);
        });
    }

    /**
     * Gets the function name
     */
    get name(): string {
        return this.#name;
    }

    /**
     * Gets the domain name of the function URL (without protocol and path)
     */
    get urlDomainName(): string | null {
        return this.#fcnUrl ? Fn.select(2, Fn.split('/', this.#fcnUrl.url)) : null;
    }

    /**
     * Gets the Lambda function
     */
    get function(): IFunction {
        return this.#fn;
    }

    /**
     * Gets the function URL (if configured)
     */
    get functionUrl(): FunctionUrl | undefined {
        return this.#fcnUrl;
    }

    /**
     * Gets the security group (if VPC-enabled and auto-created)
     */
    get securityGroup(): ISecurityGroup | undefined {
        return this.#securityGroup;
    }

    /**
     * Adds the AWS Parameters and Secrets Lambda Extension layer
     * 
     * This layer allows the function to retrieve parameters and secrets
     * via HTTP requests to localhost instead of SDK calls.
     */
    addParametersSecretsExtensionLayer(): void {
        if (this.#fn instanceof LambdaFunction) {
            this.#fn.addLayers(
                LayerVersion.fromLayerVersionArn(
                    this,
                    'SecretsLayer',
                    'arn:aws:lambda:ca-central-1:200266452380:layer:AWS-Parameters-and-Secrets-Lambda-Extension-Arm64:21',
                ),
            );
        }
    }

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
    static CodeFromBucket(scope: Construct, codeBucket: IBucket, codeKey: string, props?: CodeFromBucketProps): Code {
        const codeKeyFilename = codeKey.split('/').pop()!;
        const codeKeyPrefix = codeKey.split('/').slice(0, -1).join('/');

        new BucketDeployment(scope, `InitialCode${codeKey.replaceAll('/', '')}`, {
            sources: [Source.data(codeKeyFilename, 'placeholder')],
            destinationBucket: codeBucket,
            destinationKeyPrefix: codeKeyPrefix,
        });

        return Code.fromBucket(codeBucket, codeKey, props?.objectVersion);
    }

    /**
     * Creates a simple placeholder code that returns 501 Not Implemented
     * 
     * Useful for creating functions that will be deployed with actual code later.
     * 
     * @returns Lambda Code object with placeholder handler
     */
    static PlaceHolderCode(): Code {
        return Code.fromInline(`
            exports.handler = async () => ({ statusCode: 501, body: 'Placeholder' });
        `);
    }
}
