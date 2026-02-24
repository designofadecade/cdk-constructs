import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
/**
 * Lambda handler for Cognito OAuth callback
 * Exchanges authorization code for tokens and sets secure cookies
 */
export declare const handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;
