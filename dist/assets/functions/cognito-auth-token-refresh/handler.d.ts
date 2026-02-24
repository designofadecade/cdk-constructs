import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
/**
 * Lambda handler for refreshing Cognito tokens
 * Uses refresh token from cookies to get new access and ID tokens
 */
export declare const handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;
