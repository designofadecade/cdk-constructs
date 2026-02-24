import { Construct } from 'constructs';
import { CfnWebACL, type CfnWebACL as ICfnWebACL } from 'aws-cdk-lib/aws-wafv2';
/**
 * AWS Managed Rule configuration
 */
export interface ManagedRuleConfig {
    /**
     * The name of the managed rule group
     */
    readonly name: string;
    /**
     * The vendor name (e.g., 'AWS')
     */
    readonly vendorName?: string;
    /**
     * Rule priority
     */
    readonly priority: number;
    /**
     * Excluded rules
     */
    readonly excludedRules?: ReadonlyArray<string>;
}
/**
 * Rate limit rule configuration
 */
export interface RateLimitConfig {
    /**
     * Maximum number of requests allowed in 5 minutes
     */
    readonly limit: number;
    /**
     * Rule priority
     */
    readonly priority: number;
    /**
     * Optional scope down statement (e.g., only rate limit certain paths)
     */
    readonly scopeDownStatement?: ICfnWebACL.StatementProperty;
}
/**
 * IP set configuration
 */
export interface IPSetConfig {
    /**
     * Name for the IP set
     */
    readonly name: string;
    /**
     * IP addresses in CIDR notation
     */
    readonly addresses: ReadonlyArray<string>;
    /**
     * IP address version ('IPV4' or 'IPV6')
     */
    readonly ipAddressVersion?: 'IPV4' | 'IPV6';
    /**
     * Rule priority
     */
    readonly priority: number;
    /**
     * Action to take ('ALLOW' or 'BLOCK')
     */
    readonly action: 'ALLOW' | 'BLOCK';
}
/**
 * Geographic blocking configuration
 */
export interface GeoBlockConfig {
    /**
     * List of country codes to block (ISO 3166-1 alpha-2)
     */
    readonly countryCodes: ReadonlyArray<string>;
    /**
     * Rule priority
     */
    readonly priority: number;
}
/**
 * Properties for configuring WAF Web ACL
 */
export interface WafProps {
    /**
     * Optional name for the Web ACL
     */
    readonly name?: string;
    /**
     * The stack reference
     */
    readonly stack: {
        readonly id: string;
        readonly tags: ReadonlyArray<{
            readonly key: string;
            readonly value: string;
        }>;
    };
    /**
     * Scope of the Web ACL ('CLOUDFRONT' or 'REGIONAL')
     * Note: CLOUDFRONT scope must be deployed in us-east-1
     * If not provided, automatically determined from stack region
     */
    readonly scope?: 'CLOUDFRONT' | 'REGIONAL';
    /**
     * Default action for requests that don't match any rules
     */
    readonly defaultAction?: 'ALLOW' | 'BLOCK';
    /**
     * Enable AWS Managed Rules for best practices
     */
    readonly enableManagedRules?: boolean;
    /**
     * Custom managed rules configuration
     */
    readonly managedRules?: ReadonlyArray<ManagedRuleConfig>;
    /**
     * Rate limiting configuration
     */
    readonly rateLimit?: RateLimitConfig;
    /**
     * IP sets configuration
     */
    readonly ipSets?: ReadonlyArray<IPSetConfig>;
    /**
     * Geographic blocking configuration
     */
    readonly geoBlock?: GeoBlockConfig;
}
/**
 * A CDK construct for creating AWS WAF Web ACLs with best practice security rules
 *
 * Features:
 * - AWS Managed Rules (Core Rule Set, Known Bad Inputs, SQL Injection, etc.)
 * - Rate limiting protection
 * - IP allowlist/blocklist support
 * - Geographic blocking
 * - CloudFront association
 * - Automatic tagging
 * - Static scope constants (Waf.SCOPE_CLOUDFRONT, Waf.SCOPE_REGIONAL)
 *
 * @example
 * ```typescript
 * // Auto-detect scope from region
 * const waf = new Waf(this, 'WAF', {
 *   name: 'my-app-waf',
 *   enableManagedRules: true,
 *   rateLimit: {
 *     limit: 2000,
 *     priority: 1,
 *   },
 *   geoBlock: {
 *     countryCodes: ['CN', 'RU'],
 *     priority: 2,
 *   },
 *   distribution: myCloudFrontDistribution,
 *   stack: { id: 'my-app', tags: [] },
 * });
 *
 * // Or use explicit scope with static constants
 * const regionalWaf = new Waf(this, 'RegionalWAF', {
 *   scope: Waf.SCOPE_REGIONAL,
 *   enableManagedRules: true,
 *   stack: { id: 'my-app', tags: [] },
 * });
 * ```
 */
