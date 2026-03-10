import { describe, it, expect } from 'vitest';
import { App, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ComparisonOperator, Metric } from 'aws-cdk-lib/aws-cloudwatch';
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

            it('creates Monitoring with Teams notification', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const monitoring = new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.teamsNotifier({
                            webhookUrl: 'https://outlook.office.com/webhook/xxx',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);

                // Verify Lambda function created
                template.hasResourceProperties('AWS::Lambda::Function', {
                    Runtime: 'nodejs24.x',
                    Environment: {
                        Variables: {
                            WEBHOOK_URL: 'https://outlook.office.com/webhook/xxx',
                        },
                    },
                });

                expect(monitoring.notificationFunctions).toHaveLength(1);
            });

            it('creates Monitoring with Google Chat notification', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const monitoring = new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.googleChatNotifier({
                            webhookUrl: 'https://chat.googleapis.com/v1/spaces/xxx',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);

                // Verify Lambda function created
                template.hasResourceProperties('AWS::Lambda::Function', {
                    Runtime: 'nodejs24.x',
                    Environment: {
                        Variables: {
                            WEBHOOK_URL: 'https://chat.googleapis.com/v1/spaces/xxx',
                        },
                    },
                });

                expect(monitoring.notificationFunctions).toHaveLength(1);
            });

            it('creates Monitoring with webhook parameter ARN for Slack', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const monitoring = new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.slackNotifier({
                            webhookParameterArn: 'arn:aws:ssm:us-east-1:123456789012:parameter/slack-webhook',
                            slackChannel: '#alerts',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);

                // Verify Lambda function created with parameter ARN
                template.hasResourceProperties('AWS::Lambda::Function', {
                    Runtime: 'nodejs24.x',
                    Environment: {
                        Variables: {
                            WEBHOOK_PARAMETER_ARN: 'arn:aws:ssm:us-east-1:123456789012:parameter/slack-webhook',
                            SLACK_CHANNEL: '#alerts',
                        },
                    },
                });

                // Verify IAM policy for SSM access
                template.hasResourceProperties('AWS::IAM::Policy', {
                    PolicyDocument: {
                        Statement: Match.arrayWith([
                            Match.objectLike({
                                Effect: 'Allow',
                                Action: ['ssm:GetParameter', 'ssm:GetParameters'],
                                Resource: 'arn:aws:ssm:us-east-1:123456789012:parameter/slack-webhook',
                            }),
                            Match.objectLike({
                                Effect: 'Allow',
                                Action: 'kms:Decrypt',
                            }),
                        ]),
                    },
                });
            });

            it('creates Monitoring with webhook parameter ARN for Teams', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const monitoring = new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.teamsNotifier({
                            webhookParameterArn: 'arn:aws:ssm:us-east-1:123456789012:parameter/teams-webhook',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);

                // Verify Lambda function created with parameter ARN
                template.hasResourceProperties('AWS::Lambda::Function', {
                    Environment: {
                        Variables: {
                            WEBHOOK_PARAMETER_ARN: 'arn:aws:ssm:us-east-1:123456789012:parameter/teams-webhook',
                        },
                    },
                });

                // Verify IAM policy for SSM access
                template.hasResourceProperties('AWS::IAM::Policy', {
                    PolicyDocument: {
                        Statement: Match.arrayWith([
                            Match.objectLike({
                                Effect: 'Allow',
                                Action: ['ssm:GetParameter', 'ssm:GetParameters'],
                            }),
                        ]),
                    },
                });
            });

            it('creates Monitoring with webhook parameter ARN for Google Chat', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const monitoring = new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.googleChatNotifier({
                            webhookParameterArn: 'arn:aws:ssm:us-east-1:123456789012:parameter/googlechat-webhook',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);

                // Verify Lambda function created with parameter ARN
                template.hasResourceProperties('AWS::Lambda::Function', {
                    Environment: {
                        Variables: {
                            WEBHOOK_PARAMETER_ARN: 'arn:aws:ssm:us-east-1:123456789012:parameter/googlechat-webhook',
                        },
                    },
                });

                // Verify IAM policy for SSM access
                template.hasResourceProperties('AWS::IAM::Policy', {
                    PolicyDocument: {
                        Statement: Match.arrayWith([
                            Match.objectLike({
                                Effect: 'Allow',
                                Action: ['ssm:GetParameter', 'ssm:GetParameters'],
                            }),
                        ]),
                    },
                });
            });

            it('creates Monitoring with custom topic name', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                new Monitoring(stack, 'Monitoring', {
                    topic: {
                        topicName: 'my-alerts-topic',
                        displayName: 'My Alerts',
                    },
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::SNS::Topic', {
                    TopicName: 'my-alerts-topic',
                    DisplayName: 'My Alerts',
                });
            });

            it('creates Monitoring with multiple notification handlers', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const monitoring = new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.slackNotifier({
                            slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
                            slackChannel: '#alerts',
                        }),
                        Monitoring.teamsNotifier({
                            webhookUrl: 'https://outlook.office.com/webhook/xxx',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);
                template.resourceCountIs('AWS::Lambda::Function', 2);
                template.resourceCountIs('AWS::SNS::Subscription', 2);
                expect(monitoring.notificationFunctions).toHaveLength(2);
            });

            it('creates Monitoring with GuardDuty enabled', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const monitoring = new Monitoring(stack, 'Monitoring', {
                    guardDuty: {
                        enabled: true,
                    },
                });

                const template = Template.fromStack(stack);

                // Verify EventBridge rule created
                template.hasResourceProperties('AWS::Events::Rule', {
                    EventPattern: {
                        source: ['aws.guardduty'],
                        'detail-type': ['GuardDuty Finding'],
                        detail: {
                            severity: [
                                {
                                    numeric: ['>=', 4],
                                },
                            ],
                        },
                    },
                });

                expect(monitoring.guardDutyRule).toBeDefined();
            });

            it('creates Monitoring with GuardDuty and custom severity', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                new Monitoring(stack, 'Monitoring', {
                    guardDuty: {
                        enabled: true,
                        minSeverity: Monitoring.GUARD_DUTY_MIN_SEVERITY_HIGH,
                    },
                });

                const template = Template.fromStack(stack);

                // Verify EventBridge rule with HIGH severity (7.0+)
                template.hasResourceProperties('AWS::Events::Rule', {
                    EventPattern: {
                        detail: {
                            severity: [
                                {
                                    numeric: ['>=', 7],
                                },
                            ],
                        },
                    },
                });
            });

            it('creates Monitoring with GuardDuty LOW severity', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                new Monitoring(stack, 'Monitoring', {
                    guardDuty: {
                        enabled: true,
                        minSeverity: Monitoring.GUARD_DUTY_MIN_SEVERITY_LOW,
                    },
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::Events::Rule', {
                    EventPattern: {
                        detail: {
                            severity: [{ numeric: ['>=', 1] }],
                        },
                    },
                });
            });

            it('creates Monitoring with GuardDuty CRITICAL severity', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                new Monitoring(stack, 'Monitoring', {
                    guardDuty: {
                        enabled: true,
                        minSeverity: Monitoring.GUARD_DUTY_MIN_SEVERITY_CRITICAL,
                    },
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::Events::Rule', {
                    EventPattern: {
                        detail: {
                            severity: [{ numeric: ['>=', 8.5] }],
                        },
                    },
                });
            });

            it('creates Monitoring with GuardDuty custom rule name and description', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                new Monitoring(stack, 'Monitoring', {
                    guardDuty: {
                        enabled: true,
                        ruleName: 'my-guardduty-rule',
                        ruleDescription: 'My custom GuardDuty monitoring',
                    },
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::Events::Rule', {
                    Name: 'my-guardduty-rule',
                    Description: 'My custom GuardDuty monitoring',
                });
            });

            it('GuardDuty rule sends events to SNS topic', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                new Monitoring(stack, 'Monitoring', {
                    guardDuty: {
                        enabled: true,
                    },
                });

                const template = Template.fromStack(stack);

                // Verify EventBridge rule targets SNS topic
                template.hasResourceProperties('AWS::Events::Rule', {
                    Targets: Match.arrayWith([
                        Match.objectLike({
                            Arn: Match.anyValue(),
                        }),
                    ]),
                });
            });

            it('creates Monitoring with custom logErrorFunctionName', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
                const monitoring = new Monitoring(stack, 'Monitoring', {
                    logErrorFunctionName: 'my-custom-error-function',
                });

                // Trigger creation of the log error function
                monitoring.monitorErrors('ErrorLogger', {
                    logGroup,
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::Lambda::Function', {
                    FunctionName: 'my-custom-error-function',
                });
            });
        });

        describe('addAlarm', () => {
            it('adds alarm from metric filter', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
                const monitoring = new Monitoring(stack, 'Monitoring');

                const { metricFilter } = monitoring.addLogAlarm('ErrorAlarm', {
                    logGroup,
                    filterPattern: 'ERROR',
                });

                const alarm = monitoring.addAlarm('CustomAlarm', {
                    metricFilter,
                    threshold: 5,
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::CloudWatch::Alarm', {
                    Threshold: 5,
                });

                expect(alarm).toBeDefined();
                expect(monitoring.alarms).toHaveLength(2); // One from addLogAlarm, one from addAlarm
            });

            it('adds alarm with custom configuration', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
                const monitoring = new Monitoring(stack, 'Monitoring');

                const { metricFilter } = monitoring.addLogAlarm('ErrorAlarm', {
                    logGroup,
                    filterPattern: 'ERROR',
                });

                monitoring.addAlarm('CustomAlarm', {
                    metricFilter,
                    alarmName: 'MyCustomAlarm',
                    alarmDescription: 'Custom alarm description',
                    threshold: 10,
                    evaluationPeriods: 2,
                    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::CloudWatch::Alarm', {
                    AlarmName: 'MyCustomAlarm',
                    AlarmDescription: 'Custom alarm description',
                    Threshold: 10,
                    EvaluationPeriods: 2,
                    ComparisonOperator: 'GreaterThanThreshold',
                });
            });
        });

        describe('addMetricAlarm', () => {
            it('adds alarm from Lambda metric', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');
                const monitoring = new Monitoring(stack, 'Monitoring');

                // Create a mock metric
                const metric = new Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'Errors',
                    dimensionsMap: {
                        FunctionName: 'my-function',
                    },
                });

                const alarm = monitoring.addMetricAlarm('FunctionErrors', {
                    metric,
                    threshold: 3,
                    alarmName: 'MyFunctionErrors',
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::CloudWatch::Alarm', {
                    AlarmName: 'MyFunctionErrors',
                    Threshold: 3,
                    MetricName: 'Errors',
                    Namespace: 'AWS/Lambda',
                });

                expect(alarm).toBeDefined();
                expect(monitoring.alarms).toHaveLength(1);
            });
        });

        describe('addLogAlarm', () => {
            it('creates metric filter and alarm for log pattern', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
                const monitoring = new Monitoring(stack, 'Monitoring');

                const result = monitoring.addLogAlarm('ErrorAlarm', {
                    logGroup,
                    filterPattern: 'ERROR',
                });

                const template = Template.fromStack(stack);

                // Verify metric filter created
                template.hasResourceProperties('AWS::Logs::MetricFilter', {
                    FilterPattern: '"ERROR"',
                    MetricTransformations: [
                        {
                            MetricName: 'ErrorAlarmCount',
                            MetricNamespace: 'CustomMetrics',
                            MetricValue: '1',
                        },
                    ],
                });

                // Verify alarm created
                template.hasResourceProperties('AWS::CloudWatch::Alarm', {
                    AlarmName: 'ErrorAlarmAlarm',
                    Threshold: 1,
                });

                expect(result.metricFilter).toBeDefined();
                expect(result.alarm).toBeDefined();
                expect(monitoring.alarms).toHaveLength(1);
            });

            it('creates metric filter and alarm with custom configuration', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
                const monitoring = new Monitoring(stack, 'Monitoring');

                monitoring.addLogAlarm('CriticalErrors', {
                    logGroup,
                    filterPattern: 'CRITICAL',
                    metricName: 'CriticalErrorCount',
                    metricNamespace: 'MyApp',
                    threshold: 3,
                    alarmName: 'MyCriticalAlarm',
                    alarmDescription: 'Critical errors detected',
                });

                const template = Template.fromStack(stack);

                // Verify metric filter with custom namespace and name
                template.hasResourceProperties('AWS::Logs::MetricFilter', {
                    MetricTransformations: [
                        {
                            MetricName: 'CriticalErrorCount',
                            MetricNamespace: 'MyApp',
                        },
                    ],
                });

                // Verify alarm with custom configuration
                template.hasResourceProperties('AWS::CloudWatch::Alarm', {
                    AlarmName: 'MyCriticalAlarm',
                    AlarmDescription: 'Critical errors detected',
                    Threshold: 3,
                });
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

        describe('notifier options', () => {
            it('creates notifier with message prefix', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.slackNotifier({
                            slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
                            messagePrefix: '[PROD]',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::Lambda::Function', {
                    Environment: {
                        Variables: {
                            MESSAGE_PREFIX: '[PROD]',
                        },
                    },
                });
            });

            it('creates notifier with custom function name', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.slackNotifier({
                            slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
                            functionName: 'my-slack-notifier',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::Lambda::Function', {
                    FunctionName: 'my-slack-notifier',
                });
            });

            it('Teams notifier with message prefix', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.teamsNotifier({
                            webhookUrl: 'https://outlook.office.com/webhook/xxx',
                            messagePrefix: '[STAGING]',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::Lambda::Function', {
                    Environment: {
                        Variables: {
                            MESSAGE_PREFIX: '[STAGING]',
                        },
                    },
                });
            });

            it('Google Chat notifier with custom function name', () => {
                const app = new App();
                const stack = new Stack(app, 'TestStack');

                new Monitoring(stack, 'Monitoring', {
                    notifications: [
                        Monitoring.googleChatNotifier({
                            webhookUrl: 'https://chat.googleapis.com/v1/spaces/xxx',
                            functionName: 'my-googlechat-notifier',
                        }),
                    ],
                });

                const template = Template.fromStack(stack);
                template.hasResourceProperties('AWS::Lambda::Function', {
                    FunctionName: 'my-googlechat-notifier',
                });
            });
        });

        describe('static factory methods', () => {
            it('slackNotifier returns correct configuration', () => {
                const notifier = Monitoring.slackNotifier({
                    slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
                    slackChannel: '#alerts',
                    messagePrefix: '[PROD]',
                    functionName: 'my-slack-function',
                });

                expect(notifier).toEqual({
                    type: 'slack',
                    webhookUrl: 'https://hooks.slack.com/services/xxx',
                    webhookParameterArn: undefined,
                    channel: '#alerts',
                    messagePrefix: '[PROD]',
                    functionName: 'my-slack-function',
                });
            });

            it('teamsNotifier returns correct configuration', () => {
                const notifier = Monitoring.teamsNotifier({
                    webhookUrl: 'https://outlook.office.com/webhook/xxx',
                    messagePrefix: '[STAGING]',
                });

                expect(notifier).toEqual({
                    type: 'teams',
                    webhookUrl: 'https://outlook.office.com/webhook/xxx',
                    webhookParameterArn: undefined,
                    messagePrefix: '[STAGING]',
                    functionName: undefined,
                });
            });

            it('googleChatNotifier returns correct configuration', () => {
                const notifier = Monitoring.googleChatNotifier({
                    webhookUrl: 'https://chat.googleapis.com/v1/spaces/xxx',
                });

                expect(notifier).toEqual({
                    type: 'googlechat',
                    webhookUrl: 'https://chat.googleapis.com/v1/spaces/xxx',
                    webhookParameterArn: undefined,
                    messagePrefix: undefined,
                    functionName: undefined,
                });
            });

            it('notifier with webhookParameterArn', () => {
                const notifier = Monitoring.slackNotifier({
                    webhookParameterArn: 'arn:aws:ssm:us-east-1:123456789012:parameter/webhook',
                    slackChannel: '#alerts',
                });

                expect(notifier).toEqual({
                    type: 'slack',
                    webhookUrl: undefined,
                    webhookParameterArn: 'arn:aws:ssm:us-east-1:123456789012:parameter/webhook',
                    channel: '#alerts',
                    messagePrefix: undefined,
                    functionName: undefined,
                });
            });
        });

        describe('GuardDuty severity constants', () => {
            it('exposes correct severity constant values', () => {
                expect(Monitoring.GUARD_DUTY_MIN_SEVERITY_LOW).toBe('LOW');
                expect(Monitoring.GUARD_DUTY_MIN_SEVERITY_MEDIUM).toBe('MEDIUM');
                expect(Monitoring.GUARD_DUTY_MIN_SEVERITY_HIGH).toBe('HIGH');
                expect(Monitoring.GUARD_DUTY_MIN_SEVERITY_CRITICAL).toBe('CRITICAL');
            });
        });
    });
});
