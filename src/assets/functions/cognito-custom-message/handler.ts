import type { CustomMessageTriggerEvent, CustomMessageTriggerHandler } from 'aws-lambda';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const templatePath = resolve(dirname(fileURLToPath((import.meta as any).url)), 'forgotpassword.html');
const defaultTemplateHtml = readFileSync(templatePath, 'utf8');
const defaultSubject = 'Password Reset';

/**
 * Lambda handler for Cognito custom message trigger
 * Customizes the forgot password email with HTML template
 */
export const handler: CustomMessageTriggerHandler = async (event: CustomMessageTriggerEvent): Promise<CustomMessageTriggerEvent> => {
    try {
        if (event?.triggerSource === 'CustomMessage_ForgotPassword') {
            const code = event?.request?.codeParameter;

            if (!code) {
                console.error('Missing codeParameter in event');
                throw new Error('Code parameter not found');
            }

            const subject = process.env.COGNITO_FORGOT_PASSWORD_SUBJECT || defaultSubject;
            const htmlMessage = defaultTemplateHtml.replaceAll('{code}', code).replaceAll('{year}', String(new Date().getFullYear()));

            event.response.emailSubject = subject;
            event.response.emailMessage = htmlMessage;
        }

        return event;
    } catch (error) {
        console.error('Error in custom message trigger:', error);
        throw error;
    }
};
