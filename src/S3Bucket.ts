import { Construct } from 'constructs';
import { RemovalPolicy, Duration, Tags, CfnOutput } from 'aws-cdk-lib';
import { Bucket, BlockPublicAccess, BucketEncryption, type IBucket } from 'aws-cdk-lib/aws-s3';
import type { IGrantable } from 'aws-cdk-lib/aws-iam';

/**
 * Properties for configuring an S3 bucket
 */
export interface S3BucketProps {
    /**
     * The name of the S3 bucket
     */
    readonly name: string;

    /**
     * The stack reference containing tags and ID
     */
    readonly stack: {
        readonly id: string;
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    };
}

/**
 * A CDK construct that creates a secure S3 bucket with common configurations
 * 
 * Features:
 * - Retention policy (RETAIN) - bucket is preserved on stack deletion
 * - Block all public access by default
 * - Automatic tagging
 * - Helper methods for granting permissions
 * - Support for lifecycle rules
 * 
 * @example
 * ```typescript
 * const bucket = new S3Bucket(this, 'DataBucket', {
 *   name: 'my-app-data',
 *   stack: { id: 'my-app', tags: [] },
 * });
 * 
 * // Grant read access to a Lambda function
 * bucket.grantRead(myFunction);
 * 
 * // Add expiration lifecycle rule
 * bucket.addExpirationLifecycleRule('DeleteOldFiles', 90, 'temp/');
 * ```
 */
export class S3Bucket extends Construct {
    #bucket: Bucket;

    constructor(scope: Construct, id: string, props: S3BucketProps) {
        super(scope, id);

        this.#bucket = new Bucket(this, id, {
            bucketName: props.name,
            removalPolicy: RemovalPolicy.RETAIN,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            publicReadAccess: false,
            encryption: BucketEncryption.S3_MANAGED,
        });

        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#bucket).add(key, value);
        });

        new CfnOutput(this, `${id}Name`, {
            value: this.#bucket.bucketName,
            description: 'S3 Bucket Name',
            exportName: `${props.stack.id}-${props.name}`,
        });
    }

    /**
     * Gets the S3 bucket instance
     */
    get bucket(): IBucket {
        return this.#bucket;
    }

    /**
     * Gets the bucket name
     */
    get bucketName(): string {
        return this.#bucket.bucketName;
    }

    /**
     * Grants read permissions to the bucket
     * 
     * @param principal - The IAM principal to grant permissions to
     * @param specificPrefix - Optional object key prefix to limit access to
     */
    grantRead(principal: IGrantable, specificPrefix?: string): void {
        this.#bucket.grantRead(principal, specificPrefix);
    }

    /**
     * Grants read and write permissions to the bucket
     * 
     * @param principal - The IAM principal to grant permissions to
     * @param specificPrefix - Optional object key prefix to limit access to
     */
    grantReadWrite(principal: IGrantable, specificPrefix?: string): void {
        this.#bucket.grantReadWrite(principal, specificPrefix);
    }

    /**
     * Adds a lifecycle rule to automatically expire objects after a specified number of days
     * 
     * @param ruleName - A unique name for the lifecycle rule
     * @param days - Number of days after which objects will be deleted (default: 1)
     * @param prefix - Optional prefix to apply the rule to specific objects only
     * 
     * @example
     * ```typescript
     * // Delete temporary files after 7 days
     * bucket.addExpirationLifecycleRule('TempFiles', 7, 'temp/');
     * ```
     */
    addExpirationLifecycleRule(ruleName: string, days = 1, prefix: string | null = null): void {
        this.#bucket.addLifecycleRule({
            id: ruleName,
            enabled: true,
            expiration: Duration.days(days),
            prefix: prefix ?? undefined,
        });
    }
}
