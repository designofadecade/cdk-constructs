# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Cognito: Dedicated templates for user attribute verification**
  - New `verify-attribute.html` template for email/phone change verification
  - New `verify-attribute-sms.txt` template for attribute verification SMS
  - `COGNITO_VERIFY_ATTRIBUTE_SUBJECT` environment variable (default: "Verify Your Information")
  - Distinct messaging for attribute changes vs. new account signup
  - Template focuses on confirming account changes rather than welcoming new users

## [1.27.4] - 2026-03-17

### Fixed
- **Cognito: Support for VerifyUserAttribute custom message trigger**
  - Added support for `CustomMessage_VerifyUserAttribute` trigger
  - Uses same templates as signup verification for consistent user experience
  - Fixes issue where user attribute verification emails showed default Cognito message
  - Added test coverage for user attribute verification

## [1.27.3] - 2026-03-17

### Improved
- **Cognito: Custom message handler diagnostic logging**
  - Added logging for trigger source identification and processing
  - Logs trigger invocation details (triggerSource, userPoolId, userName)
  - Logs signup verification message customization details
  - Helps troubleshoot custom message Lambda configuration issues

## [1.27.2] - 2026-03-17

### Added
- **Cognito: Signup verification message customization**
  - Added support for `CustomMessage_SignUp` trigger to customize account verification messages
  - New HTML template (`signup.html`) for signup verification emails with welcome message
  - New SMS template (`signup-sms.txt`) for account verification text messages
  - `COGNITO_SIGNUP_SUBJECT` environment variable to customize signup email subject (default: "Verify Your Account")
  - Professional welcome email design with verification code and security information
  - Template placeholders: `{code}` for verification code, `{year}` for copyright year
  - Comprehensive test coverage for signup verification message customization
  - Updated documentation with signup message examples and configuration guidance

## [1.27.1] - 2026-03-17

### Fixed
- **Build: Cross-shell compatibility for copy-assets script**
  - Fixed GitHub Actions deployment failure caused by shell-specific brace expansion
  - Replaced `*.{html,txt}` pattern with separate copy commands for .html and .txt files
  - Ensures build works correctly across different shell environments (bash, sh, dash)

## [1.27.0] - 2026-03-17

### Added
- **Cognito: SMS message templates for custom message trigger**
  - New SMS template files for forgot password and MFA flows
  - Added `forgotpassword-sms.txt` template for password reset SMS messages
  - Added `mfa-sms.txt` template for MFA verification SMS messages
  - Custom message handler now sets `smsMessage` response for both trigger types
  - SMS templates support `{code}` placeholder for verification code replacement
  - Updated build script to copy `.txt` template files alongside `.html` files
  - Enhanced documentation with SMS template customization guidance
  - Added comprehensive test coverage for SMS message generation

## [1.26.1] - 2026-03-17

### Fixed
- **Cognito: SMS role CloudFormation dependency issue**
  - Fixed "Role does not have permission to publish with SNS" error during deployment
  - Added explicit dependency to ensure SMS role's IAM policy is created before UserPool
  - Prevents race condition when auto-creating SMS role for MFA

### Added
- **Cognito: SMS MFA support**
  - New `sms` configuration option for SMS-based multi-factor authentication
  - Added `SmsConfig` interface with `smsRole` and `externalId` properties
  - Auto-creates IAM role with SNS publish permissions when SMS is configured without a role
  - New `Cognito.createSmsRole()` static helper method to create SMS IAM role
  - SMS MFA automatically enabled when `sms` config is provided
  - SMS MFA gracefully disabled when requested but `sms` config is missing
  - Enhanced documentation with SMS MFA configuration examples
  - Comprehensive test coverage for SMS MFA functionality

## [1.25.1] - 2026-03-16

### Added
- **WAF: Static constants for oversize handling modes**
  - New `OVERSIZE_CONTINUE` constant for standard inspection behavior
  - New `OVERSIZE_MATCH` constant for blocking oversized content
  - Improves code readability and maintainability for oversize handling configuration
  - Updated documentation to reference constants in examples

## [1.25.0] - 2026-03-16

### Added
- **WAF: Oversize handling configuration for payload size constraints**
  - New `oversizeHandling` option in `PayloadSizeConstraintConfig` interface
  - Supports `'CONTINUE'` (default) and `'MATCH'` modes for handling oversized content
  - `'CONTINUE'`: Inspects what WAF can and applies size check normally
  - `'MATCH'`: Automatically blocks content larger than WAF can inspect
  - Updated `PayloadSizeConstraint()` helper method to accept `oversizeHandling` parameter
  - Provides finer control over security posture for large payload handling
  - Aligns with AWS WAF console configuration options for oversize handling

