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
| `restrictDefaultNacl` | `boolean` | **false** | Replace the default NACL with custom secure NACLs for all subnets. Perfect for API Gateway + Lambda. Allows Lambda to call external APIs while blocking incoming internet access. |
| `defaultNaclAllowedPorts` | `number[]` | - | Open specific ports from internet on public subnets (e.g., [80, 443] for ALB). Only use with restrictDefaultNacl if you need public services. NOT needed for API Gateway + Lambda. |
| `allowedPorts` | `number[]` | - | Specific TCP ports to allow for restrictPrivateSubnetNacls (e.g., [80, 443]). If not specified, all ports from VPC CIDR are allowed |
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

### Lock Down the Default NACL (API Gateway + Lambda Architecture)

AWS automatically creates a **default Network ACL** for every VPC that allows all traffic (0.0.0.0/0). Any subnet not explicitly associated with a custom NACL will use this permissive default.

#### The Replacement Strategy

Instead of trying to modify the default NACL (which causes conflicts), `restrictDefaultNacl` creates **new custom NACLs** for all subnet types and associates them with your subnets. This automatically **detaches the default NACL**, leaving it with 0 subnet associations (no security risk).

**Benefits:**
- ✅ **No conflicts** - Each new NACL starts with implicit deny-all  
- ✅ **Default NACL remains** - With 0 subnets (security scanners ignore it)
- ✅ **Explicit control** - You define exactly what traffic is allowed
- ✅ **Auditable** - Clear custom NACLs visible in AWS console

#### For API Gateway + Lambda (Everything in Private Subnets)

When your architecture uses API Gateway with Lambda functions in private subnets:

```typescript
const vpc = new Vpc(this, 'ApiGatewayVpc', {
  name: 'api-gateway-vpc',
  maxAzs: 2,
  natGateways: 0, // No NAT needed with VPC endpoints
  endpoints: ['s3', 'secrets-manager'], // Use VPC endpoints
  restrictDefaultNacl: true, // ✅ Block all incoming traffic from internet
  stack: { id: 'my-app', tags: [] },
});
```

**What this does:**
- ✅ **Creates 3 custom NACLs** - One each for public, private-egress, and isolated subnets
- ✅ **Detaches default NACL** - Automatically happens when custom NACLs are associated
- ✅ **Blocks ALL incoming traffic** from internet (0.0.0.0/0) - no one can connect in
- ✅ **Allows all VPC internal traffic** - Lambda ↔ RDS, Lambda ↔ Lambda works fine
- ✅ **Allows Lambda to call external APIs** - Stripe, SendGrid, etc. work perfectly
- ✅ **Allows return traffic** - Ephemeral ports (1024-65535) allow responses back

**How it works:**
```
Internet → API Gateway (managed, outside VPC) → Lambda (private subnet)
                                                    ↓
                                            External API (Stripe, etc.)
                                                    ↓
                                            Response comes back via ephemeral ports ✅
```

**Traffic Flow:**
```
Inbound:
  - VPC CIDR (e.g., 10.0.0.0/16) → ALLOW (all ports)
  - Internet ephemeral (1024-65535) → ALLOW (return traffic only)
  - Internet standard ports (1-1023) → DENY (blocked!)

Outbound:
  - All traffic → ALLOW (Lambda can call any external API)
```

**What happens to the default NACL?**
- It remains in your AWS account (AWS doesn't allow deletion of default NACLs)
- It shows "Associated with **0 Subnets**" in the console
- Security scanners ignore it since it's not attached to any traffic
- No security risk - all your subnets use the custom NACLs instead

#### If You Need Public Services (Load Balancers)

Only use `defaultNaclAllowedPorts` if you have **public-facing** services like load balancers. This opens specific ports on the **public subnet custom NACL**:

```typescript
const vpc = new Vpc(this, 'WebVpc', {
  name: 'web-vpc',
  maxAzs: 2,
  restrictDefaultNacl: true, // ✅ Create custom NACLs for all subnets
  defaultNaclAllowedPorts: [80, 443], // ⚠️ Opens ports from internet (on public NACL)
  stack: { id: 'my-app', tags: [] },
});
```

**⚠️ WARNING**: Only use `defaultNaclAllowedPorts` if you need:
- Application Load Balancer accepting internet traffic
- Public EC2 instances
- Other internet-facing services

**For API Gateway + Lambda**: **DO NOT** set `defaultNaclAllowedPorts` - you don't need it!

#### Defense-in-Depth with Custom NACLs

Combine default NACL restriction with custom NACLs for maximum security:

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
