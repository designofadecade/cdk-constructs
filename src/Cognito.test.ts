import { describe, it, expect } from 'vitest';
import { App, Stack, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Cognito, PasswordPolicyPlan } from '../src/Cognito.js';

describe('Cognito', () => {
    it('creates user pool', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Cognito::UserPool', 1);
    });

    it('enables email sign in', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            UsernameConfiguration: {
                CaseSensitive: false,
            },
            UsernameAttributes: ['email'],
        });
    });

    it('creates user pool client', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    });

    it('configures required MFA when mfa: true', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            mfa: true,
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            MfaConfiguration: 'ON',
        });
    });

    it('configures optional MFA when mfa: false', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            mfa: false,
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            MfaConfiguration: 'OPTIONAL',
        });
    });

    it('configures MFA with detailed config', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            mfa: { required: true, mfaSecondFactor: { sms: false, otp: true } },
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            MfaConfiguration: 'ON',
            EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
        });
    });

    it('configures email MFA', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', {
            env: { region: 'us-east-1' },
        });

        new Cognito(stack, 'TestCognito', {
            mfa: { required: true, mfaSecondFactor: { sms: false, otp: true, email: true } },
            sesEmail: {
                fromEmail: 'noreply@example.com',
                verifiedDomain: 'example.com',
            },
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            MfaConfiguration: 'ON',
            EnabledMfas: ['SOFTWARE_TOKEN_MFA', 'EMAIL_OTP'],
        });
    });

    it('configures SMS MFA', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const smsRole = new Role(stack, 'SmsRole', {
            assumedBy: new ServicePrincipal('cognito-idp.amazonaws.com'),
        });
        smsRole.addToPolicy(new PolicyStatement({
            actions: ['sns:Publish'],
            resources: ['*'],
        }));

        new Cognito(stack, 'TestCognito', {
            mfa: { required: true, mfaSecondFactor: { sms: true, otp: true } },
            sms: {
                smsRole,
                externalId: 'test-external-id',
            },
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            MfaConfiguration: 'ON',
            EnabledMfas: ['SMS_MFA', 'SOFTWARE_TOKEN_MFA'],
            SmsConfiguration: {
                SnsCallerArn: stack.resolve(smsRole.roleArn),
                ExternalId: 'test-external-id',
            },
        });
    });

    it('auto-creates SMS role when not provided', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            mfa: { required: true, mfaSecondFactor: { sms: true, otp: true } },
            sms: {
                externalId: 'test-external-id',
            },
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            MfaConfiguration: 'ON',
            EnabledMfas: ['SMS_MFA', 'SOFTWARE_TOKEN_MFA'],
            SmsConfiguration: {
                ExternalId: 'test-external-id',
            },
        });
        // Verify the role was created
        template.resourceCountIs('AWS::IAM::Role', 1);
        template.hasResourceProperties('AWS::IAM::Role', {
            AssumeRolePolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Principal: {
                            Service: 'cognito-idp.amazonaws.com',
                        },
                    }),
                ]),
            },
        });
    });

    it('creates SMS role using helper method', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const smsRole = Cognito.createSmsRole(stack, 'MySmsRole');

        new Cognito(stack, 'TestCognito', {
            mfa: true,
            sms: { smsRole },
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::IAM::Role', 1);
        template.hasResourceProperties('AWS::IAM::Role', {
            AssumeRolePolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Principal: {
                            Service: 'cognito-idp.amazonaws.com',
                        },
                    }),
                ]),
            },
        });
    });

    it('defaults to SMS MFA when SMS is configured', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const smsRole = new Role(stack, 'SmsRole', {
            assumedBy: new ServicePrincipal('cognito-idp.amazonaws.com'),
        });

        new Cognito(stack, 'TestCognito', {
            mfa: true,
            sms: {
                smsRole,
            },
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            MfaConfiguration: 'ON',
            EnabledMfas: ['SMS_MFA', 'SOFTWARE_TOKEN_MFA'],
        });
    });

    it('disables SMS MFA when SMS is not configured', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            mfa: { required: true, mfaSecondFactor: { sms: true, otp: true } },
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            MfaConfiguration: 'ON',
            EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
        });
    });

    it('exposes user pool and client', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const cognito = new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        expect(cognito.userPool).toBeDefined();
        expect(cognito.userPoolClient).toBeDefined();
        expect(cognito.userPoolId).toBeDefined();
        expect(cognito.userPoolClientId).toBeDefined();
    });

    it('outputs user pool ID and client ID', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        const outputs = template.findOutputs('*');
        expect(Object.keys(outputs).length).toBeGreaterThanOrEqual(2);
    });

    it('applies default STANDARD password policy', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            Policies: {
                PasswordPolicy: {
                    MinimumLength: 10,
                    RequireUppercase: true,
                    RequireLowercase: true,
                    RequireNumbers: true,
                    RequireSymbols: true,
                    TemporaryPasswordValidityDays: 7,
                },
            },
        });
    });

    it('applies BASIC password policy', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            passwordPolicy: { plan: PasswordPolicyPlan.BASIC },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            Policies: {
                PasswordPolicy: {
                    MinimumLength: 8,
                    RequireUppercase: false,
                    RequireLowercase: true,
                    RequireNumbers: true,
                    RequireSymbols: false,
                    TemporaryPasswordValidityDays: 7,
                },
            },
        });
    });

    it('applies STRONG password policy', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            passwordPolicy: { plan: PasswordPolicyPlan.STRONG },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            Policies: {
                PasswordPolicy: {
                    MinimumLength: 12,
                    RequireUppercase: true,
                    RequireLowercase: true,
                    RequireNumbers: true,
                    RequireSymbols: true,
                    TemporaryPasswordValidityDays: 7,
                    PasswordHistorySize: 5,
                },
            },
        });
    });

    it('applies ENTERPRISE password policy', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            passwordPolicy: { plan: PasswordPolicyPlan.ENTERPRISE },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            Policies: {
                PasswordPolicy: {
                    MinimumLength: 14,
                    RequireUppercase: true,
                    RequireLowercase: true,
                    RequireNumbers: true,
                    RequireSymbols: true,
                    TemporaryPasswordValidityDays: 3,
                    PasswordHistorySize: 10,
                },
            },
        });
    });

    it('applies custom password policy with specific settings', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            passwordPolicy: {
                plan: PasswordPolicyPlan.CUSTOM,
                minLength: 16,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSymbols: true,
                tempPasswordValidity: Duration.days(5),
                passwordHistorySize: 8,
            },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            Policies: {
                PasswordPolicy: {
                    MinimumLength: 16,
                    RequireUppercase: true,
                    RequireLowercase: true,
                    RequireNumbers: true,
                    RequireSymbols: true,
                    TemporaryPasswordValidityDays: 5,
                    PasswordHistorySize: 8,
                },
            },
        });
    });

    it('allows overriding specific password policy settings on any plan', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            passwordPolicy: {
                plan: PasswordPolicyPlan.STANDARD,
                minLength: 15,
                passwordHistorySize: 3,
            },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            Policies: {
                PasswordPolicy: {
                    MinimumLength: 15,
                    RequireUppercase: true,
                    RequireLowercase: true,
                    RequireNumbers: true,
                    RequireSymbols: true,
                    TemporaryPasswordValidityDays: 7,
                    PasswordHistorySize: 3,
                },
            },
        });
    });

    it('creates log group when logging is enabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            logs: {
                enabled: true,
            },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Logs::LogGroup', 1);
        template.hasResourceProperties('AWS::Logs::LogGroup', {
            RetentionInDays: 30,
        });
    });

    it('does not create log group when logging is disabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            logs: {
                enabled: false,
            },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Logs::LogGroup', 0);
        template.resourceCountIs('AWS::Cognito::LogDeliveryConfiguration', 0);
    });

    it('does not create log group when logs config is not provided', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Logs::LogGroup', 0);
        template.resourceCountIs('AWS::Cognito::LogDeliveryConfiguration', 0);
    });

    it('configures custom log group name', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            logs: {
                enabled: true,
                logGroupName: '/custom/cognito/logs',
            },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Logs::LogGroup', {
            LogGroupName: '/custom/cognito/logs',
        });
    });

    it('configures custom retention policy', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            logs: {
                enabled: true,
                retention: RetentionDays.ONE_WEEK,
            },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Logs::LogGroup', {
            RetentionInDays: 7,
        });
    });

    it('configures custom removal policy', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            logs: {
                enabled: true,
                removalPolicy: RemovalPolicy.RETAIN,
            },
        });

        const template = Template.fromStack(stack);
        const logGroups = template.findResources('AWS::Logs::LogGroup');
        const logGroupKey = Object.keys(logGroups)[0];
        expect(logGroups[logGroupKey].DeletionPolicy).toBe('Retain');
    });

    it('creates log delivery configuration with default settings', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            logs: {
                enabled: true,
            },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Cognito::LogDeliveryConfiguration', 1);
        template.hasResourceProperties('AWS::Cognito::LogDeliveryConfiguration', {
            LogConfigurations: [
                {
                    EventSource: 'userAuthEvents',
                    LogLevel: 'INFO',
                    CloudWatchLogsConfiguration: Match.objectLike({
                        LogGroupArn: Match.anyValue(),
                    }),
                },
            ],
        });
    });

    it('configures custom event source and log level', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            logs: {
                enabled: true,
                logConfigurations: [
                    {
                        eventSource: Cognito.LogEventSource.USER_NOTIFICATION,
                        logLevel: Cognito.LogLevel.INFO,
                    },
                ],
            },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::LogDeliveryConfiguration', {
            LogConfigurations: [
                {
                    EventSource: 'userNotification',
                    LogLevel: 'INFO',
                    CloudWatchLogsConfiguration: Match.objectLike({
                        LogGroupArn: Match.anyValue(),
                    }),
                },
            ],
        });
    });

    it('configures multiple log configurations', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Cognito(stack, 'TestCognito', {
            stack: { id: 'test', label: 'Test', tags: [] },
            logs: {
                enabled: true,
                logConfigurations: [
                    {
                        eventSource: Cognito.LogEventSource.USER_AUTH_EVENTS,
                        logLevel: Cognito.LogLevel.INFO,
                    },
                    {
                        eventSource: Cognito.LogEventSource.USER_NOTIFICATION,
                        logLevel: Cognito.LogLevel.ERROR,
                    },
                ],
            },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::LogDeliveryConfiguration', {
            LogConfigurations: [
                {
                    EventSource: 'userAuthEvents',
                    LogLevel: 'INFO',
                    CloudWatchLogsConfiguration: Match.objectLike({
                        LogGroupArn: Match.anyValue(),
                    }),
                },
                {
                    EventSource: 'userNotification',
                    LogLevel: 'ERROR',
                    CloudWatchLogsConfiguration: Match.objectLike({
                        LogGroupArn: Match.anyValue(),
                    }),
                },
            ],
        });
    });
});