## [1.24.1] - 2026-03-16

### Fixed
- **Monitoring: Improved CloudWatch alarm notification parsing**
  - Fixed "Unknown Alarm" and "No reason provided" appearing in alarm notifications
  - Added fallback to extract alarm name from SNS Subject field when AlarmName is missing
  - Added debug logging to help diagnose message parsing issues
  - Improved handling of CloudWatch alarms sent through SNS with non-standard JSON structure
  - Subject line parsing now extracts alarm name from formats like "ALARM: MyAlarmName in us-east-1"

## [1.24.0] - 2026-03-16

### Added
- **WAF: New PAYLOAD_32KB constant**
  - Added `PAYLOAD_32KB` static constant (32768 bytes) for medium API requests
  - Enables consistent payload size configuration using constants instead of literals
  - Can be used with `PayloadSizeConstraint()` helper method for blocking requests over 32KB
  - Complements existing constants (PAYLOAD_8KB, PAYLOAD_64KB, PAYLOAD_256KB, PAYLOAD_1MB)
  - Improves code readability and maintainability for payload size constraints

## [1.23.0] - 2026-03-16

### Added
- **Monitoring: Cross-region SNS topic forwarding**
  - New `ForwardToTopicConfig` interface for automatic cross-region alert forwarding
  - New `forwardToTopic` property in `MonitoringProps` to configure cross-region forwarding
  - Automatically creates and configures Lambda forwarder function when enabled
  - Forwards all SNS messages (GuardDuty, Access Analyzer, CloudWatch alarms, log errors) to target region
  - Preserves message content, subject, and attributes during forwarding
  - Configurable Lambda function name, timeout, and memory size
  - Grants IAM permissions automatically for cross-region SNS publishing
  - New public property `forwarderFunction` to access the Lambda forwarder
  - Eliminates 40+ lines of boilerplate code for multi-region deployments
  - Simplifies centralized monitoring across multiple AWS regions
  - Particularly useful for global resources (CloudFront) requiring monitoring in specific regions
  - Complete documentation with multi-region security monitoring examples
  - Comprehensive test coverage for all forwarding scenarios
  - Exported `ForwardToTopicConfig` type in main index

### Changed
- **Monitoring: Documentation updates**
  - Added comprehensive "Cross-Region SNS Forwarding" section with detailed examples
  - Updated features list to include cross-region forwarding capability
  - Updated MonitoringProps configuration reference with forwardToTopic property
  - Added ForwardToTopicConfig interface documentation with all properties
  - Updated instance properties documentation with forwarderFunction property
  - Added complete multi-region security monitoring example showing us-east-1 → ca-central-1 forwarding
  - Documented message flow diagram for cross-region architecture
  - Added benefits section highlighting boilerplate reduction and best practices

## [1.22.0] - 2026-03-16

### Added
- **HttpApi: Enhanced audit logging**
  - Default log format now includes comprehensive audit-friendly fields for compliance and security
  - Added user identity fields: `principalId` (authenticated principal), `userId` (JWT sub claim)
  - Added client information: `userAgent` (client application details)
  - Added performance metrics: `integrationLatency`, `responseLatency`, `requestTimeEpoch`
  - Added security fields: `domainName` for multi-domain tracking
  - Added error tracking: `errorMessage`, `errorType`, `integrationError`
  - Authorization fields automatically populated when using Lambda authorizers
  - Updated JSDoc documentation for `AccessLogsConfig.format` property
  - Provides complete audit trail: who (userId, principalId, IP) did what (method, route) when (timestamps) and what happened (status, errors, latency)

- **WAF: Payload size constraint rules**
  - New `PayloadSizeConstraintConfig` interface for blocking oversized requests
  - New `payloadSizeConstraint` property in `WafProps` to configure size limits
  - Supports checking BODY, HEADER, QUERY_STRING, or URI_PATH components
  - Configurable comparison operators (GT, GTE, LT, LTE, EQ, NE)
  - Default behavior: blocks requests with body size greater than configured limit
  - Static payload size constants for common limits:
    - `Waf.PAYLOAD_8KB` - 8,192 bytes (small API requests)
    - `Waf.PAYLOAD_64KB` - 65,536 bytes (standard requests)
    - `Waf.PAYLOAD_256KB` - 262,144 bytes (large requests)
    - `Waf.PAYLOAD_1MB` - 1,048,576 bytes (very large requests)
  - New static helper method `Waf.PayloadSizeConstraint(maxSizeBytes, priority, component?)`
  - Prevents denial-of-service attacks with oversized payloads
  - CloudWatch metrics enabled for monitoring blocked requests
  - Exported `PayloadSizeConstraintConfig` type in main index

