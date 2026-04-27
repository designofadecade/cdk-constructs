# RdsDatabase Construct

CDK construct for creating Amazon Aurora database clusters with support for both provisioned and serverless v2 instances.

## Features

- Aurora PostgreSQL or MySQL support
- Both provisioned and serverless v2 instance types
- Automatic credentials management (Secrets Manager)
- Deployed in private isolated subnets
- Multi-AZ support with reader instances
- Deletion protection enabled
- Automated backups (7-day retention default)
- Storage encryption enabled
- Restore from snapshot support
- VPC isolation

## Basic Usage

### Serverless v2 Instance

```typescript
import { RdsDatabase, Vpc } from '@designofadecade/cdk-constructs';
import { DatabaseClusterEngine, AuroraMysqlEngineVersion } from 'aws-cdk-lib/aws-rds';

const vpc = new Vpc(this, 'MyVpc', {
  name: 'my-vpc',
  stack: { id: 'my-app', tags: [] },
});

const db = new RdsDatabase(this, 'Database', {
  name: 'my-database',
  vpc: vpc.vpc,
  databaseName: 'appdata',
  serverlessV2MinCapacity: 0.5,
  serverlessV2MaxCapacity: 4,
  readers: 1,
  engine: DatabaseClusterEngine.auroraMysql({
    version: AuroraMysqlEngineVersion.VER_3_12_0,
  }),
  stack: { id: 'my-app', tags: [] },
});
```

### Provisioned Instance

```typescript
const db = new RdsDatabase(this, 'Database', {
  name: 'my-database',
  vpc: vpc.vpc,
  databaseName: 'appdata',
  instanceClass: RdsDatabase.InstanceClass.BURSTABLE4_GRAVITON,
  instanceSize: RdsDatabase.InstanceSize.MEDIUM,
  readers: 2,
  stack: { id: 'my-app', tags: [] },
});
```

### Restore from Snapshot

