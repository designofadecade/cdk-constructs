# CloudFront Construct

CDK construct for creating CloudFront distributions with security best practices.

## Features

- Automatic SSL/TLS certificate management
- Security headers by default
- HTTP/2 and HTTP/3 enabled
- S3 bucket origin support
- Custom domain support
- WAF integration ready
- **Access logging to S3**

## Basic Usage

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';

const distribution = new CloudFront(this, 'Distribution', {
  name: 'my-distribution',
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'my-app', tags: [] },
});
```

## Access Logging

CloudFront can write access logs to an S3 bucket for monitoring, analysis, and compliance.

### Enable Logging

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { S3Bucket } from '@designofadecade/cdk-constructs';

// Create a bucket for logs
const logBucket = new S3Bucket(this, 'CloudFrontLogs', {
  name: 'cloudfront-logs',
  stack: { id: 'my-app', tags: [] },
});

// Create distribution with logging
const distribution = new CloudFront(this, 'Distribution', {
  name: 'my-distribution',
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  logging: {
    bucket: logBucket.bucket,
    prefix: 'cloudfront/',        // Optional: organize logs in a folder
    includeCookies: true,          // Optional: include cookies in logs (default: false)
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Logging Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `bucket` | `IBucket` | Required | S3 bucket for storing logs |
| `prefix` | `string` | `''` | Prefix for log file names (e.g., 'cloudfront/') |
| `includeCookies` | `boolean` | `false` | Whether to include cookies in access logs |

### Log Fields

CloudFront access logs include:
- Request date/time
- Client IP address
- Request method and path
- Response status code
- User agent
- Referrer
- Cookies (if `includeCookies: true`)

### Best Practices for Logging

1. **Separate log bucket** - Use a dedicated bucket for logs, not your origin bucket
2. **Enable S3 lifecycle policies** - Automatically archive or delete old logs to save costs
3. **Analyze logs** - Use Amazon Athena or CloudWatch Logs Insights for analysis
4. **Secure the log bucket** - Restrict access to authorized personnel only
5. **Consider costs** - Logging generates storage costs based on traffic volume

## Security Headers

CloudFront automatically applies security best practices through response header policies. By default, the construct includes strict security headers to protect against common web vulnerabilities.

### Default Security Headers

The construct applies these security headers by default:

- **Content Security Policy (CSP)** - Prevents XSS and data injection attacks
- **X-Frame-Options** - Prevents clickjacking
- **Referrer-Policy** - Controls referrer information
- **Strict-Transport-Security (HSTS)** - Enforces HTTPS
- **Cross-Origin-Opener-Policy (COOP)** - Isolates browsing context (`same-origin`)
- **Cross-Origin-Embedder-Policy (COEP)** - Prevents loading cross-origin resources (`require-corp`)

### Customizing Security Headers

Use `CloudFront.responseHeaderPolicy()` to customize security headers:

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';

const customPolicy = CloudFront.responseHeaderPolicy(this, 'CustomPolicy', {
  name: 'my-security-policy',
  // Customize CSP
  csp: {
    styleSrc: ["'self'", 'https://fonts.googleapis.com'],
    frameSrc: ["'self'", 'https://www.youtube.com'],
    frameAncestors: ["'self'"],
  },
  // Customize Cross-Origin headers
  crossOriginOpenerPolicy: 'same-origin-allow-popups',
  crossOriginEmbedderPolicy: 'credentialless',
});

const distribution = new CloudFront(this, 'Distribution', {
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', bucket),
    responseHeadersPolicy: customPolicy,
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Disabling Cross-Origin Headers

If you need to disable Cross-Origin isolation headers (e.g., for compatibility with third-party embeds):

```typescript
const relaxedPolicy = CloudFront.responseHeaderPolicy(this, 'RelaxedPolicy', {
  name: 'relaxed-policy',
  crossOriginOpenerPolicy: false,       // Disables COOP header
  crossOriginEmbedderPolicy: false,     // Disables COEP header
});
```

### Cross-Origin Header Values

**Cross-Origin-Opener-Policy (COOP):**
- `'same-origin'` (default) - Strict isolation
- `'same-origin-allow-popups'` - Allows popups
- `'unsafe-none'` - No isolation
- `false` - Disable header

**Cross-Origin-Embedder-Policy (COEP):**
- `'require-corp'` (default) - Requires CORS or CORP
- `'credentialless'` - Loads resources without credentials
- `false` - Disable header

### Custom CSP Configuration

Customize Content Security Policy for your application needs:

```typescript
const policy = CloudFront.responseHeaderPolicy(this, 'AppPolicy', {
  csp: {
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    frameSrc: ["'self'", 'https://www.youtube.com', 'https://player.vimeo.com'],
    frameAncestors: ["'self'", 'https://trusted-embedder.com'],
  },
});
```

### Full CSP String Override

For complete control, provide a custom CSP string:

```typescript
const policy = CloudFront.responseHeaderPolicy(this, 'CustomCSP', {
  contentSecurityPolicy: `
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://cdn.example.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://api.example.com;
  `.replace(/\s+/g, ' ').trim(),
});
```

### Response Header Policy Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | - | Policy name |
| `csp` | `CspConfig` | - | Content Security Policy configuration |
| `contentSecurityPolicy` | `string` | - | Full CSP string override |
| `crossOriginOpenerPolicy` | `string \| false` | `'same-origin'` | COOP header value or `false` to disable |
| `crossOriginEmbedderPolicy` | `string \| false` | `'require-corp'` | COEP header value or `false` to disable |

## Custom CloudFront Functions

CloudFront Functions are lightweight JavaScript functions that run on CloudFront edge locations. They're ideal for simple request/response transformations with low latency.

### Creating Custom Functions

Use `CloudFront.createFunction()` to create custom CloudFront Functions that can be assigned to behaviors:

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { FunctionEventType } from 'aws-cdk-lib/aws-cloudfront';

// Create a custom function to transform URIs
const moderationFunction = CloudFront.createFunction(
  this,
  'ModerationBehaviorFunction',
  `function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var prefix = '/m-7f3d9e2a8c4b';
    
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