### Changed
- **HttpApi: Access logs documentation**
  - Updated property documentation to reflect enhanced audit logging format
  - Added detailed breakdown of all logged fields by category
  - Updated examples in JSDoc to highlight audit-friendly logging

- **WAF: Documentation updates**
  - Updated feature list to include payload size constraints
  - Added comprehensive examples for payload size constraint usage
  - Updated static constants documentation with payload size constants
  - Added best practices for choosing appropriate payload size limits

## [1.21.0] - 2026-03-16
- **HttpApi: Enhanced access logs configuration**
  - Support for custom CloudWatch Log Groups (by object or by name reference)
  - Support for custom log group names when auto-creating a new log group
  - Auto-generated log group names based on API name (format: `/aws/apigateway/{api-name}`)
  - Custom log format support with default JSON format including common fields
  - S3 bucket reference option for configuring CloudWatch Logs export to S3
  - New getter `logGroup` to access the CloudWatch Log Group (if access logs enabled)
  - Log group has automatic removal policy (DESTROY) for easier cleanup

- **HttpApi: Improved CORS configuration**
  - Support for boolean value `true` to enable CORS with sensible defaults
  - Default CORS settings: allow all origins (`['*']`), common HTTP methods (GET, POST, PUT, DELETE, OPTIONS)
  - Support for custom CORS configuration with allowOrigins, allowMethods, allowHeaders, allowCredentials
  - CORS disabled by default (must be explicitly enabled)

- **HttpApi: Lambda authorizer support**
  - New static method `createAuthorizerFunction()` for creating Lambda authorizers
  - Support for configurable cache TTL (default: 300 seconds)
  - Uses simple response type for authorizer responses
  - Reads identity from cookie header (`$request.header.cookie`)
  - Returns `HttpLambdaAuthorizer` instance for use with route integrations

- **HttpApi: Improved route integration**
  - `addFunctionIntegration()` now supports optional authorizer in options parameter
  - Support for multiple HTTP methods per route (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, ANY)
  - Automatic route path sanitization for CloudFormation resource naming

- **Monitoring: Access Analyzer automatic creation**
  - Access Analyzer is now automatically created when `accessAnalyzer.enabled` is set to `true`
  - No longer requires pre-existing Access Analyzer in your AWS account
  - New `analyzerName` property for custom analyzer names (default: `{stack-name}-access-analyzer`)
  - New `type` property to choose between `ACCOUNT` or `ORGANIZATION` level analysis (default: `ACCOUNT`)
  - New `findingTypes` property to filter findings by type (e.g., `ExternalPrincipal`, `UnusedAccess`)
  - Analyzer is automatically tagged with `Name` and `ManagedBy: CDK` tags
  - New getter `analyzer` to access the created CfnAnalyzer instance
  - Only one analyzer of each type can exist per region

### Changed
- **HttpApi: Access logs behavior**
  - Access logs now disabled by default (previously may have been enabled)
  - When enabled with `accessLogs: true`, uses 7-day retention (ONE_WEEK) by default
  - Log group name defaults to `/aws/apigateway/{api-name}` when not specified

- **Monitoring: Access Analyzer behavior**
  - **BREAKING**: Now creates the Access Analyzer resource automatically instead of requiring it to exist
  - If you have an existing analyzer, you may need to import it or remove this feature to avoid conflicts
  - Organization-level analyzers require organization admin permissions

## [1.20.1] - 2026-03-16

### Added
- **Cognito: Systems Manager Parameter Store support for origin secret**
  - HTTP API authorization function now supports retrieving origin secret from AWS Systems Manager Parameter Store
  - New `ORIGIN_SECRET_PARAMETER_ARN` environment variable for secure secret storage
  - Implements caching to avoid repeated SSM calls and improve Lambda performance
  - Backward compatible with existing `ORIGIN_SECRET` environment variable
  - Follows the same pattern as other monitoring functions for consistency
  - Use `ParameterStore` construct to create the parameter and grant read access to the authorizer function

## [1.20.0] - 2026-03-16

