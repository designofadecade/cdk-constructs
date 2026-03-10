/**
 * Pre-Authentication Lambda Trigger for Password Expiration
 * 
 * This function checks if a user's password has expired before allowing authentication.
 * If the password is expired, it throws an error to prevent the user from signing in.
 * 
 * Environment Variables:
 * - PASSWORD_EXPIRATION_DAYS: Number of days before password expires
 * 
 * Custom Attribute:
 * - custom:last-password-change: Timestamp (in milliseconds) of the last password change
 * 
 * Usage:
 * Set this as a Pre-Authentication trigger on your Cognito User Pool
 */

import type {
    PreAuthenticationTriggerEvent,
    PreAuthenticationTriggerHandler,
} from 'aws-lambda';

export const handler: PreAuthenticationTriggerHandler = async (
    event: PreAuthenticationTriggerEvent,
): Promise<PreAuthenticationTriggerEvent> => {
    const expirationDays = parseInt(process.env.PASSWORD_EXPIRATION_DAYS || '0', 10);

    // If password expiration is not configured, allow authentication
    if (expirationDays === 0) {
        return event;
    }

    const lastChange = event.request.userAttributes['custom:last-password-change'];

    // If no timestamp exists, this is likely the first login
    // Allow it and let the post-auth trigger set the initial timestamp
    if (!lastChange) {
        return event;
    }

    try {
        const lastChangeDate = new Date(parseInt(lastChange, 10));
        const now = new Date();
        const daysSinceChange = Math.floor(
            (now.getTime() - lastChangeDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceChange >= expirationDays) {
            throw new Error(
                `Your password has expired. It has been ${daysSinceChange} days since your last password change. ` +
                `Please reset your password to continue.`,
            );
        }

        // Password is still valid
        return event;
    } catch (error) {
        // If we can't parse the date or there's any other error, throw the error
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Unable to verify password expiration status.');
    }
};
