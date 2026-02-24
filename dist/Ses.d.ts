import { Construct } from 'constructs';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { type IHostedZone } from 'aws-cdk-lib/aws-route53';
/**
 * Properties for configuring SES
 */
export interface SesProps {
    /**
     * Name for the configuration set
     */
    readonly name: string;
    /**
     * Route53 hosted zone for domain verification
     */
    readonly hostedZone: IHostedZone;
    /**
     * The stack reference containing tags
     */
    readonly stack: {
        readonly tags: ReadonlyArray<{
            readonly key: string;
            readonly value: string;
        }>;
    };
}
/**
 * A CDK construct for setting up Amazon SES with domain verification
 *
 * Features:
 * - Email identity for the domain
 * - Configuration set
 * - Mail FROM domain configuration
 * - Click tracking CNAME record
 * - Helper method for IAM policies
 *
 * @example
 * ```typescript
 * const ses = new Ses(this, 'Email', {
 *   name: 'my-app',
 *   hostedZone: myZone,
 *   stack: { tags: [] },
 * });
 *
 * // Add send email permissions to a Lambda function
 * myFunction.addToRolePolicy(ses.sendEmailPolicyStatement());
 * ```
 */
export declare class Ses extends Construct {
    #private;
    constructor(scope: Construct, id: string, props: SesProps);
    /**
     * Gets the configuration set name
     */
    get configurationSetName(): string;
    /**
     * Creates an IAM policy statement for sending emails via SES
     *
     * This grants permissions to:
     * - Send email (ses:SendEmail)
     * - Send raw email (ses:SendRawEmail)
     * - Send email v2 (sesv2:SendEmail)
     *
     * @returns PolicyStatement for sending emails
     *
     * @example
     * ```typescript
     * myFunction.addToRolePolicy(ses.sendEmailPolicyStatement());
     * ```
     */
    sendEmailPolicyStatement(): PolicyStatement;
}