### Added
- **Cognito: Systems Manager Parameter Store support for origin secret**
  - HTTP API authorization function now supports retrieving origin secret from AWS Systems Manager Parameter Store
  - New `ORIGIN_SECRET_PARAMETER_ARN` environment variable for secure secret storage
  - Implements caching to avoid repeated SSM calls and improve Lambda performance
  - Backward compatible with existing `ORIGIN_SECRET` environment variable
  - Follows the same pattern as other monitoring functions for consistency
  - Use `ParameterStore` construct to create the parameter and grant read access to the authorizer function

## [1.19.1] - 2026-03-12

### Removed
- **CloudFront: Modern log format support** (temporarily removed)
  - Removed `logFormat` property from `LoggingConfig` - not yet supported in CloudFormation
  - Removed `CloudFrontLogFormat` enum
  - Removed static constants `CloudFront.LOG_FORMAT_STANDARD` and `CloudFront.LOG_FORMAT_WEB`
  - Feature will be re-added when AWS CloudFormation adds support for this property
  - **Action Required**: If you upgraded to 1.19.0 and used `logFormat`, remove it from your code

## [1.19.0] - 2026-03-12

### Added
- **WAF: Body size inspection limits**
  - New `managedRulesBodySizeLimit` property to configure body inspection limits (16, 32, 48, or 64 KB)
  - Default managed rules now use 64 KB inspection limit for enhanced security (up from AWS default 16 KB)
  - Configured via WebACL-level `associationConfig` for consistent security across all rules
  - AWS Managed Rules automatically block requests with bodies exceeding the inspection limit
  - Prevents attackers from bypassing WAF inspection with oversized payloads
  - New `BodySizeInspectionLimit` type with values: KB_16, KB_32, KB_48, KB_64
  - Static constants: `Waf.BODY_SIZE_16KB`, `Waf.BODY_SIZE_32KB`, `Waf.BODY_SIZE_48KB`, `Waf.BODY_SIZE_64KB`
  - Note: Inspection limits > 16 KB for CloudFront may incur additional AWS charges

## [1.18.0] - 2026-03-12

### Added
- **Monitoring: GuardDuty integration**
  - New `guardDuty` configuration option in `MonitoringProps`
  - Monitor AWS GuardDuty security findings with configurable severity levels
  - Filter by severity: LOW (1.0-3.9), MEDIUM (4.0-6.9), HIGH (7.0-8.9), CRITICAL (9.0+)
  - Static constants for severity levels: `GUARD_DUTY_MIN_SEVERITY_LOW/MEDIUM/HIGH/CRITICAL`
  - Default minimum severity: MEDIUM (4.0)
  - Configurable EventBridge rule name and description
  - Findings are sent to the same SNS topic as CloudWatch alarms
  - Access rule via `monitoring.guardDutyRule` property
  - **Note**: GuardDuty must be enabled in your AWS account

- **Monitoring: IAM Access Analyzer integration**
  - New `accessAnalyzer` configuration option in `MonitoringProps`
  - Monitor IAM Access Analyzer findings for unintended resource access
  - Filter by resource types (S3 buckets, IAM roles, KMS keys, Lambda functions, etc.)
  - Control whether to alert on ACTIVE findings only (default) or include all statuses
  - Configurable EventBridge rule name and description
  - Findings are sent to the same SNS topic as CloudWatch alarms
  - Access rule via `monitoring.accessAnalyzerRule` property
  - **Note**: IAM Access Analyzer must be enabled in your AWS account

- **S3Bucket: Object ownership controls**
  - New optional `objectOwnership` property to configure ACL behavior
  - Static constant `S3Bucket.BUCKET_OWNER_PREFERRED` for convenient access
  - Enables ACL support required for CloudFront logging and other AWS services
  - Supports all ObjectOwnership values: BUCKET_OWNER_PREFERRED, OBJECT_WRITER, BUCKET_OWNER_ENFORCED
  - Automatically configures ownership controls at bucket creation when specified

## [1.17.1] - 2026-03-12

### Fixed
- **Vpc `restrictDefaultNacl` now allows UDP ephemeral ports for DNS resolution**
  - Added UDP ephemeral port rules (1024-65535) alongside existing TCP rules
  - Fixes Lambda timeout issues when accessing AWS services (Secrets Manager, DynamoDB, etc.) from private subnets with NAT Gateway
  - DNS queries require UDP protocol for response traffic in stateless NACLs
  - Applies to both public and private-egress custom NACLs

## [1.17.0] - 2026-03-12

