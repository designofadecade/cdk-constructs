import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('cognito-signout-callback handler', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env.REDIRECT_URL = 'https://example.com/';
        process.env.COOKIE_ACCESS_TOKEN_PATH = '/';
        process.env.COOKIE_REFRESH_TOKEN_PATH = '/';
        delete process.env.CLOUDFRONT_SIGNING_COOKIES_PATH;
    });

    it('clears authentication cookies and redirects', async () => {
        const { handler } = await import('./handler.js');

        const event = {} as APIGatewayProxyEventV2;

        const result = await handler(event);
        if (typeof result !== 'object') throw new Error('Expected object result');

        expect(result.statusCode).toBe(302);
        expect(result.headers?.Location).toBe('https://example.com/');
        expect(result.cookies?.some((c: string) => c.includes('accessToken=;') && c.includes('Max-Age=0'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('idToken=;') && c.includes('Max-Age=0'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('refreshToken=;') && c.includes('Max-Age=0'))).toBe(true);
    });

    it('uses custom cookie paths when configured', async () => {
        process.env.COOKIE_ACCESS_TOKEN_PATH = '/app';
        process.env.COOKIE_REFRESH_TOKEN_PATH = '/auth';

        const { handler } = await import('./handler.js');

        const event = {} as APIGatewayProxyEventV2;

        const result = await handler(event);
        if (typeof result !== 'object') throw new Error('Expected object result');

        expect(result.cookies?.some((c: string) => c.includes('accessToken=;') && c.includes('Path=/app') && c.includes('Max-Age=0'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('idToken=;') && c.includes('Path=/app') && c.includes('Max-Age=0'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('refreshToken=;') && c.includes('Path=/auth') && c.includes('Max-Age=0'))).toBe(true);
    });

    it('clears CloudFront cookies when configured', async () => {
        process.env.CLOUDFRONT_SIGNING_COOKIES_PATH = '/protected,/private';

        const { handler } = await import('./handler.js');

        const event = {} as APIGatewayProxyEventV2;

        const result = await handler(event);
        if (typeof result !== 'object') throw new Error('Expected object result');

        expect(result.statusCode).toBe(302);
        // Should have CloudFront cookies for both paths
        expect(result.cookies?.some((c: string) => c.includes('CloudFront-Policy=;') && c.includes('Path=/protected'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('CloudFront-Signature=;') && c.includes('Path=/protected'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('CloudFront-Key-Pair-Id=;') && c.includes('Path=/protected'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('sessionInfo=;') && c.includes('Path=/protected'))).toBe(true);

        expect(result.cookies?.some((c: string) => c.includes('CloudFront-Policy=;') && c.includes('Path=/private'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('CloudFront-Signature=;') && c.includes('Path=/private'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('CloudFront-Key-Pair-Id=;') && c.includes('Path=/private'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('sessionInfo=;') && c.includes('Path=/private'))).toBe(true);
    });

    it('includes cache control headers', async () => {
        const { handler } = await import('./handler.js');

        const event = {} as APIGatewayProxyEventV2;

        const result = await handler(event);
        if (typeof result !== 'object') throw new Error('Expected object result');

        expect(result.headers?.['Cache-Control']).toBe('max-age=0, no-cache, no-store, must-revalidate');
    });

    it('handles single CloudFront path', async () => {
        process.env.CLOUDFRONT_SIGNING_COOKIES_PATH = '/protected';

        const { handler } = await import('./handler.js');

        const event = {} as APIGatewayProxyEventV2;

        const result = await handler(event);
        if (typeof result !== 'object') throw new Error('Expected object result');

        const cfPolicyCookies = result.cookies?.filter((c: string) => c.includes('CloudFront-Policy')) || [];
        expect(cfPolicyCookies.length).toBe(1);
    });

    it('defaults cookie paths to / when not specified', async () => {
        delete process.env.COOKIE_ACCESS_TOKEN_PATH;
        delete process.env.COOKIE_REFRESH_TOKEN_PATH;

        const { handler } = await import('./handler.js');

        const event = {} as APIGatewayProxyEventV2;

        const result = await handler(event);
        if (typeof result !== 'object') throw new Error('Expected object result');

        expect(result.cookies?.some((c: string) => c.includes('accessToken=;') && c.includes('Path=/') && c.includes('Max-Age=0'))).toBe(true);
        expect(result.cookies?.some((c: string) => c.includes('refreshToken=;') && c.includes('Path=/') && c.includes('Max-Age=0'))).toBe(true);
    });

    it('clears both auth and CloudFront cookies when both configured', async () => {
        process.env.CLOUDFRONT_SIGNING_COOKIES_PATH = '/protected';

        const { handler } = await import('./handler.js');

        const event = {} as APIGatewayProxyEventV2;

        const result = await handler(event);
        if (typeof result !== 'object') throw new Error('Expected object result');

        // Should have auth cookies
        const authCookieTypes = ['accessToken', 'idToken', 'refreshToken'];
        for (const cookieType of authCookieTypes) {
            expect(result.cookies?.some((c: string) => c.startsWith(`${cookieType}=;`))).toBe(true);
        }

        // Should have CloudFront cookies
        const cfCookieTypes = ['CloudFront-Policy', 'CloudFront-Signature', 'CloudFront-Key-Pair-Id', 'sessionInfo'];
        for (const cookieType of cfCookieTypes) {
            expect(result.cookies?.some((c: string) => c.startsWith(`${cookieType}=;`))).toBe(true);
        }
    });

    it('sets all cookies to expire immediately with Max-Age=0', async () => {
        process.env.CLOUDFRONT_SIGNING_COOKIES_PATH = '/protected';

        const { handler } = await import('./handler.js');

        const event = {} as APIGatewayProxyEventV2;

        const result = await handler(event);
        if (typeof result !== 'object') throw new Error('Expected object result');

        // All cookies should have Max-Age=0
        result.cookies?.forEach((cookie: string) => {
            expect(cookie).toContain('Max-Age=0');
        });
    });
});
