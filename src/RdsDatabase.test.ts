import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Vpc } from './Vpc.js';
import { RdsDatabase } from './RdsDatabase.js';

describe('RdsDatabase', () => {
    it('creates Aurora database cluster', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            stack: { id: 'test', tags: [] },
        });

        new RdsDatabase(stack, 'TestDatabase', {
            name: 'test-db',
            vpc: vpc.vpc,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::RDS::DBCluster', 1);
    });

    it('enables storage encryption', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            stack: { id: 'test', tags: [] },
        });

        new RdsDatabase(stack, 'TestDatabase', {
            name: 'test-db',
            vpc: vpc.vpc,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::RDS::DBCluster', {
            StorageEncrypted: true,
        });
    });

    it('creates security group', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            stack: { id: 'test', tags: [] },
        });

        new RdsDatabase(stack, 'TestDatabase', {
            name: 'test-db',
            vpc: vpc.vpc,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::EC2::SecurityGroup', 1); // RDS security group
    });

    it('generates credentials in Secrets Manager', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            stack: { id: 'test', tags: [] },
        });

        new RdsDatabase(stack, 'TestDatabase', {
            name: 'test-db',
            vpc: vpc.vpc,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::SecretsManager::Secret', 1);
    });

    it('enables deletion protection', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            stack: { id: 'test', tags: [] },
        });

        new RdsDatabase(stack, 'TestDatabase', {
            name: 'test-db',
            vpc: vpc.vpc,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::RDS::DBCluster', {
            DeletionProtection: true,
        });
    });

    it('creates reader instances when specified', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            stack: { id: 'test', tags: [] },
        });

        new RdsDatabase(stack, 'TestDatabase', {
            name: 'test-db',
            vpc: vpc.vpc,
            readers: 2,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        // Writer + 2 readers = 3 instances
        template.resourceCountIs('AWS::RDS::DBInstance', 3);
    });

    it('exposes cluster and security group', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc', {
            name: 'test-vpc',
            stack: { id: 'test', tags: [] },
        });

        const database = new RdsDatabase(stack, 'TestDatabase', {
            name: 'test-db',
            vpc: vpc.vpc,
            stack: { id: 'test', tags: [] },
        });

        expect(database.cluster).toBeDefined();
        expect(database.securityGroup).toBeDefined();
        expect(database.secret).toBeDefined();
    });
});
