import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Code } from 'aws-cdk-lib/aws-lambda';
import { Function } from '../src/Function.js';

describe('Function', () => {
    it('creates Lambda function', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Function(stack, 'TestFunction', {
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            name: 'test-function',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Lambda::Function', 1);
    });

    it('uses Node.js 24 runtime', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Function(stack, 'TestFunction', {
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            name: 'test-function',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Lambda::Function', {
            Runtime: 'nodejs24.x',
        });
    });

    it('creates function in VPC when provided', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const vpc = new Vpc(stack, 'TestVpc');

        new Function(stack, 'TestFunction', {
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            name: 'test-function',
            vpc,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Lambda::Function', {
            VpcConfig: Match.objectLike({
                SubnetIds: Match.anyValue(),
                SecurityGroupIds: Match.anyValue(),
            }),
        });
    });

    it('creates function URL when enabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Function(stack, 'TestFunction', {
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
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
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
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
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            name: 'test-function',
            stack: { id: 'test', tags: [] },
        });

        expect(func.function).toBeDefined();
        expect(func.functionArn).toBeDefined();
        expect(func.functionName).toBe('test-function');
    });
});
