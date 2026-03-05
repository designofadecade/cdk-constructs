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

    describe('createMetricFilter', () => {
        it('creates metric filter for log group', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
            Monitoring.createMetricFilter(stack, 'ErrorFilter', {
                logGroup,
                filterPattern: 'ERROR',
                metricName: 'ErrorCount',
                metricNamespace: 'MyApp',
            });

            const template = Template.fromStack(stack);
            template.hasResourceProperties('AWS::Logs::MetricFilter', {
                FilterPattern: Match.anyValue(),
                MetricTransformations: [
                    {
                        MetricName: 'ErrorCount',
                        MetricNamespace: 'MyApp',
                        MetricValue: '1',
                    },
                ],
            });
        });
    });

    describe('createAlarm', () => {
        it('creates CloudWatch alarm for metric filter', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
            const metricFilter = Monitoring.createMetricFilter(stack, 'ErrorFilter', {
                logGroup,
                filterPattern: 'ERROR',
            });

            Monitoring.createAlarm(stack, 'ErrorAlarm', {
                metricFilter,
                alarmName: 'HighErrorRate',
                threshold: 5,
                evaluationPeriods: 2,
            });

            const template = Template.fromStack(stack);
            template.hasResourceProperties('AWS::CloudWatch::Alarm', {
                AlarmName: 'HighErrorRate',
                Threshold: 5,
                EvaluationPeriods: 2,
                ComparisonOperator: 'GreaterThanOrEqualToThreshold',
            });
        });
    });

    describe('createSnsTopic', () => {
        it('creates SNS topic with defaults', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            Monitoring.createSnsTopic(stack, 'AlarmTopic');

            const template = Template.fromStack(stack);
            template.resourceCountIs('AWS::SNS::Topic', 1);
        });

        it('creates SNS topic with custom name', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            Monitoring.createSnsTopic(stack, 'AlarmTopic', {
                topicName: 'my-alarms',
                displayName: 'My Alarms',
            });

            const template = Template.fromStack(stack);
            template.hasResourceProperties('AWS::SNS::Topic', {
                TopicName: 'my-alarms',
                DisplayName: 'My Alarms',
            });
        });
    });

    describe('createSlackNotifier', () => {
        it('creates Lambda function for Slack notifications', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            Monitoring.createSlackNotifier(stack, 'SlackNotifier', {
                slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
                slackChannel: '#alerts',
            });

            const template = Template.fromStack(stack);
            template.hasResourceProperties('AWS::Lambda::Function', {
                Runtime: 'nodejs24.x',
                Environment: {
                    Variables: {
                        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/xxx',
                        SLACK_CHANNEL: '#alerts',
                    },
                },
            });
        });
    });

    describe('createErrorMonitoring', () => {
        it('creates complete monitoring setup', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
            const result = Monitoring.createErrorMonitoring(stack, 'ErrorMonitoring', {
                logGroup,
                filterPattern: 'ERROR',
                slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
                slackChannel: '#alerts',
                threshold: 3,
            });

            const template = Template.fromStack(stack);

            // Verify all resources are created
            template.resourceCountIs('AWS::Logs::MetricFilter', 1);
            template.resourceCountIs('AWS::CloudWatch::Alarm', 1);
            template.resourceCountIs('AWS::SNS::Topic', 1);
            template.resourceCountIs('AWS::Lambda::Function', 1);
            template.resourceCountIs('AWS::SNS::Subscription', 1);

            // Verify alarm configuration
            template.hasResourceProperties('AWS::CloudWatch::Alarm', {
                Threshold: 3,
            });

            // Verify result contains all resources
            expect(result.logGroup).toBeDefined();
            expect(result.metricFilter).toBeDefined();
            expect(result.alarm).toBeDefined();
            expect(result.snsTopic).toBeDefined();
            expect(result.slackFunction).toBeDefined();
        });

        it('wires alarm to SNS and SNS to Lambda', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            const logGroup = Monitoring.createLogGroup(stack, 'TestLogGroup');
            Monitoring.createErrorMonitoring(stack, 'ErrorMonitoring', {
                logGroup,
                filterPattern: 'ERROR',
                slackWebhookUrl: 'https://hooks.slack.com/services/xxx',
            });

            const template = Template.fromStack(stack);

            // Verify alarm has SNS action
            template.hasResourceProperties('AWS::CloudWatch::Alarm', {
                AlarmActions: Match.arrayWith([
                    Match.objectLike({ Ref: Match.stringLikeRegexp('ErrorMonitoringTopic') }),
                ]),
            });

            // Verify SNS subscription exists
            template.hasResourceProperties('AWS::SNS::Subscription', {
                Protocol: 'lambda',
            });
        });
    });
});
