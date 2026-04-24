import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { S3Bucket } from './S3Bucket.js';

describe('S3Bucket', () => {
    it('imports an existing bucket by name without creating a new bucket resource', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const imported = S3Bucket.fromBucketName(stack, 'ImportedBucket', 'existing-bucket-name');

        expect(imported.bucketName).toBe('existing-bucket-name');

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::S3::Bucket', 0);
    });

    it('imports an existing bucket by ARN without creating a new bucket resource', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const imported = S3Bucket.fromBucketArn(stack, 'ImportedBucketByArn', 'arn:aws:s3:::existing-bucket-name');

        expect(imported.bucketArn).toBe('arn:aws:s3:::existing-bucket-name');

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::S3::Bucket', 0);
    });

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

    it('configures object ownership controls when specified', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new S3Bucket(stack, 'TestBucket', {
            name: 'test-bucket',
            stack: { id: 'test', tags: [] },
            objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::S3::Bucket', {
            OwnershipControls: {
                Rules: [
                    {
                        ObjectOwnership: 'BucketOwnerPreferred',
                    },
                ],
            },
        });
    });

    it('does not configure object ownership controls when not specified', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new S3Bucket(stack, 'TestBucket', {
            name: 'test-bucket',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        const buckets = template.findResources('AWS::S3::Bucket');
        const bucketProps = Object.values(buckets)[0].Properties;

        expect(bucketProps.OwnershipControls).toBeUndefined();
    });
});
