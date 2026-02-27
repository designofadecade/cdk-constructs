# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
