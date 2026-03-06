import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ParameterStore } from './ParameterStore';
import { ParameterTier } from 'aws-cdk-lib/aws-ssm';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

describe('ParameterStore', () => {
    it('creates a string parameter with basic props', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: 'test-value',
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::SSM::Parameter', {
            Name: '/prod//app/config',
            Value: 'test-value',
            Type: 'String',
        });
    });

    it('creates a parameter with JSON value', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: {
                timeout: 30,
                retries: 3,
            },
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::SSM::Parameter', {
            Name: '/prod//app/config',
            Value: '{"timeout":30,"retries":3}',
            Type: 'String',
        });
    });

    it('creates a parameter with advanced tier', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new ParameterStore(stack, 'TestParameter', {
            name: '/app/large-config',
            value: 'a'.repeat(5000), // Large value
            tier: ParameterTier.ADVANCED,
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::SSM::Parameter', {
            Tier: 'Advanced',
        });
    });

    it('creates a parameter with description', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: 'test-value',
            description: 'Test parameter description',
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::SSM::Parameter', {
            Description: 'Test parameter description',
        });
    });

    it('creates a parameter with allowed pattern', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: '123',
            allowedPattern: '^[0-9]+$',
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::SSM::Parameter', {
            AllowedPattern: '^[0-9]+$',
        });
    });

    it('applies tags to the parameter', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: 'test-value',
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [
                    { key: 'Environment', value: 'production' },
                    { key: 'Team', value: 'backend' },
                ],
            },
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::SSM::Parameter', {
            Tags: {
                Environment: 'production',
                Team: 'backend',
            },
        });
    });

    it('grants read permissions to a principal', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const parameter = new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: 'test-value',
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        const role = new Role(stack, 'TestRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        });

        parameter.grantRead(role);

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: [
                            'ssm:DescribeParameters',
                            'ssm:GetParameters',
                            'ssm:GetParameter',
                            'ssm:GetParameterHistory',
                        ],
                    },
                ],
            },
        });
    });

    it('grants write permissions to a principal', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const parameter = new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: 'test-value',
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        const role = new Role(stack, 'TestRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        });

        parameter.grantWrite(role);

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: 'ssm:PutParameter',
                    },
                ],
            },
        });
    });

    it('exposes parameter ARN', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const parameter = new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: 'test-value',
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        expect(parameter.arn).toBeDefined();
    });

    it('exposes parameter name', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const parameter = new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: 'test-value',
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        expect(parameter.name).toBeDefined();
    });

    it('exposes parameter string value', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const parameter = new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: 'test-value',
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        expect(parameter.stringValue).toBeDefined();
    });

    it('creates CloudFormation outputs', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: 'test-value',
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        const template = Template.fromStack(stack);

        template.hasOutput('*', {
            Description: 'Parameter ARN',
        });

        template.hasOutput('*', {
            Description: 'Parameter Name',
        });
    });

    describe('static helper methods', () => {
        it('creates parameter using json() helper', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            ParameterStore.json(stack, 'TestParameter', {
                name: '/app/config',
                value: { key: 'value' },
                stack: { id: 'test', tags: [] },
            });

            const template = Template.fromStack(stack);

            template.hasResourceProperties('AWS::SSM::Parameter', {
                Name: '/app/config',
                Value: '{"key":"value"}',
            });
        });

        it('creates parameter using string() helper', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            ParameterStore.string(stack, 'TestParameter', {
                name: '/app/config',
                value: 'test-value',
                stack: { id: 'test', tags: [] },
            });

            const template = Template.fromStack(stack);

            template.hasResourceProperties('AWS::SSM::Parameter', {
                Name: '/app/config',
                Value: 'test-value',
                Type: 'String',
            });
        });

        it('imports existing parameter using fromExistingParameter()', () => {
            const app = new App();
            const stack = new Stack(app, 'TestStack');

            const parameter = ParameterStore.fromExistingParameter(
                stack,
                'ImportedParameter',
                '/existing/parameter'
            );

            expect(parameter).toBeDefined();
            expect(parameter.parameterName).toBe('/existing/parameter');
        });
    });

    it('uses REPLACE_ME placeholder', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new ParameterStore(stack, 'TestParameter', {
            name: '/app/config',
            value: ParameterStore.REPLACE_ME,
            stack: {
                config: { parameterNamePrefix: '/prod/' },
                tags: [],
            },
        });

        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::SSM::Parameter', {
            Value: 'REPLACE_ME',
        });
    });
});
