import { Construct } from 'constructs';
import { type IQueue } from 'aws-cdk-lib/aws-sqs';
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
        readonly tags: ReadonlyArray<{
            readonly key: string;
            readonly value: string;
        }>;
    };
}
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
export declare class Sqs extends Construct {
    #private;
    constructor(scope: Construct, id: string, props: SqsProps);
    /**
     * Gets the main SQS queue
     */
    get queue(): IQueue;
    /**
     * Gets the dead-letter queue
     */
    get deadLetterQueue(): IQueue;
    /**
     * Gets the queue URL
     */
    get queueUrl(): string;
    /**
     * Gets the queue ARN
     */
    get queueArn(): string;
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
    addEventSource(fnc: IFunction): void;
    /**
     * Grants permission to send messages to the queue
     *
     * @param fnc - The Lambda function to grant send permissions to
     */
    grantSendMessages(fnc: IFunction): void;
}
