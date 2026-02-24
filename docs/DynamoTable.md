# DynamoTable Construct

CDK construct for creating DynamoDB tables with best practices.

## Features

- On-demand billing mode
- Point-in-time recovery enabled
- Deletion protection
- Global secondary indexes
- Encryption at rest (AWS managed)
- Stream support

## Basic Usage

```typescript
import { DynamoTable } from '@designofadecade/cdk-constructs';

const table = new DynamoTable(this, 'UsersTable', {
  name: 'users',
  partitionKey: { name: 'userId', type: 'S' },
  sortKey: { name: 'createdAt', type: 'N' },
  stack: { id: 'my-app', tags: [] },
});
```

## Properties

### DynamoTableProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Table name |
| `partitionKey` | `Attribute` | Required | Partition key |
| `sortKey` | `Attribute` | - | Sort key |
| `stack` | `object` | Required | Stack ID and tags |
| `gsi` | `GlobalSecondaryIndex[]` | - | Global secondary indexes |
| `stream` | `boolean` | false | Enable DynamoDB Streams |

## Getters

- `table` - DynamoDB Table
- `tableName` - Table name
- `tableArn` - Table ARN

## Best Practices

1. **Use on-demand billing** for unpredictable traffic (default)
2. **Enable point-in-time recovery** for data protection (default)
3. **Enable deletion protection** in production (default)
4. **Design partition keys** for even distribution
5. **Use sparse indexes** to save costs on GSIs
6. **Enable streams** only when needed (Lambda triggers, replication)
7. **Use DynamoDB Transactions** for ACID requirements
8. **Monitor read/write capacity** metrics

## Related Constructs

- [Function](./Function.md) - Lambda functions accessing DynamoDB
