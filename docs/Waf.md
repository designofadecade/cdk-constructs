# WAF Construct

AWS WAF (Web Application Firewall) construct with best practice security rules for protecting web applications from common threats.

## Features

- **AWS Managed Rules**: Pre-configured rule sets from AWS
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
  
  // IP allowlist for trusted sources
  ipSets: [
    {
      name: 'TrustedIPs',
      addresses: ['203.0.113.0/24', '198.51.100.0/24'],
      priority: 3,
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

## Properties Reference

### WafProps

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No | Name for the Web ACL |
| `stack` | `object` | Yes | Stack reference with id and tags |
| `scope` | `'CLOUDFRONT' \| 'REGIONAL'` | No | Scope of the Web ACL (auto-detected from region if not provided) |
| `defaultAction` | `'ALLOW' \| 'BLOCK'` | No | Default action (default: 'ALLOW') |
| `enableManagedRules` | `boolean` | No | Enable AWS Managed Rules |
| `managedRules` | `ManagedRuleConfig[]` | No | Custom managed rules |
| `rateLimit` | `RateLimitConfig` | No | Rate limiting configuration |
| `ipSets` | `IPSetConfig[]` | No | IP allow/block lists |
| `geoBlock` | `GeoBlockConfig` | No | Geographic blocking |

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
