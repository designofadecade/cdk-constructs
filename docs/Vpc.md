# Vpc Construct

CDK construct for creating AWS VPCs with public and private subnets.

## Features

- Public and private subnets across multiple AZs
- Private isolated subnets for sensitive resources (databases)
- **Restrictive Network ACLs** for private subnets (enabled by default)
- NAT Gateway for private subnet internet access
- VPC Endpoints for AWS services (SQS, Secrets Manager, S3)
- IPv4 CIDR configuration
- Route table management

## Security

### Network ACL Protection (Opt-In)

**IMPORTANT**: Network ACL restrictions are **disabled by default** to maintain backward compatibility with existing deployments.

For **NEW VPCs**, enable restrictive Network ACLs that only allow traffic from within the VPC CIDR range:

```typescript
const vpc = new Vpc(this, 'SecureVpc', {
  name: 'secure-vpc',
  restrictPrivateSubnetNacls: true, // ✅ Enable for new VPCs
  stack: { id: 'my-app', tags: [] },
});
```

**Private Egress Subnets:**
- Inbound: Only from VPC CIDR
- Outbound: All traffic (for NAT Gateway, VPC endpoints)

**Private Isolated Subnets:**
- Inbound: Only from VPC CIDR
- Outbound: Only to VPC CIDR (fully isolated)

This provides defense-in-depth security alongside security groups.

## Basic Usage

