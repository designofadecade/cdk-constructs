import { Construct } from 'constructs';
import { type ITable } from 'aws-cdk-lib/aws-dynamodb';
import type { IGrantable } from 'aws-cdk-lib/aws-iam';
/**
 * Configuration for a DynamoDB Global Secondary Index
 */
export interface GlobalSecondaryIndexConfig {
    /**
     * The name of the index
     */
    readonly name: string;
    /**
     * The partition key attribute name for the index
     */
    readonly partitionKey: string;
    /**
     * The sort key attribute name for the index
     */
    readonly sortKey: string;
    /**
     * Non-key attributes to include in the index projection
     */
    readonly attributes: ReadonlyArray<string>;
}
/**
 * Properties for configuring a DynamoDB table
 */
export interface DynamoTableProps {
    /**
     * Optional table name. If not provided, uses the stack ID
     */
    readonly name?: string;
    /**
     * The stack reference containing tags and ID
     */
    readonly stack: {
        readonly id: string;
        readonly tags: ReadonlyArray<{
            readonly key: string;
            readonly value: string;
        }>;
    };
    /**
     * Optional Global Secondary Indexes to create on the table
     */
    readonly gobalSecondaryIndexes?: ReadonlyArray<GlobalSecondaryIndexConfig>;
}
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
export declare class DynamoTable extends Construct {
    #private;
    constructor(scope: Construct, id: string, props: DynamoTableProps);
    /**
     * Gets the DynamoDB table instance
     */
    get table(): ITable;
    /**
     * Gets the table name
     */
    get tableName(): string;
    /**
     * Grants read and write permissions to the table
     *
     * @param principal - The IAM principal to grant permissions to
     */
    grantReadWrite(principal: IGrantable): void;
}
