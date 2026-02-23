import { Stack, Tags, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Distribution, PriceClass, CachePolicy, ViewerProtocolPolicy, OriginProtocolPolicy, PublicKey, KeyGroup, ResponseHeadersPolicy, HeadersFrameOption, AllowedMethods, HeadersReferrerPolicy, OriginRequestPolicy, AccessLevel, FunctionUrlOriginAccessControl, Signing, Function as CfFunction, FunctionCode, FunctionEventType, } from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin as S3Origin, FunctionUrlOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { RecordTarget, ARecord } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
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
export class CloudFront extends Construct {
    #distribution;
    #functionUrlOriginAccessControl;
    #functionIndexRewrite;
    #functionSpaRewrite;
    constructor(scope, id, props) {
        super(scope, id);
        this.#distribution = new Distribution(this, 'Distribution', {
            domainNames: props.domain?.names ? [...props.domain.names] : undefined,
            certificate: props.domain?.certificate,
            comment: props.name ?? props.stack.id,
            priceClass: PriceClass.PRICE_CLASS_100,
            defaultRootObject: 'index.html',
            defaultBehavior: {
                origin: props.defaultBehavior.origin,
                cachePolicy: props.cachingDisabled === true ? CachePolicy.CACHING_DISABLED : CachePolicy.CACHING_OPTIMIZED,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                responseHeadersPolicy: props.defaultBehavior.responseHeadersPolicy,
                trustedKeyGroups: props.trustedKeyGroups ? [...props.trustedKeyGroups] : undefined,
            },
            errorResponses: props.errorResponses ? [...props.errorResponses] : [],
        });
        if (props.domain?.dns) {
            props.domain.dns.records.forEach((recordName) => {
                new ARecord(this, `CloudFrontAliasRecord${recordName}`, {
                    zone: props.domain.dns.hostedZone,
                    recordName,
                    target: RecordTarget.fromAlias(new CloudFrontTarget(this.#distribution)),
                });
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
    get domainName() {
        return this.#distribution.distributionDomainName;
    }
    /**
     * Adds a behavior to the distribution with a custom origin
     *
     * @param pathPattern - The path pattern (e.g., '/api/*', '/images/*')
     * @param origin - The origin to route requests to
     * @param props - Optional behavior configuration
     */
    addBehavior(pathPattern, origin, props = {}) {
        this.#distribution.addBehavior(pathPattern, origin, {
            cachePolicy: props.cachingDisabled === true ? CachePolicy.CACHING_DISABLED : CachePolicy.CACHING_OPTIMIZED,
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
    addHttpBehavior(pathPattern, domainName, props) {
        this.#distribution.addBehavior(pathPattern, new HttpOrigin(domainName.replace(/https:\/\//, ''), {
            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: props.customHeaders ?? {},
        }), {
            cachePolicy: props.cachingDisabled === true ? CachePolicy.CACHING_DISABLED : CachePolicy.CACHING_OPTIMIZED,
            allowedMethods: AllowedMethods.ALLOW_ALL,
            originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            functionAssociations: props.functions ? [...props.functions] : [],
            responseHeadersPolicy: props.responseHeadersPolicy,
            trustedKeyGroups: props.trustedKeyGroups ? [...props.trustedKeyGroups] : undefined,
        });
    }
    /**
     * Adds a behavior with a Lambda Function URL origin
     *
     * @param pathPattern - The path pattern
     * @param functionConstruct - The Function construct with a URL
     * @param props - Behavior configuration
     */
    addFunctionBehavior(pathPattern, functionConstruct, props) {
        if (!this.#functionUrlOriginAccessControl) {
            this.#functionUrlOriginAccessControl = new FunctionUrlOriginAccessControl(this, 'LambdaUrlOAC', {
                originAccessControlName: `${props.stack?.id ?? 'Lambda'}-OAC`,
                signing: Signing.SIGV4_ALWAYS,
            });
        }
        if (!functionConstruct.functionUrl) {
            throw new Error('Function must have a URL configured to use addFunctionBehavior');
        }
        this.#distribution.addBehavior(pathPattern, new FunctionUrlOrigin(functionConstruct.functionUrl), {
            cachePolicy: props.cachingDisabled === true ? CachePolicy.CACHING_DISABLED : CachePolicy.CACHING_OPTIMIZED,
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
    getIndexRewriteFunction() {
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
    getSpaRewriteFunction(basePath = '') {
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
    static CreateKeyGroup(scope, id, publicKeyIds) {
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
    static ResponseHeaderPolicy(scope, name, props) {
        let contentSecurityPolicy = props.contentSecurityPolicy ??
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
            responseHeadersPolicyName: props.name,
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
     * Creates an HTTP origin from a domain name
     *
     * @param domainName - The domain name (with or without https://)
     * @returns HttpOrigin instance
     */
    static HttpOrigin(domainName) {
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
    static S3BucketOrigin(originId, bucket, props = {}) {
        return S3Origin.withOriginAccessControl(bucket, {
            originId,
            originAccessLevels: props.enableNotFoundErrors === true ? [AccessLevel.READ, AccessLevel.LIST] : [AccessLevel.READ],
            originPath: props.originPath,
        });
    }
}
