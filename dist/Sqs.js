import { Construct } from 'constructs';
import { CfnOutput, Duration, Tags } from 'aws-cdk-lib';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
/**
 * A CDK construct that creates an SQS queue with a dead-letter queue
 *
 * Features:
 * - Main queue with 4-day retention
 * - Dead-letter queue with 14-day retention
 * - SQS-managed encryption
 * - SSL enforcement
 * - 5 max receive attempts before moving to DLQ
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
    #queue;
    #deadLetterQueue;
    constructor(scope, id, props) {
        super(scope, id);
        this.#deadLetterQueue = new Queue(this, 'QueueDeadLetter', {
            queueName: `${props.name}-deadletter`,
            retentionPeriod: Duration.days(14),
            visibilityTimeout: Duration.seconds(120),
            encryption: QueueEncryption.SQS_MANAGED,
            enforceSSL: true,
        });
        this.#queue = new Queue(this, 'Queue', {
            queueName: props.name,
            retentionPeriod: Duration.days(4),
            visibilityTimeout: Duration.seconds(120),
            encryption: QueueEncryption.SQS_MANAGED,
            enforceSSL: true,
            deadLetterQueue: {
                maxReceiveCount: 5,
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
    get queue() {
        return this.#queue;
    }
    /**
     * Gets the dead-letter queue
     */
    get deadLetterQueue() {
        return this.#deadLetterQueue;
    }
    /**
     * Gets the queue URL
     */
    get queueUrl() {
        return this.#queue.queueUrl;
    }
    /**
     * Gets the queue ARN
     */
    get queueArn() {
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
    addEventSource(fnc) {
        this.#queue.grantSendMessages(fnc);
        this.#queue.grantConsumeMessages(fnc);
        fnc.addEventSource(new SqsEventSource(this.#queue, {
            enabled: true,
            reportBatchItemFailures: true,
        }));
    }
    /**
     * Grants permission to send messages to the queue
     *
     * @param fnc - The Lambda function to grant send permissions to
     */
    grantSendMessages(fnc) {
        this.#queue.grantSendMessages(fnc);
    }
}
