import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DynamoTable } from './DynamoTable.js';

describe('DynamoTable', () => {
    it('creates a DynamoDB table with default partition key', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new DynamoTable(stack, 'TestTable', {
            name: 'test-table',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::DynamoDB::Table', {
            KeySchema: [
                {
                    AttributeName: 'id',
                    KeyType: 'HASH',
                },
            ],
        });
    });

    it('enables deletion protection', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new DynamoTable(stack, 'TestTable', {
            name: 'test-table',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::DynamoDB::Table', {
            DeletionProtectionEnabled: true,
        });
    });

    it('creates global secondary index when provided', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new DynamoTable(stack, 'TestTable', {
            name: 'test-table',
            stack: { id: 'test', tags: [] },
            gobalSecondaryIndexes: [
                {
                    name: 'StatusIndex',
                    partitionKey: 'status',
                    sortKey: 'createdAt',
                    attributes: ['userId', 'type'],
                },
            ],
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::DynamoDB::Table', {
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'StatusIndex',
                    KeySchema: [
                        {
                            AttributeName: 'status',
                            KeyType: 'HASH',
                        },
                        {
                            AttributeName: 'createdAt',
                            KeyType: 'RANGE',
                        },
                    ],
                    ProjectionType: 'INCLUDE',
                    NonKeyAttributes: ['userId', 'type'],
                },
            ],
        });
    });

    it('outputs table name', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new DynamoTable(stack, 'TestTable', {
            name: 'test-table',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasOutput('*', {
            Description: 'DynamoDB Table Name',
        });
    });

    it('exposes table property', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const dynamoTable = new DynamoTable(stack, 'TestTable', {
            name: 'test-table',
            stack: { id: 'test', tags: [] },
        });

        expect(dynamoTable.table).toBeDefined();
        expect(dynamoTable.tableName).toBe('test-table');
    });
});