// Create distribution
const distribution = new CloudFront(this, 'Distribution', {
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'my-app', tags: [] },
});

// Add behavior with custom function
distribution.addBehavior('/m-*', CloudFront.s3BucketOrigin('moderation', moderationBucket), {
  functions: [moderationFunction],
});
```

### Functions on Default Behavior

You can also add CloudFront Functions to the default behavior (applies to all requests that don't match other path patterns):

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';

// Create a custom function first
const indexRewriteFunction = CloudFront.createFunction(
  this,
  'IndexRewrite',
  `function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    if (uri.endsWith('/')) {
      request.uri += 'index.html';
    }
    
    return request;
  }`
);

// Create distribution with function on default behavior
const distribution = new CloudFront(this, 'Distribution', {
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
    functions: [indexRewriteFunction], // Add functions to default behavior
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Function Event Types

CloudFront Functions can run at different stages:

```typescript
// Viewer Request (default) - runs before CloudFront cache lookup
const requestFunction = CloudFront.createFunction(
  this,
  'RequestFunction',
  `function handler(event) { return event.request; }`
);

// Viewer Response - runs after receiving response from origin
const responseFunction = CloudFront.createFunction(
  this,
  'ResponseFunction',
  `function handler(event) {
    var response = event.response;
    response.headers['x-custom-header'] = { value: 'custom-value' };
    return response;
  }`,
  FunctionEventType.VIEWER_RESPONSE
);
```

### Use Cases for Custom Functions

1. **URL Rewriting** - Transform request URIs to match your origin structure
2. **Header Manipulation** - Add, modify, or remove HTTP headers
3. **Authentication** - Validate tokens or signed cookies
4. **A/B Testing** - Route requests to different origins based on cookies
5. **Redirects** - Implement custom redirect logic
6. **Normalization** - Standardize URLs (e.g., lowercase, remove query strings)

### Built-in Functions

The construct also provides built-in helper functions:

```typescript
// Index rewriting - adds /index.html to directory paths
const indexFunction = distribution.getIndexRewriteFunction();

// SPA routing - rewrites non-file requests to /index.html
const spaFunction = distribution.getSpaRewriteFunction('/app');

// Use in behaviors
distribution.addBehavior('/app/*', appOrigin, {
  functions: [spaFunction],
});
```

### Function Limitations

CloudFront Functions have some constraints:
- Maximum execution time: < 1ms
- Memory limit: 2MB
- Cannot make network requests
- Limited to JavaScript ES5.1
- Best for simple, fast transformations

For complex logic or external API calls, consider using Lambda@Edge instead.

> 📖 **For comprehensive examples and best practices**, see the [CloudFront Custom Functions](./CloudFrontCustomFunctions.md) guide.

## Route 53 DNS Records

Easily add Route 53 DNS records that point to your CloudFront distribution. The construct automatically creates both A and AAAA records for IPv4 and IPv6 support.

### Automatic DNS Configuration

Configure DNS records during distribution creation:

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { HostedZone } from 'aws-cdk-lib/aws-route53';

const hostedZone = HostedZone.fromLookup(this, 'Zone', {
  domainName: 'example.com',
});

const distribution = new CloudFront(this, 'Distribution', {
  name: 'my-distribution',
  domain: {
    names: ['example.com', 'www.example.com'],
    certificate: myCertificate,
    dns: {
      hostedZone,
      records: ['example.com', 'www.example.com'], // Creates A and AAAA for each
    },
  },
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Adding DNS Records Manually

Use the `addRoute53Records()` helper method to add DNS records after distribution creation:

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { HostedZone } from 'aws-cdk-lib/aws-route53';

const hostedZone = HostedZone.fromLookup(this, 'Zone', {
  domainName: 'example.com',
});

const distribution = new CloudFront(this, 'Distribution', {
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'my-app', tags: [] },
});

// Add single record (creates both A and AAAA)
distribution.addRoute53Records(hostedZone, 'www.example.com');

// Add multiple records at once
distribution.addRoute53Records(hostedZone, [
  'example.com',
  'www.example.com',
  'cdn.example.com',
]);
```

