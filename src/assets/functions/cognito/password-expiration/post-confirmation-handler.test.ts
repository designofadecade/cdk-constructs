/**
 * Tests for Post-Confirmation Lambda Trigger for Password Expiration
 */

import { describe, it, expect } from 'vitest';
import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { handler } from './post-confirmation-handler.js';

describe('Password Expiration Post-Confirmation Handler', () => {
    it('should update last-password-change on forgot password confirmation', async () => {
        const event: PostConfirmationTriggerEvent = {
            version: '1',
            region: 'us-east-1',
            userPoolId: 'us-east-1_abcdefghi',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            triggerSource: 'PostConfirmation_ConfirmForgotPassword',
            request: {
                userAttributes: {
                    email: 'test@example.com',
                    'custom:last-password-change': '1234567890000',
                },
            },
            response: {},
        };

        const result = await handler(event);

        expect(result.response.claimsOverrideDetails).toBeDefined();
        expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride).toBeDefined();
        expect(
            result.response.claimsOverrideDetails?.claimsToAddOrOverride?.['custom:last-password-change']
        ).toBeDefined();

        // Verify it's a timestamp (should be a string representation of a number)
        const timestamp = result.response.claimsOverrideDetails?.claimsToAddOrOverride?.['custom:last-password-change'];
        expect(timestamp).toMatch(/^\d+$/);
        expect(parseInt(timestamp as string, 10)).toBeGreaterThan(0);

        // Should be different from the old timestamp
        expect(timestamp).not.toBe('1234567890000');
    });

    it('should update last-password-change on sign-up confirmation', async () => {
        const event: PostConfirmationTriggerEvent = {
            version: '1',
            region: 'us-east-1',
            userPoolId: 'us-east-1_abcdefghi',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            triggerSource: 'PostConfirmation_ConfirmSignUp',
            request: {
                userAttributes: {
                    email: 'test@example.com',
                },
            },
            response: {},
        };

        const result = await handler(event);

        expect(result.response.claimsOverrideDetails).toBeDefined();
        expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride).toBeDefined();
        expect(
            result.response.claimsOverrideDetails?.claimsToAddOrOverride?.['custom:last-password-change']
        ).toBeDefined();

        // Verify it's a timestamp
        const timestamp = result.response.claimsOverrideDetails?.claimsToAddOrOverride?.['custom:last-password-change'];
        expect(timestamp).toMatch(/^\d+$/);
        expect(parseInt(timestamp as string, 10)).toBeGreaterThan(0);
    });

    it('should not update last-password-change for other trigger sources', async () => {
        // Using a cast to simulate an unknown trigger source
        const event = {
            version: '1',
            region: 'us-east-1',
            userPoolId: 'us-east-1_abcdefghi',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            triggerSource: 'PostConfirmation_SomeOtherSource',
            request: {
                userAttributes: {
                    email: 'test@example.com',
                },
            },
            response: {},
        } as unknown as PostConfirmationTriggerEvent;

        const result = await handler(event);

        // Should not set claimsOverrideDetails for other trigger sources
        expect(result.response.claimsOverrideDetails).toBeUndefined();
    });
});
