import type { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerWithContextResult } from 'aws-lambda';
/**
 * Custom context to include in the authorizer response
 */
interface AuthorizerContext {
    sub: string;
    [key: string]: string;
}
/**
 * Lambda authorizer for HTTP API that validates Cognito ID token from cookies
 */
export declare const handler: (event: APIGatewayRequestAuthorizerEventV2) => Promise<APIGatewaySimpleAuthorizerWithContextResult<AuthorizerContext>>;
export {};
