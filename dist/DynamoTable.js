import { Construct } from 'constructs';
import { Tags, CfnOutput } from 'aws-cdk-lib';
import { Table, AttributeType, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
/**
 * A CDK construct that creates a DynamoDB table with common configurations
 *
 * Features:
 * - Default partition key named 'id' (string type)
 * - Deletion protection enabled
 * - Support for Global Secondary Indexes
 * - Automatic tagging
 *
 * @example
 * ```typescript
 * const table = new DynamoTable(this, 'AppTable', {
 *   name: 'my-app-table',
 *   stack: { id: 'my-app', tags: [] },
 *   gobalSecondaryIndexes: [{
 *     name: 'StatusIndex',
 *     partitionKey: 'status',
 *     sortKey: 'createdAt',
 *     attributes: ['userId', 'type'],
 *   }],
 * });
 *
 * // Grant read/write access
 * table.grantReadWrite(myLambda);
 * ```
 */
export class DynamoTable extends Construct {
    #table;
    constructor(scope, id, props) {
        super(scope, id);
        this.#table = new Table(this, 'Table', {
            tableName: props.name ?? props.stack.id,
            partitionKey: {
                name: 'id',
                type: AttributeType.STRING,
            },
            deletionProtection: true,
        });
        if (props.gobalSecondaryIndexes) {
            props.gobalSecondaryIndexes.forEach((index) => {
                this.#table.addGlobalSecondaryIndex({
                    indexName: index.name,
                    nonKeyAttributes: [...index.attributes],
                    projectionType: ProjectionType.INCLUDE,
                    partitionKey: {
                        name: index.partitionKey,
                        type: AttributeType.STRING,
                    },
                    sortKey: {
                        name: index.sortKey,
                        type: AttributeType.STRING,
                    },
                });
            });
        }
        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#table).add(key, value);
        });
        new CfnOutput(this, 'TableName', {
            value: this.#table.tableName,
            description: 'DynamoDB Table Name',
            exportName: `${props.name ?? props.stack.id}-table-name`,
        });
    }
    /**
     * Gets the DynamoDB table instance
     */
    get table() {
        return this.#table;
    }
    /**
     * Gets the table name
     */
    get tableName() {
        return this.#table.tableName;
    }
    /**
     * Grants read and write permissions to the table
     *
     * @param principal - The IAM principal to grant permissions to
     */
    grantReadWrite(principal) {
        this.#table.grantReadWriteData(principal);
    }
}
