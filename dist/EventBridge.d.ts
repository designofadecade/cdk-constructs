import { Construct } from 'constructs';
import { type IRule } from 'aws-cdk-lib/aws-events';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
/**
 * Configuration for creating a scheduled EventBridge task
 */
export interface EventBridgeTaskConfig {
    /**
     * The parent scope where the rule will be created
     */
    readonly scope: Construct;
    /**
     * The name for the EventBridge rule
     */
    readonly name: string;
    /**
     * Description of what the scheduled task does
     */
    readonly description: string;
    /**
     * Cron expression for scheduling (without the 'cron()' wrapper)
     *
     * @example '0 12 * * ? *' for daily at noon UTC
     */
    readonly scheduleCron: string;
    /**
     * The Lambda function to invoke on schedule
     */
    readonly lambdaFunction: IFunction;
}
/**
 * A CDK construct for creating EventBridge rules and scheduled tasks
 *
 * This construct provides utilities for creating scheduled Lambda invocations
 * using EventBridge (formerly CloudWatch Events).
 *
 * @example
 * ```typescript
 * // Using the static task method to create a scheduled rule
 * const rule = EventBridge.task({
 *   scope: this,
 *   name: 'DailyReport',
 *   description: 'Generates daily reports',
 *   scheduleCron: '0 9 * * ? *', // Every day at 9 AM UTC
 *   lambdaFunction: myReportFunction,
 * });
 * ```
 */
export declare class EventBridge extends Construct {
    constructor(scope: Construct, id: string);
    /**
     * Creates a scheduled EventBridge rule that invokes a Lambda function
     *
     * @param config - Configuration for the scheduled task
     * @returns The created EventBridge Rule
     *
     * @example
     * ```typescript
     * const rule = EventBridge.task({
     *   scope: this,
     *   name: 'HourlyCleanup',
     *   description: 'Cleans up old records every hour',
     *   scheduleCron: '0 * * * ? *',
     *   lambdaFunction: cleanupFunction,
     * });
     * ```
     */
    static task(config: EventBridgeTaskConfig): IRule;
}