```typescript
const db = new RdsDatabase(this, 'Database', {
  name: 'my-database',
  vpc: vpc.vpc,
  snapshotIdentifier: 'my-snapshot-id',
  username: 'admin',
  serverlessV2MinCapacity: 0.5,
  serverlessV2MaxCapacity: 2,
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### RdsDatabaseProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Database cluster name |
| `vpc` | `IVpc` | Required | VPC to deploy in |
| `stack` | `object` | Required | Stack ID and tags |
| `engine` | `IClusterEngine` | Aurora PostgreSQL 17.6 | Database engine |
| `databaseName` | `string` | `'postgres'` | Default database name |
| `username` | `string` | `'{name}_admin'` | Master username |
| `secretName` | `string` | `'{name}-rds-credentials'` | Secret name for credentials |
| `instanceClass` | `InstanceClass` | `BURSTABLE4_GRAVITON` | Instance class (provisioned only) |
| `instanceSize` | `InstanceSize` | `SMALL` | Instance size (provisioned only) |
| `serverlessV2MinCapacity` | `number` | - | Min ACU (enables serverless v2) |
| `serverlessV2MaxCapacity` | `number` | - | Max ACU (enables serverless v2) |
| `readers` | `number` | - | Number of reader instances |
| `ingressSecurityGroups` | `ISecurityGroup[]` | - | Security groups with database access |
| `backupRetentionDays` | `number` | `7` | Backup retention (1-35 days) |
| `snapshotIdentifier` | `string` | - | Snapshot to restore from |

## Getters

- `cluster` - Database cluster instance
- `secret` - Secrets Manager secret with credentials
- `secretArn` - ARN of the credentials secret
- `clusterEndpoint` - Cluster endpoint for connections
- `securityGroup` - Database security group

## Methods

### addSecurityGroupIngressRule()

Adds an ingress rule to allow a security group to access the database.

```typescript
db.addSecurityGroupIngressRule(lambdaSecurityGroup);
db.addSecurityGroupIngressRule(bastionSecurityGroup);
```

## Static Helpers

### RdsDatabase.InstanceSize

Re-export of AWS CDK `InstanceSize` enum for convenience:

```typescript
RdsDatabase.InstanceSize.SMALL
RdsDatabase.InstanceSize.MEDIUM
RdsDatabase.InstanceSize.LARGE
RdsDatabase.InstanceSize.XLARGE
```

### RdsDatabase.InstanceClass

Re-export of AWS CDK `InstanceClass` enum for convenience:

```typescript
RdsDatabase.InstanceClass.BURSTABLE4_GRAVITON  // T4g (ARM)
RdsDatabase.InstanceClass.MEMORY5_GRAVITON     // R5g (ARM)
RdsDatabase.InstanceClass.BURSTABLE3           // T3 (x86)
```

### RdsDatabase.AuroraPostgresEngine()

Helper method to create an Aurora PostgreSQL engine configuration:

```typescript
const engine = RdsDatabase.AuroraPostgresEngine(
  AuroraPostgresEngineVersion.VER_16_6
);
```

## Provisioned vs Serverless v2

### Provisioned Instances

- **When to use**: Predictable, steady workloads
- **Configuration**: Set `instanceClass` and `instanceSize`
- **Pricing**: Pay for provisioned capacity 24/7
- **Scaling**: Manual resizing required

```typescript
const db = new RdsDatabase(this, 'Database', {
  name: 'my-db',
  vpc: myVpc,
  instanceClass: RdsDatabase.InstanceClass.MEMORY5_GRAVITON,
  instanceSize: RdsDatabase.InstanceSize.LARGE,
  readers: 1,
  stack: { id: 'my-app', tags: [] },
});
```

### Serverless v2 Instances

- **When to use**: Variable workloads with spiky traffic
- **Configuration**: Set `serverlessV2MinCapacity` and `serverlessV2MaxCapacity`
- **Pricing**: Pay per ACU-second consumed
- **Scaling**: Automatic scaling within capacity range

```typescript
const db = new RdsDatabase(this, 'Database', {
  name: 'my-db',
  vpc: myVpc,
  serverlessV2MinCapacity: 0.5,
  serverlessV2MaxCapacity: 16,
  readers: 1,
  stack: { id: 'my-app', tags: [] },
});
```

## ACU Sizing (Serverless v2)

Aurora Capacity Units (ACU) determine compute/memory:

- **0.5 ACU** - 1 GB RAM, suitable for dev/test
- **1 ACU** - 2 GB RAM, small production workloads
- **2-4 ACU** - Medium workloads
- **8-16 ACU** - Large workloads  
- **32-64 ACU** - Very large workloads
- **Max 128 ACU** per instance

## Best Practices

1. **Choose the right instance type** based on workload characteristics
   - Provisioned for steady workloads
   - Serverless v2 for variable/spiky workloads

2. **Enable deletion protection** in production (default)

3. **Store credentials in Secrets Manager** (default)

4. **Use reader instances** for read-heavy workloads
   - Scale reads horizontally
   - Offload reporting queries from writer

5. **Set appropriate capacity** based on workload
   - Provisioned: Choose right instance class/size
   - Serverless: Set realistic min/max ACU range

6. **Enable automated backups** with 7+ day retention (default: 7)

7. **Use VPC isolation** in private subnets (default)

8. **Enable encryption** at rest (default)

9. **Monitor Aurora metrics**
   - Connections
   - CPU utilization
   - Storage usage
   - ACU utilization (serverless)

10. **Configure security group access** carefully
    ```typescript
    const db = new RdsDatabase(this, 'Database', {
      // ...
      ingressSecurityGroups: [lambdaSG, ecsSG],
    });
    
    // Or add later
    db.addSecurityGroupIngressRule(bastionSG);
    ```

## Related Constructs

- [Vpc](./Vpc.md) - VPC configuration
- [Secrets](./Secrets.md) - Secrets management
- [Function](./Function.md) - Lambda functions accessing database
- [BastionHost](./BastionHost.md) - Bastion for database access