### Multi-Language Domain Example

Here's a practical example for multi-language sites:

```typescript
const stagingZone = HostedZone.fromLookup(this, 'StagingZone', {
  domainName: 'staging.example.com',
});

const distribution = new CloudFront(this, 'StagingDistribution', {
  domain: {
    names: ['en.staging.example.com', 'fr.staging.example.com'],
    certificate: stagingCertificate,
  },
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'staging', tags: [] },
});

// Add DNS records for both English and French domains
distribution.addRoute53Records(stagingZone, [
  'en.staging.example.com',
  'fr.staging.example.com',
]);
```

### What Gets Created

For each record name, the helper automatically creates:
- **A Record** - IPv4 alias pointing to CloudFront
- **AAAA Record** - IPv6 alias pointing to CloudFront

This ensures your distribution is accessible via both IPv4 and IPv6.

## Properties

### CloudFrontProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Distribution name |
| `stack` | `object` | Required | Stack ID and tags |
| `defaultBehavior` | `object` | Required | Default origin and behavior |
| `domainName` | `string` | - | Custom domain name |
| `certificate` | `ICertificate` | - | ACM certificate for custom domain |
| `logging` | `LoggingConfig` | - | Access logging configuration |

## Getters

- `distribution` - CloudFront distribution
- `distributionId` - Distribution ID
- `distributionDomainName` - CloudFront domain name
- `responseHeadersPolicy` - Response headers policy (if configured)

## Methods

### `grantCreateInvalidation(grantee)`

Grants permission to create CloudFront cache invalidations to a Lambda function, role, or other IAM principal. This is useful when you need to programmatically invalidate cached content after updates.

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { Function } from '@designofadecade/cdk-constructs';

// Create CloudFront distribution
const cdn = new CloudFront(this, 'CDN', {
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', bucket),
  },
  stack: { id: 'my-app', tags: [] },
});

// Create a Lambda function that needs to invalidate cache
const imageProcessor = new Function(this, 'ImageProcessor', {
  name: 'image-processor',
  entry: './src/handlers/process-image.ts',
  stack: { id: 'my-app', tags: [] },
});

// Grant invalidation permission
cdn.grantCreateInvalidation(imageProcessor.function);
```

**Common use cases:**
- Invalidate cache after uploading new content to S3
- Clear cache after CMS content updates
- Refresh cache for updated API responses
- Force cache refresh for hotfixes

**Example Lambda function using invalidation:**
```typescript
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const cloudfront = new CloudFrontClient({});

export async function handler(event) {
  await cloudfront.send(new CreateInvalidationCommand({
    DistributionId: process.env.DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: 1,
        Items: ['/images/*'],
      },
    },
  }));
  
  return { statusCode: 200, body: 'Cache invalidated' };
}
```

### `addBehavior(pathPattern, origin, options?)`

Adds a custom behavior to the distribution for a specific path pattern.

### `addHttpBehavior(pathPattern, domainName, options)`

Adds a behavior with an HTTP origin for API routes or external services.

### `addFunctionBehavior(pathPattern, functionConstruct, options)`

Adds a behavior with a Lambda Function URL origin.

### `addRoute53Records(hostedZone, recordNames)`

Adds DNS records pointing to the CloudFront distribution (creates both A and AAAA records).

## Custom Cache Policies

CloudFront's default cache policies work well for most use cases, but sometimes you need fine-grained control over what gets cached. Use `CloudFront.createCachePolicy()` to create custom cache policies with specific query string, cookie, and header behaviors.

### Creating Custom Cache Policies

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';

// Create a cache policy for API with query string caching
const apiCachePolicy = CloudFront.createCachePolicy(this, 'ApiCachePolicy', {
  name: 'api-query-cache-policy',
  comment: 'API cache policy with query allow-list',
  queryStrings: ['next', 'q'], // Only these query params affect caching
  cookies: 'none',
  headers: 'none',
  minTtl: 0,
  defaultTtl: 0,
  maxTtl: 1,
  enableAcceptEncodingBrotli: true,
  enableAcceptEncodingGzip: true,
});

// Use the cache policy in a behavior
const cdn = new CloudFront(this, 'CDN', {
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', bucket),
  },
  stack: { id: 'my-app', tags: [] },
});

cdn.addHttpBehavior('/api/*', 'api.example.com', {
  cachePolicy: apiCachePolicy,
  customHeaders: {
    'x-origin-verify': 'secret-value',
  },
});
```

