import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { EventBridge } from '../src/EventBridge.js';
import { Function } from '../src/Function.js';

describe('EventBridge', () => {
    it('creates scheduled rule for lambda function', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const lambda = new Function(stack, 'TestLambda', {
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            name: 'test-function',
            stack: { id: 'test', tags: [] },
        });

        EventBridge.task({
            scope: stack,
            name: 'test-task',
            description: 'Test scheduled task',
            scheduleCron: '0 0 * * ? *',
            lambdaFunction: lambda.function,
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Events::Rule', 1);
    });

    it('sets correct schedule expression', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const lambda = new Function(stack, 'TestLambda', {
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            name: 'test-function',
            stack: { id: 'test', tags: [] },
        });

        EventBridge.task({
            scope: stack,
            name: 'test-task',
            description: 'Test scheduled task',
            scheduleCron: '0 12 * * ? *',
            lambdaFunction: lambda.function,
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Events::Rule', {
            ScheduleExpression: 'cron(0 12 * * ? *)',
        });
    });

    it('associates lambda as target', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const lambda = new Function(stack, 'TestLambda', {
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            name: 'test-function',
            stack: { id: 'test', tags: [] },
        });

        EventBridge.task({
            scope: stack,
            name: 'test-task',
            description: 'Test scheduled task',
            scheduleCron: '0 */5 * * ? *',
            lambdaFunction: lambda.function,
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Events::Rule', {
            Targets: [
                Match.objectLike({
                    Arn: Match.objectLike({
                        'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('.*Lambda.*')]),
                    }),
                }),
            ],
        });
    });
});
