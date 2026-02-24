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

    it('sets reserved concurrent executions', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Function(stack, 'TestFunction', {
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            name: 'test-function',
            reservedConcurrentExecutions: 50,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Lambda::Function', {
            ReservedConcurrentExecutions: 50,
        });
    });

    it('creates alias with provisioned concurrency', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Function(stack, 'TestFunction', {
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            name: 'test-function',
            provisionedConcurrentExecutions: 10,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Lambda::Alias', {
            ProvisionedConcurrencyConfig: {
                ProvisionedConcurrentExecutions: 10,
            },
        });
    });

    it('configures auto-scaling for provisioned concurrency', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const func = new Function(stack, 'TestFunction', {
            code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
            name: 'test-function',
            provisionedConcurrentExecutions: 5,
            autoScaling: {
                minCapacity: 2,
                maxCapacity: 20,
                targetUtilization: 0.7,
            },
            stack: { id: 'test', tags: [] },
        });

        expect(func.alias).toBeDefined();
        expect(func.autoScalingTarget).toBeDefined();

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
            MinCapacity: 2,
            MaxCapacity: 20,
        });
        template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
            TargetTrackingScalingPolicyConfiguration: {
                TargetValue: 0.7,
            },
        });
    });

    it('validates auto-scaling configuration', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        expect(() => {
            new Function(stack, 'TestFunction', {
                code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
                name: 'test-function',
                provisionedConcurrentExecutions: 5,
                autoScaling: {
                    minCapacity: 20,
                    maxCapacity: 10, // Invalid: min > max
                },
                stack: { id: 'test', tags: [] },
            });
        }).toThrow('minCapacity (20) cannot be greater than maxCapacity (10)');
    });

    it('validates target utilization is in valid range', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        expect(() => {
            new Function(stack, 'TestFunction', {
                code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 })'),
                name: 'test-function',
                provisionedConcurrentExecutions: 5,
                autoScaling: {
                    maxCapacity: 10,
                    targetUtilization: 1.5, // Invalid: > 1
                },
                stack: { id: 'test', tags: [] },
            });
        }).toThrow('targetUtilization must be between 0 and 1');
    });
});