### Changed
- **BREAKING: Vpc `restrictDefaultNacl` now uses replacement strategy instead of override**
  - Creates 3 new custom NACLs (public, private-egress, isolated) instead of modifying default NACL
  - Associates custom NACLs with all subnets, automatically detaching the default NACL
  - Default NACL remains with 0 subnet associations (no security risk, ignored by scanners)
  - Each new NACL starts with implicit deny-all for better security posture
  - Eliminates conflicts with AWS default Rule 100
  - Cleaner implementation using high-level NetworkAcl constructs
  - **Migration**: Existing stacks will need to recreate NACL associations (may cause brief disruption)
  
### Fixed
- **Resolved "AlreadyExists" error when deploying with `restrictDefaultNacl`**
  - Previous implementation tried to override Rule 100, causing conflicts
  - New replacement strategy avoids this entirely
  - Security scanners no longer flag Rule 100 since default NACL is detached

### Security
- **Enhanced NACL security with explicit deny-all defaults**
  - New custom NACLs use implicit deny-all (only explicitly allowed traffic passes)
  - More auditable - separate custom NACLs clearly visible in AWS console
  - Better defense-in-depth with subnet-specific security rules

## [1.16.0] - 2026-03-11

### Added
- **HttpApi: Access 6.0 to CloudWatch and S3**
  - New `accessLogs` property to enable API Gateway access logging
  - Logs are sent to CloudWatch Logs by default
  - Optional S3 bucket reference for future CloudWatch to S3 export
  - Configurable log retention period (default: 7 days)
  - Custom log format support with sensible defaults (requestId, IP, method, status, etc.)
  - New `logGroup` getter to access the CloudWatch Log Group
  - Automatically configures the default stage with access logging
  - Example: `accessLogs: true` or `accessLogs: { retention: RetentionDays.ONE_MONTH, s3Bucket: myBucket }`

## [1.15.1] - 2026-03-11

### Removed
- **Default NACL automatic naming** - Removed AwsCustomResource tagging to avoid creating Lambda function
  - The automatic Name tag feature added unnecessary complexity (Lambda + IAM role)
  - Default NACL can still be identified by its association with subnets
  - Keeps the construct lightweight without extra resources

## [1.15.1] - 2026-03-11

### Changed
- **Improved documentation for restrictDefaultNacl**
  - Clarified primary use case: API Gateway + Lambda architecture with everything in private subnets
  - Blocks ALL incoming internet traffic while allowing Lambda to call external APIs
  - Updated property descriptions to emphasize API Gateway + Lambda use case
  - Made clear that defaultNaclAllowedPorts is only for load balancers/public services

## [1.14.1] - 2026-03-11

### Fixed
- **CRITICAL: restrictDefaultNacl now properly blocks unauthorized traffic**
  - Added explicit DENY rule (32766) to block all traffic not explicitly allowed
  - Changed rule numbers to 90 (before AWS default rule 100) to ensure proper evaluation
  - Fixes issue where default AWS NACL rules (allow all 0.0.0.0/0) were not overridden
  - Now properly secures default NACL while allowing specified traffic
  - **All users of v1.14.0 should upgrade immediately**

## [1.14.0] - 2026-03-11 [YANKED - Security Issue]

**⚠️ WARNING: This version had a security issue where restrictDefaultNacl did not properly block unauthorized traffic. Please upgrade to v1.14.1 or later.**

## [1.14.0] - 2026-03-11

### Added
- **restrictDefaultNacl property for VPC construct**
  - Lock down the VPC's default Network ACL to allow VPC CIDR traffic and controlled internet access
  - Provides defense-in-depth security for subnets not explicitly associated with custom NACLs
  - Prevents accidental exposure if custom NACL associations are missed
  - Works alongside restrictPrivateSubnetNacls and restrictPublicSubnetNacls for maximum security
  - Automatically uses the VPC's actual CIDR block (no manual configuration needed)
  - Allows ephemeral ports (1024-65535) from internet for return traffic (external API calls)
  - Allows all outbound traffic for calling external APIs

- **defaultNaclAllowedPorts property for VPC construct**
  - Open specific TCP ports from internet on the default NACL (e.g., [80, 443])
  - Only applies when restrictDefaultNacl is true
  - Perfect for load balancers or public services using the default NACL
  - Ephemeral ports automatically allowed for response traffic

## [1.13.0] - 2026-03-11

