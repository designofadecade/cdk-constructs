# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
