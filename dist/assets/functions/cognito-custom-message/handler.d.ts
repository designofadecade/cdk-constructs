import type { CustomMessageTriggerHandler } from 'aws-lambda';
/**
 * Lambda handler for Cognito custom message trigger
 * Customizes email messages for forgot password and MFA with HTML templates
 */
export declare const handler: CustomMessageTriggerHandler;
