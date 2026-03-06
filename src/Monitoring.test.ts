import { describe, it, expect } from 'vitest';
import { App, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';
import { Monitoring } from '../src/Monitoring.js';

describe('Monitoring', () => {
    describe('createLogGroup', () => {
        it('creates CloudWatch Log Group with defaults', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            Monitoring.createLogGroup(stack, 'TestLogGroup');

            const template = Template.fromStack(stack);
            template.resourceCountIs('AWS::Logs::LogGroup', 1);
            template.hasResourceProperties('AWS::Logs::LogGroup', {
                RetentionInDays: 7,
            });
        });

        it('creates CloudWatch Log Group with custom name', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            Monitoring.createLogGroup(stack, 'TestLogGroup', {
                logGroupName: '/aws/lambda/my-function',
            });

            const template = Template.fromStack(stack);
            template.hasResourceProperties('AWS::Logs::LogGroup', {
                LogGroupName: '/aws/lambda/my-function',
            });
        });

        it('creates CloudWatch Log Group with custom retention', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            Monitoring.createLogGroup(stack, 'TestLogGroup', {
                retention: RetentionDays.ONE_MONTH,
            });

            const template = Template.fromStack(stack);
            template.hasResourceProperties('AWS::Logs::LogGroup', {
                RetentionInDays: 30,
            });
        });

        it('creates CloudWatch Log Group with RETAIN removal policy', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            Monitoring.createLogGroup(stack, 'TestLogGroup', {
                removalPolicy: RemovalPolicy.RETAIN,
            });

            const template = Template.fromStack(stack);
            template.hasResource('AWS::Logs::LogGroup', {
                DeletionPolicy: 'Retain',
            });
        });

        it('returns ILogGroup interface', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');

            expect(logGroup.logGroupArn).toBeDefined();
            expect(logGroup.logGroupName).toBeDefined();
        });

        it('allows referencing log group in other resources', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup', {
                logGroupName: '/aws/lambda/my-function',
            });

            // Verify we can access log group properties
            expect(logGroup.logGroupName).toBeDefined();
            expect(logGroup.logGroupArn).toBeDefined();
        });
    });

    describe('Monitoring instance', () => {
        describe('constructor', () => {
            it('creates Monitoring with Slack notification', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const monitoring = new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.slackNotifier({
                            slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
                            slackChannel: '#alerts',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);

                // Verify SNS topic created
                template.resourceCountIs('AWS::SNS::Topic', 1);

                // Verify Lambda function created
                template.hasResourceProperties('AWS::Lambda::Function', {
                    Runtime: 'nodejs24.x',
                    Environment: {
                        Variables: {
                            SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/xxx',
                            SLACK_CHANNEL: '#alerts',
                        },
                    },
                });

                // Verify subscription
                template.resourceCountIs('AWS::SNS::Subscription', 1);

                expect(monitoring.topic).toBeDefined();
                expect(monitoring.notificationFunctions).toHaveLength(1);
            });
        });

        describe('monitorErrors', () => {
            it('creates subscription filter for ERROR level JSON logs', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
                const monitoring = new Monitoring(stack, 'Monitoring');

                const result = monitoring.monitorErrors('ErrorLogger', {
                    logGroup,
                });

                const template = Template.fromStack(stack);

                // Verify Lambda function for processing logs
                template.hasResourceProperties('AWS::Lambda::Function', {
                    Runtime: 'nodejs24.x',
                    Environment: {
                        Variables: {
                            SNS_TOPIC_ARN: Match.anyValue(),
                        },
                    },
                });

                // Verify subscription filter created
                template.hasResourceProperties('AWS::Logs::SubscriptionFilter', {
                    FilterPattern: '{ $.level = "ERROR" }',
                });

                // Verify Lambda permission for CloudWatch Logs
                template.hasResourceProperties('AWS::Lambda::Permission', {
                    Action: 'lambda:InvokeFunction',
                    Principal: 'logs.amazonaws.com',
                });

                expect(result.subscriptionFilter).toBeDefined();
                expect(result.logFunction).toBeDefined();
            });

            it('creates subscription filter with multiple error levels', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
                const monitoring = new Monitoring(stack, 'Monitoring');

                monitoring.monitorErrors('CriticalLogger', {
                    logGroup,
                    errorLevels: ['ERROR', 'FATAL', 'CRITICAL'],
                });

                const template = Template.fromStack(stack);

                // Verify subscription filter handles multiple levels
                template.hasResourceProperties('AWS::Logs::SubscriptionFilter', {
                    FilterPattern: '{ ($.level = "ERROR") || ($.level = "FATAL") || ($.level = "CRITICAL") }',
                });
            });

            it('creates subscription filter with custom level field', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
                const monitoring = new Monitoring(stack, 'Monitoring');

                monitoring.monitorErrors('CustomLogger', {
                    logGroup,
                    levelField: 'severity',
                });

                const template = Template.fromStack(stack);

                // Verify custom field name
                template.hasResourceProperties('AWS::Logs::SubscriptionFilter', {
                    FilterPattern: '{ $.severity = "ERROR" }',
                });
            });

            it('reuses the same Lambda function for multiple subscriptions', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const logGroup1 = Monitoring.createLogGroup(stack, 'TestLogGroup1');
                const logGroup2 = Monitoring.createLogGroup(stack, 'TestLogGroup2');
                const monitoring = new Monitoring(stack, 'Monitoring');

                const result1 = monitoring.monitorErrors('ErrorLogger1', {
                    logGroup: logGroup1,
                });

                const result2 = monitoring.monitorErrors('ErrorLogger2', {
                    logGroup: logGroup2,
                });

                const template = Template.fromStack(stack);

                // Verify only ONE Lambda function is created for both subscriptions
                template.resourceCountIs('AWS::Lambda::Function', 1);

                // Verify both subscriptions use the same function
                expect(result1.logFunction).toBe(result2.logFunction);

                // Verify both subscription filters are created
                template.resourceCountIs('AWS::Logs::SubscriptionFilter', 2);
            });

            it('allows multiple subscriptions with different error levels', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
                const monitoring = new Monitoring(stack, 'Monitoring');

                // Add first subscription for ERROR
                monitoring.monitorErrors('ErrorLogger', {
                    logGroup,
                });

                // Add second subscription for FATAL
                monitoring.monitorErrors('FatalLogger', {
                    logGroup,
                    errorLevels: ['FATAL'],
                });

                const template = Template.fromStack(stack);

                // Verify both subscription filters created but only ONE Lambda function
                template.resourceCountIs('AWS::Logs::SubscriptionFilter', 2);
                template.resourceCountIs('AWS::Lambda::Function', 1);
            });
        });
    });
});