```typescript
import { Vpc } from '@designofadecade/cdk-constructs';

const vpc = new Vpc(this, 'MyVpc', {
  name: 'my-vpc',
  maxAzs: 2,
  natGateways: 0, // No NAT Gateway (use VPC endpoints instead)
  endpoints: ['s3', 'secrets-manager'], // VPC endpoints for common services
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### VpcProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | stack.id | VPC name |
| `maxAzs` | `number` | 2 | Maximum availability zones |
| `natGateways` | `number` | 0 | Number of NAT Gateways (0 = none, cost optimization) |
| `endpoints` | `VpcEndpointType[]` | - | VPC endpoints: 'sqs', 'secrets-manager', 's3' |
| `restrictPrivateSubnetNacls` | `boolean` | **false** | Enable restrictive NACLs (set `true` for new VPCs) |
| `restrictPublicSubnetNacls` | `boolean` | **false** | Block internet access to public subnets (use when everything is behind API Gateway) |
| `restrictDefaultNacl` | `boolean` | **false** | Lock down the default NACL to only allow VPC CIDR traffic (defense-in-depth) |
| `defaultNaclAllowedPorts` | `number[]` | - | Specific TCP ports to allow from internet on default NACL (e.g., [80, 443]). Only applies when restrictDefaultNacl is true |
| `allowedPorts` | `number[]` | - | Specific TCP ports to allow (e.g., [80, 443]). If not specified, all ports from VPC CIDR are allowed |
| `stack` | `object` | Required | Stack reference with id and tags |

## Getters

- `vpc` - The underlying CDK VPC instance
- `sqsEndpoint` - SQS VPC endpoint (if created)
- `secretsManagerEndpoint` - Secrets Manager VPC endpoint (if created)
- `s3Endpoint` - S3 VPC endpoint (if created)

## Best Practices

1. **Use multiple AZs** for high availability (default: 2)
2. **Enable Network ACL restrictions for NEW VPCs** (`restrictPrivateSubnetNacls: true`)
3. **Use private subnets** for databases and application servers
4. **Use public subnets** only for load balancers (if needed)
5. **Prefer VPC endpoints** over NAT Gateways for AWS service access
6. **Use isolated subnets** for databases that don't need internet access
7. **Plan CIDR blocks** to avoid conflicts with other VPCs
8. **Disable NAT Gateways** (natGateways: 0) if services are behind API Gateway

## Network ACL Configuration

### Enable for New VPCs (Recommended)

For enhanced security on NEW VPCs, enable restrictive NACLs:

```typescript
const vpc = new Vpc(this, 'SecureVpc', {
  name: 'secure-vpc',
  maxAzs: 2,
  restrictPrivateSubnetNacls: true, // ✅ Enable NACLs
  stack: { id: 'my-app', tags: [] },
});
```

### Default Behavior (Disabled)

By default, NACLs are **disabled** for backward compatibility:

```typescript
const vpc = new Vpc(this, 'Vpc', {
  name: 'my-vpc',
  maxAzs: 2,
  // restrictPrivateSubnetNacls: false (default)
  stack: { id: 'my-app', tags: [] },
});
```

### Restrict to Specific Ports (HTTP/HTTPS)

For even tighter security on NEW VPCs, allow only specific ports:

```typescript
const vpc = new Vpc(this, 'WebVpc', {
  name: 'web-vpc',
  maxAzs: 2,
  restrictPrivateSubnetNacls: true, // Enable NACLs
  allowedPorts: [80, 443], // Only allow HTTP and HTTPS
  stack: { id: 'my-app', tags: [] },
});
```

### Database-Only Access

For database-specific workloads:

```typescript
const vpc = new Vpc(this, 'DbVpc', {
  name: 'db-vpc',
  maxAzs: 2,
  restrictPrivateSubnetNacls: true, // Enable NACLs
  allowedPorts: [5432], // Only PostgreSQL
  stack: { id: 'my-app', tags: [] },
});
```

### Multiple Service Ports

Allow multiple specific services:

```typescript
const vpc = new Vpc(this, 'MultiVpc', {
  name: 'multi-vpc',
  maxAzs: 2,
  restrictPrivateSubnetNacls: true, // Enable NACLs
  allowedPorts: [80, 443, 5432, 6379], // HTTP, HTTPS, PostgreSQL, Redis
  stack: { id: 'my-app', tags: [] },
});
```

**Note:** When you specify `allowedPorts`, ephemeral ports (1024-65535) are automatically allowed for return traffic, as NACLs are stateless.

### Block Public Subnet Internet Access

When you don't need ANY public-facing resources (everything behind API Gateway):

```typescript
const vpc = new Vpc(this, 'FullyPrivateVpc', {
  name: 'fully-private-vpc',
  maxAzs: 2,
  restrictPublicSubnetNacls: true, // ✅ Block internet on public subnets
  restrictPrivateSubnetNacls: true, // ✅ Secure private subnets
  endpoints: ['s3', 'secrets-manager'],
  stack: { id: 'my-app', tags: [] },
});
```

**⚠️ WARNING**: Only enable `restrictPublicSubnetNacls: true` if you do NOT need:
- NAT Gateways (they require internet access)
- Application Load Balancers in public subnets
- Public-facing EC2 instances
- Internet Gateway access

### Lock Down the Default NACL (Defense-in-Depth)

AWS automatically creates a **default Network ACL** for every VPC that allows all traffic (0.0.0.0/0). Any subnet not explicitly associated with a custom NACL will use this permissive default.

For maximum security, lock down the default NACL to only allow VPC CIDR traffic:

```typescript
const vpc = new Vpc(this, 'SecureVpc', {
  name: 'secure-vpc',
  maxAzs: 2,
  restrictDefaultNacl: true, // ✅ Lock down the default NACL
  restrictPrivateSubnetNacls: true, // ✅ Custom NACLs for private subnets
  stack: { id: 'my-app', tags: [] },
});
```

**Why use this?**
- **Defense-in-depth**: Even if a subnet isn't associated with a custom NACL, it's still protected
- **Prevents misconfigurations**: Accidentally forgetting to apply a custom NACL won't expose resources
- **No performance impact**: NACL rules are evaluated once at the subnet boundary

**How it works:**
- Modifies the VPC's default NACL to allow traffic from VPC CIDR
- Allows ephemeral ports (1024-65535) from internet for response traffic (external API calls)
- Allows all outbound traffic (for calling external APIs)
- Custom NACLs (from `restrictPrivateSubnetNacls` or `restrictPublicSubnetNacls`) take precedence
- Subnets without custom NACLs automatically get restrictive rules via the default NACL

#### Allow Specific Ports from Internet on Default NACL

If you have a load balancer or public service using the default NACL, you can open specific ports:

```typescript
const vpc = new Vpc(this, 'WebVpc', {
  name: 'web-vpc',
  maxAzs: 2,
  restrictDefaultNacl: true, // ✅ Lock down the default NACL
  defaultNaclAllowedPorts: [80, 443], // ✅ Allow HTTP and HTTPS from internet
  stack: { id: 'my-app', tags: [] },
});
```

**This configuration:**
- **Inbound**: Allows ports 80 and 443 from internet (0.0.0.0/0)
- **Inbound**: Allows all traffic from VPC CIDR
- **Inbound**: Allows ephemeral ports (1024-65535) from internet for return traffic
- **Outbound**: Allows all traffic (for external API calls)

**Use cases:**
- Application Load Balancer in subnets using default NACL
- Public EC2 instances without custom NACLs
- Services that need specific internet-facing ports open

**Example with full defense-in-depth:**
```typescript
const vpc = new Vpc(this, 'MaxSecurityVpc', {
  name: 'max-security-vpc',
  maxAzs: 2,
  restrictDefaultNacl: true, // ✅ Fallback protection
  restrictPrivateSubnetNacls: true, // ✅ Private subnet NACLs
  restrictPublicSubnetNacls: true, // ✅ Public subnet NACLs (if needed)
  endpoints: ['s3', 'secrets-manager'],
  stack: { id: 'my-app', tags: [] },
});
```

### Disable NACL Restrictions

NACLs are disabled by default. To explicitly disable:

```typescript
const vpc = new Vpc(this, 'CustomVpc', {
  name: 'custom-vpc',
  maxAzs: 2,
  restrictPrivateSubnetNacls: false, // Explicitly disabled (default)
  stack: { id: 'my-app', tags: [] },
});
```

### Behind API Gateway Architecture

If all your services are behind API Gateway with no public access:

```typescript
const vpc = new Vpc(this, 'PrivateVpc', {
  name: 'private-vpc',
  maxAzs: 2,
  natGateways: 0, // No NAT Gateway needed
  endpoints: ['s3', 'secrets-manager', 'sqs'], // Use VPC endpoints
  restrictPrivateSubnetNacls: true, // ✅ Secure private subnets
  restrictPublicSubnetNacls: true,  // ✅ Block internet access to public subnets
  stack: { id: 'my-app', tags: [] },
});

