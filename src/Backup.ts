import { Construct } from 'constructs';
import { Duration, Tags } from 'aws-cdk-lib';
import { BackupPlan, BackupPlanRule, BackupResource } from 'aws-cdk-lib/aws-backup';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

/**
 * Configuration for a backup plan helper
 */
export interface BackupProps {
    /**
     * Backup plan base name
     */
    readonly name: string;

    /**
     * Resource ARNs to include in backup selection
     */
    readonly resourceArns: ReadonlyArray<string>;

    /**
     * Stack metadata for naming and tags
     */
    readonly stack: {
        readonly id: string;
        readonly tags: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    };

    /**
     * Enable continuous backup
     * @default true
     */
    readonly enableContinuousBackup?: boolean;

    /**
     * Backup retention in days
     * @default 30
     */
    readonly deleteAfterDays?: number;

    /**
     * Optional custom backup selection role name
     */
    readonly roleName?: string;
}

/**
 * Helper construct for AWS Backup plans with selection role wiring.
 */
export class Backup extends Construct {
    #plan: BackupPlan;

    constructor(scope: Construct, id: string, props: BackupProps) {
        super(scope, id);

        this.#plan = new BackupPlan(this, 'BackupPlan', {
            backupPlanName: `${props.name}-backup-plan`,
            backupPlanRules: [new BackupPlanRule({
                ruleName: `${props.name}-backup-rule`,
                enableContinuousBackup: props.enableContinuousBackup ?? true,
                deleteAfter: Duration.days(props.deleteAfterDays ?? 30),
            })],
        });

        const selectionRole = new Role(this, 'BackupSelectionRole', {
            roleName: props.roleName,
            assumedBy: new ServicePrincipal('backup.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForBackup'),
                ManagedPolicy.fromAwsManagedPolicyName('AWSBackupServiceRolePolicyForS3Backup'),
                ManagedPolicy.fromAwsManagedPolicyName('AWSBackupServiceRolePolicyForS3Restore'),
            ],
        });

        this.#plan.addSelection('BackupSelection', {
            backupSelectionName: `${props.name}-backup-selection`,
            resources: props.resourceArns.map((arn) => BackupResource.fromArn(arn)),
            role: selectionRole,
        });

        props.stack.tags.forEach(({ key, value }) => {
            Tags.of(this.#plan).add(key, value);
            Tags.of(selectionRole).add(key, value);
        });
    }

    /**
     * Gets the backup plan
     */
    get plan(): BackupPlan {
        return this.#plan;
    }
}
