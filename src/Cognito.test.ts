import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
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
                tempPasswordValidityDays: 5,
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
});
