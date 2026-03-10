import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';

// Mock aws-jwt-verify
const mockVerify = vi.fn();
vi.mock('aws-jwt-verify', () => ({
    CognitoJwtVerifier: {
        create: vi.fn(() => ({
            verify: mockVerify,
        })),
    },
}));

describe('cognito-auth-http-api-authorization handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env.COGNITO_USERPOOL_ID = 'us-east-1_test123';
        process.env.COGNITO_CLIENT_ID = 'test-client-id';
        delete process.env.ORIGIN_SECRET;
        delete process.env.COGNITO_CONTEXT_CLAIMS;
    });

    it('returns unauthorized when identity source is missing', async () => {
        const { handler } = await import('./handler.js');

        const event = {
            headers: {},
            identitySource: [],
        } as any;

        const result = await handler(event);

        expect(result.isAuthorized).toBe(false);
        expect(result.context).toEqual({});
    });

    it('returns unauthorized when idToken is not in identity source', async () => {
        const { handler } = await import('./handler.js');

        const event = {
            headers: {},
            identitySource: ['accessToken=test-token'],
        } as any;

        const result = await handler(event);

        expect(result.isAuthorized).toBe(false);
        expect(result.context).toEqual({});
    });

    it('successfully authorizes valid token with basic claims', async () => {
        mockVerify.mockResolvedValueOnce({
            sub: '12345678-1234-1234-1234-123456789012',
            email: 'test@example.com',
            'cognito:username': 'testuser',
        });

        const { handler } = await import('./handler.js');

        const event = {
            headers: {},
            identitySource: ['idToken=valid-jwt-token; accessToken=test'],
        } as any;

        const result = await handler(event);

        expect(result.isAuthorized).toBe(true);
        expect(result.context.sub).toBe('12345678-1234-1234-1234-123456789012');
    });

    it('includes custom claims from environment variable', async () => {
        process.env.COGNITO_CONTEXT_CLAIMS = 'custom:partner,custom:role,email';

        mockVerify.mockResolvedValueOnce({
            sub: '12345678-1234-1234-1234-123456789012',
            'custom:partner': 'partner-123',
            'custom:role': 'admin',
            email: 'test@example.com',
        });

        const { handler } = await import('./handler.js');

        const event = {
            headers: {},
            identitySource: ['idToken=valid-jwt-token'],
        } as any;

        const result = await handler(event);

        expect(result.isAuthorized).toBe(true);
        expect(result.context.sub).toBe('12345678-1234-1234-1234-123456789012');
        expect(result.context.partner).toBe('partner-123');
        expect(result.context.role).toBe('admin');
        expect(result.context.email).toBe('test@example.com');
    });

    it('returns unauthorized when token verification fails', async () => {
        mockVerify.mockRejectedValueOnce(new Error('Token expired'));

        const { handler } = await import('./handler.js');

        const event = {
            headers: {},
            identitySource: ['idToken=expired-token'],
        } as any;

        const result = await handler(event);

        expect(result.isAuthorized).toBe(false);
        expect(result.context).toEqual({});
    });

    it('validates origin secret when configured', async () => {
        process.env.ORIGIN_SECRET = 'my-secret-value';

        const { handler } = await import('./handler.js');

        const event = {
            headers: {
                'x-origin-verify': 'wrong-secret',
            },
            identitySource: ['idToken=valid-token'],
        } as any;

        const result = await handler(event);

        expect(result.isAuthorized).toBe(false);
        expect(result.context).toEqual({});
    });

    it('allows request when origin secret matches', async () => {
        process.env.ORIGIN_SECRET = 'my-secret-value';

        mockVerify.mockResolvedValueOnce({
            sub: '12345678-1234-1234-1234-123456789012',
        });

        const { handler } = await import('./handler.js');

        const event = {
            headers: {
                'x-origin-verify': 'my-secret-value',
            },
            identitySource: ['idToken=valid-token'],
        } as any;

        const result = await handler(event);

        expect(result.isAuthorized).toBe(true);
        expect(result.context.sub).toBe('12345678-1234-1234-1234-123456789012');
    });

    it('handles custom claims with undefined values gracefully', async () => {
        process.env.COGNITO_CONTEXT_CLAIMS = 'custom:partner,custom:missing';

        mockVerify.mockResolvedValueOnce({
            sub: '12345678-1234-1234-1234-123456789012',
            'custom:partner': 'partner-123',
        });

        const { handler } = await import('./handler.js');

        const event = {
            headers: {},
            identitySource: ['idToken=valid-token'],
        } as any;

        const result = await handler(event);

        expect(result.isAuthorized).toBe(true);
        expect(result.context.partner).toBe('partner-123');
        expect(result.context.missing).toBeUndefined();
    });
});
