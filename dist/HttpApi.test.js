import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
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
    it('enables CORS by default', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        new HttpApi(stack, 'TestApi', {
            name: 'test-api',
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
    it('adds Lambda integration', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');
        const lambda = new LambdaFunction(stack, 'TestLambda', {
            code: { bind: () => ({ inlineCode: 'test' }) },
            handler: 'index.handler',
            runtime: { name: 'nodejs20.x' },
        });
        const api = new HttpApi(stack, 'TestApi', {
            name: 'test-api',
            stack: { id: 'test', tags: [] },
        });
        api.addFunctionIntegration({
            path: '/users',
            method: 'GET',
            function: lambda,
        });
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
});
