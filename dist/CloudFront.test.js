import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CloudFront } from '../src/CloudFront.js';
describe('CloudFront', () => {
    it('creates CloudFront distribution', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'TestBucket');
        new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.S3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });
        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });
    it('creates distribution with custom domain', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1' } });
        const certificate = Certificate.fromCertificateArn(stack, 'Cert', 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012');
        const bucket = new Bucket(stack, 'TestBucket');
        new CloudFront(stack, 'TestDistribution', {
            domain: {
                names: ['example.com', 'www.example.com'],
                certificate,
            },
            defaultBehavior: {
                origin: CloudFront.S3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });
        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: {
                Aliases: ['example.com', 'www.example.com'],
            },
        });
    });
    it('adds S3 bucket origin', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'TestBucket');
        const bucket2 = new Bucket(stack, 'TestBucket2');
        const cloudfront = new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.S3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });
        cloudfront.addBehavior('/api/*', CloudFront.S3BucketOrigin('api', bucket2));
        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: {
                CacheBehaviors: Match.arrayWith([
                    Match.objectLike({
                        PathPattern: '/api/*',
                    }),
                ]),
            },
        });
    });
    it('enables HTTP/2 and HTTP/3', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'TestBucket');
        new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.S3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });
        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: {
                HttpVersion: 'http2and3',
            },
        });
    });
    it('applies security headers by default', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'TestBucket');
        new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.S3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });
        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::CloudFront::ResponseHeadersPolicy', 1);
    });
    it('exposes distribution property', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'TestBucket');
        const cloudfront = new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.S3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });
        expect(cloudfront.distribution).toBeDefined();
        expect(cloudfront.distributionId).toBeDefined();
        expect(cloudfront.distributionDomainName).toBeDefined();
    });
});