### Added
- **Network ACL restrictions for public subnets**
  - `restrictPublicSubnetNacls` property to block internet access (0.0.0.0/0) to public subnets
  - Useful when all services are behind API Gateway and no public-facing resources are needed
  - Blocks both inbound and outbound internet traffic on public subnets
  - Only allows traffic within VPC CIDR range
  - Automatically uses VPC's actual CIDR block (no manual configuration needed)
  - Comprehensive test coverage with 14 passing VPC tests

### Fixed
- **Network ACL support for Lambda external API calls**
  - Private egress subnet NACLs now allow ephemeral port responses (1024-65535) from internet (0.0.0.0/0)
  - Enables Lambda functions in VPC to call external APIs (Stripe, SendGrid, etc.)
  - Private isolated subnet NACLs still restrict ephemeral ports to VPC CIDR only for enhanced RDS security
  - Maintains defense-in-depth: Security Groups provide primary control, NACLs provide backup layer

## [1.12.1] - 2026-03-11

### Fixed
- **CRITICAL: Network ACL default changed to false** to prevent breaking existing deployments
  - Fixed issue where v1.12.0 Network ACLs blocked Lambda→RDS and other internal communication by default
  - `restrictPrivateSubnetNacls` now defaults to `false` for backward compatibility
  - Existing VPC deployments are no longer affected by default
  - Users must explicitly opt-in with `restrictPrivateSubnetNacls: true` for new VPCs
  - This restores normal operation for Lambda→RDS, Lambda→ElastiCache, and other VPC-internal communications

### Changed
- Network ACLs are now **opt-in** instead of **opt-out** for safety
- Updated all documentation to reflect opt-in behavior

## [1.12.0] - 2026-03-11 [YANKED - Breaking Change]

**⚠️ WARNING: This version had a breaking change that blocked internal VPC communication. Please upgrade to v1.12.1 or later.**

### Added
- **Network ACL security for VPC private subnets (Opt-In)**
  - Restrictive Network ACLs now available for private subnets
  - Only allows inbound traffic from VPC CIDR range, blocks external traffic (0.0.0.0/0)
  - Separate NACLs for private-egress and private-isolated subnets
  - `restrictPrivateSubnetNacls` property (default: `false`) to enable NACL restrictions
  - `allowedPorts` property to specify specific TCP ports (e.g., `[80, 443]`)
  - Automatic ephemeral port rules (1024-65535) for return traffic when using specific ports
  - Private-egress subnets: Allow inbound from VPC CIDR, allow all outbound
  - Private-isolated subnets: Allow inbound from VPC CIDR, allow outbound only to VPC CIDR
  - Defense-in-depth security with both Network ACLs (subnet-level) and Security Groups (resource-level)
  - Comprehensive test coverage with 12 passing VPC tests
  - Full documentation with security best practices and examples in [VPC docs](./docs/Vpc.md)

### Changed
- **Network ACLs are disabled by default** (`restrictPrivateSubnetNacls: false`) to maintain backward compatibility
- Existing VPC deployments are unaffected - Lambda→RDS and other internal communication continues to work
- Set `restrictPrivateSubnetNacls: true` explicitly for NEW VPCs to enable enhanced security

### Security
- VPC private subnets CAN NOW be secured with restrictive Network ACLs (opt-in)
- Prevents misconfigured security groups from exposing resources to the internet (when enabled)
- Provides compliance-ready network isolation (PCI-DSS, HIPAA requirements) (when enabled)

### Note
- **IMPORTANT**: This feature is OPT-IN. Set `restrictPrivateSubnetNacls: true` for new VPCs
- Existing deployments maintain current behavior (no NACLs) for zero-downtime upgrades

## [1.11.0] - 2026-03-10

