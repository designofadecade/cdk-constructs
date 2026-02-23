import { Construct } from 'constructs';
import { type IOrigin, type IResponseHeadersPolicy, type IKeyGroup, type FunctionAssociation, type ErrorResponse } from 'aws-cdk-lib/aws-cloudfront';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { type IHostedZone } from 'aws-cdk-lib/aws-route53';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import type { Function as LambdaFunction } from './Function.js';
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
    readonly name: string;
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
        readonly tags: ReadonlyArray<{
            readonly key: string;
            readonly value: string;
        }>;
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
 * - Automatic tagging
 *
 * @example
 * ```typescript
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
 *     origin: CloudFront.S3BucketOrigin('main', myBucket),
 *     responseHeadersPolicy: CloudFront.ResponseHeaderPolicy(this, 'Policy', {
 *       name: 'my-policy',
 *     }),
 *   },
 *   stack: { id: 'my-app', tags: [] },
 * });
 *
 * // Add API behavior
 * cdn.addHttpBehavior('/api/*', apiDomain, { cachingDisabled: true });
 *
 * // Add SPA rewrite function
 * cdn.addBehavior('/app/*', appOrigin, {
 *   functions: [cdn.getSpaRewriteFunction('/app')],
 * });
 * ```
 */
export declare class CloudFront extends Construct {
    #private;
    constructor(scope: Construct, id: string, props: CloudFrontProps);
    /**
     * Gets the CloudFront distribution domain name
     */
    get domainName(): string;
    /**
     * Adds a behavior to the distribution with a custom origin
     *
     * @param pathPattern - The path pattern (e.g., '/api/*', '/images/*')
     * @param origin - The origin to route requests to
     * @param props - Optional behavior configuration
     */
    addBehavior(pathPattern: string, origin: IOrigin, props?: BehaviorOptions): void;
    /**
     * Adds a behavior with an HTTP origin
     *
     * @param pathPattern - The path pattern
     * @param domainName - The origin domain name (with or without https://)
     * @param props - Behavior configuration
     */
    addHttpBehavior(pathPattern: string, domainName: string, props: HttpBehaviorOptions): void;
    /**
     * Adds a behavior with a Lambda Function URL origin
     *
     * @param pathPattern - The path pattern
     * @param functionConstruct - The Function construct with a URL
     * @param props - Behavior configuration
     */
    addFunctionBehavior(pathPattern: string, functionConstruct: LambdaFunction, props: FunctionBehaviorOptions): void;
    /**
     * Gets or creates a CloudFront Function that rewrites paths to add /index.html
     *
     * @returns Function association configuration
     */
    getIndexRewriteFunction(): FunctionAssociation;
    /**
     * Gets or creates a CloudFront Function for SPA routing
     *
     * @param basePath - Optional base path for the SPA (default: '')
     * @returns Function association configuration
     */
    getSpaRewriteFunction(basePath?: string): FunctionAssociation;
    /**
     * Creates a KeyGroup from public key IDs
     *
     * @param scope - The construct scope
     * @param id - Unique identifier
     * @param publicKeyIds - Array of public key IDs
     * @returns Configured KeyGroup
     */
    static CreateKeyGroup(scope: Construct, id: string, publicKeyIds: string[]): IKeyGroup;
    /**
     * Creates a response headers policy with security headers and CSP
     *
     * @param scope - The construct scope
     * @param name - Unique identifier
     * @param props - Policy configuration
     * @returns Configured ResponseHeadersPolicy
     */
    static ResponseHeaderPolicy(scope: Construct, name: string, props: ResponseHeaderPolicyOptions): IResponseHeadersPolicy;
    /**
     * Creates an HTTP origin from a domain name
     *
     * @param domainName - The domain name (with or without https://)
     * @returns HttpOrigin instance
     */
    static HttpOrigin(domainName: string): HttpOrigin;
    /**
     * Creates an S3 bucket origin with Origin Access Control
     *
     * @param originId - Unique identifier for the origin
     * @param bucket - The S3 bucket
     * @param props - Optional configuration
     * @returns S3 origin with OAC
     */
    static S3BucketOrigin(originId: string, bucket: IBucket, props?: S3BucketOriginOptions): IOrigin;
}
