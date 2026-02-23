import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Function } from '../src/Function.js';

describe('Function', () => {
    it('creates Lambda function', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Function(stack, 'TestFunction', {
            entry: './tests/fixtures/test-handler.ts',
            name: 'test-function',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Lambda::Function', 1);
    });

    it('uses Node.js 20 runtime', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Function(stack, 'TestFunction', {
            entry: './tests/fixtures/test-handler.ts',
            name: 'test-function',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Lambda::Function', {
            Runtime: 'nodejs20.x',
        });
    });

    it('creates function in VPC when provided', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');

        new Function(stack, 'TestFunction', {
            entry: './tests/fixtures/test-handler.ts',
            name: 'test-function',
            vpc,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Lambda::Function', {
            VpcConfig: {
                SubnetIds: expect.any(Array),
                SecurityGroupIds: expect.any(Array),
            },
        });
    });

    it('creates function URL when enabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Function(stack, 'TestFunction', {
            entry: './tests/fixtures/test-handler.ts',
            name: 'test-function',
            functionUrl: {
                authType: 'NONE',
            },
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Lambda::Url', 1);
    });

    it('uses ARM64 architecture', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Function(stack, 'TestFunction', {
            entry: './tests/fixtures/test-handler.ts',
            name: 'test-function',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Lambda::Function', {
            Architectures: ['arm64'],
        });
    });

    it('exposes function property', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const func = new Function(stack, 'TestFunction', {
            entry: './tests/fixtures/test-handler.ts',
            name: 'test-function',
            stack: { id: 'test', tags: [] },
        });

        expect(func.function).toBeDefined();
        expect(func.functionArn).toBeDefined();
        expect(func.functionName).toBe('test-function');
    });
});
