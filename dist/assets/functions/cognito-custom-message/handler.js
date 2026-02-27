import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
// Load templates
const forgotPasswordTemplatePath = resolve(__dirname, 'forgotpassword.html');
const mfaTemplatePath = resolve(__dirname, 'mfa.html');
const forgotPasswordTemplateHtml = readFileSync(forgotPasswordTemplatePath, 'utf8');
const mfaTemplateHtml = readFileSync(mfaTemplatePath, 'utf8');
// Default subjects
const defaultForgotPasswordSubject = 'Password Reset';
const defaultMfaSubject = 'Your Verification Code';
/**
 * Lambda handler for Cognito custom message trigger
 * Customizes email messages for forgot password and MFA with HTML templates
 */
export const handler = async (event) => {
    try {
        const code = event?.request?.codeParameter;
        if (!code) {
            console.error('Missing codeParameter in event');
            throw new Error('Code parameter not found');
        }
        const currentYear = String(new Date().getFullYear());
        // Handle Forgot Password
        if (event?.triggerSource === 'CustomMessage_ForgotPassword') {
            const subject = process.env.COGNITO_FORGOT_PASSWORD_SUBJECT || defaultForgotPasswordSubject;
            const htmlMessage = forgotPasswordTemplateHtml
                .replaceAll('{code}', code)
                .replaceAll('{year}', currentYear);
            event.response.emailSubject = subject;
            event.response.emailMessage = htmlMessage;
        }
        // Handle MFA Code (sent during authentication)
        if (event?.triggerSource === 'CustomMessage_Authentication') {
            const subject = process.env.COGNITO_MFA_SUBJECT || defaultMfaSubject;
            const htmlMessage = mfaTemplateHtml
                .replaceAll('{code}', code)
                .replaceAll('{year}', currentYear);
            event.response.emailSubject = subject;
            event.response.emailMessage = htmlMessage;
        }
        return event;
    }
    catch (error) {
        console.error('Error in custom message trigger:', error);
        throw error;
    }
};
