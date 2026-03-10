/**
 * @designofadecade/cdk-constructs
 * 
 * A collection of opinionated AWS CDK constructs for rapid infrastructure deployment
 * 
 * @module
 */

export { Vpc } from './Vpc.js';
export type { VpcProps, VpcEndpointType } from './Vpc.js';

export { Waf } from './Waf.js';
export type { WafProps, ManagedRuleConfig, RateLimitConfig, IPSetConfig, GeoBlockConfig } from './Waf.js';

export { CloudFront } from './CloudFront.js';
export type {
    CloudFrontProps,
    DomainConfig,
    DefaultBehaviorConfig,
    BehaviorOptions,
    HttpBehaviorOptions,
    FunctionBehaviorOptions,
    CspConfig,
    ResponseHeaderPolicyOptions,
    S3BucketOriginOptions,
} from './CloudFront.js';

export { EventBridge } from './EventBridge.js';
export type { EventBridgeTaskConfig } from './EventBridge.js';

export { S3Bucket } from './S3Bucket.js';
export type { S3BucketProps } from './S3Bucket.js';

export { Function } from './Function.js';
export type { FunctionProps, AssetConfig, FunctionUrlConfig, FunctionUrlAuthTypeOption, CodeFromBucketProps } from './Function.js';

export { Secrets } from './Secrets.js';
export type { SecretsProps } from './Secrets.js';

export { ParameterStore } from './ParameterStore.js';
export type { ParameterStoreProps } from './ParameterStore.js';

export {
    Cognito,
    PasswordPolicyPlan,
    LogEventSource,
    LogLevel,
    AccountTakeoverActionType,
    CompromisedCredentialsActionType,
} from './Cognito.js';

// Re-export CDK types for threat protection
export { StandardThreatProtectionMode, CustomThreatProtectionMode } from 'aws-cdk-lib/aws-cognito';
export type {
    CognitoProps,
    MfaConfig,
    CustomDomainConfig,
    SesEmailConfig,
    ClientBrandingConfig,
    UserPoolClientConfig,
    LoadedBranding,
    PasswordPolicyConfig,
    LogDeliveryConfig,
    CognitoLogsConfig,
    ThreatProtectionConfig,
    AccountTakeoverRiskConfiguration,
    AccountTakeoverActionConfig,
    CompromisedCredentialsRiskConfiguration,
    NotifyConfiguration,
} from './Cognito.js';

export { HttpApi } from './HttpApi.js';
export type { HttpApiProps, HttpMethodType, AddFunctionIntegrationOptions, CreateAuthorizerFunctionProps } from './HttpApi.js';

export { DynamoTable } from './DynamoTable.js';
export type { DynamoTableProps, GlobalSecondaryIndexConfig } from './DynamoTable.js';

export { Dashboard } from './Dashboard.js';
export type { DashboardProps, GridPosition } from './Dashboard.js';
export { TextWidgetBackground } from 'aws-cdk-lib/aws-cloudwatch';

export { RdsDatabase } from './RdsDatabase.js';
export type { RdsDatabaseProps } from './RdsDatabase.js';

export { Ses } from './Ses.js';
export type { SesProps } from './Ses.js';

export { Sqs } from './Sqs.js';
export type { SqsProps } from './Sqs.js';

export { BastionHost } from './BastionHost.js';
export type { BastionHostProps } from './BastionHost.js';

export { Server } from './Server.js';
export type { ServerProps, ProjectConfig as ServerProjectConfig, DomainConfig as ServerDomainConfig, VolumeConfig } from './Server.js';

export { Monitoring } from './Monitoring.js';
export type {
    MonitoringProps,
    NotificationHandler,
    AlarmConfig,
    SnsTopicConfig,
    LogGroupConfig,
} from './Monitoring.js';
