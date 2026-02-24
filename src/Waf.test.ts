import { describe, it, expect } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Waf } from '../src/Waf.js';

describe('Waf', () => {
    it('creates WAF Web ACL with CLOUDFRONT scope', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1' } });

        new Waf(stack, 'TestWAF', {
            scope: Waf.SCOPE_CLOUDFRONT,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.resourceCountIs('AWS::WAFv2::WebACL', 1);
        template.hasResourceProperties('AWS::WAFv2::WebACL', {
            Scope: 'CLOUDFRONT',
        });
    });

    it('auto-detects CLOUDFRONT scope in us-east-1', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1' } });

        new Waf(stack, 'TestWAF', {
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::WAFv2::WebACL', {
            Scope: 'CLOUDFRONT',
        });
    });

    it('auto-detects REGIONAL scope in other regions', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-west-2' } });

        new Waf(stack, 'TestWAF', {
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::WAFv2::WebACL', {
            Scope: 'REGIONAL',
        });
    });

    it('creates WAF Web ACL with REGIONAL scope', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack');

        new Waf(stack, 'TestWAF', {
            scope: Waf.SCOPE_REGIONAL,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::WAFv2::WebACL', {
            Scope: 'REGIONAL',
        });
    });

    it('throws error when CLOUDFRONT scope not in us-east-1', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-west-2' } });

        expect(() => {
            new Waf(stack, 'TestWAF', {
                scope: Waf.SCOPE_CLOUDFRONT,
                stack: { id: 'test', tags: [] },
            });
        }).toThrow('WAF Web ACL with CLOUDFRONT scope must be created in us-east-1 region');
    });

    it('creates WAF with rate limiting', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1' } });

        new Waf(stack, 'TestWAF', {
            scope: 'CLOUDFRONT',
            rateLimit: {
                limit: 2000,
                priority: 1,
            },
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::WAFv2::WebACL', {
            Rules: Match.arrayWith([
                Match.objectLike({
                    Name: 'RateLimitRule',
                    Statement: {
                        RateBasedStatement: {
                            Limit: 2000,
                            AggregateKeyType: 'IP',
                        },
                    },
                }),
            ]),
        });
    });

    it('creates WAF with geographic blocking', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1' } });

        new Waf(stack, 'TestWAF', {
            scope: 'CLOUDFRONT',
            geoBlock: {
                countryCodes: ['CN', 'RU'],
                priority: 2,
            },
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::WAFv2::WebACL', {
            Rules: Match.arrayWith([
                Match.objectLike({
                    Name: 'GeoBlockRule',
                    Statement: {
                        GeoMatchStatement: {
                            CountryCodes: ['CN', 'RU'],
                        },
                    },
                }),
            ]),
        });
    });

    it('creates WAF with managed rules enabled', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1' } });

        new Waf(stack, 'TestWAF', {
            scope: 'CLOUDFRONT',
            enableManagedRules: true,
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::WAFv2::WebACL', {
            Rules: Match.arrayWith([
                Match.objectLike({
                    Name: 'AWSManagedRulesCommonRuleSet',
                }),
                Match.objectLike({
                    Name: 'AWSManagedRulesSQLiRuleSet',
                }),
            ]),
        });
    });

    it('has correct default action', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1' } });

        new Waf(stack, 'TestWAF', {
            scope: 'CLOUDFRONT',
            defaultAction: 'BLOCK',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::WAFv2::WebACL', {
            DefaultAction: { Block: {} },
        });
    });

    it('exports outputs', () => {
        const app = new App();
        const stack = new Stack(app, 'TestStack', { env: { region: 'us-east-1' } });

        new Waf(stack, 'TestWAF', {
            scope: 'CLOUDFRONT',
            stack: { id: 'test', tags: [] },
        });

        const template = Template.fromStack(stack);
        template.hasOutput('*', {
            Description: 'WAF Web ACL ID',
        });
        template.hasOutput('*', {
            Description: 'WAF Web ACL ARN',
        });
    });

    it('GetScopeFromRegion returns correct scope', () => {
        expect(Waf.GetScopeFromRegion('us-east-1')).toBe('CLOUDFRONT');
        expect(Waf.GetScopeFromRegion('us-west-2')).toBe('REGIONAL');
        expect(Waf.GetScopeFromRegion('eu-west-1')).toBe('REGIONAL');
        expect(Waf.GetScopeFromRegion('ap-southeast-1')).toBe('REGIONAL');
    });
});
