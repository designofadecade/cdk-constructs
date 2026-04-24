import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Backup } from './Backup.js';

describe('Backup', () => {
    it('creates backup plan and selection', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'Bucket');

        const backup = new Backup(stack, 'Backup', {
            name: 'test-app',
            resourceArns: [bucket.bucketArn],
            stack: { id: 'test', tags: [] },
        });

        expect(backup.plan).toBeDefined();

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Backup::BackupPlan', 1);
        template.resourceCountIs('AWS::Backup::BackupSelection', 1);
        template.hasResourceProperties('AWS::Backup::BackupSelection', {
            BackupSelection: Match.objectLike({
                SelectionName: 'test-app-backup-selection',
            }),
        });
    });

    it('supports custom retention and continuous backup flag', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'Bucket');

        new Backup(stack, 'Backup', {
            name: 'test-app',
            resourceArns: [bucket.bucketArn],
            enableContinuousBackup: false,
            deleteAfterDays: 10,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Backup::BackupPlan', {
            BackupPlan: {
                BackupPlanRule: [
                    Match.objectLike({
                        EnableContinuousBackup: false,
                        Lifecycle: {
                            DeleteAfterDays: 10,
                        },
                    }),
                ],
            },
        });
    });
});
