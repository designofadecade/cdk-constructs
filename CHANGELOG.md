# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive test coverage for all Lambda function handlers
- Test suites for Cognito authentication handlers

### Changed
- Improved TypeScript type safety in test files

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
