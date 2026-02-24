import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { S3Bucket } from './S3Bucket.js';

describe('S3Bucket', () => {
    it('creates an S3 bucket with encryption', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new S3Bucket(stack, 'TestBucket', {
            name: 'test-bucket',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::S3::Bucket', {
            BucketEncryption: {
                ServerSideEncryptionConfiguration: [
                    {
                        ServerSideEncryptionByDefault: {
                            SSEAlgorithm: 'AES256',
                        },
                    },
                ],
            },
        });
    });

    it('blocks public access', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new S3Bucket(stack, 'TestBucket', {
            name: 'test-bucket',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::S3::Bucket', {
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                BlockPublicPolicy: true,
                IgnorePublicAcls: true,
                RestrictPublicBuckets: true,
            },
        });
    });

    it('sets retention policy to RETAIN', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new S3Bucket(stack, 'TestBucket', {
            name: 'test-bucket',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResource('AWS::S3::Bucket', {
            DeletionPolicy: 'Retain',
            UpdateReplacePolicy: 'Retain',
        });
    });

    it('adds lifecycle rules when provided', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const bucket = new S3Bucket(stack, 'TestBucket', {
            name: 'test-bucket',
            stack: { id: 'test', tags: [] },
        });

        bucket.addExpirationLifecycleRule('DeleteOldFiles', 90);

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::S3::Bucket', {
            LifecycleConfiguration: {
                Rules: [
                    {
                        Id: 'DeleteOldFiles',
                        ExpirationInDays: 90,
                        Status: 'Enabled',
                    },
                ],
            },
        });
    });

    it('exposes bucket property', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const s3Bucket = new S3Bucket(stack, 'TestBucket', {
            name: 'test-bucket',
            stack: { id: 'test', tags: [] },
        });

        expect(s3Bucket.bucket).toBeDefined();
        expect(s3Bucket.bucketName).toBeDefined();
    });
});
