import { Construct } from 'constructs';
import { Rule, Schedule, type IRule, type EventPattern, type IRuleTarget } from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
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
 * Configuration for creating a pattern-matching EventBridge rule
 */
export interface EventBridgePatternConfig {
    /**
     * The parent scope where the rule will be created
     */
    readonly scope: Construct;

    /**
     * The name for the EventBridge rule
     */
    readonly name: string;

    /**
     * Optional description for the rule
     */
    readonly description?: string;

    /**
     * Event pattern used to match incoming events
     */
    readonly eventPattern: EventPattern;

    /**
     * Lambda function to target when the event pattern matches
     */
    readonly lambdaFunction?: IFunction;

    /**
     * Optional explicit EventBridge rule targets
     */
    readonly targets?: ReadonlyArray<IRuleTarget>;
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
export class EventBridge extends Construct {
    constructor(scope: Construct, id: string) {
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
    static task(config: EventBridgeTaskConfig): IRule {
        const sanitizedName = config.name.replace(/[^a-zA-Z0-9]/g, '');

        return new Rule(config.scope, `ScheduleRule${sanitizedName}`, {
            ruleName: config.name,
            description: config.description,
            schedule: Schedule.expression(`cron(${config.scheduleCron})`),
            targets: [new targets.LambdaFunction(config.lambdaFunction)],
        });
    }

    /**
     * Creates an event pattern rule with Lambda or custom targets
     *
     * @param config - Configuration for the pattern rule
     * @returns The created EventBridge Rule
     */
    static pattern(config: EventBridgePatternConfig): IRule {
        const sanitizedName = config.name.replace(/[^a-zA-Z0-9]/g, '');
        const ruleTargets = config.targets
            ? [...config.targets]
            : config.lambdaFunction
                ? [new targets.LambdaFunction(config.lambdaFunction)]
                : [];

        if (ruleTargets.length === 0) {
            throw new Error('EventBridge.pattern requires either lambdaFunction or targets');
        }

        return new Rule(config.scope, `PatternRule${sanitizedName}`, {
            ruleName: config.name,
            description: config.description,
            eventPattern: config.eventPattern,
            targets: ruleTargets,
        });
    }
}
