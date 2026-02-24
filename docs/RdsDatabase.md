# RdsDatabase Construct

CDK construct for creating Amazon Aurora Serverless v2 databases.

## Features

- Aurora Serverless v2 (MySQL/PostgreSQL)
- Automatic credentials management (Secrets Manager)
- Multi-AZ support
- Deletion protection
- Automated backups
- Storage encryption
- VPC isolation

## Basic Usage

```typescript
import { RdsDatabase, Vpc } from '@designofadecade/cdk-constructs';

const vpc = new Vpc(this, 'MyVpc', {
  name: 'my-vpc',
  stack: { id: 'my-app', tags: [] },
});

const db = new RdsDatabase(this, 'Database', {
  name: 'my-database',
  vpc: vpc.vpc,
  engine: 'postgres', // or 'mysql'
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### RdsDatabaseProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Database cluster name |
| `vpc` | `IVpc` | Required | VPC to deploy in |
| `engine` | `'postgres' \| 'mysql'` | Required | Database engine |
| `stack` | `object` | Required | Stack ID and tags |
| `readers` | `number` | 0 | Number of reader instances |
| `minCapacity` | `number` | 0.5 | Minimum ACU |
| `maxCapacity` | `number` | 1 | Maximum ACU |

## Getters

- `cluster` - Database cluster
- `clusterIdentifier` - Cluster identifier
- `endpoint` - Cluster endpoint
- `secret` - Secrets Manager secret with credentials

## Best Practices

1. **Use Aurora Serverless v2** for variable workloads
2. **Enable deletion protection** in production (default)
3. **Store credentials in Secrets Manager** (default)
4. **Use reader instances** for read-heavy workloads
5. **Set appropriate ACU limits** based on workload
6. **Enable automated backups** with 7+ day retention
7. **Use VPC isolation** (required by construct)
8. **Enable encryption** at rest and in transit (default)
9. **Monitor Aurora metrics** (connections, CPU, storage)

## ACU Sizing

Aurora Capacity Units (ACU) determine compute/memory:

- **0.5 ACU** - 1 GB RAM, suitable for dev/test
- **1 ACU** - 2 GB RAM, small production workloads
- **2-4 ACU** - Medium workloads
- **8-16 ACU** - Large workloads
- **Max 128 ACU** per instance

## Related Constructs

- [Vpc](./Vpc.md) - VPC configuration
- [Secrets](./Secrets.md) - Secrets management
- [Function](./Function.md) - Lambda functions accessing database
