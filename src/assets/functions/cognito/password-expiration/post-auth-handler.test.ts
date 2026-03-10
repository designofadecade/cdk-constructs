/**
 * Tests for Post-Authentication Lambda Trigger for Password Expiration
 */

import { describe, it, expect } from 'vitest';
import type { PostAuthenticationTriggerEvent, Context, Callback } from 'aws-lambda';
import { handler } from './post-auth-handler.js';

describe('Password Expiration Post-Auth Handler', () => {
    // Helper to call handler with required 3-arg signature
    const callHandler = (event: PostAuthenticationTriggerEvent) => {
        return handler(event, {} as Context, (() => {}) as Callback<PostAuthenticationTriggerEvent>);
    };
    it('should set last-password-change when attribute does not exist', async () => {
        const event: PostAuthenticationTriggerEvent = {
            version: '1',
            region: 'us-east-1',
            userPoolId: 'us-east-1_abcdefghi',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            triggerSource: 'PostAuthentication_Authentication',
            request: {
                userAttributes: {
                    email: 'test@example.com',
                },
                newDeviceUsed: false,
            },
            response: {},
        };

        const result = await callHandler(event);

        expect(result.response.claimsOverrideDetails).toBeDefined();
        expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride).toBeDefined();
        expect(
            result.response.claimsOverrideDetails?.claimsToAddOrOverride?.['custom:last-password-change']
        ).toBeDefined();

        // Verify it's a timestamp (should be a string representation of a number)
        const timestamp = result.response.claimsOverrideDetails?.claimsToAddOrOverride?.['custom:last-password-change'];
        expect(timestamp).toMatch(/^\d+$/);
        expect(parseInt(timestamp as string, 10)).toBeGreaterThan(0);
    });

    it('should not modify last-password-change when attribute already exists', async () => {
        const existingTimestamp = '1234567890000';
        const event: PostAuthenticationTriggerEvent = {
            version: '1',
            region: 'us-east-1',
            userPoolId: 'us-east-1_abcdefghi',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            triggerSource: 'PostAuthentication_Authentication',
            request: {
                userAttributes: {
                    email: 'test@example.com',
                    'custom:last-password-change': existingTimestamp,
                },
                newDeviceUsed: false,
            },
            response: {},
        };

        const result = await callHandler(event);

        // Should not set claimsOverrideDetails when attribute already exists
        expect(result.response.claimsOverrideDetails).toBeUndefined();
    });
});
