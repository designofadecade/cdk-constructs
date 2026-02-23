import { Construct } from 'constructs';
import { Fn, Duration, Tags, CfnOutput } from 'aws-cdk-lib';
import { HttpApi as AwsHttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
/**
 * A CDK construct for creating HTTP APIs with Lambda integrations
 *
 * Features:
 * - Simple Lambda function integrations
 * - Support for multiple HTTP methods per route
 * - Lambda authorizers with caching
 * - Automatic tagging
 *
 * @example
 * ```typescript
 * const api = new HttpApi(this, 'Api', {
 *   name: 'my-api',
 *   stack: { id: 'my-app', tags: [] },
 * });
 *
 * // Create an authorizer
 * const authorizer = HttpApi.createAuthorizerFunction(
 *   'MyAuthorizer',
 *   authFunction,
 *   { resultsCacheTtl: 300 }
 * );
 *
 * // Add a protected route
 * api.addFunctionIntegration('/users', usersFunction, ['GET', 'POST'], {
 * authorizer,
 * });
 *
 * // Add a public route
 * api.addFunctionIntegration('/health', healthFunction, ['GET']);
 * ```
 */
export class HttpApi extends Construct {
    #httpApi;
    constructor(scope, id, props) {
        super(scope, id);
        this.#httpApi = new AwsHttpApi(this, 'HttpApi', {
            apiName: props.name ?? props.stack.id,
        });
        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#httpApi).add(key, value);
        });
        new CfnOutput(this, 'HttpApiEndpoint', {
            value: this.#httpApi.url ?? '',
            description: 'HTTP API Endpoint',
            exportName: `${props.stack.id}-http-api-endpoint`,
        });
    }
    /**
     * Gets the domain name of the HTTP API (without protocol and path)
     */
    get domainName() {
        return Fn.select(2, Fn.split('/', this.#httpApi.url ?? ''));
    }
    /**
     * Adds a Lambda function integration to the HTTP API
     *
     * @param path - The route path (e.g., '/users', '/products/{id}')
     * @param lambdaFunction - The Lambda function to integrate
     * @param methods - HTTP methods to accept (default: ['GET'])
     * @param options - Optional configuration including authorizer
     *
     * @example
     * ```typescript
     * api.addFunctionIntegration('/items', itemsFunction, ['GET', 'POST']);
     * api.addFunctionIntegration('/items/{id}', itemFunction, ['GET', 'PUT', 'DELETE']);
     * ```
     */
    addFunctionIntegration(path, lambdaFunction, methods = ['GET'], options = {}) {
        const sanitizedPath = path.replace(/\/|\*/gi, '-');
        this.#httpApi.addRoutes({
            path,
            methods: methods.map((method) => HttpMethod[method]),
            integration: new HttpLambdaIntegration(`FunctionIntegration${sanitizedPath}`, lambdaFunction),
            authorizer: options.authorizer,
        });
    }
    /**
     * Creates a Lambda authorizer for HTTP API routes
     *
     * The authorizer:
     * - Uses simple response type
     * - Reads identity from cookie header
     * - Caches results for specified TTL (default 300 seconds)
     *
     * @param id - Unique identifier for the authorizer
     * @param authorizerFunction - Lambda function that validates requests
     * @param props - Optional configuration for the authorizer
     * @returns A configured HTTP Lambda authorizer
     *
     * @example
     * ```typescript
     * const authorizer = HttpApi.createAuthorizerFunction(
     *   'CookieAuth',
     *   authFunction,
     *   { resultsCacheTtl: 600 }
     * );
     * ```
     */
    static createAuthorizerFunction(id, authorizerFunction, props) {
        return new HttpLambdaAuthorizer(id, authorizerFunction, {
            responseTypes: [HttpLambdaResponseType.SIMPLE],
            identitySource: ['$request.header.cookie'],
            resultsCacheTtl: Duration.seconds(props?.resultsCacheTtl ?? 300),
        });
    }
}