### Added
- **Password expiration support** for Cognito User Pools
  - `passwordExpirationDays` property in `PasswordPolicyConfig` to force password resets after N days
  - Automatic custom attribute `custom:last-password-change` to track password age
  - Three Lambda triggers for password expiration enforcement:
    - Pre-authentication trigger to block expired passwords
    - Post-authentication trigger to initialize password timestamps
    - Post-confirmation trigger to update timestamps on password resets
  - Static helper methods for Lambda function entry paths:
    - `Cognito.PasswordExpirationPreAuthFunctionEntryPath()`
    - `Cognito.PasswordExpirationPostAuthFunctionEntryPath()`
    - `Cognito.PasswordExpirationPostConfirmationFunctionEntryPath()`
  - Comprehensive test coverage with 10 passing tests
  - Full documentation with usage examples in [Cognito docs](./docs/Cognito.md#password-expiration)

### Note
- **Publishing**: This package auto-publishes to npm when pushed to GitHub with tags

## [1.10.0] - 2026-03-10

### Added
- **GuardDuty monitoring integration** for security threat detection
  - `guardDuty` configuration option in Monitoring construct
  - Automatic EventBridge rule creation for GuardDuty findings
  - Configurable minimum severity levels: LOW, MEDIUM, HIGH, CRITICAL
  - Direct integration with SNS topic for unified notification routing
  - Static constants for severity levels: `GUARD_DUTY_MIN_SEVERITY_LOW`, `GUARD_DUTY_MIN_SEVERITY_MEDIUM`, `GUARD_DUTY_MIN_SEVERITY_HIGH`, `GUARD_DUTY_MIN_SEVERITY_CRITICAL`
  - Numeric severity filtering based on AWS GuardDuty severity ranges
  - Full documentation with examples and best practices

## [1.8.0] - 2026-03-06

### Changed
- Migrated to new AWS CDK threat protection API for Cognito
  - Use `standardThreatProtectionMode` with ESSENTIALS feature plan (values: NO_ENFORCEMENT, AUDIT_ONLY, FULL_FUNCTION)
  - Use `customThreatProtectionMode` with PLUS feature plan (values: AUDIT_ONLY, FULL_FUNCTION)
  - Removed deprecated `AdvancedSecurityMode` (was never used in production)
  - See [Cognito documentation](./docs/Cognito.md#threat-protection-advanced-security) for usage examples
- Removed deprecated `ParameterType` from ParameterStore construct
  - `type` property removed from `ParameterStoreProps` (was always 'String')
  - `secureString()` static method removed (SecureString parameters cannot be created via CDK/CloudFormation)
  - Note: Use AWS Console, CLI, or SDK to create SecureString parameters, then import them with `fromExistingParameter()`

### Added
- **Enhanced Monitoring construct** with real-time error log notifications
  - `monitorErrors()` - Real-time JSON error log monitoring with CloudWatch subscription filters
  - Automatic JSON log parsing for structured error data
  - Shared Lambda function architecture for efficient resource usage
  - Multiple error level support (ERROR, FATAL, CRITICAL)
  - Custom field name support for flexible log formats
  - Direct integration with SNS topic for unified notification routing
  - ES module support for all monitoring Lambda functions
- **Monitoring construct** with comprehensive CloudWatch and Slack integration
  - `createLogGroup()` - Create CloudWatch Log Groups with configurable retention
  - `addLogAlarm()` - Create metric filters and alarms for log patterns
  - `addAlarm()` - Create CloudWatch alarms with configurable thresholds
  - Notification handlers for Slack, Microsoft Teams, and Google Chat
  - `slackNotifier()`, `teamsNotifier()`, `googleChatNotifier()` - Factory methods for notification configs
  - Formatted notification messages with color coding and detailed context
  - Sensible defaults: 7-day log retention, 5-minute evaluation periods
  - Full documentation with examples and best practices
  - Comprehensive test coverage

### Changed
- All monitoring Lambda functions now use ES modules (`"type": "module"`)
- Removed all console.log statements from monitoring functions for cleaner CloudWatch logs
- Build script now automatically copies package.json files for all monitoring functions
- Renamed `addJsonErrorLogSubscription()` to `monitorErrors()` for better API clarity

### Fixed
- Lambda runtime "Cannot use import statement outside a module" errors
- TypeScript compilation errors with aws-jwt-verify package
- Updated log-error-notifier tests to match SNS-based implementation
- Removed outdated unit tests for deprecated static methods

## [1.7.0] - 2026-03-03

### Added
- WAF integration for Cognito User Pools
  - Optional `waf` property in CognitoProps to attach WAF Web ACL
  - Automatic association of REGIONAL WAF with User Pool ARN
  - Network-level protection against DDoS, credential stuffing, and brute force attacks
  - Support for combining WAF (network-level) with Advanced Security (application-level)
  - Comprehensive documentation with security best practices
  - Full test coverage maintained (153 tests passing)

## [1.5.0] - 2026-03-03

### Added
- Advanced Security / Threat Protection for Cognito User Pools
  - Three security modes: OFF (default), AUDIT, and ENFORCED
  - Account takeover prevention with configurable risk-based actions (low, medium, high)
  - Compromised credentials detection and blocking
  - Email notifications for security events via SES
  - Custom email templates for MFA, block, and no-action notifications
- CloudWatch Logs integration for Cognito User Pools
  - Configurable log delivery for user authentication and notification events
  - Support for multiple event sources (USER_AUTH_EVENTS, USER_NOTIFICATION)
  - Configurable log levels (INFO, ERROR)
  - Custom log group names and retention policies
  - Automatic IAM policy creation for log delivery
- New exported types and enums:
  - `AdvancedSecurityMode` - Security mode options (OFF, AUDIT, ENFORCED)
  - `AccountTakeoverActionType` - Actions for account takeover scenarios
  - `CompromisedCredentialsActionType` - Actions for compromised credentials
  - `ThreatProtectionConfig` - Complete threat protection configuration
  - `AccountTakeoverRiskConfiguration` - Risk level action configuration
  - `AccountTakeoverActionConfig` - Individual action configuration
  - `CompromisedCredentialsRiskConfiguration` - Compromised credentials settings
  - `NotifyConfiguration` - Email notification configuration
  - `CognitoLogsConfig` - CloudWatch Logs configuration
  - `LogDeliveryConfig` - Individual log delivery configuration
- Comprehensive documentation for threat protection features
- Full test coverage for advanced security and logging features

### Changed
- Enhanced Cognito construct with enterprise-grade security features
- Documentation updated with threat protection examples and best practices
- Added security considerations and cost warnings for Advanced Security features

## [1.4.0] - 2026-03-01

### Added
- Password policy configuration with predefined plans (BASIC, STANDARD, STRONG, ENTERPRISE, CUSTOM)
- Comprehensive password policy options: minLength, requireUppercase, requireLowercase, requireNumbers, requireSymbols
- Password history support to prevent password reuse (0-24 previous passwords)
- Temporary password validity configuration (tempPasswordValidityDays)
- PasswordPolicyPlan enum for easy policy selection
- PasswordPolicyConfig interface with full type safety
- Full test coverage for all password policy plans and custom configurations
- Updated Cognito documentation with password policy examples and configuration table

## [1.3.0] - 2026-02-27

### Added
- Email MFA support in Cognito construct with SES integration
- Styled HTML email templates for MFA authentication codes
- Custom message handler support for `CustomMessage_Authentication` trigger
- MFA email styling with professional design and security warnings
- Environment variables for customizing MFA email subjects (`COGNITO_MFA_SUBJECT`)
- Comprehensive test coverage for MFA email functionality
- Documentation for email MFA configuration and custom email styling

### Changed
- Updated default MFA configuration to include email when SES is configured
- Improved custom message handler to support both password reset and MFA emails
- Enhanced Cognito documentation with MFA configuration examples

## [0.2.2] - 2026-02-24

### Fixed
- TypeScript compilation errors in Lambda function handlers

## [0.2.1] - 2026-02-20

### Added
- CloudFront construct with custom domains and security headers
- EventBridge construct for scheduled tasks
- BastionHost construct for secure SSH access
- Server construct for EC2 instances

### Changed
- Updated dependencies to latest versions
- Improved documentation

## [0.2.0] - 2026-02-15

### Added
- Cognito construct with OAuth, MFA, and custom domains
- HttpApi construct with Lambda integrations and JWT authorization
- Comprehensive lambda handlers for Cognito authentication flows:
  - OAuth callback handler
  - Token refresh handler
  - HTTP API JWT authorizer
  - Custom message handler
  - Pre-token generation handler
  - Signout callback handler

### Changed
- Refactored Function construct for better reusability
- Updated AWS SDK dependencies

## [0.1.5] - 2026-02-10

### Added
- DynamoDB construct with GSI support
- SQS construct with DLQ configuration
- SES construct for email sending

### Fixed
- VPC endpoint configuration issues

## [0.1.0] - 2026-02-01

### Added
- Initial release
- Vpc construct with configurable subnets and endpoints
- S3Bucket construct with lifecycle policies
- Function (Lambda) construct
- RdsDatabase construct
- Secrets construct

### Features
- TypeScript support
- Comprehensive unit tests
- Full AWS CDK integration

[Unreleased]: https://github.com/designofadecade/cdk-constructs/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/designofadecade/cdk-constructs/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/designofadecade/cdk-constructs/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/designofadecade/cdk-constructs/compare/v0.1.5...v0.2.0
[0.1.5]: https://github.com/designofadecade/cdk-constructs/compare/v0.1.0...v0.1.5
[0.1.0]: https://github.com/designofadecade/cdk-constructs/releases/tag/v0.1.0
