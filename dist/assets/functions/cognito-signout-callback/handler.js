const SETTINGS = {
    cloudfront: {
        paths: process.env.CLOUDFRONT_SIGNING_COOKIES_PATH?.split(',') || [],
    },
    cookie: {
        accessTokenPath: process.env.COOKIE_ACCESS_TOKEN_PATH,
        refreshTokenPath: process.env.COOKIE_REFRESH_TOKEN_PATH,
    },
    redirectUrl: process.env.REDIRECT_URL,
};
/**
 * Lambda handler for Cognito signout callback
 * Clears all authentication cookies and redirects to the configured URL
 */
export const handler = async (event) => {
    const cloudFrontCookies = SETTINGS?.cloudfront?.paths && SETTINGS?.cloudfront?.paths.length > 0
        ? SETTINGS.cloudfront.paths
            .map((path) => [
            `CloudFront-Policy=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
            `CloudFront-Signature=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
            `CloudFront-Key-Pair-Id=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
            `sessionInfo=; Path=${path}; Max-Age=0; Secure; SameSite=Lax`,
        ])
            .flat()
        : [];
    return {
        statusCode: 302,
        headers: {
            Location: SETTINGS.redirectUrl,
            'Cache-Control': 'max-age=0, no-cache, no-store, must-revalidate',
        },
        cookies: cloudFrontCookies.length > 0
            ? [
                `accessToken=; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=0`,
                `idToken=; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=0`,
                `refreshToken=; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.refreshTokenPath || '/'}; Max-Age=0`,
            ].concat(cloudFrontCookies)
            : [
                `accessToken=; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=0`,
                `idToken=; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.accessTokenPath || '/'}; Max-Age=0`,
                `refreshToken=; Secure; HttpOnly; SameSite=Lax; Path=${SETTINGS.cookie.refreshTokenPath || '/'}; Max-Age=0`,
            ],
    };
};
