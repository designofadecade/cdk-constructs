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

describe('cognito-auth-token-refresh handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env.COGNITO_DOMAIN = 'https://test.auth.us-east-1.amazoncognito.com';
        process.env.COGNITO_CLIENT_ID = 'test-client-id';
        process.env.COOKIE_ACCESS_TOKEN_PATH = '/';
        process.env.COOKIE_REFRESH_TOKEN_PATH = '/';
        delete process.env.CLOUDFRONT_SIGNING_COOKIES_KEY_SECRET_ARN;
    });

    it('returns 401 when refresh token is missing', async () => {
        const { handler } = await import('./handler.js');

        const event = {
            cookies: [],
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body!)).toEqual({ error: 'No refresh token found' });
        }
    });

    it('successfully refreshes tokens', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({
                access_token: 'new-access-token',
                id_token: 'new-id-token',
                expires_in: 3600,
                token_type: 'Bearer',
            }),
        });

        const { handler } = await import('./handler.js');

        const event = {
            cookies: ['refreshToken=test-refresh-token', 'accessToken=old-token'],
        } as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(200);
            expect(result.cookies?.some((c: string) => c.includes('accessToken=new-access-token'))).toBe(true);
            expect(result.cookies?.some((c: string) => c.includes('idToken=new-id-token'))).toBe(true);
            expect(JSON.parse(result.body!)).toEqual({ success: true });
        }
    });

    it('returns 401 when token refresh fails', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 400,
            statusText: 'Bad Request',
            text: async () => 'Invalid refresh token',
        });

        const { handler } = await import('./handler.js');

        const event = {
            cookies: ['refreshToken=invalid-token'],
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body!)).toEqual({ error: 'Token refresh failed' });
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
            cookies: ['refreshToken=test-token'],
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body!)).toEqual({ error: 'Invalid token response' });
        }
    });

    it('uses custom session duration when configured', async () => {
        process.env.SESSION_DURATION_SECONDS = '7200';

        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({
                access_token: 'new-access-token',
                id_token: 'new-id-token',
                expires_in: 3600,
                token_type: 'Bearer',
            }),
        });

        const { handler } = await import('./handler.js');

        const event = {
            cookies: ['refreshToken=test-token'],
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(200);
            expect(result.cookies?.some((c: string) => c.includes('Max-Age=7200'))).toBe(true);
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
                access_token: 'new-access-token',
                id_token: 'new-id-token',
                expires_in: 3600,
                token_type: 'Bearer',
            }),
        });

        mockSend.mockResolvedValueOnce({
            SecretString: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
        });

        const { handler } = await import('./handler.js');

        const event = {
            cookies: ['refreshToken=test-token'],
        } as APIGatewayProxyEventV2;

        const result = await handler(event);

        // Basic test: verify handler completes successfully with CloudFront config
        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(200);
            expect(result.cookies).toBeDefined();
            expect(result.cookies!.length).toBeGreaterThan(2); // Should have at least access + id tokens
        }
    });

    it('returns 500 on unexpected errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const { handler } = await import('./handler.js');

        const event = {
            cookies: ['refreshToken=test-token'],
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body!)).toEqual({ error: 'Internal server error' });
        }
    });

    it('handles refresh token with equals sign in value', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({
                access_token: 'new-access-token',
                id_token: 'new-id-token',
                expires_in: 3600,
                token_type: 'Bearer',
            }),
        });

        const { handler } = await import('./handler.js');

        const event = {
            cookies: ['refreshToken=test-token=with=equals'],
        } as unknown as APIGatewayProxyEventV2;

        const result = await handler(event);

        expect(typeof result).toBe('object');
        if (typeof result === 'object') {
            expect(result.statusCode).toBe(200);
        }
        // Verify fetch was called with the refresh token (URLSearchParams will encode = as %3D)
        expect(mockFetch).toHaveBeenCalled();
        const fetchCall = mockFetch.mock.calls[0];
        const body = fetchCall[1].body as URLSearchParams;
        expect(body.get('refresh_token')).toBe('test-token=with=equals');
    });
});
