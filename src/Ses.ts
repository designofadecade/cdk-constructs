import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';
import { EmailIdentity, Identity, ConfigurationSet, type IEmailIdentity } from 'aws-cdk-lib/aws-ses';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { CnameRecord, type IHostedZone } from 'aws-cdk-lib/aws-route53';

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
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
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
export class Ses extends Construct {
    #configurationSetName: string;
    #hostedZoneName: string;

    constructor(scope: Construct, id: string, props: SesProps) {
        super(scope, id);

        this.#configurationSetName = props.name;
        this.#hostedZoneName = props.hostedZone.zoneName;

        const configurationSet = new ConfigurationSet(this, 'ConfigurationSet', {
            configurationSetName: this.#configurationSetName,
        });

        const identity = new EmailIdentity(this, 'Identity', {
            identity: Identity.publicHostedZone(props.hostedZone),
            mailFromDomain: `mail.${props.hostedZone.zoneName}`,
            configurationSet,
        });

        new CnameRecord(this, 'CnameApiRecord', {
            recordName: 'tracking',
            zone: props.hostedZone,
            domainName: 'r.ca-central-1.awstrack.me',
        });

        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(identity).add(key, value);
        });
    }

    /**
     * Gets the configuration set name
     */
    get configurationSetName(): string {
        return this.#configurationSetName;
    }

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
    sendEmailPolicyStatement(): PolicyStatement {
        const region = Stack.of(this).region;
        const account = Stack.of(this).account;

        return new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['ses:SendEmail', 'ses:SendRawEmail', 'sesv2:SendEmail'],
            resources: [
                `arn:aws:ses:${region}:${account}:identity/${this.#hostedZoneName}`,
                `arn:aws:ses:${region}:${account}:configuration-set/${this.#configurationSetName}`,
            ],
        });
    }
}
