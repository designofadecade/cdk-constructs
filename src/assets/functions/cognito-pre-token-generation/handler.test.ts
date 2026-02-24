import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PreTokenGenerationTriggerEvent, Context, Callback } from 'aws-lambda';

describe('cognito-pre-token-generation handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        delete process.env.ALLOWED_CLAIMS;
    });

    // Helper to call handler with required 3-arg signature
    const callHandler = (handler: any, event: PreTokenGenerationTriggerEvent) => {
        return handler(event, {} as Context, (() => { }) as Callback<PreTokenGenerationTriggerEvent>);
    };

    it('suppresses all non-standard claims when ALLOWED_CLAIMS is not set', async () => {
        const { handler } = await import('./handler.js');

        const event: PreTokenGenerationTriggerEvent = {
            version: '1',
            triggerSource: 'TokenGeneration_Authentication',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {
                    sub: '12345678-1234-1234-1234-123456789012',
                    email: 'test@example.com',
                    'custom:partner': 'partner-123',
                    'custom:role': 'admin',
                    phone_number: '+1234567890',
                },
                groupConfiguration: {
                    groupsToOverride: [],
                    iamRolesToOverride: [],
                },
            },
            response: { claimsOverrideDetails: {} },
        };

        const result = await callHandler(handler, event);

        expect(result.response.claimsOverrideDetails?.claimsToSuppress).toContain('email');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).toContain('custom:partner');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).toContain('custom:role');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).toContain('phone_number');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('sub');
    });

    it('only allows specified claims from environment variable', async () => {
        process.env.ALLOWED_CLAIMS = 'email,custom:partner';

        const { handler } = await import('./handler.js');

        const event: PreTokenGenerationTriggerEvent = {
            version: '1',
            triggerSource: 'TokenGeneration_Authentication',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {
                    sub: '12345678-1234-1234-1234-123456789012',
                    email: 'test@example.com',
                    'custom:partner': 'partner-123',
                    'custom:role': 'admin',
                    phone_number: '+1234567890',
                },
                groupConfiguration: {
                    groupsToOverride: [],
                    iamRolesToOverride: [],
                },
            },
            response: { claimsOverrideDetails: {} },
        };

        const result = await callHandler(handler, event);

        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('email');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('custom:partner');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).toContain('custom:role');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).toContain('phone_number');
    });

    it('never suppresses standard JWT claims', async () => {
        const { handler } = await import('./handler.js');

        const event: PreTokenGenerationTriggerEvent = {
            version: '1',
            triggerSource: 'TokenGeneration_Authentication',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {
                    sub: '12345678-1234-1234-1234-123456789012',
                    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123',
                    aud: 'test-client-id',
                    'cognito:username': 'testuser',
                    email: 'test@example.com',
                },
                groupConfiguration: {
                    groupsToOverride: [],
                    iamRolesToOverride: [],
                },
            },
            response: { claimsOverrideDetails: {} },
        };

        const result = await callHandler(handler, event);

        // Standard claims should never be suppressed
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('sub');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('iss');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('aud');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('cognito:username');

        // Non-standard claims should be suppressed (when not in ALLOWED_CLAIMS)
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).toContain('email');
    });

    it('handles empty userAttributes gracefully', async () => {
        const { handler } = await import('./handler.js');

        const event: PreTokenGenerationTriggerEvent = {
            version: '1',
            triggerSource: 'TokenGeneration_Authentication',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {},
                groupConfiguration: {
                    groupsToOverride: [],
                    iamRolesToOverride: [],
                },
            },
            response: { claimsOverrideDetails: {} },
        };

        const result = await callHandler(handler, event);

        expect(result.response.claimsOverrideDetails?.claimsToSuppress).toEqual([]);
    });

    it('returns event unchanged on error', async () => {
        const { handler } = await import('./handler.js');

        // Create event with undefined request to trigger error
        const event: any = {
            version: '1',
            triggerSource: 'TokenGeneration_Authentication',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: null,
            response: { claimsOverrideDetails: {} },
        };

        const result = await callHandler(handler, event);

        // Should return the original event without throwing
        expect(result).toBe(event);
    });

    it('trims whitespace from ALLOWED_CLAIMS entries', async () => {
        process.env.ALLOWED_CLAIMS = ' email , custom:partner , custom:role ';

        const { handler } = await import('./handler.js');

        const event: PreTokenGenerationTriggerEvent = {
            version: '1',
            triggerSource: 'TokenGeneration_Authentication',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {
                    sub: '12345678-1234-1234-1234-123456789012',
                    email: 'test@example.com',
                    'custom:partner': 'partner-123',
                    'custom:role': 'admin',
                },
                groupConfiguration: {
                    groupsToOverride: [],
                    iamRolesToOverride: [],
                },
            },
            response: { claimsOverrideDetails: {} },
        };

        const result = await callHandler(handler, event);

        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('email');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('custom:partner');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('custom:role');
    });

    it('filters empty strings from ALLOWED_CLAIMS', async () => {
        process.env.ALLOWED_CLAIMS = 'email,,custom:partner,  ,custom:role';

        const { handler } = await import('./handler.js');

        const event: PreTokenGenerationTriggerEvent = {
            version: '1',
            triggerSource: 'TokenGeneration_Authentication',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {
                    sub: '12345678-1234-1234-1234-123456789012',
                    email: 'test@example.com',
                    'custom:partner': 'partner-123',
                },
                groupConfiguration: {
                    groupsToOverride: [],
                    iamRolesToOverride: [],
                },
            },
            response: { claimsOverrideDetails: {} },
        };

        const result = await callHandler(handler, event);

        // Should work correctly despite empty entries
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('email');
        expect(result.response.claimsOverrideDetails?.claimsToSuppress).not.toContain('custom:partner');
    });
});
