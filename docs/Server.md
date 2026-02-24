# Server Construct

CDK construct for creating EC2 servers with optional Docker support.

## Features

- ARM64 or x86_64 architecture
- Docker pre-installed (optional)
- Elastic IP support
- Route53 DNS integration
- Automatic security group creation
- CloudWatch monitoring
- Session Manager support

## Basic Usage

```typescript
import { Server, Vpc } from '@designofadecade/cdk-constructs';

const vpc = new Vpc(this, 'MyVpc', {
  name: 'my-vpc',
  stack: { id: 'my-app', tags: [] },
});

const server = new Server(this, 'AppServer', {
  name: 'app-server',
  vpc: vpc.vpc,
  instanceType: 't4g.small',
  installDocker: true,
  elasticIp: true,
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### ServerProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Server name |
| `vpc` | `IVpc` | Required | VPC to deploy in |
| `instanceType` | `string` | Required | EC2 instance type |
| `stack` | `object` | Required | Stack ID and tags |
| `installDocker` | `boolean` | true | Install Docker |
| `elasticIp` | `boolean` | false | Associate elastic IP |
| `domainName` | `string` | - | Route53 domain name |
| `hostedZoneId` | `string` | - | Route53 hosted zone ID |

## Getters

- `instance` - EC2 Instance
- `securityGroup` - Security group
- `instanceId` - Instance ID
- `elasticIp` - Elastic IP (if configured)
- `privateIp` - Private IP address
- `publicIp` - Public IP address

## Best Practices

1. **Use ARM64 instances** (t4g, c7g) for cost savings
2. **Enable Session Manager** instead of SSH keys
3. **Use Elastic IP** for persistent public IP
4. **Set up CloudWatch logs** for monitoring
5. **Use Auto Scaling Groups** for high availability
6. **Implement backup strategy** for EBS volumes
7. **Use security groups** to restrict access
8. **Keep OS and packages updated**

## Instance Type Recommendations

### Development
- `t4g.micro` - 2 vCPU, 1 GB RAM
- `t4g.small` - 2 vCPU, 2 GB RAM

### Production
- `t4g.medium` - 2 vCPU, 4 GB RAM
- `c7g.large` - 2 vCPU, 4 GB RAM (compute optimized)
- `m7g.large` - 2 vCPU, 8 GB RAM (balanced)

## Docker Installation

When `installDocker: true`, the construct installs:
- Docker Engine
- Docker Compose
- Configures Docker to start on boot
- Adds ec2-user to docker group

## Related Constructs

- [Vpc](./Vpc.md) - VPC configuration
- [BastionHost](./BastionHost.md) - Bastion host for SSH access
