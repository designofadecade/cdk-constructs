/**
 * Example: Creating Custom CloudFront Functions
 * 
 * This example demonstrates how to create custom CloudFront Functions
 * and assign them to behaviors for URL rewriting and header manipulation.
 */

import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { FunctionEventType } from 'aws-cdk-lib/aws-cloudfront';
import { CloudFront } from '@designofadecade/cdk-constructs';

export class CustomCloudFrontFunctionsStack extends Stack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // Create S3 buckets for content
        const mainBucket = new Bucket(this, 'MainBucket');
        const moderationBucket = new Bucket(this, 'ModerationBucket');

        // Example 1: Custom function for URL rewriting with prefix
        const moderationFunction = CloudFront.createFunction(
            this,
            'ModerationBehaviorFunction',
            `function handler(event) {
                var request = event.request;
                var uri = request.uri;
                var prefix = '/m-7f3d9e2a8c4b';
                
                // Skip resource files
                if (!uri.includes('/res/')) {
                    uri = uri.toLowerCase();
                    var relative = uri.startsWith(prefix) ? uri.slice(prefix.length) : uri;
                    
                    if (relative === '' || relative === '/') {
                        request.uri = prefix + '/index.html';
                    } else if (!relative.includes('.')) {
                        request.uri = prefix + '/' + relative.replace(/^\\//, '') + '.html';
                    } else {
                        request.uri = uri;
                    }
                }
                
                return request;
            }`
        );

        // Example 2: Custom function for adding security headers
        const securityHeadersFunction = CloudFront.createFunction(
            this,
            'SecurityHeadersFunction',
            `function handler(event) {
                var response = event.response;
                
                // Add custom security headers
                response.headers['x-request-id'] = { 
                    value: crypto.randomUUID() 
                };
                response.headers['x-cache-status'] = { 
                    value: event.context.distributionDomainName 
                };
                
                return response;
            }`,
            FunctionEventType.VIEWER_RESPONSE
        );

        // Example 3: Custom function for A/B testing
        const abTestFunction = CloudFront.createFunction(
            this,
            'ABTestFunction',
            `function handler(event) {
                var request = event.request;
                var cookies = request.cookies;
                
                // Check if user has an A/B test cookie
                if (!cookies['ab-test']) {
                    // Assign user to variant A or B randomly
                    var variant = Math.random() < 0.5 ? 'A' : 'B';
                    request.cookies['ab-test'] = { value: variant };
                }
                
                return request;
            }`
        );

        // Example 4: Custom function for redirecting old URLs
        const redirectFunction = CloudFront.createFunction(
            this,
            'RedirectFunction',
            `function handler(event) {
                var request = event.request;
                var uri = request.uri;
                
                // Define redirect rules
                var redirects = {
                    '/old-path': '/new-path',
                    '/legacy': '/modern',
                    '/deprecated': '/',
                };
                
                // Check if URI matches a redirect rule
                if (redirects[uri]) {
                    return {
                        statusCode: 301,
                        headers: {
                            'location': { value: redirects[uri] }
                        }
                    };
                }
                
                return request;
            }`
        );

        // Create CloudFront distribution
        const distribution = new CloudFront(this, 'Distribution', {
            name: 'custom-functions-distribution',
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('main', mainBucket),
            },
            stack: { 
                id: 'custom-functions-example', 
                tags: [
                    { key: 'Environment', value: 'production' },
                    { key: 'Project', value: 'custom-functions-demo' }
                ] 
            },
        });

        // Add behavior with moderation function (viewer-request)
        distribution.addBehavior(
            '/m-*', 
            CloudFront.s3BucketOrigin('moderation', moderationBucket), 
            {
                functions: [moderationFunction],
            }
        );

        // Add behavior with multiple functions (request + response)
        distribution.addBehavior(
            '/app/*', 
            CloudFront.s3BucketOrigin('app', mainBucket), 
            {
                functions: [
                    abTestFunction,
                    securityHeadersFunction,
                ],
            }
        );

        // Add behavior with redirect function
        distribution.addBehavior(
            '/legacy/*', 
            CloudFront.s3BucketOrigin('legacy', mainBucket), 
            {
                functions: [redirectFunction],
            }
        );

        // You can also combine custom functions with built-in functions
        const spaFunction = distribution.getSpaRewriteFunction('/app');
        
        distribution.addBehavior(
            '/spa/*', 
            CloudFront.s3BucketOrigin('spa', mainBucket), 
            {
                functions: [
                    abTestFunction,  // Custom function
                    spaFunction,     // Built-in function
                ],
            }
        );
    }
}

/**
 * Common CloudFront Function Patterns
 */

// 1. URL Normalization (lowercase, remove trailing slash)
const normalizeUrlFunction = `
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // Convert to lowercase
    uri = uri.toLowerCase();
    
    // Remove trailing slash (except root)
    if (uri.length > 1 && uri.endsWith('/')) {
        uri = uri.slice(0, -1);
    }
    
    request.uri = uri;
    return request;
}
`;

// 2. Query String Manipulation
const removeQueryStringFunction = `
function handler(event) {
    var request = event.request;
    
    // Remove all query strings for better cache hit ratio
    request.querystring = {};
    
    return request;
}
`;

// 3. Custom Cache Key
const customCacheKeyFunction = `
function handler(event) {
    var request = event.request;
    
    // Use only specific headers for cache key
    var newHeaders = {};
    var allowedHeaders = ['accept', 'accept-language'];
    
    for (var header in request.headers) {
        if (allowedHeaders.includes(header.toLowerCase())) {
            newHeaders[header] = request.headers[header];
        }
    }
    
    request.headers = newHeaders;
    return request;
}
`;

// 4. Geographic Redirection
const geoRedirectFunction = `
function handler(event) {
    var request = event.request;
    var countryCode = request.headers['cloudfront-viewer-country'][0].value;
    
    // Redirect based on country
    if (countryCode === 'GB' || countryCode === 'FR' || countryCode === 'DE') {
        return {
            statusCode: 302,
            headers: {
                'location': { value: '/eu' + request.uri }
            }
        };
    }
    
    return request;
}
`;

// 5. Rate Limiting via Cookies
const rateLimitFunction = `
function handler(event) {
    var request = event.request;
    var cookies = request.cookies;
    
    // Check rate limit cookie
    if (cookies['rate-limit']) {
        var limit = parseInt(cookies['rate-limit'].value);
        if (limit > 100) {
            return {
                statusCode: 429,
                statusDescription: 'Too Many Requests',
                headers: {
                    'retry-after': { value: '60' }
                }
            };
        }
    }
    
    return request;
}
`;
