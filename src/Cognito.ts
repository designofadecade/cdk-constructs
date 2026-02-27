import { Construct } from 'constructs';
import { Tags, CfnOutput } from 'aws-cdk-lib';
import {
    UserPool,
    ManagedLoginVersion,
    CfnManagedLoginBranding,
    StringAttribute,
    ClientAttributes,
    UserPoolEmail,
    UserPoolOperation,
    Mfa,
    type IUserPool,
    type UserPoolClient,
    type UserPoolDomain,
    type StringAttributeProps,
    type StringAttributeConstraints,
    type CustomAttributeConfig,
    type UserPoolTriggers,
    type MfaSecondFactor,
    type StandardAttribute,
    type StandardAttributes,
    type ICustomAttribute,
} from 'aws-cdk-lib/aws-cognito';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { RecordTarget, ARecord, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { UserPoolDomainTarget } from 'aws-cdk-lib/aws-route53-targets';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * MFA configuration options
 */
export interface MfaConfig {
    /**
     * Whether MFA is required (true) or optional (false)
     */
    readonly required: boolean;

    /**
     * Optional MFA second factor configuration
     */
    readonly mfaSecondFactor?: MfaSecondFactor;
}

/**
 * Custom domain configuration
 */
export interface CustomDomainConfig {
    /**
     * The custom domain name
     */
    readonly domain: string;

    /**
     * ACM certificate for the domain
     */
    readonly certificate: ICertificate;

    /**
     * Optional Route53 hosted zone for creating DNS records
     */
    readonly hostedZone?: IHostedZone;
}

/**
 * SES email configuration for Cognito
 */
export interface SesEmailConfig {
    /**
     * The email address to send from
     */
    readonly fromEmail: string;

    /**
     * Optional display name for the sender
     */
    readonly fromName?: string;

    /**
     * Optional reply-to email address
     */
    readonly replyTo?: string;

    /**
     * The verified SES domain
     */
    readonly verifiedDomain: string;
}

/**
 * Branding configuration for a User Pool Client
 */
export interface ClientBrandingConfig {
    /**
     * Whether to return merged resources
     */
    readonly returnMergedResources?: boolean;

    /**
     * Branding settings JSON
     */
    readonly settings?: unknown;

    /**
     * Branding assets
     */
    readonly assets?: ReadonlyArray<{
        readonly category: string;
        readonly colorMode: string;
        readonly extension: string;
        readonly bytes: string;
    }>;

    /**
     * Whether to use Cognito-provided default values
     */
    readonly useCognitoProvidedValues?: boolean;
}

/**
 * User Pool Client configuration
 */
export interface UserPoolClientConfig {
    /**
     * Unique identifier for this client
     */
    readonly id: string;

    /**
     * Display name for the client
     */
    readonly name: string;

    /**
     * Callback URLs for OAuth flow
     */
    readonly callbackUrls: ReadonlyArray<string>;

    /**
     * Logout URLs for OAuth flow
     */
    readonly logoutUrls: ReadonlyArray<string>;

    /**
     * Optional branding configuration
     */
    readonly branding?: ClientBrandingConfig;
}

/**
 * Properties for configuring a Cognito User Pool
 */
export interface CognitoProps {
    /**
     * The stack reference
     */
    readonly stack: {
        readonly id: string;
        readonly label: string;
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    };

    /**
     * Optional MFA configuration (boolean or detailed config)
     */
    readonly mfa?: boolean | MfaConfig;

    /**
     * Optional MFA second factor (deprecated - use mfa.mfaSecondFactor instead)
     */
    readonly mfaSecondFactor?: MfaSecondFactor;

    /**
     * Optional custom attributes for user profiles
     */
    readonly customAttributes?: Record<string, ICustomAttribute>;

    /**
     * Optional Lambda triggers for User Pool events
     */
    readonly lambdaTriggers?: UserPoolTriggers;

    /**
     * Optional SES email configuration (uses SES instead of Cognito email)
     */
    readonly sesEmail?: SesEmailConfig;

    /**
     * Optional custom domain configuration
     */
    readonly customDomain?: CustomDomainConfig;

    /**
     * Optional User Pool clients to create
     */
    readonly clients?: ReadonlyArray<UserPoolClientConfig>;

    /**
     * Optional read attributes configuration
     */
    readonly readAttributes?: ClientAttributes;

    /**
     * Optional write attributes configuration
     */
    readonly writeAttributes?: ClientAttributes;
}

/**
 * Loaded branding data structure
 */
export interface LoadedBranding {
    /**
     * Whether to use Cognito-provided values
     */
    readonly useCognitoProvidedValues?: boolean;

    /**
     * Branding settings
     */
    readonly settings?: unknown;

    /**
     * Branding assets
     */
    readonly assets: ReadonlyArray<{
        readonly category: string;
        readonly colorMode: string;
        readonly extension: string;
        readonly bytes: string;
    }>;
}

/**
 * A CDK construct for creating Cognito User Pools with advanced features
 * 
 * Features:
 * - Email-based authentication
 * - MFA support (optional or required) with SMS, TOTP, and Email options
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
 *   mfa: { required: true, mfaSecondFactor: { sms: false, otp: true, email: true } },
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
    #userPool: UserPool;
    #userPoolDomain: UserPoolDomain;
    #domainName: string;
    #userPoolClients = new Map<string, UserPoolClient>();
    #defaultUserPoolClient?: UserPoolClient;

    constructor(scope: Construct, id: string, props: CognitoProps) {
        super(scope, id);

        // Calculate MFA second factor configuration
        // Email MFA requires SES to be configured
        const getMfaSecondFactor = (): MfaSecondFactor | undefined => {
            if (props.mfa == null) return undefined;

            const explicitConfig = props.mfaSecondFactor ??
                (typeof props.mfa === 'object' ? props.mfa.mfaSecondFactor : undefined);

            if (explicitConfig) {
                // If email MFA is requested but SES is not configured, remove email
                if (explicitConfig.email && !props.sesEmail) {
                    return {
                        ...explicitConfig,
                        email: false,
                    };
                }
                return explicitConfig;
            }

            // Default configuration
            return {
                sms: false,
                otp: true,
                email: props.sesEmail != null, // Only enable email MFA if SES is configured
            };
        };

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
                    mfaSecondFactor: getMfaSecondFactor(),
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
            ...(props.customDomain
                ? {
                    customDomain: {
                        domainName: props.customDomain.domain,
                        certificate: props.customDomain.certificate,
                    },
                }
                : {
                    cognitoDomain: {
                        domainPrefix: `${props.stack.id}-${props.stack.label.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
                    },
                }),
        });

        this.#domainName = `${this.#userPoolDomain.domainName}.auth.ca-central-1.amazoncognito.com`;

        // Create default client if no clients specified
        if (!props.clients || props.clients.length === 0) {
            this.#defaultUserPoolClient = this.#userPool.addClient('UserPoolClient', {
                userPoolClientName: `${props.stack.label} Client`,
                authFlows: {
                    adminUserPassword: true,
                    userPassword: true,
                    userSrp: true,
                },
                readAttributes: props.readAttributes,
                writeAttributes: props.writeAttributes,
            });

            new CfnOutput(this, 'CognitoUserPoolClientID', {
                value: this.#defaultUserPoolClient.userPoolClientId,
                description: 'Cognito User Pool Client ID',
                exportName: `${props.stack.id}-cognito-user-pool-client-id`,
            });
        }

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
                const managedLoginBrandingProps: any = {
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
                } else if (clientBranding.settings !== undefined || clientBranding.assets !== undefined) {
                    managedLoginBrandingProps.useCognitoProvidedValues = false;
                } else {
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
    get userPool(): IUserPool {
        return this.#userPool;
    }

    /**
     * Gets the User Pool ID
     */
    get userPoolId(): string {
        return this.#userPool.userPoolId;
    }

    /**
     * Gets the default User Pool Client
     */
    get userPoolClient(): UserPoolClient | undefined {
        return this.#defaultUserPoolClient;
    }

    /**
     * Gets the default User Pool Client ID
     */
    get userPoolClientId(): string | undefined {
        return this.#defaultUserPoolClient?.userPoolClientId;
    }

    /**
     * Gets the User Pool domain name
     */
    get domain(): string {
        return this.#domainName;
    }

    /**
     * Gets a User Pool Client by its ID
     * 
     * @param id - The client ID used when creating the client
     * @returns The UserPoolClient or undefined if not found
     */
    getUserPoolClient(id: string): UserPoolClient | undefined {
        return this.#userPoolClients.get(id);
    }

    /**
     * Sets up a custom message Lambda trigger
     * 
     * @param lambdaFunction - The Lambda function to handle custom messages
     */
    setupCustomMessageLambdaTrigger(lambdaFunction: import('aws-cdk-lib/aws-lambda').IFunction): void {
        this.#userPool.addTrigger(UserPoolOperation.CUSTOM_MESSAGE, lambdaFunction);
    }

    /**
     * Creates a string attribute configuration
     * 
     * @param props - String attribute properties
     * @returns StringAttribute instance
     */
    static StringAttribute(props: StringAttributeProps): StringAttribute {
        return new StringAttribute(props);
    }

    /**
     * Creates a ClientAttributes instance for read/write permissions
     * 
     * @param standardAttributes - Standard attributes to include
     * @param customAttributes - Custom attribute names to include
     * @returns ClientAttributes instance
     */
    static ReadAttributes(standardAttributes = {}, customAttributes: string[] = []): ClientAttributes {
        const attributes = new ClientAttributes();

        if (Object.keys(standardAttributes).length > 0) {
            attributes.withStandardAttributes(standardAttributes as any);
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
    static LoadBrandingFromFile(relativePath: string, fromImportMetaUrl?: string): LoadedBranding {
        const fromDir = dirname(fileURLToPath(fromImportMetaUrl ?? (import.meta as any).url));
        const brandingFilePath = resolve(fromDir, relativePath);
        const brandingJson = JSON.parse(readFileSync(brandingFilePath, 'utf8')) as Record<string, unknown>;
        const brandingSource = (brandingJson.ManagedLoginBranding ?? brandingJson) as Record<string, unknown>;

        const settings = brandingSource.Settings ?? brandingSource.settings;
        const sourceAssets = (brandingSource.Assets ?? brandingSource.assets ?? []) as Array<Record<string, unknown>>;
        const assets = sourceAssets
            .map((asset) => ({
                category: (asset.category ?? asset.Category) as string,
                colorMode: (asset.colorMode ?? asset.ColorMode) as string,
                extension: (asset.extension ?? asset.Extension) as string,
                bytes: (asset.bytes ?? asset.Bytes) as string,
            }))
            .filter((asset) => asset.category && asset.colorMode && asset.extension && asset.bytes)
            .filter((asset) => asset.category !== 'IDP_BUTTON_ICON');

        const useCognitoProvidedValues = (brandingSource.UseCognitoProvidedValues ??
            brandingSource.useCognitoProvidedValues) as boolean | undefined;

        return {
            useCognitoProvidedValues:
                useCognitoProvidedValues === true && (settings !== undefined || assets.length > 0)
                    ? false
                    : useCognitoProvidedValues,
            settings,
            assets,
        };
    }

    /**
     * Gets the entry path for the auth callback function
     */
    static CallbackAuthFunctionEntryPath(): string {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        return resolve(__dirname, './assets/functions/cognito-auth-callback/handler.js');
    }

    /**
     * Gets the entry path for the sign-out callback function
     */
    static CallbackSignOutFunctionEntryPath(): string {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        return resolve(__dirname, './assets/functions/cognito-signout-callback/handler.js');
    }

    /**
     * Gets the entry path for the HTTP API authorization function
     */
    static HttpApiAuthorizationFunctionEntryPath(): string {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        return resolve(__dirname, './assets/functions/cognito-auth-http-api-authorization/handler.js');
    }

    /**
     * Gets the entry path for the pre-token generation function
     */
    static PreTokenGenerationFunctionEntryPath(): string {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        return resolve(__dirname, './assets/functions/cognito-pre-token-generation/handler.js');
    }

    /**
     * Gets the entry path for the custom message function
     */
    static CustomMessageFunctionEntryPath(): string {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        return resolve(__dirname, './assets/functions/cognito-custom-message/handler.js');
    }

    /**
     * Gets the entry path for the token refresh function
     */
    static TokenRefreshFunctionEntryPath(): string {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        return resolve(__dirname, './assets/functions/cognito-auth-token-refresh/handler.js');
    }
}