export declare class Waf extends Construct {
    #private;
    static readonly SCOPE_CLOUDFRONT: 'CLOUDFRONT';
    static readonly SCOPE_REGIONAL: 'REGIONAL';
    constructor(scope: Construct, id: string, props: WafProps);
    /**
     * Gets the Web ACL ID
     */
    get webAclId(): string;
    /**
     * Gets the Web ACL ARN
     */
    get webAclArn(): string;
    /**
     * Gets the Web ACL scope
     */
    get scope(): 'CLOUDFRONT' | 'REGIONAL';
    /**
     * Gets the Web ACL resource
     */
    get webAcl(): CfnWebACL;
    /**
     * Associates the Web ACL with a regional resource (ALB, API Gateway, etc.)
     *
     * Note: For CloudFront distributions, use the webAclId property on the distribution instead.
     * CloudFront distributions require the WAF ARN to be set during creation, not via association.
     *
     * @param id - Unique identifier for the association
     * @param resourceArn - ARN of the regional resource (ALB, API Gateway, AppSync, Cognito User Pool)
     *
     * @example
     * ```typescript
     * // For ALB
     * waf.associateWithResource('ALB', loadBalancer.loadBalancerArn);
     *
     * // For API Gateway
     * waf.associateWithResource('API', apiGateway.apiArn);
     * ```
     */
    associateWithResource(id: string, resourceArn: string): void;
    /**
     * Determines the WAF scope based on the AWS region
     *
     * @param region - AWS region (e.g., 'us-east-1', 'eu-west-1')
     * @returns 'CLOUDFRONT' if us-east-1, otherwise 'REGIONAL'
     */
    static GetScopeFromRegion(region: string): 'CLOUDFRONT' | 'REGIONAL';
    /**
     * Gets the default AWS Managed Rules for best practices
     *
     * Includes:
     * - Core Rule Set (CRS)
     * - Known Bad Inputs
     * - Amazon IP Reputation List
     * - Anonymous IP List
     * - SQL Injection Protection
     * - Linux Operating System Protection
     * - POSIX Operating System Protection
     *
     * @param startPriority - Starting priority number for the rules
     * @returns Array of managed rule configurations
     */
    static GetDefaultManagedRules(startPriority?: number): CfnWebACL.RuleProperty[];
    /**
     * Creates a rate limit configuration
     *
     * @param limit - Maximum requests per 5 minutes
     * @param priority - Rule priority
     * @returns Rate limit configuration
     */
    static RateLimitConfig(limit: number, priority?: number): RateLimitConfig;
    /**
     * Creates a geographic blocking configuration
     *
     * @param countryCodes - Array of ISO 3166-1 alpha-2 country codes
     * @param priority - Rule priority
     * @returns Geo block configuration
     */
    static GeoBlockConfig(countryCodes: string[], priority?: number): GeoBlockConfig;
    /**
     * Creates an IP set configuration for blocking
     *
     * @param name - Name for the IP set
     * @param addresses - Array of IP addresses in CIDR notation
     * @param priority - Rule priority
     * @returns IP set configuration
     */
    static BlockIPSet(name: string, addresses: string[], priority: number): IPSetConfig;
    /**
     * Creates an IP set configuration for allowing
     *
     * @param name - Name for the IP set
     * @param addresses - Array of IP addresses in CIDR notation
     * @param priority - Rule priority
     * @returns IP set configuration
     */
    static AllowIPSet(name: string, addresses: string[], priority: number): IPSetConfig;
}
