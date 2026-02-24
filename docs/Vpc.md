# Vpc Construct

CDK construct for creating AWS VPCs with public and private subnets.

## Features

- Public and private subnets across multiple AZs
- NAT Gateway for private subnet internet access
- Flow logs enabled
- IPv4 CIDR configuration
- Route table management

## Basic Usage

```typescript
import { Vpc } from '@designofadecade/cdk-constructs';

const vpc = new Vpc(this, 'MyVpc', {
  name: 'my-vpc',
  cidr: '10.0.0.0/16',
  maxAzs: 2,
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### VpcProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | VPC name |
| `cidr` | `string` | '10.0.0.0/16' | IPv4 CIDR block |
| `maxAzs` | `number` | 2 | Maximum availability zones |
| `stack` | `object` | Required | Stack ID and tags |
| `enableFlowLogs` | `boolean` | true | Enable VPC flow logs |

## Getters

- `vpc` - VPC instance
- `vpcId` - VPC ID
- `publicSubnets` - Public subnet IDs
- `privateSubnets` - Private subnet IDs

## Best Practices

1. **Use multiple AZs** for high availability (default: 2)
2. **Enable flow logs** for security monitoring (default)
3. **Use private subnets** for databases and application servers
4. **Use public subnets** only for load balancers and NAT gateways
5. **Plan CIDR blocks** to avoid conflicts with other VPCs
6. **Use VPC peering** for inter-VPC communication
7. **Enable VPC endpoints** for AWS services (S3, DynamoDB)
8. **Consider NAT Gateway costs** - $0.045/hour per AZ

## CIDR Planning

Common CIDR blocks:
- `/16` (65,536 IPs) - Large applications
- `/20` (4,096 IPs) - Medium applications
- `/24` (256 IPs) - Small applications

Reserved IPs per subnet:
- First 4 IPs: AWS reserved
- Last IP: Broadcast
- Usable: Total - 5

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
