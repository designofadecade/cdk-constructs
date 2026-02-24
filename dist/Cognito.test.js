import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Cognito } from '../src/Cognito.js';
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
    it('configures MFA when requested', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        new Cognito(stack, 'TestCognito', {
            mfa: true,
            stack: { id: 'test', label: 'Test', tags: [] },
        });
        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Cognito::UserPool', {
            MfaConfiguration: 'OPTIONAL',
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
});
