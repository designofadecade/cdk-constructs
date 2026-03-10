/**
 * Post-Confirmation Lambda Trigger for Password Expiration
 * 
 * This function updates the password change timestamp when a user resets their password
 * through the forgot password flow.
 * 
 * Custom Attribute:
 * - custom:last-password-change: Timestamp (in milliseconds) of the last password change
 * 
 * Usage:
 * Set this as a Post-Confirmation trigger on your Cognito User Pool
 * 
 * Trigger Sources:
 * - PostConfirmation_ConfirmForgotPassword: User confirmed a forgot password request
 * - PostConfirmation_ConfirmSignUp: User confirmed sign-up (initial registration)
 */

import type {
    PostConfirmationTriggerEvent,
    PostConfirmationTriggerHandler,
} from 'aws-lambda';

export const handler: PostConfirmationTriggerHandler = async (
    event: PostConfirmationTriggerEvent,
): Promise<PostConfirmationTriggerEvent> => {
    // Update timestamp when password is reset or on initial sign-up
    if (
        event.triggerSource === 'PostConfirmation_ConfirmForgotPassword' ||
        event.triggerSource === 'PostConfirmation_ConfirmSignUp'
    ) {
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
