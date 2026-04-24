import { Construct } from 'constructs';
import { CfnOutput, Duration, Tags } from 'aws-cdk-lib';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue, QueueEncryption, type IQueue } from 'aws-cdk-lib/aws-sqs';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';

/**
 * Properties for configuring an SQS queue
 */
export interface SqsProps {
    /**
     * The name of the SQS queue
     */
    readonly name: string;

    /**
     * The stack reference containing tags
     */
    readonly stack: {
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    };

    /**
     * Main queue retention period in days (default: 4)
     */
    readonly retentionDays?: number;

    /**
     * Dead-letter queue retention period in days (default: 14)
     */
    readonly deadLetterRetentionDays?: number;

    /**
     * Queue visibility timeout in seconds for both queues (default: 120)
     */
    readonly visibilityTimeoutSeconds?: number;

    /**
     * Maximum receive attempts before moving message to DLQ (default: 3)
     */
    readonly maxReceiveCount?: number;
}

/**
 * A CDK construct that creates an SQS queue with a dead-letter queue
 * 
 * Features:
 * - Main queue with 4-day retention
 * - Dead-letter queue with 14-day retention
 * - SQS-managed encryption
 * - SSL enforcement
 * - 3 max receive attempts before moving to DLQ
 * - Helper methods for Lambda integration
 * 
 * @example
 * ```typescript
 * const queue = new Sqs(this, 'ProcessingQueue', {
 *   name: 'my-app-processing',
 *   stack: { tags: [] },
 * });
 * 
 * // Add Lambda as event source (consumer)
 * queue.addEventSource(myProcessorFunction);
 * 
 * // Grant send message permissions
 * queue.grantSendMessages(myProducerFunction);
 * ```
 */
export class Sqs extends Construct {
    #queue: IQueue;
    #deadLetterQueue: IQueue;

    constructor(scope: Construct, id: string, props: SqsProps) {
        super(scope, id);

        this.#deadLetterQueue = new Queue(this, 'QueueDeadLetter', {
            queueName: `${props.name}-deadletter`,
            retentionPeriod: Duration.days(props.deadLetterRetentionDays ?? 14),
            visibilityTimeout: Duration.seconds(props.visibilityTimeoutSeconds ?? 120),
            encryption: QueueEncryption.SQS_MANAGED,
            enforceSSL: true,
        });

        this.#queue = new Queue(this, 'Queue', {
            queueName: props.name,
            retentionPeriod: Duration.days(props.retentionDays ?? 4),
            visibilityTimeout: Duration.seconds(props.visibilityTimeoutSeconds ?? 120),
            encryption: QueueEncryption.SQS_MANAGED,
            enforceSSL: true,
            deadLetterQueue: {
                maxReceiveCount: props.maxReceiveCount ?? 3,
                queue: this.#deadLetterQueue,
            },
        });

        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#deadLetterQueue).add(key, value);
            Tags.of(this.#queue).add(key, value);
        });

        new CfnOutput(this, 'QueueUrl', {
            value: this.#queue.queueUrl,
            description: 'SQS Queue URL',
            exportName: `${props.name}-queue-url`,
        });
    }

    /**
     * Gets the main SQS queue
     */
    get queue(): IQueue {
        return this.#queue;
    }

    /**
     * Gets the dead-letter queue
     */
    get deadLetterQueue(): IQueue {
        return this.#deadLetterQueue;
    }

    /**
     * Gets the queue URL
     */
    get queueUrl(): string {
        return this.#queue.queueUrl;
    }

    /**
     * Gets the queue ARN
     */
    get queueArn(): string {
        return this.#queue.queueArn;
    }

    /**
     * Adds a Lambda function as an event source for this queue
     * 
     * This configures the Lambda to:
     * - Poll messages from the queue
     * - Report batch item failures
     * - Have send and consume permissions
     * 
     * @param fnc - The Lambda function to process messages from the queue
     */
    addEventSource(fnc: IFunction): void {
        this.#queue.grantSendMessages(fnc);
        this.#queue.grantConsumeMessages(fnc);

        fnc.addEventSource(
            new SqsEventSource(this.#queue, {
                enabled: true,
                reportBatchItemFailures: true,
            }),
        );
    }

    /**
     * Grants permission to send messages to the queue
     * 
     * @param fnc - The Lambda function to grant send permissions to
     */
    grantSendMessages(fnc: IFunction): void {
        this.#queue.grantSendMessages(fnc);
    }
}
