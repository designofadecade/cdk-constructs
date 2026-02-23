import { Construct } from 'constructs';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
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
export class EventBridge extends Construct {
    constructor(scope, id) {
        super(scope, id);
    }
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
    static task(config) {
        const sanitizedName = config.name.replace(/[^a-zA-Z0-9]/g, '');
        return new Rule(config.scope, `ScheduleRule${sanitizedName}`, {
            ruleName: config.name,
            description: config.description,
            schedule: Schedule.expression(`cron(${config.scheduleCron})`),
            targets: [new targets.LambdaFunction(config.lambdaFunction)],
        });
    }
}
