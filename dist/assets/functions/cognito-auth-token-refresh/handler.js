import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getSignedCookies } from '@aws-sdk/cloudfront-signer';
const SETTINGS = {
    cognito: {
        domain: process.env.COGNITO_DOMAIN,
        clientId: process.env.COGNITO_CLIENT_ID,
    },
    cloudfront: {
        signingKeySecretArn: process.env.CLOUDFRONT_SIGNING_COOKIES_KEY_SECRET_ARN || '',
        keyPairId: process.env.CLOUDFRONT_SIGNING_COOKIES_KEY_PAIR_ID || '',
        domain: process.env.CLOUDFRONT_SIGNING_COOKIES_DOMAIN || '',
        paths: process.env.CLOUDFRONT_SIGNING_COOKIES_PATH?.split(',') || [],
    },
    cookie: {
        accessTokenPath: process.env.COOKIE_ACCESS_TOKEN_PATH,
        refreshTokenPath: process.env.COOKIE_REFRESH_TOKEN_PATH,
    },
    session: {
        durationSeconds: process.env.SESSION_DURATION_SECONDS ? parseInt(process.env.SESSION_DURATION_SECONDS, 10) : null,
    },
};
const secretsClient = new SecretsManagerClient();
/**
 * Lambda handler for refreshing Cognito tokens
 * Uses refresh token from cookies to get new access and ID tokens
 */
export const handler = async (event) => {
    try {
        // Extract refresh token from cookies (API Gateway v2 format)
        const cookies = event.cookies || [];
        const refreshTokenCookie = cookies.find((c) => c.startsWith('refreshToken='));
        const refreshToken = refreshTokenCookie ? refreshTokenCookie.split('=').slice(1).join('=') : null;
        if (!refreshToken) {
            return {
                statusCode: 401,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'No refresh token found' }),
            };
        }
        // Exchange refresh token for new access and ID tokens
        const response = await fetch(`${SETTINGS.cognito.domain}/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: SETTINGS.cognito.clientId,
                refresh_token: refreshToken,
            }),
        });
        if (response.status !== 200) {
            const errorText = await response.text();
            console.error('Token refresh failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
            });
            return {
                statusCode: 401,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Token refresh failed' }),
            };
        }
        const data = (await response.json());
        if (!data.access_token || !data.id_token) {
            console.error('Invalid token response: missing tokens');
            return {
                statusCode: 401,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Invalid token response' }),
            };
        }
        // Calculate expiration timestamp for frontend tracking
        // Use custom session duration if set, otherwise use Cognito token expiration
        const sessionDuration = SETTINGS.session.durationSeconds || data.expires_in || 3600;
        const expiresAt = Math.floor(Date.now() / 1000) + sessionDuration;
        // Generate CloudFront signed cookies
        const cloudFrontCookies = [];
        if (SETTINGS?.cloudfront?.signingKeySecretArn) {
            const secret = await secretsClient.send(new GetSecretValueCommand({ SecretId: SETTINGS.cloudfront.signingKeySecretArn }));
            for (const path of SETTINGS.cloudfront.paths) {
                const cloudFrontPathCookie = getSignedCookies({
                    policy: JSON.stringify({
                        Statement: [
                            {
                                Resource: `${SETTINGS.cloudfront.domain}${path}/*`,
                                Condition: {
                                    DateLessThan: {
                                        'AWS:EpochTime': Math.floor(Date.now() / 1000) + sessionDuration,
                                    },
                                },
                            },
                        ],
                    }),
                    keyPairId: SETTINGS.cloudfront.keyPairId,
                    privateKey: secret.SecretString,
                });
                cloudFrontCookies.push(`CloudFront-Policy=${cloudFrontPathCookie['CloudFront-Policy']}; Path=${path}; HttpOnly; Secure; SameSite=Lax`);
                cloudFrontCookies.push(`CloudFront-Signature=${cloudFrontPathCookie['CloudFront-Signature']}; Path=${path}; HttpOnly; Secure; SameSite=Lax`);
                cloudFrontCookies.push(`CloudFront-Key-Pair-Id=${cloudFrontPathCookie['CloudFront-Key-Pair-Id']}; Path=${path}; HttpOnly; Secure; SameSite=Lax`);
                cloudFrontCookies.push(`sessionInfo=${expiresAt}; Path=${path}; Secure; SameSite=Lax; Max-Age=${sessionDuration}`);
            }
        }
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'max-age=0, no-cache, no-store, must-revalidate',
            },
            cookies: cloudFrontCookies && cloudFrontCookies.length > 0
                ? [
                    `accessToken=${data.access_token}; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=${sessionDuration}`,
                    `idToken=${data.id_token}; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=${sessionDuration}`,
                ].concat(cloudFrontCookies)
                : [
                    `accessToken=${data.access_token}; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=${sessionDuration}`,
                    `idToken=${data.id_token}; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=${sessionDuration}`,
                ],
            body: JSON.stringify({ success: true }),
        };
    }
    catch (error) {
        console.error('Unexpected error in token refresh:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
