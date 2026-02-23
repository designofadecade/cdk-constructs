import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
/**
 * Lambda handler for Cognito signout callback
 * Clears all authentication cookies and redirects to the configured URL
 */
export declare const handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;
