import { Stack, Tags, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnWebACL, CfnWebACLAssociation, CfnIPSet, } from 'aws-cdk-lib/aws-wafv2';
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
 *
 * @example
 * ```typescript
 * const waf = new Waf(this, 'WAF', {
 *   name: 'my-app-waf',
 *   scope: 'CLOUDFRONT',
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
 * ```
 */
export class Waf extends Construct {
    #webAcl;
    #scope;
    constructor(scope, id, props) {
        super(scope, id);
        this.#scope = props.scope;
        // Validate CloudFront scope is in us-east-1
        if (props.scope === 'CLOUDFRONT') {
            const region = Stack.of(this).region;
            if (region !== 'us-east-1' && !region.startsWith('${')) {
                throw new Error('WAF Web ACL with CLOUDFRONT scope must be created in us-east-1 region');
            }
        }
        const rules = [];
        let priorityCounter = 0;
        // Add rate limiting rule
        if (props.rateLimit) {
            rules.push({
                name: 'RateLimitRule',
                priority: props.rateLimit.priority ?? priorityCounter++,
                statement: {
                    rateBasedStatement: {
                        limit: props.rateLimit.limit,
                        aggregateKeyType: 'IP',
                        scopeDownStatement: props.rateLimit.scopeDownStatement,
                    },
                },
                action: { block: {} },
                visibilityConfig: {
                    sampledRequestsEnabled: true,
                    cloudWatchMetricsEnabled: true,
                    metricName: 'RateLimitRule',
                },
            });
            priorityCounter = Math.max(priorityCounter, props.rateLimit.priority + 1);
        }
        // Add geographic blocking rule
        if (props.geoBlock) {
            rules.push({
                name: 'GeoBlockRule',
                priority: props.geoBlock.priority ?? priorityCounter++,
                statement: {
                    geoMatchStatement: {
                        countryCodes: [...props.geoBlock.countryCodes],
                    },
                },
                action: { block: {} },
                visibilityConfig: {
                    sampledRequestsEnabled: true,
                    cloudWatchMetricsEnabled: true,
                    metricName: 'GeoBlockRule',
                },
            });
            priorityCounter = Math.max(priorityCounter, props.geoBlock.priority + 1);
        }
        // Add IP sets rules
        if (props.ipSets) {
            props.ipSets.forEach((ipSetConfig) => {
                const ipSet = new CfnIPSet(this, `IPSet${ipSetConfig.name}`, {
                    scope: props.scope,
                    name: ipSetConfig.name,
                    addresses: [...ipSetConfig.addresses],
                    ipAddressVersion: ipSetConfig.ipAddressVersion ?? 'IPV4',
                });
                rules.push({
                    name: `IPSetRule${ipSetConfig.name}`,
                    priority: ipSetConfig.priority ?? priorityCounter++,
                    statement: {
                        ipSetReferenceStatement: {
                            arn: ipSet.attrArn,
                        },
                    },
                    action: ipSetConfig.action === 'ALLOW' ? { allow: {} } : { block: {} },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: `IPSetRule${ipSetConfig.name}`,
                    },
                });
                priorityCounter = Math.max(priorityCounter, ipSetConfig.priority + 1);
            });
        }
        // Add AWS Managed Rules (best practices)
        if (props.enableManagedRules === true) {
            const defaultManagedRules = Waf.GetDefaultManagedRules(priorityCounter);
            rules.push(...defaultManagedRules);
            priorityCounter += defaultManagedRules.length;
        }
        // Add custom managed rules
        if (props.managedRules) {
            props.managedRules.forEach((ruleConfig) => {
                rules.push({
                    name: ruleConfig.name,
                    priority: ruleConfig.priority ?? priorityCounter++,
                    statement: {
                        managedRuleGroupStatement: {
                            vendorName: ruleConfig.vendorName ?? 'AWS',
                            name: ruleConfig.name,
                            excludedRules: ruleConfig.excludedRules?.map((name) => ({ name })),
                        },
                    },
                    overrideAction: { none: {} },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: ruleConfig.name,
                    },
                });
                priorityCounter = Math.max(priorityCounter, ruleConfig.priority + 1);
            });
        }
        // Create Web ACL
        this.#webAcl = new CfnWebACL(this, 'WebACL', {
            name: props.name ?? `${props.stack.id}-waf`,
            scope: props.scope,
            defaultAction: props.defaultAction === 'BLOCK' ? { block: {} } : { allow: {} },
            rules,
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: `${props.stack.id}-waf`,
            },
        });
        // Associate with CloudFront distribution if provided
        if (props.distribution) {
            new CfnWebACLAssociation(this, 'WebACLAssociation', {
                resourceArn: props.distribution.distributionArn,
                webAclArn: this.#webAcl.attrArn,
            });
        }
        // Apply tags
        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#webAcl).add(key, value);
        });
        // Outputs
        new CfnOutput(this, 'WebACLId', {
            value: this.#webAcl.attrId,
            description: 'WAF Web ACL ID',
            exportName: `${props.stack.id}-waf-id`,
        });
        new CfnOutput(this, 'WebACLArn', {
            value: this.#webAcl.attrArn,
            description: 'WAF Web ACL ARN',
            exportName: `${props.stack.id}-waf-arn`,
        });
    }
    /**
     * Gets the Web ACL ID
     */
    get webAclId() {
        return this.#webAcl.attrId;
    }
    /**
     * Gets the Web ACL ARN
     */
    get webAclArn() {
        return this.#webAcl.attrArn;
    }
    /**
     * Gets the Web ACL scope
     */
    get scope() {
        return this.#scope;
    }
    /**
     * Gets the Web ACL resource
     */
    get webAcl() {
        return this.#webAcl;
    }
    /**
     * Associates the Web ACL with a resource
     *
     * @param id - Unique identifier for the association
     * @param resourceArn - ARN of the resource to associate with
     */
    associateWithResource(id, resourceArn) {
        new CfnWebACLAssociation(this, `Association${id}`, {
            resourceArn,
            webAclArn: this.#webAcl.attrArn,
        });
    }
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
    static GetDefaultManagedRules(startPriority = 100) {
        const managedRules = [
            { name: 'AWSManagedRulesCommonRuleSet', description: 'Core Rule Set' },
            { name: 'AWSManagedRulesKnownBadInputsRuleSet', description: 'Known Bad Inputs' },
            { name: 'AWSManagedRulesAmazonIpReputationList', description: 'Amazon IP Reputation' },
            { name: 'AWSManagedRulesAnonymousIpList', description: 'Anonymous IP List' },
            { name: 'AWSManagedRulesSQLiRuleSet', description: 'SQL Injection' },
            { name: 'AWSManagedRulesLinuxRuleSet', description: 'Linux OS' },
            { name: 'AWSManagedRulesUnixRuleSet', description: 'POSIX OS' },
        ];
        return managedRules.map((rule, index) => ({
            name: rule.name,
            priority: startPriority + index,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: 'AWS',
                    name: rule.name,
                },
            },
            overrideAction: { none: {} },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: rule.name,
            },
        }));
    }
    /**
     * Creates a rate limit configuration
     *
     * @param limit - Maximum requests per 5 minutes
     * @param priority - Rule priority
     * @returns Rate limit configuration
     */
    static RateLimitConfig(limit, priority = 1) {
        return { limit, priority };
    }
    /**
     * Creates a geographic blocking configuration
     *
     * @param countryCodes - Array of ISO 3166-1 alpha-2 country codes
     * @param priority - Rule priority
     * @returns Geo block configuration
     */
    static GeoBlockConfig(countryCodes, priority = 2) {
        return { countryCodes, priority };
    }
    /**
     * Creates an IP set configuration for blocking
     *
     * @param name - Name for the IP set
     * @param addresses - Array of IP addresses in CIDR notation
     * @param priority - Rule priority
     * @returns IP set configuration
     */
    static BlockIPSet(name, addresses, priority) {
        return {
            name,
            addresses,
            priority,
            action: 'BLOCK',
            ipAddressVersion: 'IPV4',
        };
    }
    /**
     * Creates an IP set configuration for allowing
     *
     * @param name - Name for the IP set
     * @param addresses - Array of IP addresses in CIDR notation
     * @param priority - Rule priority
     * @returns IP set configuration
     */
    static AllowIPSet(name, addresses, priority) {
        return {
            name,
            addresses,
            priority,
            action: 'ALLOW',
            ipAddressVersion: 'IPV4',
        };
    }
}