// Your Lambdas behind API Gateway
const api = new HttpApi(this, 'Api', {
  functions: [{
    path: '/api',
    handler: myFunction,
    // Function runs in private subnet with full NACL protection
  }],
  stack: { id: 'my-app', tags: [] },
});
```

**Benefits:**
- API Gateway handles all public traffic (outside VPC)
- Lambda functions run in private subnets (secured)
- Public subnets blocked from internet (no attack surface)
- Private subnets only allow VPC internal traffic
- VPC endpoints for AWS services (no internet needed)

// Your Lambdas behind API Gateway
const api = new HttpApi(this, 'Api', {
  functions: [{
    path: '/api',
    handler: myFunction,
    // Function runs in private subnet with NACL protection
  }],
  stack: { id: 'my-app', tags: [] },
});
```

## CIDR Planning

Common CIDR blocks:
- `/16` (65,536 IPs) - Large applications
- `/20` (4,096 IPs) - Medium applications
- `/24` (256 IPs) - Small applications

Reserved IPs per subnet:
- First 4 IPs: AWS reserved
- Last IP: Broadcast
- Usable: Total - 5

## Security Architecture

### Network ACLs vs Security Groups

This construct implements **defense-in-depth** with both Network ACLs and Security Groups:

| Feature | Network ACLs | Security Groups |
|---------|--------------|-----------------|
| **Layer** | Subnet level | Instance/ENI level |
| **Stateless** | Yes (must configure inbound + outbound) | No (stateful) |
| **Rules** | Allow and Deny | Allow only |
| **Default** | Restrictive (VPC CIDR only) | Permissive (0.0.0.0/0) |
| **Use Case** | Broad subnet protection | Fine-grained resource control |

### Why Both?

**Network ACLs (Subnet-level):**
- First line of defense
- Prevents unauthorized traffic from reaching subnet
- Protects against misconfigured security groups
- Required for compliance (PCI-DSS, HIPAA)

**Security Groups (Resource-level):**
- Fine-grained control per resource
- Easier to manage for specific services
- Stateful (automatic return traffic)

### Example: Database Security

```typescript
const vpc = new Vpc(this, 'Vpc', {
  name: 'secure-vpc',
  restrictPrivateSubnetNacls: true, // NACL: Only VPC CIDR
  stack: { id: 'my-app', tags: [] },
});

const db = new RdsDatabase(this, 'Database', {
  vpc,
  // Security Group: Only allow specific Lambda security group
  allowConnectionsFrom: [lambdaSecurityGroup],
  stack: { id: 'my-app', tags: [] },
});
```

**Security layers:**
1. **NACL**: Only allows traffic from VPC CIDR (10.0.0.0/16)
2. **Security Group**: Only allows traffic from Lambda security group
3. **IAM**: Database credentials managed by Secrets Manager

## NAT Gateway Cost Optimization

NAT Gateways are expensive (~$32/month per AZ). Options:

### Development
```typescript
const vpc = new Vpc(this, 'DevVpc', {
  name: 'dev-vpc',
  maxAzs: 1, // Single AZ to save on NAT Gateway costs
  stack: { id: 'dev', tags: [] },
});
```

### Production
```typescript
const vpc = new Vpc(this, 'ProdVpc', {
  name: 'prod-vpc',
  maxAzs: 3, // Multi-AZ for high availability
  stack: { id: 'prod', tags: [] },
});
```

### Cost-Optimized
Consider:
- Using NAT instances instead of NAT Gateway
- Sharing NAT Gateway across multiple private subnets
- Using VPC endpoints for AWS services instead of NAT

## Related Constructs

- [Function](./Function.md) - Lambda in VPC
- [RdsDatabase](./RdsDatabase.md) - Database in VPC
- [BastionHost](./BastionHost.md) - SSH access to VPC
- [Server](./Server.md) - EC2 in VPC
