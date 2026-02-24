import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getSignedCookies } from '@aws-sdk/cloudfront-signer';
const SETTINGS = {
    cognito: {
        domain: process.env.COGNITO_DOMAIN,
        clientId: process.env.COGNITO_CLIENT_ID,
        redirectUrl: process.env.COGNITO_REDIRECT_URL,
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
    redirectUrl: process.env.REDIRECT_URL,
    session: {
        durationSeconds: process.env.SESSION_DURATION_SECONDS ? parseInt(process.env.SESSION_DURATION_SECONDS, 10) : null,
    },
};
const secretsClient = new SecretsManagerClient();
/**
 * Lambda handler for Cognito OAuth callback
 * Exchanges authorization code for tokens and sets secure cookies
 */
export const handler = async (event) => {
    try {
        const code = event?.queryStringParameters?.code;
        if (code == null) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing authorization code' }),
            };
        }
        const response = await fetch(`${SETTINGS.cognito.domain}/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: SETTINGS.cognito.clientId,
                code,
                redirect_uri: SETTINGS.cognito.redirectUrl,
            }),
        });
        if (response.status !== 200) {
            const errorText = await response.text();
            console.error('Token exchange failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
            });
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Authentication failed' }),
            };
        }
        const data = (await response.json());
        if (!data.access_token || !data.id_token) {
            console.error('Invalid token response: missing tokens');
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Invalid token response' }),
            };
        }
        // Calculate expiration timestamp for frontend tracking
        // Use custom session duration if set, otherwise use Cognito token expiration
        const sessionDuration = SETTINGS.session.durationSeconds || data.expires_in || 3600;
        const expiresAt = Math.floor(Date.now() / 1000) + sessionDuration;
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
            statusCode: 302,
            headers: {
                Location: SETTINGS.redirectUrl,
                'Cache-Control': 'max-age=0, no-cache, no-store, must-revalidate',
            },
            cookies: cloudFrontCookies && cloudFrontCookies.length > 0
                ? [
                    `accessToken=${data.access_token}; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=${sessionDuration}`,
                    `idToken=${data.id_token}; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=${sessionDuration}`,
                    `refreshToken=${data.refresh_token}; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.refreshTokenPath || '/'}; Max-Age=18000`,
                ].concat(cloudFrontCookies)
                : [
                    `accessToken=${data.access_token}; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=${sessionDuration}`,
                    `idToken=${data.id_token}; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=${sessionDuration}`,
                    `refreshToken=${data.refresh_token}; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.refreshTokenPath || '/'}; Max-Age=18000`,
                ],
        };
    }
    catch (error) {
        console.error('Unexpected error in Cognito callback:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
