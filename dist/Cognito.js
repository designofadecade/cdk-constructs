import { Construct } from 'constructs';
import { Tags, CfnOutput } from 'aws-cdk-lib';
import { UserPool, ManagedLoginVersion, CfnManagedLoginBranding, StringAttribute, ClientAttributes, UserPoolEmail, UserPoolOperation, Mfa, } from 'aws-cdk-lib/aws-cognito';
import { RecordTarget, ARecord } from 'aws-cdk-lib/aws-route53';
import { UserPoolDomainTarget } from 'aws-cdk-lib/aws-route53-targets';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * A CDK construct for creating Cognito User Pools with advanced features
 *
 * Features:
 * - Email-based authentication
 * - MFA support (optional or required)
 * - Custom domains with Route53 integration
 * - SES email integration
 * - Multiple app clients with per-client branding
 * - Custom attributes
 * - Lambda triggers
 * - Helper methods for common configurations
 *
 * @example
 * ```typescript
 * const userPool = new Cognito(this, 'UserPool', {
 *   stack: { id: 'my-app', label: 'My App', tags: [] },
 *   mfa: { required: true, mfaSecondFactor: { sms: false, otp: true } },
 *   customDomain: {
 *     domain: 'auth.example.com',
 *     certificate: myCertificate,
 *     hostedZone: myZone,
 *   },
 *   clients: [{
 *     id: 'web',
 *     name: 'Web Client',
 *     callbackUrls: ['https://example.com/callback'],
 *     logoutUrls: ['https://example.com/logout'],
 *     branding: Cognito.LoadBrandingFromFile('./branding.json'),
 *   }],
 * });
 *
 * // Get a specific client
 * const webClient = userPool.getUserPoolClient('web');
 * ```
 */
