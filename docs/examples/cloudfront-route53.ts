/**
 * Example: Adding Route 53 DNS records to CloudFront distribution
 * 
 * This example demonstrates how to use the addRoute53Records() helper
 * to easily create both A and AAAA records pointing to a CloudFront distribution.
 */

import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { CloudFront, S3Bucket } from '@designofadecade/cdk-constructs';

export class CloudFrontRoute53Stack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Create S3 bucket for content
        const websiteBucket = new S3Bucket(this, 'WebsiteBucket', {
            name: 'website-content',
            stack: { id: 'my-app', tags: [] },
        });

        // Import existing hosted zone
        const hostedZone = HostedZone.fromLookup(this, 'Zone', {
            domainName: 'example.com',
        });

        // Import existing certificate
        const certificate = Certificate.fromCertificateArn(
            this,
            'Certificate',
            'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012'
        );

        // Create CloudFront distribution
        const distribution = new CloudFront(this, 'Distribution', {
            name: 'my-website',
            domain: {
                names: ['example.com', 'www.example.com'],
                certificate,
            },
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('main', websiteBucket.bucket),
            },
            stack: { 
                id: 'my-app',
                tags: [{ key: 'Environment', value: 'Production' }],
            },
        });

        // Add DNS records for the domain
        // This creates both A and AAAA records for each domain
        distribution.addRoute53Records(hostedZone, [
            'example.com',
            'www.example.com',
        ]);

        // You can also add individual records
        distribution.addRoute53Records(hostedZone, 'cdn.example.com');
    }
}

/**
 * Example: Multi-language site with separate domains
 */
export class MultiLanguageSiteStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const contentBucket = new S3Bucket(this, 'ContentBucket', {
            name: 'multilang-content',
            stack: { id: 'multilang-site', tags: [] },
        });

        const stagingZone = HostedZone.fromLookup(this, 'StagingZone', {
            domainName: 'staging.example.com',
        });

        const productionZone = HostedZone.fromLookup(this, 'ProductionZone', {
            domainName: 'example.com',
        });

        const certificate = Certificate.fromCertificateArn(
            this,
            'Certificate',
            'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012'
        );

        // Create CloudFront distribution
        const distribution = new CloudFront(this, 'Distribution', {
            name: 'multilang-site',
            domain: {
                names: [
                    'en.example.com',
                    'fr.example.com',
                    'en.staging.example.com',
                    'fr.staging.example.com',
                ],
                certificate,
            },
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('main', contentBucket.bucket),
            },
            stack: { 
                id: 'multilang-site',
                tags: [],
            },
        });

        // Add production DNS records
        distribution.addRoute53Records(productionZone, [
            'en.example.com',
            'fr.example.com',
        ]);

        // Add staging DNS records
        distribution.addRoute53Records(stagingZone, [
            'en.staging.example.com',
            'fr.staging.example.com',
        ]);
    }
}

/**
 * Example: Using automatic DNS configuration
 */
export class AutoDnsStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const bucket = new S3Bucket(this, 'Bucket', {
            name: 'website-content',
            stack: { id: 'my-app', tags: [] },
        });

        const hostedZone = HostedZone.fromLookup(this, 'Zone', {
            domainName: 'example.com',
        });

        const certificate = Certificate.fromCertificateArn(
            this,
            'Certificate',
            'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012'
        );

        // DNS records are automatically created when using domain.dns
        const distribution = new CloudFront(this, 'Distribution', {
            name: 'my-website',
            domain: {
                names: ['example.com', 'www.example.com'],
                certificate,
                dns: {
                    hostedZone,
                    records: ['example.com', 'www.example.com'],
                },
            },
            defaultBehavior: {
                origin: CloudFront.s3BucketOrigin('main', bucket.bucket),
            },
            stack: { id: 'my-app', tags: [] },
        });

        // Both A and AAAA records are automatically created for:
        // - example.com
        // - www.example.com
    }
}
