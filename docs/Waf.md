# WAF Construct

AWS WAF (Web Application Firewall) construct with best practice security rules for protecting web applications from common threats.

## Features

- **AWS Managed Rules**: Pre-configured rule sets from AWS
- **64 KB Body Inspection**: Increased inspection limit (from default 16 KB) to detect threats in larger payloads while automatically blocking oversized requests
- **Payload Size Constraints**: Block requests exceeding specific size limits (prevents denial-of-service attacks with oversized payloads)
- **Rate Limiting**: Prevents DDoS and brute force attacks
- **Geographic Blocking**: Block traffic from specific countries
- **IP Allow/Block Lists**: Control access by IP address
- **CloudFront Integration**: Easy association with CloudFront distributions
- **Comprehensive Logging**: CloudWatch metrics for all rules

## Basic Usage

### Simple WAF with Best Practice Rules

```typescript
import { Waf } from '@designofadecade/cdk-constructs';

// Scope is auto-detected from stack region
// us-east-1 → CLOUDFRONT, others → REGIONAL
const waf = new Waf(this, 'WAF', {
  name: 'my-app-waf',
  enableManagedRules: true,
  stack: { 
    id: 'my-app', 
    tags: [{ key: 'Environment', value: 'production' }] 
  },
});
```

### Explicit Scope Configuration

```typescript
const waf = new Waf(this, 'WAF', {
  name: 'my-app-waf',
  scope: Waf.SCOPE_CLOUDFRONT, // Use static constant
  enableManagedRules: true,
  stack: { id: 'my-app', tags: [] },
});

// Or use string literals
const waf2 = new Waf(this, 'WAF2', {
  scope: 'REGIONAL',
  enableManagedRules: true,
  stack: { id: 'my-app', tags: [] },
});
```

### WAF with Rate Limiting

```typescript
const waf = new Waf(this, 'WAF', {
  enableManagedRules: true,
  rateLimit: {
    limit: 2000, // Max 2000 requests per 5 minutes per IP
    priority: 1,
  },
  stack: { id: 'my-app', tags: [] },
});
```

### WAF with Geographic Blocking

```typescript
const waf = new Waf(this, 'WAF', {
  geoBlock: {
    countryCodes: ['CN', 'RU', 'KP'], // Block China, Russia, North Korea
    priority: 2,
  },
  stack: { id: 'my-app', tags: [] },
});
```

### WAF with Payload Size Constraints

Block requests with payloads exceeding a specific size to prevent denial-of-service attacks:

```typescript
// Using static constants (recommended)
const waf = new Waf(this, 'WAF', {
  enableManagedRules: true,
  payloadSizeConstraint: {
    maxSizeBytes: Waf.PAYLOAD_64KB,
    priority: 3,
    component: 'BODY', // Check request body size
  },
  stack: { id: 'my-app', tags: [] },
});

// Using the helper method with constants
const waf2 = new Waf(this, 'WAF2', {
  payloadSizeConstraint: Waf.PayloadSizeConstraint(Waf.PAYLOAD_1MB, 3),
  stack: { id: 'my-app', tags: [] },
});

// Or use literal byte values
const waf3 = new Waf(this, 'WAF3', {
  payloadSizeConstraint: {
    maxSizeBytes: 524288, // 512 KB custom size
    priority: 3,
  },
  stack: { id: 'my-app', tags: [] },
});
```

**Static payload size constants:**
- `Waf.PAYLOAD_8KB` - 8,192 bytes (small API requests)
- `Waf.PAYLOAD_64KB` - 65,536 bytes (standard requests)
- `Waf.PAYLOAD_256KB` - 262,144 bytes (large requests)  
- `Waf.PAYLOAD_1MB` - 1,048,576 bytes (very large requests)

## Advanced Usage

### Complete Security Configuration

```typescript
const waf = new Waf(this, 'WAF', {
  name: 'production-waf',
  // Scope auto-detected from region
  defaultAction: 'ALLOW',
  
  // Enable AWS Managed Rules
  enableManagedRules: true,
  
  // Rate limiting (2000 requests per 5 minutes)
  rateLimit: {
    limit: 2000,
    priority: 1,
  },
  
  // Block specific countries
  geoBlock: {
    countryCodes: ['CN', 'RU'],
    priority: 2,
  },
  
  // Block oversized payloads
  payloadSizeConstraint: {
    maxSizeBytes: Waf.PAYLOAD_256KB,
    priority: 3,
  },
  
  // IP allowlist for trusted sources
  ipSets: [
    {
      name: 'TrustedIPs',
      addresses: ['203.0.113.0/24', '198.51.100.0/24'],
      priority: 4,
      action: 'ALLOW',
      ipAddressVersion: 'IPV4',
    },
  ],
  
  stack: { 
    id: 'my-app', 
    tags: [
      { key: 'Environment', value: 'production' },
      { key: 'Team', value: 'security' },
    ] 
  },
});
```

