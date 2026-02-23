import { Construct } from 'constructs';
import { StringAttribute, ClientAttributes, type IUserPool, type UserPoolClient, type StringAttributeProps, type UserPoolTriggers, type MfaSecondFactor, type ICustomAttribute } from 'aws-cdk-lib/aws-cognito';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { type IHostedZone } from 'aws-cdk-lib/aws-route53';
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
        readonly tags: ReadonlyArray<{
            readonly key: string;
            readonly value: string;
        }>;
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
export declare class Cognito extends Construct {
    #private;
    constructor(scope: Construct, id: string, props: CognitoProps);
    /**
     * Gets the User Pool instance
     */
    get userPool(): IUserPool;
    /**
     * Gets the User Pool domain name
     */
    get domain(): string;
    /**
     * Gets a User Pool Client by its ID
     *
     * @param id - The client ID used when creating the client
     * @returns The UserPoolClient or undefined if not found
     */
    getUserPoolClient(id: string): UserPoolClient | undefined;
    /**
     * Sets up a custom message Lambda trigger
     *
     * @param lambdaFunction - The Lambda function to handle custom messages
     */
    setupCustomMessageLambdaTrigger(lambdaFunction: import('aws-cdk-lib/aws-lambda').IFunction): void;
    /**
     * Creates a string attribute configuration
     *
     * @param props - String attribute properties
     * @returns StringAttribute instance
     */
    static StringAttribute(props: StringAttributeProps): StringAttribute;
    /**
     * Creates a ClientAttributes instance for read/write permissions
     *
     * @param standardAttributes - Standard attributes to include
     * @param customAttributes - Custom attribute names to include
     * @returns ClientAttributes instance
     */
    static ReadAttributes(standardAttributes?: {}, customAttributes?: string[]): ClientAttributes;
    /**
     * Loads branding configuration from a JSON file
     *
     * @param relativePath - Path to the branding JSON file (relative to caller)
     * @param fromImportMetaUrl - The import.meta.url of the calling module
     * @returns Loaded branding configuration
     */
    static LoadBrandingFromFile(relativePath: string, fromImportMetaUrl?: string): LoadedBranding;
    /**
     * Gets the entry path for the auth callback function
     */
    static CallbackAuthFunctionEntryPath(): string;
    /**
     * Gets the entry path for the sign-out callback function
     */
    static CallbackSignOutFunctionEntryPath(): string;
    /**
     * Gets the entry path for the HTTP API authorization function
     */
    static HttpApiAuthorizationFunctionEntryPath(): string;
    /**
     * Gets the entry path for the pre-token generation function
     */
    static PreTokenGenerationFunctionEntryPath(): string;
    /**
     * Gets the entry path for the custom message function
     */
    static CustomMessageFunctionEntryPath(): string;
    /**
     * Gets the entry path for the token refresh function
     */
    static TokenRefreshFunctionEntryPath(): string;
}
