import { Stack, Tags, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
    Distribution,
    PriceClass,
    CachePolicy,
    ViewerProtocolPolicy,
    OriginProtocolPolicy,
    PublicKey,
    KeyGroup,
    ResponseHeadersPolicy,
    HeadersFrameOption,
    AllowedMethods,
    HeadersReferrerPolicy,
    OriginRequestPolicy,
    AccessLevel,
    FunctionUrlOriginAccessControl,
    Signing,
    Function as CfFunction,
    FunctionCode,
    FunctionEventType,
    CacheQueryStringBehavior,
    CacheCookieBehavior,
    CacheHeaderBehavior,
    type IOrigin,
    type IDistribution,
    type IResponseHeadersPolicy,
    type ICachePolicy,
    type IKeyGroup,
    type FunctionAssociation,
    type ErrorResponse,
    CfnDistribution,
} from 'aws-cdk-lib/aws-cloudfront';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HttpOrigin, S3BucketOrigin as S3Origin, FunctionUrlOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { RecordTarget, ARecord, AaaaRecord, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { ServicePrincipal, type IGrantable } from 'aws-cdk-lib/aws-iam';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import type { Function as LambdaFunction } from './Function.js';
import type { Waf } from './Waf.js';

/**
 * Domain configuration for CloudFront distribution
 */
export interface DomainConfig {
    /**
     * Domain names for the distribution
     */
    readonly names: ReadonlyArray<string>;

    /**
     * ACM certificate for the domains
     */
    readonly certificate: ICertificate;

    /**
     * Optional DNS configuration
     */
    readonly dns?: {
        /**
         * Route53 hosted zone
         */
        readonly hostedZone: IHostedZone;

        /**
         * Record names to create
         */
        readonly records: ReadonlyArray<string>;
    };
}

/**
 * Default behavior configuration
 */
export interface DefaultBehaviorConfig {
    /**
     * The origin for the default behavior
     */
    readonly origin: IOrigin;

    /**
     * Optional response headers policy
     */
    readonly responseHeadersPolicy?: IResponseHeadersPolicy;

    /**
     * Optional CloudFront functions to associate
     */
    readonly functions?: ReadonlyArray<FunctionAssociation>;
}

/**
 * Behavior options for additional paths
 */
export interface BehaviorOptions {
    /**
     * Whether to disable caching
     */
    readonly cachingDisabled?: boolean;

    /**
     * Optional custom cache policy
     * If provided, takes precedence over cachingDisabled
     */
    readonly cachePolicy?: ICachePolicy;

    /**
     * Optional CloudFront functions to associate
     */
    readonly functions?: ReadonlyArray<FunctionAssociation>;

    /**
     * Optional response headers policy
     */
    readonly responseHeadersPolicy?: IResponseHeadersPolicy;

    /**
     * Optional trusted key groups for signed URLs/cookies
     */
    readonly trustedKeyGroups?: ReadonlyArray<IKeyGroup>;
}

/**
 * HTTP behavior options
 */
export interface HttpBehaviorOptions extends BehaviorOptions {
    /**
     * Optional custom headers to add to origin requests
     */
    readonly customHeaders?: Record<string, string>;
}

/**
 * Function behavior options
 */
export interface FunctionBehaviorOptions extends BehaviorOptions {
    /**
     * Stack reference for naming
     */
    readonly stack?: {
        readonly id: string;
    };
}

/**
 * Content Security Policy configuration
 */
export interface CspConfig {
    /**
     * Style sources
     */
    readonly styleSrc?: ReadonlyArray<string>;

    /**
     * Frame sources
     */
    readonly frameSrc?: ReadonlyArray<string>;

    /**
     * Frame ancestors
     */
    readonly frameAncestors?: ReadonlyArray<string>;
}

/**
 * Response header policy options
 */
export interface ResponseHeaderPolicyOptions {
    /**
     * Name for the policy
     */
    readonly name?: string;

    /**
     * Optional custom CSP string
     */
    readonly contentSecurityPolicy?: string;

    /**
     * Optional CSP configuration
     */
    readonly csp?: CspConfig;
}

/**
 * CloudFront logging configuration
 */
export interface LoggingConfig {
    /**
     * The S3 bucket to store access logs
     */
    readonly bucket: IBucket;

    /**
     * Optional prefix for log files
     * @default - no prefix
     */
    readonly prefix?: string;

    /**
     * Whether to include cookies in logs
     * @default false
     */
    readonly includeCookies?: boolean;
}

/**
 * S3 bucket origin options
 */
export interface S3BucketOriginOptions {
    /**
     * Whether to enable 404 errors (requires LIST permission)
     */
    readonly enableNotFoundErrors?: boolean;

    /**
     * Optional origin path prefix
     */
    readonly originPath?: string;
}

/**
 * Cache policy configuration options
 */
export interface CachePolicyOptions {
    /**
     * Name for the cache policy
     */
    readonly name: string;

    /**
     * Optional comment describing the policy
     */
    readonly comment?: string;

    /**
     * Query string behavior
     * - 'none' - Don't include query strings in cache key
     * - 'all' - Include all query strings in cache key
     * - string[] - Include only specified query strings in cache key (allow-list)
     * 
     * @default 'none'
     */
    readonly queryStrings?: 'none' | 'all' | ReadonlyArray<string>;

    /**
     * Cookie behavior
     * - 'none' - Don't include cookies in cache key
     * - 'all' - Include all cookies in cache key
     * - string[] - Include only specified cookies in cache key (allow-list)
     * 
     * @default 'none'
     */
    readonly cookies?: 'none' | 'all' | ReadonlyArray<string>;

    /**
     * Header behavior
     * - 'none' - Don't include headers in cache key
     * - string[] - Include only specified headers in cache key (allow-list)
     * 
     * @default 'none'
     */
    readonly headers?: 'none' | ReadonlyArray<string>;

    /**
     * Minimum TTL in seconds
     * @default 0
     */
    readonly minTtl?: number;

    /**
     * Default TTL in seconds
     * @default 86400 (1 day)
     */
    readonly defaultTtl?: number;

    /**
     * Maximum TTL in seconds
     * @default 31536000 (1 year)
     */
    readonly maxTtl?: number;

    /**
     * Enable Brotli compression
     * @default true
     */
    readonly enableAcceptEncodingBrotli?: boolean;

    /**
     * Enable Gzip compression
     * @default true
     */
    readonly enableAcceptEncodingGzip?: boolean;
}

/**
 * Properties for configuring CloudFront distribution
 */
export interface CloudFrontProps {
    /**
     * Optional name for the distribution
     */
    readonly name?: string;

    /**
     * The stack reference
     */
    readonly stack: {
        readonly id: string;
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    };

    /**
     * Optional domain configuration
     */
    readonly domain?: DomainConfig;

    /**
     * Whether to disable caching globally
     */
    readonly cachingDisabled?: boolean;

    /**
     * Default behavior configuration
     */
    readonly defaultBehavior: DefaultBehaviorConfig;

    /**
     * Optional trusted key groups for signed URLs/cookies
     */
    readonly trustedKeyGroups?: ReadonlyArray<IKeyGroup>;

    /**
     * Optional custom error responses
     */
    readonly errorResponses?: ReadonlyArray<ErrorResponse>;

    /**
     * Optional WAF Web ACL to associate with the distribution
     * Can be a Waf construct or a WAF Web ACL ARN string
     * Note: WAF for CloudFront must be created in us-east-1
     */
    readonly waf?: Waf | string;

    /**
     * Optional logging configuration
     * When enabled, CloudFront will write access logs to the specified S3 bucket
     * 
     * @example
     * ```typescript
     * const logBucket = new S3Bucket(this, 'LogBucket', {
     *   name: 'cloudfront-logs',
     *   stack: { id: 'my-app', tags: [] },
     * });
     * 
     * const cdn = new CloudFront(this, 'CDN', {
     *   // ... other props
     *   logging: {
     *     bucket: logBucket.bucket,
     *     prefix: 'cloudfront/',
     *     includeCookies: true,
     *   },
     * });
     * ```
     */
    readonly logging?: LoggingConfig;
}

/**
 * A CDK construct for creating CloudFront distributions with common configurations
 * 
 * Features:
 * - Multiple origin types (S3, HTTP, Lambda Function URLs)
 * - Custom domain support with Route53 integration
 * - Response header policies with CSP
 * - Signed URLs/cookies support
 * - Built-in CloudFront Functions for SPA and index rewriting
 * - WAF integration for security
 * - Automatic tagging
 * 
 * @example
 * ```typescript
 * // Create WAF (must be in us-east-1 for CloudFront)
 * const waf = new Waf(this, 'WAF', {
 *   enableManagedRules: true,
 *   stack: { id: 'my-app', tags: [] },
 * });
 * 
 * // Create a custom function for default behavior
 * const customFunction = CloudFront.createFunction(
 *   this,
 *   'CustomFunction',
 *   `function handler(event) {
 *     var request = event.request;
 *     // Custom logic here
 *     return request;
 *   }`
 * );
 * 
 * // Create CloudFront with WAF and function on default behavior
 * const cdn = new CloudFront(this, 'CDN', {
 *   name: 'my-app',
 *   domain: {
 *     names: ['example.com', 'www.example.com'],
 *     certificate: myCertificate,
 *     dns: {
 *       hostedZone: myZone,
 *       records: ['example.com', 'www.example.com'],
 *     },
 *   },
 *   defaultBehavior: {
 *     origin: CloudFront.s3BucketOrigin('main', myBucket),
 *     responseHeadersPolicy: CloudFront.responseHeaderPolicy(this, 'Policy', {
 *       name: 'my-policy',
 *     }),
 *     functions: [customFunction], // Add functions to default behavior
 *   },
 *   waf, // Pass WAF construct directly
 *   stack: { id: 'my-app', tags: [] },
 * });
 * 
 * // Add API behavior
 * cdn.addHttpBehavior('/api/*', apiDomain, { cachingDisabled: true });
 * 
 * // Add SPA rewrite function to a specific path
 * cdn.addBehavior('/app/*', appOrigin, {
 *   functions: [cdn.getSpaRewriteFunction('/app')],
 * });
 * ```
 */
export class CloudFront extends Construct {
    #distribution: Distribution;
    #responseHeadersPolicy?: IResponseHeadersPolicy;
    #functionUrlOriginAccessControl?: FunctionUrlOriginAccessControl;
    #functionIndexRewrite?: CfFunction;
    #functionSpaRewrite?: CfFunction;

    constructor(scope: Construct, id: string, props: CloudFrontProps) {
        super(scope, id);

        this.#responseHeadersPolicy = props.defaultBehavior.responseHeadersPolicy ?? CloudFront.responseHeaderPolicy(this, 'ResponseHeadersPolicy');

        // Extract WAF ARN if Waf construct is provided
        const webAclId = typeof props.waf === 'string' ? props.waf : props.waf?.webAclArn;

        this.#distribution = new Distribution(this, 'Distribution', {
            domainNames: props.domain?.names ? [...props.domain.names] : undefined,
            certificate: props.domain?.certificate,
            comment: props.name ?? props.stack.id,
            priceClass: PriceClass.PRICE_CLASS_100,
            defaultRootObject: 'index.html',
            httpVersion: 'http2and3' as any,
            webAclId,
            enableLogging: props.logging !== undefined,
            logBucket: props.logging?.bucket,
            logFilePrefix: props.logging?.prefix,
            logIncludesCookies: props.logging?.includeCookies ?? false,
            defaultBehavior: {
                origin: props.defaultBehavior.origin,
                cachePolicy: props.cachingDisabled === true ? CachePolicy.CACHING_DISABLED : CachePolicy.CACHING_OPTIMIZED,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                responseHeadersPolicy: this.#responseHeadersPolicy,
                trustedKeyGroups: props.trustedKeyGroups ? [...props.trustedKeyGroups] : undefined,
                functionAssociations: props.defaultBehavior.functions ? [...props.defaultBehavior.functions] : undefined,
            },
            errorResponses: props.errorResponses ? [...props.errorResponses] : [],
        });

        if (props.domain?.dns) {
            props.domain.dns.records.forEach((recordName) => {
                this.addRoute53Records(props.domain!.dns!.hostedZone, recordName);
            });
        }

        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#distribution).add(key, value);
        });

        new CfnOutput(this, 'DistributionDomain', {
            value: this.#distribution.distributionDomainName,
            description: 'CloudFront Distribution Domain Name',
            exportName: `${props.stack.id}-cloudfront-domain-name`,
        });

        new CfnOutput(this, 'DistributionId', {
            value: this.#distribution.distributionId,
            description: 'CloudFront Distribution ID',
            exportName: `${props.stack.id}-cloudfront-distribution-id`,
        });
    }

    /**
     * Gets the CloudFront distribution domain name
     */
    get domainName(): string {
        return this.#distribution.distributionDomainName;
    }

    /**
     * Gets the CloudFront distribution instance
     */
    get distribution(): IDistribution {
        return this.#distribution;
    }

    /**
     * Gets the CloudFront distribution ID
     */
    get distributionId(): string {
        return this.#distribution.distributionId;
    }

    /**
     * Gets the CloudFront distribution domain name
     */
    get distributionDomainName(): string {
        return this.#distribution.distributionDomainName;
    }

    /**
     * Gets the response headers policy
     */
    get responseHeadersPolicy(): IResponseHeadersPolicy | undefined {
        return this.#responseHeadersPolicy;
    }

    /**
     * Grants permission to create CloudFront cache invalidations
     * 
     * This is useful when you need a Lambda function or other service to invalidate
     * the CloudFront cache (e.g., after uploading new content to S3).
     * 
     * @param grantee - The principal (Lambda function, role, etc.) to grant permissions to
     * 
     * @example
     * ```typescript
     * const cdn = new CloudFront(this, 'CDN', { ... });
     * 
     * const imageProcessor = new Function(this, 'ImageProcessor', {
     *   name: 'image-processor',
     *   entry: './src/processor.ts',
     *   stack: { id: 'my-app', tags: [] },
     * });
     * 
     * // Grant the function permission to invalidate the CloudFront cache
     * cdn.grantCreateInvalidation(imageProcessor.function);
     * ```
     */
    grantCreateInvalidation(grantee: IGrantable): void {
        this.#distribution.grantCreateInvalidation(grantee);
    }

    /**
     * Adds a behavior to the distribution with a custom origin
     * 
     * @param pathPattern - The path pattern (e.g., '/api/*', '/images/*')
     * @param origin - The origin to route requests to
     * @param props - Optional behavior configuration
     */
    addBehavior(pathPattern: string, origin: IOrigin, props: BehaviorOptions = {}): void {
        const cachePolicy = props.cachePolicy ?? (props.cachingDisabled === true ? CachePolicy.CACHING_DISABLED : CachePolicy.CACHING_OPTIMIZED);

        this.#distribution.addBehavior(pathPattern, origin, {
            cachePolicy,
            allowedMethods: AllowedMethods.ALLOW_ALL,
            originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            functionAssociations: props.functions ? [...props.functions] : [],
            responseHeadersPolicy: props.responseHeadersPolicy,
            trustedKeyGroups: props.trustedKeyGroups ? [...props.trustedKeyGroups] : undefined,
        });
    }

    /**
     * Adds a behavior with an HTTP origin
     * 
     * @param pathPattern - The path pattern
     * @param domainName - The origin domain name (with or without https://)
     * @param props - Behavior configuration
     */
    addHttpBehavior(pathPattern: string, domainName: string, props: HttpBehaviorOptions): void {
        const cachePolicy = props.cachePolicy ?? (props.cachingDisabled === true ? CachePolicy.CACHING_DISABLED : CachePolicy.CACHING_OPTIMIZED);

        this.#distribution.addBehavior(
            pathPattern,
            new HttpOrigin(domainName.replace(/https:\/\//, ''), {
                protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
                customHeaders: props.customHeaders ?? {},
            }),
            {
                cachePolicy,
                allowedMethods: AllowedMethods.ALLOW_ALL,
                originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                functionAssociations: props.functions ? [...props.functions] : [],
                responseHeadersPolicy: props.responseHeadersPolicy,
                trustedKeyGroups: props.trustedKeyGroups ? [...props.trustedKeyGroups] : undefined,
            },
        );
    }

    /**
     * Adds a behavior with a Lambda Function URL origin
     * 
     * @param pathPattern - The path pattern
     * @param functionConstruct - The Function construct with a URL
     * @param props - Behavior configuration
     */
    addFunctionBehavior(pathPattern: string, functionConstruct: LambdaFunction, props: FunctionBehaviorOptions): void {
        if (!this.#functionUrlOriginAccessControl) {
            this.#functionUrlOriginAccessControl = new FunctionUrlOriginAccessControl(this, 'LambdaUrlOAC', {
                originAccessControlName: `${props.stack?.id ?? 'Lambda'}-OAC`,
                signing: Signing.SIGV4_ALWAYS,
            });
        }

        if (!functionConstruct.functionUrl) {
            throw new Error('Function must have a URL configured to use addFunctionBehavior');
        }

        const cachePolicy = props.cachePolicy ?? (props.cachingDisabled === true ? CachePolicy.CACHING_DISABLED : CachePolicy.CACHING_OPTIMIZED);

        this.#distribution.addBehavior(pathPattern, new FunctionUrlOrigin(functionConstruct.functionUrl), {
            cachePolicy,
            allowedMethods: AllowedMethods.ALLOW_ALL,
            originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            functionAssociations: props.functions ? [...props.functions] : [],
            responseHeadersPolicy: props.responseHeadersPolicy,
            trustedKeyGroups: props.trustedKeyGroups ? [...props.trustedKeyGroups] : undefined,
        });

        functionConstruct.function.addPermission(`CloudFrontInvokePermissionInvokeUrl-${functionConstruct.name}`, {
            principal: new ServicePrincipal('cloudfront.amazonaws.com'),
            action: 'lambda:InvokeFunctionUrl',
            sourceArn: `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${this.#distribution.distributionId}`,
        });

        functionConstruct.function.addPermission(`CloudFrontInvokePermissionInvoke-${functionConstruct.name}`, {
            principal: new ServicePrincipal('cloudfront.amazonaws.com'),
            action: 'lambda:InvokeFunction',
            sourceArn: `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${this.#distribution.distributionId}`,
        });
    }

    /**
     * Gets or creates a CloudFront Function that rewrites paths to add /index.html
     * 
     * @returns Function association configuration
     */
    getIndexRewriteFunction(): FunctionAssociation {
        if (this.#functionIndexRewrite) {
            return {
                function: this.#functionIndexRewrite,
                eventType: FunctionEventType.VIEWER_REQUEST,
            };
        }

        this.#functionIndexRewrite = new CfFunction(this, 'IndexRewrite', {
            code: FunctionCode.fromInline(`
                function handler(event) {
                var request = event.request;
                var uri = request.uri;
                
                if (uri.endsWith('/')) {
                    request.uri += 'index.html';
                } else if (!uri.includes('.')) {

                    if(!uri.endsWith('/'))
                        return {
                            statusCode: 301,
                            headers: {
                                'location': { value: uri + '/' }
                            }
                        };

                    request.uri += '/index.html';
                }
                
                return request;
                }
            `),
        });

        return {
            function: this.#functionIndexRewrite,
            eventType: FunctionEventType.VIEWER_REQUEST,
        };
    }

    /**
     * Gets or creates a CloudFront Function for SPA routing
     * 
     * @param basePath - Optional base path for the SPA (default: '')
     * @returns Function association configuration
     */
    getSpaRewriteFunction(basePath = ''): FunctionAssociation {
        if (this.#functionSpaRewrite) {
            return {
                function: this.#functionSpaRewrite,
                eventType: FunctionEventType.VIEWER_REQUEST,
            };
        }

        const normalizedBasePath = basePath ? (basePath.startsWith('/') ? basePath : `/${basePath}`).replace(/\/$/, '') : '';

        this.#functionSpaRewrite = new CfFunction(this, 'SPARewrite', {
            code: FunctionCode.fromInline(`
                function handler(event) {
                var request = event.request;
                var uri = request.uri;
                var basePath = '${normalizedBasePath}';
                
                // If this is a file request (has extension), serve it as-is
                if (uri.includes('.')) {
                    return request;
                }
                
                // For SPA routing: rewrite all non-file requests to the basePath index.html
                if (basePath) {
                    // If URI is exactly the basePath or a sub-path
                    if (uri === basePath || uri.startsWith(basePath + '/')) {
                        request.uri = basePath + '/index.html';
                        return request;
                    }
                }
                
                // Default behavior: append index.html to directories
                if (uri.endsWith('/')) {
                    request.uri += 'index.html';
                } else {
                    // Redirect to add trailing slash, then it will get index.html
                    return {
                        statusCode: 301,
                        headers: {
                            'location': { value: uri + '/' }
                        }
                    };
                }
                
                return request;
                }
            `),
        });

        return {
            function: this.#functionSpaRewrite,
            eventType: FunctionEventType.VIEWER_REQUEST,
        };
    }

    /**
     * Creates a KeyGroup from public key IDs
     * 
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param publicKeyIds - Array of public key IDs
     * @returns Configured KeyGroup
     */
    static createKeyGroup(scope: Construct, id: string, publicKeyIds: string[]): IKeyGroup {
        return new KeyGroup(scope, id, {
            items: publicKeyIds.map((keyId) => PublicKey.fromPublicKeyId(scope, `ImportedPublicKey${keyId}`, keyId)),
        });
    }

    /**
     * Creates a response headers policy with security headers and CSP
     * 
     * @param scope - The construct scope
     * @param name - Unique identifier
     * @param props - Policy configuration
     * @returns Configured ResponseHeadersPolicy
     */
    static responseHeaderPolicy(scope: Construct, name: string, props: ResponseHeaderPolicyOptions = {}): IResponseHeadersPolicy {
        let contentSecurityPolicy =
            props.contentSecurityPolicy ??
            `default-src 'none'; script-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'self'; manifest-src 'self'; upgrade-insecure-requests`;

        contentSecurityPolicy += props.csp?.styleSrc ? `; style-src ${props.csp.styleSrc.join(' ')}` : "; style-src 'self'";
        contentSecurityPolicy += props.csp?.frameSrc ? `; frame-src ${props.csp.frameSrc.join(' ')}` : "; frame-src 'none'";
        contentSecurityPolicy += props.csp?.frameAncestors
            ? `; frame-ancestors ${props.csp.frameAncestors.join(' ')}`
            : "; frame-ancestors 'none'";

        contentSecurityPolicy = contentSecurityPolicy
            .replaceAll(' self', " 'self'")
            .replaceAll(' none', " 'none'")
            .replaceAll(' unsafe-inline', " 'unsafe-inline'");

        return new ResponseHeadersPolicy(scope, name, {
            responseHeadersPolicyName: props.name ?? name,
            removeHeaders: ['Server', 'x-powered-by'],
            customHeadersBehavior: {
                customHeaders: [
                    { header: 'Cross-Origin-Opener-Policy', value: 'same-origin', override: true },
                    { header: 'Cross-Origin-Embedder-Policy', value: 'require-corp', override: true },
                ],
            },
            securityHeadersBehavior: {
                contentSecurityPolicy: {
                    contentSecurityPolicy,
                    override: true,
                },
                frameOptions: {
                    frameOption: props.csp?.frameSrc?.includes('self') ? HeadersFrameOption.SAMEORIGIN : HeadersFrameOption.DENY,
                    override: true,
                },
                referrerPolicy: {
                    referrerPolicy: HeadersReferrerPolicy.NO_REFERRER,
                    override: true,
                },
                strictTransportSecurity: {
                    accessControlMaxAge: Duration.days(365),
                    includeSubdomains: true,
                    preload: true,
                    override: true,
                },
            },
        });
    }

    /**
     * Creates a custom cache policy with fine-grained control over caching behavior
     * 
     * This is useful when you need to control which query strings, cookies, or headers
     * are included in the cache key, or when you need custom TTL values.
     * 
     * @param scope - The construct scope
     * @param id - Unique identifier for the cache policy
     * @param options - Cache policy configuration
     * @returns Configured CachePolicy
     * 
     * @example
     * ```typescript
     * // Create a cache policy for API with query string caching
     * const apiCachePolicy = CloudFront.createCachePolicy(this, 'ApiCachePolicy', {
     *   name: 'api-query-cache-policy',
     *   comment: 'API cache policy with query allow-list',
     *   queryStrings: ['next', 'q'], // Only cache based on these query params
     *   cookies: 'none',
     *   headers: 'none',
     *   minTtl: 0,
     *   defaultTtl: 0,
     *   maxTtl: 1,
     *   enableAcceptEncodingBrotli: true,
     *   enableAcceptEncodingGzip: true,
     * });
     * 
     * // Create a cache policy that includes all query strings
     * const fullCachePolicy = CloudFront.createCachePolicy(this, 'FullCache', {
     *   name: 'full-cache-policy',
     *   queryStrings: 'all',
     *   cookies: ['session', 'user_id'],
     *   headers: ['Accept', 'Accept-Language'],
     *   defaultTtl: 3600,
     * });
     * 
     * // Use the cache policy in a behavior
     * cdn.addHttpBehavior('/api/*', apiDomain, {
     *   cachePolicy: apiCachePolicy,
     *   customHeaders: { 'x-origin-verify': 'secret' },
     * });
     * ```
     */
    static createCachePolicy(scope: Construct, id: string, options: CachePolicyOptions): ICachePolicy {
        // Handle query string behavior
        let queryStringBehavior: CacheQueryStringBehavior;
        if (!options.queryStrings || options.queryStrings === 'none') {
            queryStringBehavior = CacheQueryStringBehavior.none();
        } else if (options.queryStrings === 'all') {
            queryStringBehavior = CacheQueryStringBehavior.all();
        } else {
            queryStringBehavior = CacheQueryStringBehavior.allowList(...options.queryStrings);
        }

        // Handle cookie behavior
        let cookieBehavior: CacheCookieBehavior;
        if (!options.cookies || options.cookies === 'none') {
            cookieBehavior = CacheCookieBehavior.none();
        } else if (options.cookies === 'all') {
            cookieBehavior = CacheCookieBehavior.all();
        } else {
            cookieBehavior = CacheCookieBehavior.allowList(...options.cookies);
        }

        // Handle header behavior
        let headerBehavior: CacheHeaderBehavior;
        if (!options.headers || options.headers === 'none') {
            headerBehavior = CacheHeaderBehavior.none();
        } else {
            headerBehavior = CacheHeaderBehavior.allowList(...options.headers);
        }

        return new CachePolicy(scope, id, {
            cachePolicyName: options.name,
            comment: options.comment,
            queryStringBehavior,
            cookieBehavior,
            headerBehavior,
            minTtl: options.minTtl !== undefined ? Duration.seconds(options.minTtl) : Duration.seconds(0),
            defaultTtl: options.defaultTtl !== undefined ? Duration.seconds(options.defaultTtl) : Duration.days(1),
            maxTtl: options.maxTtl !== undefined ? Duration.seconds(options.maxTtl) : Duration.days(365),
            enableAcceptEncodingBrotli: options.enableAcceptEncodingBrotli ?? true,
            enableAcceptEncodingGzip: options.enableAcceptEncodingGzip ?? true,
        });
    }

    /**
     * Creates a custom CloudFront Function that can be assigned to behaviors
     * 
     * @param scope - The construct scope
     * @param id - Unique identifier for the function
     * @param code - Inline JavaScript code for the function
     * @param eventType - When to execute the function (default: VIEWER_REQUEST)
     * @returns Function association configuration
     * 
     * @example
     * ```typescript
     * const customFunction = CloudFront.createFunction(
     *   this,
     *   'ModerationBehaviorFunction',
     *   `function handler(event) {
     *     var request = event.request;
     *     var uri = request.uri;
     *     var prefix = '/m-7f3d9e2a8c4b';
     *     
     *     if (!uri.includes('/res/')) {
     *       uri = uri.toLowerCase();
     *       var relative = uri.startsWith(prefix) ? uri.slice(prefix.length) : uri;
     *       
     *       if (relative === '' || relative === '/') {
     *         request.uri = prefix + '/index.html';
     *       } else if (!relative.includes('.')) {
     *         request.uri = prefix + '/' + relative.replace(/^\\//, '') + '.html';
     *       } else {
     *         request.uri = uri;
     *       }
     *     }
     *     
     *     return request;
     *   }`
     * );
     * 
     * cloudfront.addBehavior('/m-*', origin, {
     *   functions: [customFunction],
     * });
     * ```
     */
    static createFunction(
        scope: Construct,
        id: string,
        code: string,
        eventType: FunctionEventType = FunctionEventType.VIEWER_REQUEST,
    ): FunctionAssociation {
        const cfFunction = new CfFunction(scope, id, {
            code: FunctionCode.fromInline(code),
        });

        return {
            function: cfFunction,
            eventType,
        };
    }

    /**
     * Adds Route 53 DNS records (A and AAAA) pointing to this CloudFront distribution
     * 
     * @param hostedZone - The Route53 hosted zone
     * @param recordNames - Single record name or array of record names to create
     * 
     * @example
     * ```typescript
     * const cdn = new CloudFront(this, 'CDN', { ... });
     * 
     * // Single record
     * cdn.addRoute53Records(hostedZone, 'www.example.com');
     * 
     * // Multiple records
     * cdn.addRoute53Records(hostedZone, ['example.com', 'www.example.com', 'api.example.com']);
     * ```
     */
    addRoute53Records(hostedZone: IHostedZone, recordNames: string | ReadonlyArray<string>): void {
        const names = Array.isArray(recordNames) ? recordNames : [recordNames];

        names.forEach((recordName) => {
            // Sanitize record name for use in construct ID
            const sanitizedName = recordName.replace(/[^a-zA-Z0-9]/g, '');

            new ARecord(this, `ARecord${sanitizedName}`, {
                zone: hostedZone,
                recordName,
                target: RecordTarget.fromAlias(new CloudFrontTarget(this.#distribution)),
            });

            new AaaaRecord(this, `AaaaRecord${sanitizedName}`, {
                zone: hostedZone,
                recordName,
                target: RecordTarget.fromAlias(new CloudFrontTarget(this.#distribution)),
            });
        });
    }

    /**
     * Creates an HTTP origin from a domain name
     * 
     * @param domainName - The domain name (with or without https://)
     * @returns HttpOrigin instance
     */
    static httpOrigin(domainName: string): HttpOrigin {
        return new HttpOrigin(domainName.replace(/https:\/\//, ''));
    }

    /**
     * Creates an S3 bucket origin with Origin Access Control
     * 
     * @param originId - Unique identifier for the origin
     * @param bucket - The S3 bucket
     * @param props - Optional configuration
     * @returns S3 origin with OAC
     */
    static s3BucketOrigin(originId: string, bucket: IBucket, props: S3BucketOriginOptions = {}): IOrigin {
        return S3Origin.withOriginAccessControl(bucket, {
            originId,
            originAccessLevels: props.enableNotFoundErrors === true ? [AccessLevel.READ, AccessLevel.LIST] : [AccessLevel.READ],
            originPath: props.originPath,
        });
    }
}
