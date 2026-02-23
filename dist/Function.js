import { Construct } from 'constructs';
import { Tags, Fn, CfnOutput, Duration } from 'aws-cdk-lib';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Function as LambdaFunction, Runtime, FunctionUrlAuthType, Architecture, LayerVersion, Code, } from 'aws-cdk-lib/aws-lambda';
import { SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { basename, dirname, isAbsolute, normalize, resolve } from 'node:path';
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
    #name;
    #fn;
    #fcnUrl;
    #securityGroup;
    constructor(scope, id, props) {
        super(scope, id);
        if (!props.securityGroup && props.vpc) {
            this.#securityGroup = new SecurityGroup(this, 'SecurityGroup', {
                vpc: props.vpc,
                securityGroupName: props.name ?? `${props.stack.id}-lambda-function`,
            });
            Tags.of(this.#securityGroup).add('Name', `${props.name ?? props.stack.id}-lambda-function`);
            props.stack.tags.forEach(({ key, value }) => {
                Tags.of(this.#securityGroup).add(key, value);
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
        }
        else {
            const entryPath = props.entry ? props.entry.replace('file:/', '') : undefined;
            const extraAssets = Array.isArray(props.assets) ? props.assets : [];
            let bundling = {
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
                    beforeBundling(_inputDir, outputDir) {
                        return resolvedAssets.map(({ source, target }) => {
                            const normalizedTarget = normalize(target).replace(/^\.{1,2}[\\/]+/, '');
                            const targetPath = `${outputDir}/${normalizedTarget}`;
                            const targetDir = dirname(targetPath);
                            return `mkdir -p "${targetDir}" && cp "${source}" "${targetPath}"`;
                        });
                    },
                    beforeInstall() {
                        return [];
                    },
                    afterBundling() {
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
    get name() {
        return this.#name;
    }
    /**
     * Gets the domain name of the function URL (without protocol and path)
     */
    get urlDomainName() {
        return this.#fcnUrl ? Fn.select(2, Fn.split('/', this.#fcnUrl.url)) : null;
    }
    /**
     * Gets the Lambda function
     */
    get function() {
        return this.#fn;
    }
    /**
     * Gets the function URL (if configured)
     */
    get functionUrl() {
        return this.#fcnUrl;
    }
    /**
     * Gets the security group (if VPC-enabled and auto-created)
     */
    get securityGroup() {
        return this.#securityGroup;
    }
    /**
     * Adds the AWS Parameters and Secrets Lambda Extension layer
     *
     * This layer allows the function to retrieve parameters and secrets
     * via HTTP requests to localhost instead of SDK calls.
     */
    addParametersSecretsExtensionLayer() {
        if (this.#fn instanceof LambdaFunction) {
            this.#fn.addLayers(LayerVersion.fromLayerVersionArn(this, 'SecretsLayer', 'arn:aws:lambda:ca-central-1:200266452380:layer:AWS-Parameters-and-Secrets-Lambda-Extension-Arm64:21'));
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
    static CodeFromBucket(scope, codeBucket, codeKey, props) {
        const codeKeyFilename = codeKey.split('/').pop();
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
    static PlaceHolderCode() {
        return Code.fromInline(`
            exports.handler = async () => ({ statusCode: 501, body: 'Placeholder' });
        `);
    }
}
