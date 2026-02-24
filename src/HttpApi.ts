import { Construct } from 'constructs';
import { Fn, Duration, Tags, CfnOutput } from 'aws-cdk-lib';
import { HttpApi as AwsHttpApi, HttpMethod, CorsHttpMethod, type IHttpRouteAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';

/**
 * HTTP method types supported by API Gateway
 */
export type HttpMethodType = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'ANY';

/**
 * Options for adding a Lambda function integration
 */
export interface AddFunctionIntegrationOptions {
    /**
     * Optional authorizer for this route
     */
    readonly authorizer?: IHttpRouteAuthorizer;
}

/**
 * CORS configuration for HTTP API
 */
export interface CorsConfig {
    /**
     * Allowed origins (default: ['*'])
     */
    readonly allowOrigins?: string[];

    /**
     * Allowed HTTP methods (default: GET, POST, PUT, DELETE, OPTIONS)
     */
    readonly allowMethods?: CorsHttpMethod[];

    /**
     * Allowed headers (optional)
     */
    readonly allowHeaders?: string[];

    /**
     * Whether to allow credentials (optional)
     */
    readonly allowCredentials?: boolean;
}

/**
 * Properties for configuring the HTTP API
 */
export interface HttpApiProps {
    /**
     * Optional name for the API. If not provided, uses the stack ID
     */
    readonly name?: string;

    /**
     * Optional CORS configuration. If not provided, CORS is disabled.
     */
    readonly cors?: CorsConfig | boolean;

    /**
     * The stack reference containing ID and tags
     */
    readonly stack: {
        readonly id: string;
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    };
}

/**
 * Properties for creating a Lambda authorizer
 */
export interface CreateAuthorizerFunctionProps {
    /**
     * Optional TTL for caching authorization results (default: 300 seconds)
     */
    readonly resultsCacheTtl?: number;
}

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
 * // API without CORS (default)
 * const api = new HttpApi(this, 'Api', {
 *   name: 'my-api',
 *   stack: { id: 'my-app', tags: [] },
 * });
 * 
 * // API with CORS enabled (allow all origins)
 * const apiWithCors = new HttpApi(this, 'ApiWithCors', {
 *   name: 'my-api',
 *   cors: true,
 *   stack: { id: 'my-app', tags: [] },
 * });
 * 
 * // API with custom CORS configuration
 * const apiCustomCors = new HttpApi(this, 'ApiCustomCors', {
 *   name: 'my-api',
 *   cors: {
 *     allowOrigins: ['https://myapp.com'],
 *     allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST],
 *     allowCredentials: true,
 *   },
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
 *   authorizer,
 * });
 * 
 * // Add a public route
 * api.addFunctionIntegration('/health', healthFunction, ['GET']);
 * ```
 */
export class HttpApi extends Construct {
    #httpApi: AwsHttpApi;

    constructor(scope: Construct, id: string, props: HttpApiProps) {
        super(scope, id);

        // Configure CORS if enabled
        let corsConfig;
        if (props.cors) {
            const cors = typeof props.cors === 'boolean' ? {} : props.cors;
            corsConfig = {
                allowMethods: cors.allowMethods ?? [
                    CorsHttpMethod.GET,
                    CorsHttpMethod.POST,
                    CorsHttpMethod.PUT,
                    CorsHttpMethod.DELETE,
                    CorsHttpMethod.OPTIONS,
                ],
                allowOrigins: cors.allowOrigins ?? ['*'],
                allowHeaders: cors.allowHeaders,
                allowCredentials: cors.allowCredentials,
            };
        }

        this.#httpApi = new AwsHttpApi(this, 'HttpApi', {
            apiName: props.name ?? props.stack.id,
            corsPreflight: corsConfig,
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
    get domainName(): string {
        return Fn.select(2, Fn.split('/', this.#httpApi.url ?? ''));
    }

    /**
     * Gets the HTTP API instance
     */
    get api(): AwsHttpApi {
        return this.#httpApi;
    }

    /**
     * Gets the API ID
     */
    get apiId(): string {
        return this.#httpApi.apiId;
    }

    /**
     * Gets the API endpoint URL
     */
    get apiEndpoint(): string {
        return this.#httpApi.url ?? '';
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
    addFunctionIntegration(
        path: string,
        lambdaFunction: IFunction,
        methods: HttpMethodType[] = ['GET'],
        options: AddFunctionIntegrationOptions = {},
    ): void {
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
    static createAuthorizerFunction(
        id: string,
        authorizerFunction: IFunction,
        props?: CreateAuthorizerFunctionProps,
    ): HttpLambdaAuthorizer {
        return new HttpLambdaAuthorizer(id, authorizerFunction, {
            responseTypes: [HttpLambdaResponseType.SIMPLE],
            identitySource: ['$request.header.cookie'],
            resultsCacheTtl: Duration.seconds(props?.resultsCacheTtl ?? 300),
        });
    }
}
