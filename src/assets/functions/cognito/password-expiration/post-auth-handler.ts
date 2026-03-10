/**
 * Post-Authentication Lambda Trigger for Password Expiration
 * 
 * This function initializes the password change timestamp on first login
 * or updates it if it doesn't exist.
 * 
 * Custom Attribute:
 * - custom:last-password-change: Timestamp (in milliseconds) of the last password change
 * 
 * Usage:
 * Set this as a Post-Authentication trigger on your Cognito User Pool
 * 
 * Note: This trigger runs AFTER successful authentication, so it's used to
 * set the initial timestamp. The Pre-Authentication trigger handles the actual
 * password expiration check.
 */

import type {
    PostAuthenticationTriggerEvent,
    PostAuthenticationTriggerHandler,
} from 'aws-lambda';

export const handler: PostAuthenticationTriggerHandler = async (
    event: PostAuthenticationTriggerEvent,
): Promise<PostAuthenticationTriggerEvent> => {
    const lastChange = event.request.userAttributes['custom:last-password-change'];

    // If no timestamp exists, set the initial password change date
    if (!lastChange) {
        event.response = {
            claimsOverrideDetails: {
                claimsToAddOrOverride: {
                    'custom:last-password-change': Date.now().toString(),
                },
            },
        };
    }

    return event;
};