### Associate with CloudFront Distribution

```typescript
import { CloudFront, Waf } from '@designofadecade/cdk-constructs';

// Create WAF first (must be in us-east-1)
const waf = new Waf(this, 'WAF', {
  enableManagedRules: true,
  stack: { id: 'my-app', tags: [] },
});

// Pass WAF directly to CloudFront
const cdn = new CloudFront(this, 'CDN', {
  defaultBehavior: { origin: myOrigin },
  waf, // Pass Waf construct
  stack: { id: 'my-app', tags: [] },
});

// Or use WAF ARN string
const cdn2 = new CloudFront(this, 'CDN2', {
  defaultBehavior: { origin: myOrigin },
  waf: waf.webAclArn, // Pass ARN string
  stack: { id: 'my-app', tags: [] },
});
```

### Regional WAF for ALB

```typescript
const waf = new Waf(this, 'WAF', {
  scope: Waf.SCOPE_REGIONAL, // Use static constant for regional resources
  enableManagedRules: true,
  rateLimit: {
    limit: 5000,
    priority: 1,
  },
  stack: { id: 'my-app', tags: [] },
});

// Associate with Application Load Balancer
waf.associateWithResource('ALB', myLoadBalancer.loadBalancerArn);
```

### Custom Managed Rules

```typescript
const waf = new Waf(this, 'WAF', {
  managedRules: [
    {
      name: 'AWSManagedRulesCommonRuleSet',
      vendorName: 'AWS',
      priority: 100,
      excludedRules: ['SizeRestrictions_BODY'], // Exclude specific rules
    },
    {
      name: 'AWSManagedRulesWordPressRuleSet',
      vendorName: 'AWS',
      priority: 101,
    },
  ],
  stack: { id: 'my-app', tags: [] },
});
```

## AWS Managed Rules

When `enableManagedRules: true`, the following AWS Managed Rules are automatically applied:

1. **Core Rule Set (CRS)** - Protects against OWASP Top 10 vulnerabilities
2. **Known Bad Inputs** - Blocks patterns associated with exploits
3. **Amazon IP Reputation List** - Blocks IPs with poor reputation
4. **Anonymous IP List** - Blocks VPNs, proxies, Tor nodes
5. **SQL Injection Protection** - Prevents SQL injection attacks
6. **Linux OS Protection** - Blocks Linux-specific exploits
7. **POSIX OS Protection** - Blocks Unix/POSIX exploits

### Enhanced Security with Body Size Inspection

By default, managed rules are configured with **64 KB body size inspection limits** to prevent large payloads from bypassing security rules:

- **64 KB inspection limit** (up from the AWS default 16 KB)
- **Automatic blocking** of requests with bodies exceeding the inspection limit by AWS Managed Rules  
- Prevents attackers from using oversized payloads to bypass WAF inspection
- Applies to all rules in the Web ACL for consistent security

```typescript
const waf = new Waf(this, 'WAF', {
  enableManagedRules: true,
  // Optional: customize body size limit (default is KB_64 for maximum security)
  managedRulesBodySizeLimit: Waf.BODY_SIZE_64KB, // or KB_16, KB_32, KB_48
  stack: { id: 'my-app', tags: [] },
});
```

**How it works:**
- WAF inspects request bodies up to the configured limit (default: 64 KB for managed rules)
- AWS Managed Rules automatically block requests with bodies exceeding this limit
- This prevents attackers from bypassing rules by sending oversized payloads
- The limit is configured globally for the entire Web ACL via CloudFormation's `AssociationConfig`

**Why this matters:**
- Attackers may attempt to send payloads larger than the inspection limit to bypass security rules
- Without a sufficient inspection limit, requests exceeding 16 KB could pass through uninspected
- Setting the limit to 64 KB provides thorough inspection while blocking truly oversized requests

**Available body size limits:**
- `Waf.BODY_SIZE_16KB` - 16 KB (typical AWS default)
- `Waf.BODY_SIZE_32KB` - 32 KB
- `Waf.BODY_SIZE_48KB` - 48 KB
- `Waf.BODY_SIZE_64KB` - 64 KB (recommended, provides maximum inspection before blocking)

