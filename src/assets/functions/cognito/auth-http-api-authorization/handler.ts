import type { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerWithContextResult } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

/**
 * Custom context to include in the authorizer response
 */
interface AuthorizerContext {
    sub: string;
    [key: string]: string;
}

const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USERPOOL_ID!,
    tokenUse: 'id',
    clientId: process.env.COGNITO_CLIENT_ID!,
});

const claims = process.env.COGNITO_CONTEXT_CLAIMS?.split(',') || [];

// Cache the origin secret to avoid repeated SSM calls
let cachedOriginSecret: string | null = null;

/**
 * Get origin secret from SSM Parameter Store or environment variable
 * Caches the value to avoid repeated SSM calls
 */
async function getOriginSecret(): Promise<string | null> {
    // Return cached value if available
    if (cachedOriginSecret !== null) {
        return cachedOriginSecret;
    }

    const directSecret = process.env.ORIGIN_SECRET;
    const parameterArn = process.env.ORIGIN_SECRET_PARAMETER_ARN;

    if (directSecret) {
        cachedOriginSecret = directSecret;
        return cachedOriginSecret;
    }

    if (parameterArn) {
        const client = new SSMClient({});
        // Extract parameter name from ARN: arn:aws:ssm:region:account:parameter/name
        const match = parameterArn.match(/parameter\/(.+)$/);
        if (!match) {
            throw new Error(`Invalid parameter ARN format: ${parameterArn}`);
        }
        const parameterName = `/${match[1]}`;

        const command = new GetParameterCommand({
            Name: parameterName,
            WithDecryption: true,
        });

        const response = await client.send(command);
        if (!response.Parameter?.Value) {
            throw new Error(`Failed to retrieve parameter: ${parameterName}`);
        }

        cachedOriginSecret = response.Parameter.Value;
        return cachedOriginSecret;
    }

    // No origin secret configured - return null
    return null;
}

/**
 * Lambda authorizer for HTTP API that validates Cognito ID token from cookies
 */
export const handler = async (
    event: APIGatewayRequestAuthorizerEventV2,
): Promise<APIGatewaySimpleAuthorizerWithContextResult<AuthorizerContext>> => {
    const originSecret = await getOriginSecret();
    const originVerify = event?.headers?.['x-origin-verify'] || '';

    if (originSecret && originVerify !== originSecret) {
        console.error('Origin verification failed');
        return {
            isAuthorized: false,
            context: {} as AuthorizerContext,
        };
    }

    try {
        const identitySource = event?.identitySource?.[0];
        if (!identitySource) {
            console.error('No identity source provided');
            return {
                isAuthorized: false,
                context: {} as AuthorizerContext,
            };
        }

        // Extract ID token from cookie string
        const idTokenMatch = identitySource.match(/idToken=([^;]+)/);
        const idToken = idTokenMatch?.[1];

        if (!idToken) {
            console.error('No ID token found in identity source');
            return {
                isAuthorized: false,
                context: {} as AuthorizerContext,
            };
        }

        const payload = await verifier.verify(idToken);

        // Build context dynamically from environment variable
        const context: AuthorizerContext = { sub: payload.sub };

        // Parse CONTEXT_CLAIMS if provided (e.g., "custom:partner,custom:role,email")
        if (claims.length > 0) {
            claims.forEach((claim) => {
                const trimmedClaim = claim.trim();
                const value = payload[trimmedClaim];
                if (value !== undefined) {
                    const key = trimmedClaim.replace('custom:', '');
                    context[key] = String(value);
                }
            });
        }

        return {
            isAuthorized: true,
            context,
        };
    } catch (error) {
        const err = error as Error;
        console.error('Token verification failed:', {
            error: err.message,
            name: err.name,
        });
        return {
            isAuthorized: false,
            context: {} as AuthorizerContext,
        };
    }
};
