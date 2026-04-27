import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { CloudFront } from '../src/CloudFront.js';

describe('CloudFront', () => {
    it('creates CloudFront distribution', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'TestBucket');

        new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('origin', bucket),
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
                origin: CloudFront.s3BucketOrigin('origin', bucket),
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
                origin: CloudFront.s3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });

        cloudfront.addBehavior('/api/*', CloudFront.s3BucketOrigin('api', bucket2));

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
                origin: CloudFront.s3BucketOrigin('origin', bucket),
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
                origin: CloudFront.s3BucketOrigin('origin', bucket),
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
                origin: CloudFront.s3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });

        expect(cloudfront.distribution).toBeDefined();
        expect(cloudfront.distributionId).toBeDefined();
        expect(cloudfront.distributionDomainName).toBeDefined();
    });

    it('enables logging when configured', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'TestBucket');
        const logBucket = new Bucket(stack, 'LogBucket');

        new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('origin', bucket),
            },
            logging: {
                bucket: logBucket,
                prefix: 'cloudfront-logs/',
                includeCookies: true,
            },
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: {
                Logging: {
                    Bucket: Match.anyValue(),
                    Prefix: 'cloudfront-logs/',
                    IncludeCookies: true,
                },
            },
        });
    });

    it('disables logging when not configured', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'TestBucket');

        new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        const distribution = template.findResources('AWS::CloudFront::Distribution');
        const distributionConfig = Object.values(distribution)[0].Properties.DistributionConfig;
        expect(distributionConfig.Logging).toBeUndefined();
    });

    it('creates custom CloudFront function and assigns to behavior', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'TestBucket');
        const bucket2 = new Bucket(stack, 'TestBucket2');

        const customFunction = CloudFront.createFunction(
            stack,
            'ModerationBehaviorFunction',
            `function handler(event) {
                var request = event.request;
                var uri = request.uri;
                var prefix = '/m-7f3d9e2a8c4b';
                
                if (!uri.includes('/res/')) {
                    uri = uri.toLowerCase();
                    var relative = uri.startsWith(prefix) ? uri.slice(prefix.length) : uri;
                    
                    if (relative === '' || relative === '/') {
                        request.uri = prefix + '/index.html';
                    } else if (!relative.includes('.')) {
                        request.uri = prefix + '/' + relative.replace(/^\\//, '') + '.html';
                    } else {
                        request.uri = uri;
                    }
                }
                
                return request;
            }`
        );

        const cloudfront = new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });

        cloudfront.addBehavior('/m-*', CloudFront.s3BucketOrigin('moderation', bucket2), {
            functions: [customFunction],
        });

        const template = Template.fromStack(stack);

        // Verify CloudFront function was created
        template.resourceCountIs('AWS::CloudFront::Function', 1);

        // Verify behavior has function association
        template.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: {
                CacheBehaviors: Match.arrayWith([
                    Match.objectLike({
                        PathPattern: '/m-*',
                        FunctionAssociations: Match.arrayWith([
                            Match.objectLike({
                                EventType: 'viewer-request',
                            }),
                        ]),
                    }),
                ]),
            },
        });
    });

    it('creates custom CloudFront function with viewer-response event type', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'TestBucket');

        const customFunction = CloudFront.createFunction(
            stack,
            'ResponseFunction',
            `function handler(event) {
                var response = event.response;
                response.headers['x-custom-header'] = { value: 'custom-value' };
                return response;
            }`,
            'viewer-response' as any
        );

        const cloudfront = new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });

        cloudfront.addBehavior('/api/*', CloudFront.s3BucketOrigin('api', bucket), {
            functions: [customFunction],
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: {
                CacheBehaviors: Match.arrayWith([
                    Match.objectLike({
                        PathPattern: '/api/*',
                        FunctionAssociations: Match.arrayWith([
                            Match.objectLike({
                                EventType: 'viewer-response',
                            }),
                        ]),
                    }),
                ]),
            },
        });
    });

    it('adds Route53 A and AAAA records for single record name', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1', account: '123456789012' } });
        const bucket = new Bucket(stack, 'TestBucket');
        const hostedZone = new HostedZone(stack, 'HostedZone', {
            zoneName: 'example.com',
        });

        const cloudfront = new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });

        cloudfront.addRoute53Records(hostedZone, 'www.example.com');

        const template = Template.fromStack(stack);
        
        // Should create both A and AAAA records
        template.resourceCountIs('AWS::Route53::RecordSet', 2);
        
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            Type: 'A',
            Name: 'www.example.com.',
        });
        
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            Type: 'AAAA',
            Name: 'www.example.com.',
        });
    });

    it('adds Route53 A and AAAA records for multiple record names', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1', account: '123456789012' } });
        const bucket = new Bucket(stack, 'TestBucket');
        const hostedZone = new HostedZone(stack, 'HostedZone', {
            zoneName: 'example.com',
        });

        const cloudfront = new CloudFront(stack, 'TestDistribution', {
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });

        cloudfront.addRoute53Records(hostedZone, ['example.com', 'www.example.com']);

        const template = Template.fromStack(stack);
        
        // Should create 2 A records and 2 AAAA records (4 total)
        template.resourceCountIs('AWS::Route53::RecordSet', 4);
        
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            Type: 'A',
            Name: 'example.com.',
        });
        
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            Type: 'AAAA',
            Name: 'example.com.',
        });
        
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            Type: 'A',
            Name: 'www.example.com.',
        });
        
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            Type: 'AAAA',
            Name: 'www.example.com.',
        });
    });

    it('adds Route53 records via domain DNS configuration', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1', account: '123456789012' } });
        const certificate = Certificate.fromCertificateArn(stack, 'Cert', 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012');
        const bucket = new Bucket(stack, 'TestBucket');
        const hostedZone = new HostedZone(stack, 'HostedZone', {
            zoneName: 'example.com',
        });

        new CloudFront(stack, 'TestDistribution', {
            domain: {
                names: ['example.com'],
                certificate,
                dns: {
                    hostedZone,
                    records: ['example.com'],
                },
            },
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('origin', bucket),
            },
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        
        // Should automatically create both A and AAAA records
        template.resourceCountIs('AWS::Route53::RecordSet', 2);
        
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            Type: 'A',
            Name: 'example.com.',
        });
        
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            Type: 'AAAA',
            Name: 'example.com.',
        });
    });
});
