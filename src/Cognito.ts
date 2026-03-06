import { Construct } from 'constructs';
import { Tags, CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
    UserPool,
    ManagedLoginVersion,
    CfnManagedLoginBranding,
    CfnLogDeliveryConfiguration,
    CfnUserPoolRiskConfigurationAttachment,
    StringAttribute,
    ClientAttributes,
    UserPoolEmail,
    UserPoolOperation,
    Mfa,
    FeaturePlan,
    StandardThreatProtectionMode,
    CustomThreatProtectionMode,
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
import * as logs from 'aws-cdk-lib/aws-logs';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { RecordTarget, ARecord, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { UserPoolDomainTarget } from 'aws-cdk-lib/aws-route53-targets';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Waf } from './Waf.js';

/**
 * Account takeover action type
 */
export enum AccountTakeoverActionType {
    /**
     * Block the request
     */
    BLOCK = 'BLOCK',

    /**
     * Require MFA if configured for the user
     */
    MFA_IF_CONFIGURED = 'MFA_IF_CONFIGURED',

    /**
     * Require MFA
     */
    MFA_REQUIRED = 'MFA_REQUIRED',

    /**
     * Allow the request
     */
    NO_ACTION = 'NO_ACTION',
}

/**
 * Compromised credentials action type
 */
export enum CompromisedCredentialsActionType {
    /**
     * Block the request
     */
    BLOCK = 'BLOCK',

    /**
     * Allow the request
     */
    NO_ACTION = 'NO_ACTION',
}

/**
 * Account takeover action configuration
 */
export interface AccountTakeoverActionConfig {
    /**
     * The action to take
     */
    readonly eventAction: AccountTakeoverActionType;

    /**
     * Whether to send a notification email to the user
     * @default false
     */
    readonly notify?: boolean;
}

/**
 * Account takeover risk configuration for different risk levels
 */
export interface AccountTakeoverRiskConfiguration {
    /**
     * Action for low risk detected
     * @default { eventAction: AccountTakeoverActionType.NO_ACTION, notify: true }
     */
    readonly lowAction?: AccountTakeoverActionConfig;

    /**
     * Action for medium risk detected
     * @default { eventAction: AccountTakeoverActionType.MFA_IF_CONFIGURED, notify: true }
     */
    readonly mediumAction?: AccountTakeoverActionConfig;

    /**
     * Action for high risk detected
     * @default { eventAction: AccountTakeoverActionType.MFA_REQUIRED, notify: true }
     */
    readonly highAction?: AccountTakeoverActionConfig;
}

/**
 * Compromised credentials risk configuration
 */
export interface CompromisedCredentialsRiskConfiguration {
    /**
     * The action to take when compromised credentials are detected
     * @default CompromisedCredentialsActionType.BLOCK
     */
    readonly eventAction?: CompromisedCredentialsActionType;
}

/**
 * Notify configuration for risk detection email
 */
export interface NotifyConfiguration {
    /**
     * The source email address for notifications
     * Must be a verified email address or domain in SES
     */
    readonly sourceArn: string;

    /**
     * The email address to send from
     * @default Uses the email from sourceArn
     */
    readonly from?: string;

    /**
     * The reply-to email address
     */
    readonly replyTo?: string;

    /**
     * Email template for MFA notifications
     */
    readonly mfaEmail?: {
        /**
         * The email subject
         */
        readonly subject: string;

        /**
         * The HTML body of the email
         */
        readonly htmlBody?: string;

        /**
         * The text body of the email
         */
        readonly textBody?: string;
    };

    /**
     * Email template for no action notifications
     */
    readonly noActionEmail?: {
        /**
         * The email subject
         */
        readonly subject: string;

        /**
         * The HTML body of the email
         */
        readonly htmlBody?: string;

        /**
         * The text body of the email
         */
        readonly textBody?: string;
    };

    /**
     * Email template for block notifications
     */
    readonly blockEmail?: {
        /**
         * The email subject
         */
        readonly subject: string;

        /**
         * The HTML body of the email
         */
        readonly htmlBody?: string;

        /**
         * The text body of the email
         */
        readonly textBody?: string;
    };
}

/**
 * Threat Protection configuration for Cognito User Pool
 */
export interface ThreatProtectionConfig {
    /**
     * Standard threat protection mode (for ESSENTIALS feature plan)
     * - NO_ENFORCEMENT: Cognito doesn't gather metrics or take preventative actions
     * - AUDIT_ONLY: Cognito gathers metrics but doesn't take automatic action
     * - FULL_FUNCTION: Cognito takes preventative actions based on risk levels
     * @default StandardThreatProtectionMode.NO_ENFORCEMENT
     */
    readonly standardThreatProtectionMode?: StandardThreatProtectionMode;

    /**
     * Custom threat protection mode (for PLUS feature plan)
     * - AUDIT_ONLY: Cognito gathers metrics but doesn't take automatic action
     * - FULL_FUNCTION: Cognito takes preventative actions based on risk levels
     * @default - no custom threat protection
     */
    readonly customThreatProtectionMode?: CustomThreatProtectionMode;

    /**
     * Account takeover risk configuration
     * Configure actions for different risk levels (low, medium, high)
     */
    readonly accountTakeoverRisk?: AccountTakeoverRiskConfiguration;

    /**
     * Compromised credentials risk configuration
     * Configure action when compromised credentials are detected
     */
    readonly compromisedCredentialsRisk?: CompromisedCredentialsRiskConfiguration;

    /**
     * Notification configuration for sending risk detection emails
     * Required if any action has notify: true
     */
    readonly notifyConfiguration?: NotifyConfiguration;
}

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
 * Log event source types for Cognito
 */
export enum LogEventSource {
    /**
     * User notification events (e.g., MFA, email verification)
     */
    USER_NOTIFICATION = 'userNotification',

    /**
     * User authentication events (e.g., sign-in, sign-out)
     */
    USER_AUTH_EVENTS = 'userAuthEvents',
}

/**
 * Log level for Cognito logs
 */
export enum LogLevel {
    /**
     * Log all events (including INFO level)
     */
    INFO = 'INFO',

    /**
     * Log only errors
     */
    ERROR = 'ERROR',
}

/**
 * Configuration for a single log delivery
 */
export interface LogDeliveryConfig {
    /**
     * Event source to log
     * @default LogEventSource.USER_AUTH_EVENTS
     */
    readonly eventSource?: LogEventSource;

    /**
     * Log level
     * Note: USER_AUTH_EVENTS only supports INFO level
     * USER_NOTIFICATION supports both INFO and ERROR
     * @default LogLevel.INFO for USER_AUTH_EVENTS, LogLevel.ERROR for USER_NOTIFICATION
     */
    readonly logLevel?: LogLevel;
}

/**
 * Logging configuration for Cognito
 */
export interface CognitoLogsConfig {
    /**
     * Enable logging for the User Pool
     * @default false
     */
    readonly enabled?: boolean;

    /**
     * Custom log group name
     * If not provided, defaults to /aws/cognito/${userPoolId}
     */
    readonly logGroupName?: string;

    /**
     * Log retention period
     * @default logs.RetentionDays.ONE_MONTH
     */
    readonly retention?: logs.RetentionDays;

    /**
     * Removal policy for the log group
     * @default RemovalPolicy.DESTROY
     */
    readonly removalPolicy?: RemovalPolicy;

    /**
     * Log delivery configurations
     * Can specify multiple event sources with different log levels
     * Note: USER_AUTH_EVENTS only supports INFO level
     * @default [{ eventSource: LogEventSource.USER_AUTH_EVENTS, logLevel: LogLevel.INFO }]
     */
    readonly logConfigurations?: ReadonlyArray<LogDeliveryConfig>;
}

/**
 * Predefined password policy plans for different security requirements
 */
export enum PasswordPolicyPlan {
    /**
     * Basic password policy:
     * - Minimum length: 8 characters
     * - Requires lowercase letters
     * - Requires numbers
     */
    BASIC = 'BASIC',

    /**
     * Standard password policy (recommended):
     * - Minimum length: 10 characters
     * - Requires uppercase letters
     * - Requires lowercase letters
     * - Requires numbers
     * - Requires symbols
     */
    STANDARD = 'STANDARD',

    /**
     * Strong password policy:
     * - Minimum length: 12 characters
     * - Requires uppercase letters
     * - Requires lowercase letters
     * - Requires numbers
     * - Requires symbols
     * - Password history: remembers last 5 passwords
     */
    STRONG = 'STRONG',

    /**
     * Enterprise password policy:
     * - Minimum length: 14 characters
     * - Requires uppercase letters
     * - Requires lowercase letters
     * - Requires numbers
     * - Requires symbols
     * - Password history: remembers last 10 passwords
     * - Temporary password validity: 3 days
     */
    ENTERPRISE = 'ENTERPRISE',

    /**
     * Custom password policy:
     * - Use your own password policy settings
     */
    CUSTOM = 'CUSTOM',
}

/**
 * Password policy configuration for Cognito User Pool
 */
export interface PasswordPolicyConfig {
    /**
     * Password policy plan to use
     * @default PasswordPolicyPlan.STANDARD
     */
    readonly plan?: PasswordPolicyPlan;

    /**
     * Minimum password length (8-99 characters)
     * @default 8 for BASIC, 10 for STANDARD, 12 for STRONG, 14 for ENTERPRISE
     */
    readonly minLength?: number;

    /**
     * Require at least one uppercase letter
     * @default false for BASIC, true for STANDARD/STRONG/ENTERPRISE
     */
    readonly requireUppercase?: boolean;

    /**
     * Require at least one lowercase letter
     * @default true for all plans
     */
    readonly requireLowercase?: boolean;

    /**
     * Require at least one digit (number)
     * @default true for all plans
     */
    readonly requireDigits?: boolean;

    /**
     * Require at least one number
     * @default true for all plans
     */
    readonly requireNumbers?: boolean;

    /**
     * Require at least one symbol (special character)
     * @default false for BASIC, true for STANDARD/STRONG/ENTERPRISE
     */
    readonly requireSymbols?: boolean;

    /**
     * How long temporary passwords are valid
     * Must be specified in whole days only
     * @default Duration.days(7) for most plans, Duration.days(3) for ENTERPRISE
     */
    readonly tempPasswordValidity?: Duration;

    /**
     * How many previous passwords to remember (0-24)
     * Prevents users from reusing recent passwords
     * @default 0 for BASIC/STANDARD, 5 for STRONG, 10 for ENTERPRISE
     */
    readonly passwordHistorySize?: number;
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

    /**
     * Prevent user existence errors
     * When enabled, Cognito returns generic error messages that don't reveal whether a user exists
     * @default true
     */
    readonly preventUserExistenceErrors?: boolean;
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
     * Optional feature plan for the User Pool
     * @default FeaturePlan.ESSENTIALS
     */
    readonly featurePlan?: FeaturePlan;

    /**
     * Optional MFA configuration (boolean or detailed config)
     */
    readonly mfa?: boolean | MfaConfig;

    /**
     * Optional MFA second factor (deprecated - use mfa.mfaSecondFactor instead)
     */
    readonly mfaSecondFactor?: MfaSecondFactor;

    /**
     * Optional password policy configuration
     * @default PasswordPolicyPlan.STANDARD
     */
    readonly passwordPolicy?: PasswordPolicyConfig;

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

    /**
     * Prevent user existence errors for default client
     * When enabled, Cognito returns generic error messages that don't reveal whether a user exists
     * @default true
     */
    readonly preventUserExistenceErrors?: boolean;

    /**
     * Optional logging configuration for the User Pool
     * Enables CloudWatch Logs for Cognito events
     */
    readonly logs?: CognitoLogsConfig;

    /**
     * Optional threat protection configuration
     * Enables Advanced Security features including:
     * - Risk-based adaptive authentication
     * - Account takeover prevention
     * - Compromised credentials detection
     * @default Advanced security is disabled (OFF)
     */
    readonly threatProtection?: ThreatProtectionConfig;

    /**
     * Optional WAF Web ACL to associate with this User Pool
     * Note: WAF must use REGIONAL scope for Cognito User Pools
     */
    readonly waf?: Waf;
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
 * - Feature plan selection (LITE, ESSENTIALS, PLUS)
 * - MFA support (optional or required) with SMS, TOTP, and Email options
 * - Custom domains with Route53 integration
 * - SES email integration
 * - Multiple app clients with per-client branding
 * - Prevent user existence errors for enhanced security
 * - Custom attributes
 * - Lambda triggers
 * - Helper methods for common configurations
 * 
 * @example
 * ```typescript
 * const userPool = new Cognito(this, 'UserPool', {
 *   stack: { id: 'my-app', label: 'My App', tags: [] },
 *   featurePlan: Cognito.FeaturePlan.LITE,
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
 *     preventUserExistenceErrors: true,
 *   }],
 * });
 * 
 * // Get a specific client
 * const webClient = userPool.getUserPoolClient('web');
 * ```
 */
export class Cognito extends Construct {
    /**
     * Cognito feature plans
     */
    static readonly FeaturePlan = FeaturePlan;

    /**
     * Log event source types for Cognito logging
     */
    static readonly LogEventSource = LogEventSource;

    /**
     * Log level options for Cognito logging
     */
    static readonly LogLevel = LogLevel;

    /**
     * Standard threat protection mode options (for ESSENTIALS feature plan)
     */
    static readonly StandardThreatProtectionMode = StandardThreatProtectionMode;

    /**
     * Custom threat protection mode options (for PLUS feature plan)
     */
    static readonly CustomThreatProtectionMode = CustomThreatProtectionMode;

    /**
     * Account takeover action types
     */
    static readonly AccountTakeoverActionType = AccountTakeoverActionType;

    /**
     * Compromised credentials action types
     */
    static readonly CompromisedCredentialsActionType = CompromisedCredentialsActionType;

    #userPool: UserPool;
    #userPoolDomain: UserPoolDomain;
    #domainName: string;
    #userPoolClients = new Map<string, UserPoolClient>();
    #defaultUserPoolClient?: UserPoolClient;

    constructor(scope: Construct, id: string, props: CognitoProps) {
        super(scope, id);

        this.#userPool = new UserPool(this, 'UserPool', {
            userPoolName: props.stack.label,
            featurePlan: props.featurePlan ?? FeaturePlan.ESSENTIALS,
            signInCaseSensitive: false,
            signInAliases: {
                email: true,
            },
            autoVerify: {
                email: true,
            },
            passwordPolicy: Cognito.getPasswordPolicy(props.passwordPolicy),
            ...(props.mfa != null
                ? {
                    mfa: (typeof props.mfa === 'boolean' ? props.mfa : props.mfa.required) ? Mfa.REQUIRED : Mfa.OPTIONAL,
                    mfaSecondFactor: Cognito.getMfaSecondFactor(props.mfa, props.mfaSecondFactor, props.sesEmail),
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
            ...(props.threatProtection?.standardThreatProtectionMode !== undefined
                ? { standardThreatProtectionMode: props.threatProtection.standardThreatProtectionMode }
                : props.threatProtection?.customThreatProtectionMode !== undefined
                    ? { customThreatProtectionMode: props.threatProtection.customThreatProtectionMode }
                    : {}),
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
                preventUserExistenceErrors: props.preventUserExistenceErrors ?? true,
            });

            new CfnOutput(this, 'CognitoUserPoolClientID', {
                value: this.#defaultUserPoolClient.userPoolClientId,
                description: 'Cognito User Pool Client ID',
                exportName: `${props.stack.id}-cognito-user-pool-client-id`,
            });
        }

        if (props.clients) {
            props.clients.forEach(({ id, name, callbackUrls, logoutUrls, branding, preventUserExistenceErrors }) => {
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
                    preventUserExistenceErrors: preventUserExistenceErrors ?? true,
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

        // Configure threat protection if enabled
        const isThreatProtectionEnabled =
            props.threatProtection?.standardThreatProtectionMode === StandardThreatProtectionMode.FULL_FUNCTION ||
            props.threatProtection?.standardThreatProtectionMode === StandardThreatProtectionMode.AUDIT_ONLY ||
            props.threatProtection?.customThreatProtectionMode === CustomThreatProtectionMode.FULL_FUNCTION ||
            props.threatProtection?.customThreatProtectionMode === CustomThreatProtectionMode.AUDIT_ONLY;

        if (isThreatProtectionEnabled) {
            const riskConfigProps: any = {};

            // Configure account takeover risk
            if (props.threatProtection.accountTakeoverRisk) {
                const actions: any = {};

                if (props.threatProtection.accountTakeoverRisk.lowAction) {
                    actions.lowAction = {
                        eventAction: props.threatProtection.accountTakeoverRisk.lowAction.eventAction,
                        notify: props.threatProtection.accountTakeoverRisk.lowAction.notify ?? false,
                    };
                }

                if (props.threatProtection.accountTakeoverRisk.mediumAction) {
                    actions.mediumAction = {
                        eventAction: props.threatProtection.accountTakeoverRisk.mediumAction.eventAction,
                        notify: props.threatProtection.accountTakeoverRisk.mediumAction.notify ?? false,
                    };
                }

                if (props.threatProtection.accountTakeoverRisk.highAction) {
                    actions.highAction = {
                        eventAction: props.threatProtection.accountTakeoverRisk.highAction.eventAction,
                        notify: props.threatProtection.accountTakeoverRisk.highAction.notify ?? false,
                    };
                }

                const accountTakeoverRiskConfig: any = {
                    actions,
                };

                // Add notify configuration if provided
                if (props.threatProtection.notifyConfiguration) {
                    accountTakeoverRiskConfig.notifyConfiguration = {
                        sourceArn: props.threatProtection.notifyConfiguration.sourceArn,
                        from: props.threatProtection.notifyConfiguration.from,
                        replyTo: props.threatProtection.notifyConfiguration.replyTo,
                    };

                    if (props.threatProtection.notifyConfiguration.mfaEmail) {
                        accountTakeoverRiskConfig.notifyConfiguration.mfaEmail = {
                            subject: props.threatProtection.notifyConfiguration.mfaEmail.subject,
                            htmlBody: props.threatProtection.notifyConfiguration.mfaEmail.htmlBody,
                            textBody: props.threatProtection.notifyConfiguration.mfaEmail.textBody,
                        };
                    }

                    if (props.threatProtection.notifyConfiguration.noActionEmail) {
                        accountTakeoverRiskConfig.notifyConfiguration.noActionEmail = {
                            subject: props.threatProtection.notifyConfiguration.noActionEmail.subject,
                            htmlBody: props.threatProtection.notifyConfiguration.noActionEmail.htmlBody,
                            textBody: props.threatProtection.notifyConfiguration.noActionEmail.textBody,
                        };
                    }

                    if (props.threatProtection.notifyConfiguration.blockEmail) {
                        accountTakeoverRiskConfig.notifyConfiguration.blockEmail = {
                            subject: props.threatProtection.notifyConfiguration.blockEmail.subject,
                            htmlBody: props.threatProtection.notifyConfiguration.blockEmail.htmlBody,
                            textBody: props.threatProtection.notifyConfiguration.blockEmail.textBody,
                        };
                    }
                }

                riskConfigProps.accountTakeoverRiskConfiguration = accountTakeoverRiskConfig;
            }

            // Configure compromised credentials risk
            if (props.threatProtection.compromisedCredentialsRisk) {
                riskConfigProps.compromisedCredentialsRiskConfiguration = {
                    eventFilter: ['SIGN_IN', 'PASSWORD_CHANGE', 'SIGN_UP'],
                    actions: {
                        eventAction: props.threatProtection.compromisedCredentialsRisk.eventAction ?? CompromisedCredentialsActionType.BLOCK,
                    },
                };
            }

            // Add risk configuration attachment
            const riskConfig = new CfnUserPoolRiskConfigurationAttachment(this, 'RiskConfiguration', {
                userPoolId: this.#userPool.userPoolId,
                clientId: 'ALL', // Apply to all clients
                ...riskConfigProps,
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

        // Configure logging if enabled
        if (props.logs?.enabled) {
            const logGroupName = props.logs.logGroupName ?? `/aws/cognito/${this.#userPool.userPoolId}`;
            const retention = props.logs.retention ?? logs.RetentionDays.ONE_MONTH;
            const removalPolicy = props.logs.removalPolicy ?? RemovalPolicy.DESTROY;

            // Create the log group
            const logGroup = new logs.LogGroup(this, 'CognitoLogs', {
                logGroupName,
                retention,
                removalPolicy,
            });

            // Build ARN manually without :* suffix (Cognito requires this format)
            const logGroupArn = `arn:${this.#userPool.stack.partition}:logs:${this.#userPool.stack.region}:${this.#userPool.stack.account}:log-group:${logGroupName}`;

            // Grant Cognito log delivery service permission to write to the log group
            const loggingPolicy = new logs.CfnResourcePolicy(this, 'CognitoLoggingPolicy', {
                // Best practice: Keep the name unique but simple
                policyName: `CognitoLogPolicy-${this.#userPool.userPoolId}`,
                policyDocument: JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Sid: 'AllowCognitoLogDelivery',
                            Effect: 'Allow',
                            Principal: {
                                // Cognito uses the internal delivery service principal
                                Service: 'cognito-idp.amazonaws.com',
                            },
                            Action: [
                                'logs:CreateLogStream',
                                'logs:PutLogEvents',
                                'logs:DescribeLogGroups',
                                'logs:DescribeLogStreams'
                            ],
                            // CRITICAL: Ensure the ARN ends with ':*' to include all streams
                            Resource: `${logGroup.logGroupArn}:*`,
                            Condition: {
                                StringEquals: {
                                    'aws:SourceAccount': this.#userPool.stack.account,
                                },
                                ArnLike: {
                                    // Extra security: Only allow your specific User Pool
                                    'aws:SourceArn': this.#userPool.userPoolArn
                                }
                            },
                        },
                    ],
                }),
            });

            // Prepare log configurations
            const logConfigurations = (props.logs.logConfigurations ?? [
                { eventSource: LogEventSource.USER_AUTH_EVENTS, logLevel: LogLevel.INFO },
            ]).map((config) => {
                // Default log level based on event source
                // userAuthEvents only supports INFO, userNotification supports both INFO and ERROR
                const defaultLogLevel =
                    (config.eventSource ?? LogEventSource.USER_AUTH_EVENTS) === LogEventSource.USER_AUTH_EVENTS
                        ? LogLevel.INFO
                        : LogLevel.ERROR;

                return {
                    eventSource: config.eventSource ?? LogEventSource.USER_AUTH_EVENTS,
                    logLevel: config.logLevel ?? defaultLogLevel,
                    cloudWatchLogsConfiguration: {
                        logGroupArn,
                    },
                };
            });

            // Enable log delivery - ensure it depends on the log group and policy
            const logDeliveryConfig = new CfnLogDeliveryConfiguration(this, 'UserPoolLogDelivery', {
                userPoolId: this.#userPool.userPoolId,
                logConfigurations,
            });

            // Add explicit dependencies to ensure proper creation order
            const cfnLogGroup = logGroup.node.defaultChild as logs.CfnLogGroup;
            logDeliveryConfig.addDependency(cfnLogGroup);
            logDeliveryConfig.addDependency(loggingPolicy);
        }

        // Associate WAF if provided
        if (props.waf) {
            props.waf.associateWithResource('Cognito', this.#userPool.userPoolArn);
        }
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

    /**
     * Calculate password policy based on plan and custom settings
     * @private
     */
    private static getPasswordPolicy(passwordPolicyConfig?: PasswordPolicyConfig): {
        minLength: number;
        requireUppercase: boolean;
        requireLowercase: boolean;
        requireDigits: boolean;
        requireSymbols: boolean;
        tempPasswordValidity?: Duration;
        passwordHistorySize?: number;
    } {
        const plan = passwordPolicyConfig?.plan ?? PasswordPolicyPlan.STANDARD;

        // Define defaults for each plan
        const planDefaults: Record<PasswordPolicyPlan, {
            minLength: number;
            requireUppercase: boolean;
            requireLowercase: boolean;
            requireDigits: boolean;
            requireSymbols: boolean;
            tempPasswordValidityDays: number;
            passwordHistorySize: number;
        }> = {
            [PasswordPolicyPlan.BASIC]: {
                minLength: 8,
                requireUppercase: false,
                requireLowercase: true,
                requireDigits: true,
                requireSymbols: false,
                tempPasswordValidityDays: 7,
                passwordHistorySize: 0,
            },
            [PasswordPolicyPlan.STANDARD]: {
                minLength: 10,
                requireUppercase: true,
                requireLowercase: true,
                requireDigits: true,
                requireSymbols: true,
                tempPasswordValidityDays: 7,
                passwordHistorySize: 0,
            },
            [PasswordPolicyPlan.STRONG]: {
                minLength: 12,
                requireUppercase: true,
                requireLowercase: true,
                requireDigits: true,
                requireSymbols: true,
                tempPasswordValidityDays: 7,
                passwordHistorySize: 5,
            },
            [PasswordPolicyPlan.ENTERPRISE]: {
                minLength: 14,
                requireUppercase: true,
                requireLowercase: true,
                requireDigits: true,
                requireSymbols: true,
                tempPasswordValidityDays: 3,
                passwordHistorySize: 10,
            },
            [PasswordPolicyPlan.CUSTOM]: {
                minLength: 8,
                requireUppercase: false,
                requireLowercase: true,
                requireDigits: true,
                requireSymbols: false,
                tempPasswordValidityDays: 7,
                passwordHistorySize: 0,
            },
        };

        const defaults = planDefaults[plan];
        const config = passwordPolicyConfig ?? {};

        const tempPasswordValidity = config.tempPasswordValidity ?? Duration.days(defaults.tempPasswordValidityDays);
        const passwordHistorySize = config.passwordHistorySize ?? defaults.passwordHistorySize;

        return {
            minLength: config.minLength ?? defaults.minLength,
            requireUppercase: config.requireUppercase ?? defaults.requireUppercase,
            requireLowercase: config.requireLowercase ?? defaults.requireLowercase,
            requireDigits: config.requireNumbers ?? defaults.requireDigits,
            requireSymbols: config.requireSymbols ?? defaults.requireSymbols,
            tempPasswordValidity,
            passwordHistorySize: passwordHistorySize > 0 ? passwordHistorySize : undefined,
        };
    }

    /**
     * Calculate MFA second factor configuration
     * Email MFA requires SES to be configured
     * @private
     */
    private static getMfaSecondFactor(
        mfa?: boolean | MfaConfig,
        mfaSecondFactor?: MfaSecondFactor,
        sesEmail?: SesEmailConfig,
    ): MfaSecondFactor | undefined {
        if (mfa == null) return undefined;

        const explicitConfig = mfaSecondFactor ??
            (typeof mfa === 'object' ? mfa.mfaSecondFactor : undefined);

        if (explicitConfig) {
            // If email MFA is requested but SES is not configured, remove email
            if (explicitConfig.email && !sesEmail) {
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
            email: sesEmail != null, // Only enable email MFA if SES is configured
        };
    }
}
