import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Secrets } from './Secrets.js';

describe('Secrets', () => {
    it('creates JSON secret', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        Secrets.json(stack, 'TestSecret', {
            name: 'test-secret',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'admin' }),
                generateStringKey: 'password',
            },
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::SecretsManager::Secret', {
            Name: 'test-secret',
            GenerateSecretString: {
                SecretStringTemplate: '{"username":"admin"}',
                GenerateStringKey: 'password',
            },
        });
    });

    it('creates string secret', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        Secrets.string(stack, 'TestSecret', {
            name: 'test-api-key',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::SecretsManager::Secret', {
            Name: 'test-api-key',
        });
    });

    it('creates secret from existing secret', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        const secret = Secrets.fromExistingSecret(stack, 'ExistingSecret', 'existing-secret-name');

        expect(secret).toBeDefined();
    });

    it('has REPLACE_ME constant', () => {
        expect(Secrets.REPLACE_ME).toBeDefined();
    });

    it('outputs secret ARN', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        Secrets.json(stack, 'TestSecret', {
            name: 'test-secret',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasOutput('*', {
            Description: 'Secret ARN',
        });
    });
});
