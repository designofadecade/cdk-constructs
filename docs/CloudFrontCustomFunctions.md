# CloudFront Custom Functions

Create custom CloudFront Functions to transform requests and responses at the edge with sub-millisecond latency.

## Features

- Lightweight JavaScript execution at CloudFront edge locations
- Sub-millisecond response times
- Request and response transformation
- URL rewriting and redirects
- Header manipulation
- Authentication and authorization logic
- Built-in helper functions for common patterns

## Basic Usage

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { FunctionEventType } from 'aws-cdk-lib/aws-cloudfront';

// Create a custom function
const customFunction = CloudFront.createFunction(
  this,
  'CustomFunction',
  `function handler(event) {
    var request = event.request;
    // Transform the request
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

// Apply function to a behavior
distribution.addBehavior('/api/*', apiOrigin, {
  functions: [customFunction],
});
```

## Creating Custom Functions

Use the `CloudFront.createFunction()` static method to create CloudFront Functions:

```typescript
const customFunction = CloudFront.createFunction(
  scope: Construct,          // The construct scope (typically 'this')
  id: string,                // Unique identifier for the function
  code: string,              // JavaScript function code
  eventType?: FunctionEventType  // When to execute (default: VIEWER_REQUEST)
);
```

### Event Types

CloudFront Functions can execute at two different stages:

| Event Type | Description | Use Cases |
|------------|-------------|-----------|
| `VIEWER_REQUEST` | Executes before CloudFront cache lookup | URL rewriting, authentication, request validation |
| `VIEWER_RESPONSE` | Executes after receiving response from origin | Adding headers, response modification |

### Viewer Request Example

```typescript
const requestFunction = CloudFront.createFunction(
  this,
  'RequestFunction',
  `function handler(event) {
    var request = event.request;
    // Modify request before cache lookup
    request.headers['x-custom-header'] = { value: 'custom' };
    return request;
  }`
  // Default is VIEWER_REQUEST, so eventType parameter is optional
);
```

### Viewer Response Example

```typescript
const responseFunction = CloudFront.createFunction(
  this,
  'ResponseFunction',
  `function handler(event) {
    var response = event.response;
    // Modify response headers
    response.headers['x-custom-header'] = { value: 'custom-value' };
    return response;
  }`,
  FunctionEventType.VIEWER_RESPONSE
);
```

## Use Cases and Examples

### URL Rewriting

Rewrite URLs to match your origin's file structure. This example adds a prefix and transforms paths:

```typescript
const moderationFunction = CloudFront.createFunction(
  this,
  'ModerationFunction',
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

distribution.addBehavior('/m-*', moderationOrigin, {
  functions: [moderationFunction],
});
```

### Adding Custom Headers

Add or modify HTTP headers in responses:

```typescript
const headerFunction = CloudFront.createFunction(
  this,
  'HeaderFunction',
  `function handler(event) {
    var response = event.response;
    response.headers['x-custom-header'] = { value: 'my-value' };
    response.headers['x-environment'] = { value: 'production' };
    return response;
  }`,
  FunctionEventType.VIEWER_RESPONSE
);

distribution.addBehavior('/api/*', apiOrigin, {
  functions: [headerFunction],
});
```

### URL Redirects

Implement custom redirect logic for moved or deprecated paths:

```typescript
const redirectFunction = CloudFront.createFunction(
  this,
  'RedirectFunction',
  `function handler(event) {
    var uri = event.request.uri;
    
    // Redirect old paths to new locations
    if (uri === '/old-path') {
      return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: {
          'location': { value: '/new-path' }
        }
      };
    }
    
    // Redirect non-www to www
    var host = event.request.headers.host.value;
    if (host === 'example.com') {
      return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: {
          'location': { value: 'https://www.example.com' + uri }
        }
      };
    }
    
    return event.request;
  }`
);
```

### Combining Multiple Functions

Apply multiple functions to a single behavior for complex transformations:

```typescript
const requestTransform = CloudFront.createFunction(
  this,
  'RequestTransform',
  `function handler(event) {
    // Transform request
    return event.request;
  }`
);

const responseTransform = CloudFront.createFunction(
  this,
  'ResponseTransform',
  `function handler(event) {
    // Transform response
    return event.response;
  }`,
  FunctionEventType.VIEWER_RESPONSE
);

distribution.addBehavior('/app/*', appOrigin, {
  functions: [requestTransform, responseTransform],
});
```

## Built-in Helper Functions

The CloudFront construct provides pre-built functions for common patterns:

### Index Rewriting

Automatically add `/index.html` to directory requests:

```typescript
const distribution = new CloudFront(this, 'Distribution', {
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', myBucket),
  },
  stack: { id: 'my-app', tags: [] },
});

const indexFunction = distribution.getIndexRewriteFunction();

distribution.addBehavior('/docs/*', docsOrigin, {
  functions: [indexFunction],
});
```

### SPA Routing

Rewrite all non-file requests to `/index.html` for single-page applications:

```typescript
const spaFunction = distribution.getSpaRewriteFunction('/app');

distribution.addBehavior('/app/*', appOrigin, {
  functions: [spaFunction],
});
```

With a base path, the function:
- Serves static files (with extensions) normally
- Rewrites all other requests to `/app/index.html`
- Adds trailing slashes where needed

## Function Constraints

CloudFront Functions have specific limitations:

| Constraint | Limit | Impact |
|------------|-------|--------|
| **Execution time** | < 1ms | Must be fast; no complex computations |
| **Memory** | 2MB | Limited context and data storage |
| **Network requests** | Not allowed | Cannot call external APIs |
| **JavaScript version** | ES5.1 | No modern syntax (arrow functions, async/await) |
| **Best for** | Simple transformations | URL rewrites, headers, redirects |

**When to use Lambda@Edge instead:**
- Need to make external API calls
- Require more than 1ms execution time
- Need access to request body
- Require complex business logic
- Need modern JavaScript features

## Best Practices

1. **Keep functions simple** - CloudFront Functions are optimized for speed
2. **Test thoroughly** - Use the CloudFront Function test console
3. **Handle errors gracefully** - Always return valid request/response objects
4. **Minimize function size** - Smaller functions load faster
5. **Use built-in functions** - Leverage `getIndexRewriteFunction()` and `getSpaRewriteFunction()` when possible
6. **Cache-aware** - Remember VIEWER_REQUEST runs before cache, VIEWER_RESPONSE after
7. **Avoid side effects** - Functions should be deterministic

## Properties

### createFunction() Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scope` | `Construct` | Yes | The CDK construct scope (typically `this`) |
| `id` | `string` | Yes | Unique identifier for the function |
| `code` | `string` | Yes | Inline JavaScript function code |
| `eventType` | `FunctionEventType` | No | Execution stage (default: `VIEWER_REQUEST`) |

### Return Value

Returns a `FunctionAssociation` object that can be passed to behavior configuration.

## Related Constructs

- [CloudFront](./CloudFront.md) - CloudFront distribution construct
- [Function](./Function.md) - Lambda functions (for Lambda@Edge)

## Additional Resources

- [AWS CloudFront Functions Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html)
- [CloudFront Functions Event Structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html)
- [Example Functions](./examples/cloudfront-custom-functions.ts)
