import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// Mock AWS SDK
const mockSend = vi.fn();
class MockSecretsManagerClient {
    send = mockSend;
}
vi.mock('@aws-sdk/client-secrets-manager', () => ({
    SecretsManagerClient: MockSecretsManagerClient,
    GetSecretValueCommand: vi.fn((params) => params),
}));

// Mock CloudFront signer
vi.mock('@aws-sdk/cloudfront-signer', () => ({
    getSignedCookies: vi.fn(() => ({
        'CloudFront-Policy': 'test-policy',
        'CloudFront-Signature': 'test-signature',
        'CloudFront-Key-Pair-Id': 'APKAEIBAERJR2EXAMPLE',
    })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('cognito-auth-callback handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env.COGNITO_DOMAIN = 'https://test.auth.us-east-1.amazoncognito.com';
        process.env.COGNITO_CLIENT_ID = 'test-client-id';
        process.env.COGNITO_REDIRECT_URL = 'https://example.com/callback';
        process.env.REDIRECT_URL = 'https://example.com/';
        process.env.COOKIE_ACCESS_TOKEN_PATH = '/';
        process.env.COOKIE_REFRESH_TOKEN_PATH = '/';
    });

    it('returns 400 when authorization code is missing', async () => {
        // Re-import handler after env vars are set
        const { handler } = await import('./handler.js');

        const event = {
            queryStringParameters: {},
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body!)).toEqual({ error: 'Missing authorization code' });
        }
    });

    it('successfully exchanges code for tokens and sets cookies', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({
                access_token: 'test-access-token',
                id_token: 'test-id-token',
                refresh_token: 'test-refresh-token',
                expires_in: 3600,
                token_type: 'Bearer',
            }),
        });

        const { handler } = await import('./handler.js');

        const event = {
            queryStringParameters: {
                code: 'test-auth-code',
            },
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(302);
            expect(result.headers?.Location).toBe('https://example.com/');
            expect(result.cookies?.some((c: string) => c.includes('accessToken=test-access-token'))).toBe(true);
            expect(result.cookies?.some((c: string) => c.includes('idToken=test-id-token'))).toBe(true);
            expect(result.cookies?.some((c: string) => c.includes('refreshToken=test-refresh-token'))).toBe(true);
        }
    });

    it('returns 401 when token exchange fails', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 401,
            statusText: 'Unauthorized',
            text: async () => 'Invalid code',
        });

        const { handler } = await import('./handler.js');

        const event = {
            queryStringParameters: {
                code: 'invalid-code',
            },
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body!)).toEqual({ error: 'Authentication failed' });
        }
    });

    it('returns 401 when tokens are missing in response', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({
                token_type: 'Bearer',
            }),
        });

        const { handler } = await import('./handler.js');

        const event = {
            queryStringParameters: {
                code: 'test-code',
            },
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body!)).toEqual({ error: 'Invalid token response' });
        }
    });

    it.skip('generates CloudFront signed cookies when configured', async () => {
        process.env.CLOUDFRONT_SIGNING_COOKIES_KEY_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:cf-key';
        process.env.CLOUDFRONT_SIGNING_COOKIES_KEY_PAIR_ID = 'APKAEIBAERJR2EXAMPLE';
        process.env.CLOUDFRONT_SIGNING_COOKIES_DOMAIN = 'https://d1234567890.cloudfront.net';
        process.env.CLOUDFRONT_SIGNING_COOKIES_PATH = '/protected';

        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({
                access_token: 'test-access-token',
                id_token: 'test-id-token',
                refresh_token: 'test-refresh-token',
                expires_in: 3600,
                token_type: 'Bearer',
            }),
        });

        mockSend.mockResolvedValueOnce({
            SecretString: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
        });

        const { handler } = await import('./handler.js');

        const event = {
            queryStringParameters: {
                code: 'test-code',
            },
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        // Basic test: verify handler completes successfully with CloudFront config
        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(302);
            expect(result.cookies).toBeDefined();
            expect(result.cookies!.length).toBeGreaterThan(3); // Should have auth + CF cookies
        }
    });

    it('returns 500 on unexpected errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const { handler } = await import('./handler.js');

        const event = {
            queryStringParameters: {
                code: 'test-code',
            },
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body!)).toEqual({ error: 'Internal server error' });
        }
    });
});
