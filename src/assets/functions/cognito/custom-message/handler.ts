import type { CustomMessageTriggerEvent, CustomMessageTriggerHandler } from 'aws-lambda';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath((import.meta as any).url));

// Load email templates
const forgotPasswordTemplatePath = resolve(__dirname, 'forgotpassword.html');
const mfaTemplatePath = resolve(__dirname, 'mfa.html');
const signupTemplatePath = resolve(__dirname, 'signup.html');
const verifyAttributeTemplatePath = resolve(__dirname, 'verify-attribute.html');
const forgotPasswordTemplateHtml = readFileSync(forgotPasswordTemplatePath, 'utf8');
const mfaTemplateHtml = readFileSync(mfaTemplatePath, 'utf8');
const signupTemplateHtml = readFileSync(signupTemplatePath, 'utf8');
const verifyAttributeTemplateHtml = readFileSync(verifyAttributeTemplatePath, 'utf8');

// Load SMS templates
const forgotPasswordSmsTemplatePath = resolve(__dirname, 'forgotpassword-sms.txt');
const mfaSmsTemplatePath = resolve(__dirname, 'mfa-sms.txt');
const signupSmsTemplatePath = resolve(__dirname, 'signup-sms.txt');
const verifyAttributeSmsTemplatePath = resolve(__dirname, 'verify-attribute-sms.txt');
const forgotPasswordSmsTemplate = readFileSync(forgotPasswordSmsTemplatePath, 'utf8');
const mfaSmsTemplate = readFileSync(mfaSmsTemplatePath, 'utf8');
const signupSmsTemplate = readFileSync(signupSmsTemplatePath, 'utf8');
const verifyAttributeSmsTemplate = readFileSync(verifyAttributeSmsTemplatePath, 'utf8');

// Default subjects
const defaultForgotPasswordSubject = 'Password Reset';
const defaultMfaSubject = 'Your Verification Code';
const defaultSignupSubject = 'Verify Your Account';
const defaultVerifyAttributeSubject = 'Verify Your Information';

/**
 * Lambda handler for Cognito custom message trigger
 * Customizes email and SMS messages for forgot password and MFA with templates
 */
export const handler: CustomMessageTriggerHandler = async (event: CustomMessageTriggerEvent): Promise<CustomMessageTriggerEvent> => {
    try {
        console.log('Custom message trigger invoked:', {
            triggerSource: event?.triggerSource,
            userPoolId: event?.userPoolId,
            userName: event?.userName,
        });

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
            const smsMessage = forgotPasswordSmsTemplate
                .replaceAll('{code}', code);

            event.response.emailSubject = subject;
            event.response.emailMessage = htmlMessage;
            event.response.smsMessage = smsMessage;
        }

        // Handle MFA Code (sent during authentication)
        if (event?.triggerSource === 'CustomMessage_Authentication') {
            const subject = process.env.COGNITO_MFA_SUBJECT || defaultMfaSubject;
            const htmlMessage = mfaTemplateHtml
                .replaceAll('{code}', code)
                .replaceAll('{year}', currentYear);
            const smsMessage = mfaSmsTemplate
                .replaceAll('{code}', code);

            event.response.emailSubject = subject;
            event.response.emailMessage = htmlMessage;
            event.response.smsMessage = smsMessage;
        }

        // Handle Sign Up Verification
        if (event?.triggerSource === 'CustomMessage_SignUp') {
            console.log('Processing signup verification message');
            const subject = process.env.COGNITO_SIGNUP_SUBJECT || defaultSignupSubject;
            const htmlMessage = signupTemplateHtml
                .replaceAll('{code}', code)
                .replaceAll('{year}', currentYear);
            const smsMessage = signupSmsTemplate
                .replaceAll('{code}', code);

            event.response.emailSubject = subject;
            event.response.emailMessage = htmlMessage;
            event.response.smsMessage = smsMessage;

            console.log('Signup verification message customized:', {
                subject,
                hasHtmlMessage: !!htmlMessage,
                hasSmsMessage: !!smsMessage,
            });
        }

        // Handle Verify User Attribute (email/phone verification)
        if (event?.triggerSource === 'CustomMessage_VerifyUserAttribute') {
            console.log('Processing user attribute verification message');
            const subject = process.env.COGNITO_VERIFY_ATTRIBUTE_SUBJECT || defaultVerifyAttributeSubject;
            const htmlMessage = verifyAttributeTemplateHtml
                .replaceAll('{code}', code)
                .replaceAll('{year}', currentYear);
            const smsMessage = verifyAttributeSmsTemplate
                .replaceAll('{code}', code);

            event.response.emailSubject = subject;
            event.response.emailMessage = htmlMessage;
            event.response.smsMessage = smsMessage;

            console.log('User attribute verification message customized:', {
                subject,
                hasHtmlMessage: !!htmlMessage,
                hasSmsMessage: !!smsMessage,
            });
        }

        return event;
    } catch (error) {
        console.error('Error in custom message trigger:', error);
        throw error;
    }
};
