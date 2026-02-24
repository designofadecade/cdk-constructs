# BastionHost Construct

CDK construct for creating an EC2 bastion host for secure SSH access to private resources in a VPC.

## Features

- ARM64 architecture by default
- Automatic security group creation
- Session Manager support
- Public subnet placement
- CloudWatch monitoring enabled
- Instance profile with SSM permissions

## Basic Usage

```typescript
import { BastionHost, Vpc } from '@designofadecade/cdk-constructs';

const vpc = new Vpc(this, 'MyVpc', {
  name: 'my-vpc',
  stack: { id: 'my-app', tags: [] },
});

const bastion = new BastionHost(this, 'BastionHost', {
  name: 'bastion-host',
  vpc: vpc.vpc,
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### BastionHostProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Bastion host name |
| `vpc` | `IVpc` | Required | VPC to deploy in |
| `stack` | `object` | Required | Stack ID and tags |

## Getters

- `instance` - EC2 Instance
- `securityGroup` - Security group
- `instanceId` - Instance ID

## Best Practices

1. **Use Session Manager** instead of SSH keys when possible
2. **Restrict security group** to specific IP ranges
3. **Enable CloudWatch logs** for audit trail
4. **Use small instance types** (bastion doesn't need much compute)
5. **Consider AWS Systems Manager Session Manager** as alternative

## Related Constructs

- [Vpc](./Vpc.md) - VPC configuration
- [Server](./Server.md) - EC2 server with more features