export class Cognito extends Construct {
    #userPool;
    #userPoolDomain;
    #domainName;
    #userPoolClients = new Map();
    constructor(scope, id, props) {
        super(scope, id);
        this.#userPool = new UserPool(this, 'UserPool', {
            userPoolName: props.stack.label,
            signInCaseSensitive: false,
            signInAliases: {
                email: true,
            },
            autoVerify: {
                email: true,
            },
            ...(props.mfa != null
                ? {
                    mfa: (typeof props.mfa === 'boolean' ? props.mfa : props.mfa.required) ? Mfa.REQUIRED : Mfa.OPTIONAL,
                    mfaSecondFactor: props.mfaSecondFactor ??
                        (typeof props.mfa === 'object' ? props.mfa.mfaSecondFactor : undefined) ?? {
                        sms: false,
                        otp: true,
                    },
                }
                : {}),
            standardAttributes: {
                email: {
                    required: true,
                    mutable: false,
                },
            },
            customAttributes: props.customAttributes ?? undefined,
            lambdaTriggers: props.lambdaTriggers ?? {},
            email: props.sesEmail
                ? UserPoolEmail.withSES({
                    fromEmail: props.sesEmail.fromEmail,
                    fromName: props.sesEmail.fromName ?? props.stack.label,
                    replyTo: props.sesEmail.replyTo,
                    sesVerifiedDomain: props.sesEmail.verifiedDomain,
                })
                : undefined,
        });
        this.#userPoolDomain = this.#userPool.addDomain('UserPoolDomain', {
            managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
            customDomain: props.customDomain
                ? {
                    domainName: props.customDomain.domain,
                    certificate: props.customDomain.certificate,
                }
                : undefined,
        });
        this.#domainName = `${this.#userPoolDomain.domainName}.auth.ca-central-1.amazoncognito.com`;
        if (props.clients) {
            props.clients.forEach(({ id, name, callbackUrls, logoutUrls, branding }) => {
                const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '');
                const userPoolClient = this.#userPool.addClient(`UserPoolMainClient${sanitizedName}`, {
                    userPoolClientName: name,
                    authFlows: {
                        adminUserPassword: true,
                        userPassword: true,
                        userSrp: true,
                    },
                    oAuth: {
                        flows: {
                            authorizationCodeGrant: true,
                        },
                        callbackUrls: [...callbackUrls],
                        logoutUrls: [...logoutUrls],
                    },
                    readAttributes: props.readAttributes,
                    writeAttributes: props.writeAttributes,
                });
                const clientBranding = branding ?? {};
                const managedLoginBrandingProps = {
                    userPoolId: this.#userPool.userPoolId,
                    clientId: userPoolClient.userPoolClientId,
                };
                if (clientBranding.returnMergedResources !== undefined) {
                    managedLoginBrandingProps.returnMergedResources = clientBranding.returnMergedResources;
                }
                if (clientBranding.settings !== undefined) {
                    managedLoginBrandingProps.settings = clientBranding.settings;
                }
                if (clientBranding.assets !== undefined) {
                    managedLoginBrandingProps.assets = clientBranding.assets;
                }
                if (clientBranding.useCognitoProvidedValues !== undefined) {
                    managedLoginBrandingProps.useCognitoProvidedValues = clientBranding.useCognitoProvidedValues;
                }
                else if (clientBranding.settings !== undefined || clientBranding.assets !== undefined) {
                    managedLoginBrandingProps.useCognitoProvidedValues = false;
                }
                else {
                    managedLoginBrandingProps.useCognitoProvidedValues = true;
                }
                new CfnManagedLoginBranding(this, `ClientManagedStyle${sanitizedName}`, managedLoginBrandingProps);
                this.#userPoolClients.set(id, userPoolClient);
            });
        }
        if (props.customDomain?.hostedZone) {
            new ARecord(this, 'Route53AliasRecord', {
                zone: props.customDomain.hostedZone,
                recordName: props.customDomain.domain,
                target: RecordTarget.fromAlias(new UserPoolDomainTarget(this.#userPoolDomain)),
            });
        }
        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#userPool).add(key, value);
        });
        new CfnOutput(this, 'CognitoUserPoolID', {
            value: this.#userPool.userPoolId,
            description: 'Cognito User Pool ID',
            exportName: `${props.stack.id}-cognito-user-pool-id`,
        });
        new CfnOutput(this, 'CognitoUserPoolDomain', {
            value: this.#userPoolDomain.domainName,
            description: 'Cognito User Pool Domain Name',
            exportName: `${props.stack.id}-cognito-domain-name`,
        });
    }
    /**
     * Gets the User Pool instance
     */
    get userPool() {
        return this.#userPool;
    }
    /**
     * Gets the User Pool domain name
     */
    get domain() {
        return this.#domainName;
    }
    /**
     * Gets a User Pool Client by its ID
     *
     * @param id - The client ID used when creating the client
     * @returns The UserPoolClient or undefined if not found
     */
    getUserPoolClient(id) {
        return this.#userPoolClients.get(id);
    }
    /**
     * Sets up a custom message Lambda trigger
     *
     * @param lambdaFunction - The Lambda function to handle custom messages
     */
    setupCustomMessageLambdaTrigger(lambdaFunction) {
        this.#userPool.addTrigger(UserPoolOperation.CUSTOM_MESSAGE, lambdaFunction);
    }
    /**
     * Creates a string attribute configuration
     *
     * @param props - String attribute properties
     * @returns StringAttribute instance
     */
    static StringAttribute(props) {
        return new StringAttribute(props);
    }
    /**
     * Creates a ClientAttributes instance for read/write permissions
     *
     * @param standardAttributes - Standard attributes to include
     * @param customAttributes - Custom attribute names to include
     * @returns ClientAttributes instance
     */
    static ReadAttributes(standardAttributes = {}, customAttributes = []) {
        const attributes = new ClientAttributes();
        if (Object.keys(standardAttributes).length > 0) {
            attributes.withStandardAttributes(standardAttributes);
        }
        if (customAttributes.length > 0) {
            attributes.withCustomAttributes(...customAttributes);
        }
        return attributes;
    }
    /**
     * Loads branding configuration from a JSON file
     *
     * @param relativePath - Path to the branding JSON file (relative to caller)
     * @param fromImportMetaUrl - The import.meta.url of the calling module
     * @returns Loaded branding configuration
     */
    static LoadBrandingFromFile(relativePath, fromImportMetaUrl) {
        const fromDir = dirname(fileURLToPath(fromImportMetaUrl ?? import.meta.url));
        const brandingFilePath = resolve(fromDir, relativePath);
        const brandingJson = JSON.parse(readFileSync(brandingFilePath, 'utf8'));
        const brandingSource = (brandingJson.ManagedLoginBranding ?? brandingJson);
        const settings = brandingSource.Settings ?? brandingSource.settings;
        const sourceAssets = (brandingSource.Assets ?? brandingSource.assets ?? []);
        const assets = sourceAssets
            .map((asset) => ({
            category: (asset.category ?? asset.Category),
            colorMode: (asset.colorMode ?? asset.ColorMode),
            extension: (asset.extension ?? asset.Extension),
            bytes: (asset.bytes ?? asset.Bytes),
        }))
            .filter((asset) => asset.category && asset.colorMode && asset.extension && asset.bytes)
            .filter((asset) => asset.category !== 'IDP_BUTTON_ICON');
        const useCognitoProvidedValues = (brandingSource.UseCognitoProvidedValues ??
            brandingSource.useCognitoProvidedValues);
        return {
            useCognitoProvidedValues: useCognitoProvidedValues === true && (settings !== undefined || assets.length > 0)
                ? false
                : useCognitoProvidedValues,
            settings,
            assets,
        };
    }
    /**
     * Gets the entry path for the auth callback function
     */
    static CallbackAuthFunctionEntryPath() {
        return import.meta.resolve('@designofadecade/cdk-constructs/assets/functions/cognito-auth-callback/handler.js');
    }
    /**
     * Gets the entry path for the sign-out callback function
     */
    static CallbackSignOutFunctionEntryPath() {
        return import.meta.resolve('@designofadecade/cdk-constructs/assets/functions/cognito-signout-callback/handler.js');
    }
    /**
     * Gets the entry path for the HTTP API authorization function
     */
    static HttpApiAuthorizationFunctionEntryPath() {
        return import.meta.resolve('@designofadecade/cdk-constructs/assets/functions/cognito-auth-http-api-authorization/handler.js');
    }
    /**
     * Gets the entry path for the pre-token generation function
     */
    static PreTokenGenerationFunctionEntryPath() {
        return import.meta.resolve('@designofadecade/cdk-constructs/assets/functions/cognito-pre-token-generation/handler.js');
    }
    /**
     * Gets the entry path for the custom message function
     */
    static CustomMessageFunctionEntryPath() {
        return import.meta.resolve('@designofadecade/cdk-constructs/assets/functions/cognito-custom-message/handler.js');
    }
    /**
     * Gets the entry path for the token refresh function
     */
    static TokenRefreshFunctionEntryPath() {
        return import.meta.resolve('@designofadecade/cdk-constructs/assets/functions/cognito-auth-token-refresh/handler.js');
    }
}