**Note:** For CloudFront distributions, increasing the inspection limit beyond 16 KB may incur additional AWS charges. See [AWS WAF Pricing](https://aws.amazon.com/waf/pricing/) for details.

## Static Constants

### Scope Constants

```typescript
Waf.SCOPE_CLOUDFRONT  // 'CLOUDFRONT'
Waf.SCOPE_REGIONAL    // 'REGIONAL'

// Usage
const waf = new Waf(this, 'WAF', {
  scope: Waf.SCOPE_CLOUDFRONT,
  stack: { id: 'my-app', tags: [] },
});
```

### Payload Size Constants

```typescript
Waf.PAYLOAD_8KB    // 8,192 bytes
Waf.PAYLOAD_64KB   // 65,536 bytes
Waf.PAYLOAD_256KB  // 262,144 bytes
Waf.PAYLOAD_1MB    // 1,048,576 bytes

// Usage
const waf = new Waf(this, 'WAF', {
  payloadSizeConstraint: {
    maxSizeBytes: Waf.PAYLOAD_256KB,
    priority: 3,
  },
  stack: { id: 'my-app', tags: [] },
});
```

### Body Size Inspection Limit Constants

```typescript
Waf.BODY_SIZE_16KB  // 'KB_16'
Waf.BODY_SIZE_32KB  // 'KB_32'
Waf.BODY_SIZE_48KB  // 'KB_48'
Waf.BODY_SIZE_64KB  // 'KB_64'

// Usage
const waf = new Waf(this, 'WAF', {
  enableManagedRules: true,
  managedRulesBodySizeLimit: Waf.BODY_SIZE_64KB,
  stack: { id: 'my-app', tags: [] },
});
```

## Static Helper Methods

### Scope from Region

```typescript
const scope = Waf.GetScopeFromRegion('us-east-1'); // Returns 'CLOUDFRONT'
const scope2 = Waf.GetScopeFromRegion('us-west-2'); // Returns 'REGIONAL'
```

### Rate Limit Configuration

```typescript
const rateLimit = Waf.RateLimitConfig(2000, 1);
```

### Geographic Blocking

```typescript
const geoBlock = Waf.GeoBlockConfig(['CN', 'RU', 'KP'], 2);
```

### IP Block List

```typescript
const ipBlock = Waf.BlockIPSet('MaliciousIPs', [
  '192.0.2.0/24',
  '198.51.100.0/24',
], 3);
```

### IP Allow List

```typescript
const ipAllow = Waf.AllowIPSet('TrustedIPs', [
  '203.0.113.0/24',
], 3);
```

### Payload Size Constraint

```typescript
// Block requests with body > 64 KB (using constant)
const sizeConstraint = Waf.PayloadSizeConstraint(Waf.PAYLOAD_64KB, 3);

// Block requests with body > 1 MB (using constant)
const largePayload = Waf.PayloadSizeConstraint(Waf.PAYLOAD_1MB, 3);

// Block requests with body > 256 KB, check body (default)
const constraint = Waf.PayloadSizeConstraint(Waf.PAYLOAD_256KB, 3, 'BODY');

// Or use literal values for custom sizes
const custom = Waf.PayloadSizeConstraint(524288, 3); // 512 KB
```

## Properties Reference

### WafProps

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No | Name for the Web ACL |
| `stack` | `object` | Yes | Stack reference with id and tags |
| `scope` | `'CLOUDFRONT' \| 'REGIONAL'` | No | Scope of the Web ACL (auto-detected from region if not provided) |
| `defaultAction` | `'ALLOW' \| 'BLOCK'` | No | Default action (default: 'ALLOW') |
| `enableManagedRules` | `boolean` | No | Enable AWS Managed Rules |
| `managedRulesBodySizeLimit` | `BodySizeInspectionLimit` | No | Body inspection limit for managed rules (default: 'KB_64') |
| `managedRules` | `ManagedRuleConfig[]` | No | Custom managed rules |
| `rateLimit` | `RateLimitConfig` | No | Rate limiting configuration |
| `ipSets` | `IPSetConfig[]` | No | IP allow/block lists |
| `geoBlock` | `GeoBlockConfig` | No | Geographic blocking |
| `payloadSizeConstraint` | `PayloadSizeConstraintConfig` | No | Payload size constraint |

### ManagedRuleConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Name of the managed rule group |
| `vendorName` | `string` | No | Vendor name (default: 'AWS') |
| `priority` | `number` | Yes | Rule priority |
| `excludedRules` | `string[]` | No | Rules to exclude |
| `bodySizeInspectionLimit` | `BodySizeInspectionLimit` | No | Body inspection limit override |

### BodySizeInspectionLimit

Type: `'KB_16' | 'KB_32' | 'KB_48' | 'KB_64'`

Controls the maximum request body size that will be inspected by WAF rules. Requests with bodies exceeding this limit are automatically blocked to prevent bypass attacks.

### PayloadSizeConstraintConfig

Configures a custom rule to block requests exceeding a specific payload size.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `maxSizeBytes` | `number` | Yes | - | Maximum payload size in bytes |
| `priority` | `number` | Yes | - | Rule priority |
| `component` | `'BODY' \| 'HEADER' \| 'QUERY_STRING' \| 'URI_PATH'` | No | `'BODY'` | Request component to check |
| `comparisonOperator` | `'GT' \| 'GTE' \| 'LT' \| 'LTE' \| 'EQ' \| 'NE'` | No | `'GT'` | Comparison operator |

**Common Size Values:**
- 8 KB: `8192` or `Waf.PAYLOAD_8KB`
- 64 KB: `65536` or `Waf.PAYLOAD_64KB`
- 256 KB: `262144` or `Waf.PAYLOAD_256KB`
- 1 MB: `1048576` or `Waf.PAYLOAD_1MB`

## Important Notes

### Scope Auto-Detection

If `scope` is not explicitly provided, it is automatically determined from the stack's region:
- **us-east-1**: Returns `CLOUDFRONT`
- **All other regions**: Returns `REGIONAL`

```typescript
// In us-east-1 - automatically uses CLOUDFRONT scope
const stack = new Stack(app, 'WafStack', {
  env: { region: 'us-east-1' },
});
const waf = new Waf(stack, 'WAF', {
  stack: { id: 'my-app', tags: [] },
}); // scope will be 'CLOUDFRONT'

// In other regions - automatically uses REGIONAL scope
const regionalStack = new Stack(app, 'RegionalWafStack', {
  env: { region: 'eu-west-1' },
});
const regionalWaf = new Waf(regionalStack, 'WAF', {
  stack: { id: 'my-app', tags: [] },
}); // scope will be 'REGIONAL'
```

### CloudFront Scope

WAF Web ACLs with `CLOUDFRONT` scope **must be created in us-east-1 region**:

```typescript
const app = new App();
const stack = new Stack(app, 'WafStack', {
  env: { region: 'us-east-1' },
});

const waf = new Waf(stack, 'WAF', {
  scope: 'CLOUDFRONT',
  stack: { id: 'my-app', tags: [] },
});
```

### Regional Scope

Regional WAFs can be created in any region and are used with:
- Application Load Balancers (ALB)
- API Gateway
- App Runner
- AWS AppSync
- Cognito User Pools

## Example: Full E-commerce Security

```typescript
const waf = new Waf(this, 'EcommerceWAF', {
  name: 'ecommerce-security',
  // Scope auto-detected (CLOUDFRONT in us-east-1, REGIONAL elsewhere)
  
  // Allow legitimate traffic by default
  defaultAction: 'ALLOW',
  
  // Enable all AWS Managed Rules
  enableManagedRules: true,
  
  // Prevent DDoS (400 requests per minute per IP)
  rateLimit: {
    limit: 2000,
    priority: 1,
  },
  
  // Block high-risk countries
  geoBlock: {
    countryCodes: ['CN', 'RU', 'KP', 'IR'],
    priority: 2,
  },
  
  // Allow office IPs
  ipSets: [
    {
      name: 'OfficeIPs',
      addresses: ['203.0.113.0/24'],
      priority: 0, // Higher priority to allow before other rules
      action: 'ALLOW',
    },
  ],
  
  stack: { 
    id: 'ecommerce', 
    tags: [
      { key: 'Environment', value: 'production' },
      { key: 'Compliance', value: 'PCI-DSS' },
    ],
  },
});

// Outputs
console.log('WAF ID:', waf.webAclId);
console.log('WAF ARN:', waf.webAclArn);
```

## CloudWatch Metrics

All rules automatically send metrics to CloudWatch:

- `AWS/WAFV2/RateLimitRule` - Rate limit hits
- `AWS/WAFV2/GeoBlockRule` - Geographic blocks
- `AWS/WAFV2/AWSManagedRulesCommonRuleSet` - CRS rule hits
- And more...

Access these metrics in the CloudWatch console under the WAF namespace.

## Cost Considerations

- Web ACL: $5.00/month
- Rules: $1.00/month per rule
- Requests: $0.60 per million requests
- Managed Rule Groups: Additional costs apply

Enable only the rules you need to optimize costs.
