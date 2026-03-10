import type { PreTokenGenerationTriggerEvent, PreTokenGenerationTriggerHandler } from 'aws-lambda';

// Standard JWT claims that can't be suppressed
const standardClaims = new Set([
    'sub',
    'iss',
    'aud',
    'exp',
    'iat',
    'jti',
    'token_use',
    'auth_time',
    'cognito:username',
    'origin_jti',
    'event_id',
    'at_hash',
]);

// Parse allowed claims from environment variable (once at init)
const allowedClaimsFromEnv = process.env.ALLOWED_CLAIMS
    ? process.env.ALLOWED_CLAIMS.split(',')
        .map((c) => c.trim())
        .filter((c) => c)
    : [];

if (!process.env.ALLOWED_CLAIMS) {
    console.warn('ALLOWED_CLAIMS environment variable not set');
}

// Combine standard claims with allowed claims from env
const allowedClaims = new Set([...standardClaims, ...allowedClaimsFromEnv]);

/**
 * Lambda handler for Cognito pre-token generation trigger
 * Suppresses claims not in the allowed list
 */
export const handler: PreTokenGenerationTriggerHandler = async (event: PreTokenGenerationTriggerEvent): Promise<PreTokenGenerationTriggerEvent> => {
    try {
        const claimsToSuppress: string[] = [];

        // Suppress all claims that aren't in the allowed list
        if (event.request.userAttributes) {
            for (const claim in event.request.userAttributes) {
                if (!allowedClaims.has(claim)) {
                    claimsToSuppress.push(claim);
                }
            }
        }

        event.response = {
            claimsOverrideDetails: {
                claimsToSuppress: claimsToSuppress,
            },
        };

        return event;
    } catch (error) {
        console.error('Error in pre-token generation:', error);
        return event;
    }
};