### Cache Policy Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | Required | Name for the cache policy |
| `comment` | `string` | - | Description of the policy |
| `queryStrings` | `'none' \| 'all' \| string[]` | `'none'` | Which query strings to include in cache key |
| `cookies` | `'none' \| 'all' \| string[]` | `'none'` | Which cookies to include in cache key |
| `headers` | `'none' \| string[]` | `'none'` | Which headers to include in cache key |
| `minTtl` | `number` | `0` | Minimum TTL in seconds |
| `defaultTtl` | `number` | `86400` | Default TTL in seconds (1 day) |
| `maxTtl` | `number` | `31536000` | Maximum TTL in seconds (1 year) |
| `enableAcceptEncodingBrotli` | `boolean` | `true` | Enable Brotli compression |
| `enableAcceptEncodingGzip` | `boolean` | `true` | Enable Gzip compression |

### Query String Behaviors

```typescript
// Don't include query strings in cache key (all requests cache together)
queryStrings: 'none'

// Include all query strings in cache key (each combo caches separately)
queryStrings: 'all'

// Include only specific query strings (allow-list)
queryStrings: ['page', 'sort', 'filter']
```

### Cookie Behaviors

```typescript
// Don't include cookies in cache key
cookies: 'none'

// Include all cookies in cache key
cookies: 'all'

// Include only specific cookies (allow-list)
cookies: ['session_id', 'user_preferences']
```

### Header Behaviors

```typescript
// Don't include headers in cache key
headers: 'none'

// Include specific headers (allow-list)
headers: ['Accept', 'Accept-Language', 'CloudFront-Viewer-Country']
```

### Common Cache Policy Patterns

**API with pagination:**
```typescript
const apiCache = CloudFront.createCachePolicy(this, 'ApiPagination', {
  name: 'api-pagination',
  queryStrings: ['page', 'limit', 'offset'],
  defaultTtl: 300, // 5 minutes
  maxTtl: 3600,    // 1 hour
});
```

**Search results:**
```typescript
const searchCache = CloudFront.createCachePolicy(this, 'SearchCache', {
  name: 'search-cache',
  queryStrings: ['q', 'filter', 'sort'],
  defaultTtl: 600, // 10 minutes
});
```

**No caching (always fresh):**
```typescript
const noCache = CloudFront.createCachePolicy(this, 'NoCache', {
  name: 'no-cache',
  minTtl: 0,
  defaultTtl: 0,
  maxTtl: 1,
});
```

**User-specific content:**
```typescript
const userCache = CloudFront.createCachePolicy(this, 'UserCache', {
  name: 'user-cache',
  cookies: ['session_id'],
  queryStrings: ['user_id'],
  defaultTtl: 300,
});
```

### Using Cache Policies with Behaviors

All behavior methods (`addBehavior`, `addHttpBehavior`, `addFunctionBehavior`) support custom cache policies:

```typescript
// With addBehavior
cdn.addBehavior('/custom/*', origin, {
  cachePolicy: customCachePolicy,
});

// With addHttpBehavior
cdn.addHttpBehavior('/api/*', 'api.example.com', {
  cachePolicy: apiCachePolicy,
  customHeaders: { 'x-api-key': 'secret' },
});

// With addFunctionBehavior
cdn.addFunctionBehavior('/lambda/*', lambdaFunction, {
  cachePolicy: lambdaCachePolicy,
  stack: { id: 'my-app' },
});
```

**Note:** If you provide a custom `cachePolicy`, the `cachingDisabled` option is ignored.

## Best Practices

1. **Always use HTTPS** - Enforce secure connections
2. **Enable HTTP/3** - Better performance (enabled by default)
3. **Add security headers** - Protect against common attacks (enabled by default)
4. **Use Origin Access Identity** for S3 origins
5. **Enable access logging** for audit trail
6. **Consider WAF** for DDoS protection
7. **Set appropriate cache policies** based on content type

## Related Constructs

- [S3Bucket](./S3Bucket.md) - S3 bucket for origin content
- [CloudFront Custom Functions](./CloudFrontCustomFunctions.md) - Detailed guide for creating custom edge functions
