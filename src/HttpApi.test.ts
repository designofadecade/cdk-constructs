import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Function as LambdaFunction, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { HttpApi } from './HttpApi.js';

describe('HttpApi', () => {
    it('creates HTTP API', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    });

    it('disables CORS by default', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
            Name: 'test-api',
        });
    });

    it('enables CORS when configured', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            cors: true,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
            CorsConfiguration: {
                AllowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                AllowOrigins: ['*'],
            },
        });
    });

    it('allows custom CORS configuration', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            cors: {
                allowOrigins: ['https://example.com'],
                allowMethods: ['GET', 'POST'],
            },
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
            CorsConfiguration: {
                AllowMethods: ['GET', 'POST'],
                AllowOrigins: ['https://example.com'],
            },
        });
    });

    it('adds Lambda integration', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const lambda = new LambdaFunction(stack, 'TestLambda', {
            code: Code.fromAsset('./tests/fixtures'),
            handler: 'test-handler.handler',
            runtime: Runtime.NODEJS_20_X,
        });

        const api = new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });

        api.addFunctionIntegration('/users', lambda, ['GET']);

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::ApiGatewayV2::Route', 1);
        template.resourceCountIs('AWS::ApiGatewayV2::Integration', 1);
    });

    it('exposes HTTP API', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const api = new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });

        expect(api.api).toBeDefined();
        expect(api.apiId).toBeDefined();
        expect(api.apiEndpoint).toBeDefined();
    });

    it('outputs API endpoint', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasOutput('*', {
            Description: 'HTTP API Endpoint',
        });
    });

    it('does not create log group by default', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const api = new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Logs::LogGroup', 0);
        expect(api.logGroup).toBeUndefined();
    });

    it('creates log group when access logs enabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const api = new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            accessLogs: true,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Logs::LogGroup', 1);
        template.hasResourceProperties('AWS::Logs::LogGroup', {
            LogGroupName: '/aws/apigateway/test-api',
            RetentionInDays: 7,
        });
        expect(api.logGroup).toBeDefined();
    });

    it('allows custom access logs configuration', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            accessLogs: {
                retention: RetentionDays.ONE_MONTH,
            },
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::Logs::LogGroup', {
            LogGroupName: '/aws/apigateway/test-api',
            RetentionInDays: 30,
        });
    });

    it('accepts S3 bucket for access logs', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const bucket = new Bucket(stack, 'LogsBucket');

        new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            accessLogs: {
                s3Bucket: bucket,
            },
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::Logs::LogGroup', 1);
        template.resourceCountIs('AWS::S3::Bucket', 1);
    });

    it('adds direct SQS service integration', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const queue = new Queue(stack, 'TestQueue');

        const api = new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });

        api.addSqsIntegration('/api/deposit/make', queue);

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
            IntegrationType: 'AWS_PROXY',
            IntegrationSubtype: 'SQS-SendMessage',
            PayloadFormatVersion: '1.0',
            RequestParameters: {
                MessageBody: '$request.body',
                QueueUrl: Match.anyValue(),
            },
        });

        template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
            RouteKey: 'POST /api/deposit/make',
        });
    });

    it('adds event_type message attribute for SQS integration when eventType is provided', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const queue = new Queue(stack, 'TestQueue');

        const api = new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });

        api.addSqsIntegration('/api/deposit/make', queue, {
            eventType: 'deposit:make',
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
            RequestParameters: Match.objectLike({
                MessageAttributes: '{"event_type":{"DataType":"String","StringValue":"deposit:make"}}',
            }),
        });
    });

    it('creates Lambda authorizer with default cache TTL', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const authFunction = new LambdaFunction(stack, 'AuthFunction', {
            code: Code.fromAsset('./tests/fixtures'),
            handler: 'test-handler.handler',
            runtime: Runtime.NODEJS_20_X,
        });

        const authorizer = HttpApi.createAuthorizerFunction('TestAuth', authFunction);

        expect(authorizer).toBeDefined();
    });

    it('creates Lambda authorizer with custom cache TTL', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const authFunction = new LambdaFunction(stack, 'AuthFunction', {
            code: Code.fromAsset('./tests/fixtures'),
            handler: 'test-handler.handler',
            runtime: Runtime.NODEJS_20_X,
        });

        const authorizer = HttpApi.createAuthorizerFunction('TestAuth', authFunction, {
            resultsCacheTtl: 600,
        });

        expect(authorizer).toBeDefined();
    });

    it('creates IAM authorizer', () => {
        const authorizer = HttpApi.createIamAuthorizer();

        expect(authorizer).toBeDefined();
    });

    it('adds route with Lambda authorizer', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const lambda = new LambdaFunction(stack, 'TestLambda', {
            code: Code.fromAsset('./tests/fixtures'),
            handler: 'test-handler.handler',
            runtime: Runtime.NODEJS_20_X,
        });
        const authFunction = new LambdaFunction(stack, 'AuthFunction', {
            code: Code.fromAsset('./tests/fixtures'),
            handler: 'test-handler.handler',
            runtime: Runtime.NODEJS_20_X,
        });

        const api = new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });

        const authorizer = HttpApi.createAuthorizerFunction('TestAuth', authFunction);
        api.addFunctionIntegration('/protected', lambda, ['GET'], { authorizer });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::ApiGatewayV2::Route', 1);
        template.resourceCountIs('AWS::ApiGatewayV2::Authorizer', 1);
    });

    it('adds route with IAM authorizer', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const lambda = new LambdaFunction(stack, 'TestLambda', {
            code: Code.fromAsset('./tests/fixtures'),
            handler: 'test-handler.handler',
            runtime: Runtime.NODEJS_20_X,
        });

        const api = new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });

        const iamAuthorizer = HttpApi.createIamAuthorizer();
        api.addFunctionIntegration('/admin', lambda, ['GET'], { authorizer: iamAuthorizer });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::ApiGatewayV2::Route', 1);
        // Note: IAM authorization is built into API Gateway and doesn't create a separate Authorizer resource
        template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
            AuthorizationType: 'AWS_IAM',
        });
    });
});
