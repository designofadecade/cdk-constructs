import type { PreTokenGenerationTriggerHandler } from 'aws-lambda';
/**
 * Lambda handler for Cognito pre-token generation trigger
 * Suppresses claims not in the allowed list
 */
export declare const handler: PreTokenGenerationTriggerHandler;
