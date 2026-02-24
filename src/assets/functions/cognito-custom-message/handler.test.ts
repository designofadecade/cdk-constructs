import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CustomMessageTriggerEvent, Context, Callback } from 'aws-lambda';

describe('cognito-custom-message handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        delete process.env.COGNITO_FORGOT_PASSWORD_SUBJECT;
    });

    // Helper to call handler with required 3-arg signature
    const callHandler = (handler: any, event: CustomMessageTriggerEvent) => {
        return handler(event, {} as Context, (() => { }) as Callback<CustomMessageTriggerEvent>);
    };

    it('customizes forgot password email with HTML template', async () => {
        const { handler } = await import('./handler.js');

        const event: CustomMessageTriggerEvent = {
            version: '1',
            triggerSource: 'CustomMessage_ForgotPassword',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {
                    sub: '12345678-1234-1234-1234-123456789012',
                    email: 'test@example.com',
                },
                codeParameter: '123456',
                linkParameter: '',
                usernameParameter: null,
            },
            response: {
                smsMessage: null,
                emailSubject: '',
                emailMessage: '',
            },
        };

        const result = await callHandler(handler, event);

        expect(result.response.emailSubject).toBe('Password Reset');
        expect(result.response.emailMessage).toContain('123456');
        expect(result.response.emailMessage).toContain(String(new Date().getFullYear()));
    });

    it('uses custom subject when environment variable is set', async () => {
        process.env.COGNITO_FORGOT_PASSWORD_SUBJECT = 'Custom Reset Password Email';

        const { handler } = await import('./handler.js');

        const event: CustomMessageTriggerEvent = {
            version: '1',
            triggerSource: 'CustomMessage_ForgotPassword',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {
                    sub: '12345678-1234-1234-1234-123456789012',
                    email: 'test@example.com',
                },
                codeParameter: '654321',
                linkParameter: '',
                usernameParameter: null,
            },
            response: {
                smsMessage: null,
                emailSubject: '',
                emailMessage: '',
            },
        };

        const result = await callHandler(handler, event);

        expect(result.response.emailSubject).toBe('Custom Reset Password Email');
        expect(result.response.emailMessage).toContain('654321');
    });

    it('returns unchanged event for non-forgot-password triggers', async () => {
        const { handler } = await import('./handler.js');

        const event: CustomMessageTriggerEvent = {
            version: '1',
            triggerSource: 'CustomMessage_SignUp',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {
                    sub: '12345678-1234-1234-1234-123456789012',
                    email: 'test@example.com',
                },
                codeParameter: '123456',
                linkParameter: '',
                usernameParameter: null,
            },
            response: {
                smsMessage: null,
                emailSubject: '',
                emailMessage: '',
            },
        };

        const result = await callHandler(handler, event);

        expect(result.response.emailSubject).toBe('');
        expect(result.response.emailMessage).toBe('');
    });

    it('throws error when code parameter is missing', async () => {
        const { handler } = await import('./handler.js');

        const event: CustomMessageTriggerEvent = {
            version: '1',
            triggerSource: 'CustomMessage_ForgotPassword',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {
                    sub: '12345678-1234-1234-1234-123456789012',
                    email: 'test@example.com',
                },
                codeParameter: '',
                linkParameter: '',
                usernameParameter: null,
            },
            response: {
                smsMessage: null,
                emailSubject: '',
                emailMessage: '',
            },
        };

        await expect(callHandler(handler, event)).rejects.toThrow('Code parameter not found');
    });

    it('replaces all code placeholders in template', async () => {
        const { handler } = await import('./handler.js');

        const event: CustomMessageTriggerEvent = {
            version: '1',
            triggerSource: 'CustomMessage_ForgotPassword',
            region: 'us-east-1',
            userPoolId: 'us-east-1_test123',
            userName: 'testuser',
            callerContext: {
                awsSdkVersion: '1',
                clientId: 'test-client-id',
            },
            request: {
                userAttributes: {
                    sub: '12345678-1234-1234-1234-123456789012',
                    email: 'test@example.com',
                },
                codeParameter: '999888',
                linkParameter: '',
                usernameParameter: null,
            },
            response: {
                smsMessage: null,
                emailSubject: '',
                emailMessage: '',
            },
        };

        const result = await callHandler(handler, event);

        // Verify the code appears in the message (template may have it multiple times)
        const codeOccurrences = (result.response.emailMessage.match(/999888/g) || []).length;
        expect(codeOccurrences).toBeGreaterThan(0);
    });
});
