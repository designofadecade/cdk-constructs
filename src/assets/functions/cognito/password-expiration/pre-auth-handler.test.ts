/**
 * Tests for Pre-Authentication Lambda Trigger for Password Expiration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PreAuthenticationTriggerEvent } from 'aws-lambda';
import { handler } from './pre-auth-handler.js';

describe('Password Expiration Pre-Auth Handler', () => {
    beforeEach(() => {
        vi.resetModules();
        delete process.env.PASSWORD_EXPIRATION_DAYS;
    });

    it('should allow authentication when password expiration is not configured', async () => {
        const event: PreAuthenticationTriggerEvent = {
            version: '1',
            region: 'us-east-1',
            userPoolId: 'us-east-1_abcdefghi',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            triggerSource: 'PreAuthentication_Authentication',
            request: {
                userAttributes: {
                    email: 'test@example.com',
                    'custom:last-password-change': Date.now().toString(),
                },
                validationData: {},
                userNotFound: false,
            },
            response: {},
        };

        const result = await handler(event);
        expect(result).toEqual(event);
    });

    it('should allow authentication when no last-password-change attribute exists', async () => {
        process.env.PASSWORD_EXPIRATION_DAYS = '90';

        const event: PreAuthenticationTriggerEvent = {
            version: '1',
            region: 'us-east-1',
            userPoolId: 'us-east-1_abcdefghi',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            triggerSource: 'PreAuthentication_Authentication',
            request: {
                userAttributes: {
                    email: 'test@example.com',
                },
                validationData: {},
                userNotFound: false,
            },
            response: {},
        };

        const result = await handler(event);
        expect(result).toEqual(event);
    });

    it('should allow authentication when password is not expired', async () => {
        process.env.PASSWORD_EXPIRATION_DAYS = '90';
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        const event: PreAuthenticationTriggerEvent = {
            version: '1',
            region: 'us-east-1',
            userPoolId: 'us-east-1_abcdefghi',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            triggerSource: 'PreAuthentication_Authentication',
            request: {
                userAttributes: {
                    email: 'test@example.com',
                    'custom:last-password-change': thirtyDaysAgo.toString(),
                },
                validationData: {},
                userNotFound: false,
            },
            response: {},
        };

        const result = await handler(event);
        expect(result).toEqual(event);
    });

    it('should block authentication when password is expired', async () => {
        process.env.PASSWORD_EXPIRATION_DAYS = '90';
        const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;

        const event: PreAuthenticationTriggerEvent = {
            version: '1',
            region: 'us-east-1',
            userPoolId: 'us-east-1_abcdefghi',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            triggerSource: 'PreAuthentication_Authentication',
            request: {
                userAttributes: {
                    email: 'test@example.com',
                    'custom:last-password-change': ninetyOneDaysAgo.toString(),
                },
                validationData: {},
                userNotFound: false,
            },
            response: {},
        };

        await expect(handler(event)).rejects.toThrow(/password has expired/i);
    });

    it('should block authentication on the exact expiration day', async () => {
        process.env.PASSWORD_EXPIRATION_DAYS = '90';
        const exactlyNinetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

        const event: PreAuthenticationTriggerEvent = {
            version: '1',
            region: 'us-east-1',
            userPoolId: 'us-east-1_abcdefghi',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            triggerSource: 'PreAuthentication_Authentication',
            request: {
                userAttributes: {
                    email: 'test@example.com',
                    'custom:last-password-change': exactlyNinetyDaysAgo.toString(),
                },
                validationData: {},
                userNotFound: false,
            },
            response: {},
        };

        await expect(handler(event)).rejects.toThrow(/password has expired/i);
    });
});
