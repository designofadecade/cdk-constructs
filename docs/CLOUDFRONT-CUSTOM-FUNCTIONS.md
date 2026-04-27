# Custom CloudFront Functions - Quick Reference

## Overview

The CloudFront construct now supports creating custom CloudFront Functions that can be assigned to behaviors using the `CloudFront.createFunction()` static method.

## API

```typescript
CloudFront.createFunction(
  scope: Construct,
  id: string,
  code: string,
  eventType?: FunctionEventType
): FunctionAssociation
```

### Parameters

- **scope**: The CDK construct scope (usually `this`)
- **id**: Unique identifier for the function
- **code**: Inline JavaScript code for the CloudFront Function
- **eventType**: When to execute (default: `FunctionEventType.VIEWER_REQUEST`)
  - `VIEWER_REQUEST` - Before CloudFront cache lookup
  - `VIEWER_RESPONSE` - After receiving response from origin

## Quick Example

```typescript
import { CloudFront } from '@designofadecade/cdk-constructs';
import { FunctionEventType } from 'aws-cdk-lib/aws-cloudfront';

// Create custom function
const myFunction = CloudFront.createFunction(
  this,
  'MyCustomFunction',
  `function handler(event) {
    var request = event.request;
    // Your custom logic here
    return request;
  }`
);

// Create distribution
const cdn = new CloudFront(this, 'CDN', {
  defaultBehavior: {
    origin: CloudFront.s3BucketOrigin('origin', bucket),
  },
  stack: { id: 'my-app', tags: [] },
});

// Add behavior with custom function
cdn.addBehavior('/path/*', origin, {
  functions: [myFunction],
});
```

## Common Use Cases

### 1. URL Rewriting with Prefix

```typescript
const moderationFunction = CloudFront.createFunction(
  this,
  'ModerationFunction',
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
      }
    }
    
    return request;
  }`
);
```

### 2. Adding Custom Headers

```typescript
const headerFunction = CloudFront.createFunction(
  this,
  'HeaderFunction',
  `function handler(event) {
    var response = event.response;
    response.headers['x-custom-header'] = { value: 'my-value' };
    return response;
  }`,
  FunctionEventType.VIEWER_RESPONSE
);
```

### 3. Redirects

```typescript
const redirectFunction = CloudFront.createFunction(
  this,
  'RedirectFunction',
  `function handler(event) {
    var uri = event.request.uri;
    
    if (uri === '/old-path') {
      return {
        statusCode: 301,
        headers: {
          'location': { value: '/new-path' }
        }
      };
    }
    
    return event.request;
  }`
);
```

### 4. Multiple Functions per Behavior

```typescript
cdn.addBehavior('/app/*', origin, {
  functions: [
    requestFunction,   // Runs at viewer-request
    responseFunction,  // Runs at viewer-response
  ],
});
```

## Built-in Helper Functions

The construct also provides built-in functions:

```typescript
// Add /index.html to directories
const indexFunction = cdn.getIndexRewriteFunction();

// SPA routing
const spaFunction = cdn.getSpaRewriteFunction('/app');

// Use them in behaviors
cdn.addBehavior('/app/*', origin, {
  functions: [spaFunction],
});
```

## Function Constraints

- **Execution time**: < 1ms
- **Memory**: 2MB
- **No network requests**
- **JavaScript ES5.1** only
- Best for simple, fast transformations

For complex logic, use Lambda@Edge instead.

## Documentation

- [CloudFront Documentation](../CloudFront.md)
- [Complete Examples](./cloudfront-custom-functions.ts)
- [AWS CloudFront Functions Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html)
