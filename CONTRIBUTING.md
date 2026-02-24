# Contributing to @designofadecade/cdk-constructs

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Environment details** (Node version, AWS CDK version, etc.)
- **Code samples** or test cases demonstrating the issue

Example bug report:

```markdown
## Bug: VPC endpoint creation fails with custom CIDR

**Environment:**
- Node.js: 20.10.0
- AWS CDK: 2.240.0
- Package version: 0.2.2

**Steps to reproduce:**
1. Create Vpc with custom CIDR: `new Vpc(this, 'Vpc', { cidr: '172.16.0.0/16' })`
2. Add S3 endpoint: `endpoints: ['s3']`
3. Run `cdk deploy`

**Expected:** VPC and S3 endpoint created successfully
**Actual:** Error: "Invalid CIDR range for S3 endpoint"

**Code sample:**
\`\`\`typescript
const vpc = new Vpc(this, 'CustomVpc', {
  cidr: '172.16.0.0/16',
  endpoints: ['s3']
});
\`\`\`
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When suggesting an enhancement:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the proposed feature
- **Explain why this enhancement would be useful**
- **Provide code examples** of how the feature would be used
- **List alternative solutions** you've considered

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following the code style guidelines
3. **Add tests** for new functionality
4. **Update documentation** as needed
5. **Ensure tests pass**: `npm test`
6. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git
- AWS CLI (for testing deployments)

### Setup Steps

1. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/cdk-constructs.git
   cd cdk-constructs
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/designofadecade/cdk-constructs.git
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for TDD
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Building

```bash
# Compile TypeScript
npm run build

# Watch mode
npm run watch
```

### Testing Your Changes

Before submitting a PR, ensure:

```bash
# All tests pass
npm test

# No TypeScript errors
npm run build

# Code is properly formatted (if using Prettier)
npm run format

# No linting errors (if using ESLint)
npm run lint
```

## Code Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable and function names
- Keep functions small and focused (ideally < 50 lines)
- Use explicit return types for public functions

**Good:**
```typescript
export function createBucket(scope: Construct, id: string, props: BucketProps): Bucket {
  return new Bucket(scope, id, {
    encryption: BucketEncryption.KMS_MANAGED,
    versioned: props.versioned ?? true,
  });
}
```

**Bad:**
```typescript
export function create(s: any, i: string, p: any) {
  return new Bucket(s, i, p);
}
```

### Documentation

- Add JSDoc comments for all public APIs
- Include `@param` descriptions for parameters
- Include `@returns` descriptions
- Add `@example` for complex functionality

**Example:**
```typescript
/**
 * Creates an S3 bucket with security best practices enabled
 * 
 * @param scope - The CDK scope
 * @param id - The construct ID
 * @param props - Bucket configuration properties
 * @returns Configured S3 bucket instance
 * 
 * @example
 * ```typescript
 * const bucket = new S3Bucket(this, 'MyBucket', {
 *   versioned: true,
 *   lifecycleRules: [{
 *     enabled: true,
 *     transitions: [{
 *       storageClass: StorageClass.GLACIER,
 *       transitionAfter: Duration.days(90),
 *     }],
 *   }],
 * });
 * ```
 */
export class S3Bucket extends Construct {
  // ... implementation
}
```

### Testing

- Write unit tests for all new constructs
- Aim for >80% code coverage
- Test both success and error cases
- Use descriptive test names

**Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { Stack } from 'aws-cdk-lib';
import { S3Bucket } from './S3Bucket';

describe('S3Bucket', () => {
  it('creates bucket with versioning enabled', () => {
    const stack = new Stack();
    const bucket = new S3Bucket(stack, 'TestBucket', {
      versioned: true,
    });
    
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: {
        Status: 'Enabled',
      },
    });
  });

  it('throws error when invalid lifecycle rule provided', () => {
    const stack = new Stack();
    
    expect(() => {
      new S3Bucket(stack, 'TestBucket', {
        lifecycleRules: [{
          transitionAfter: Duration.days(-1), // Invalid
        }],
      });
    }).toThrow('Transition days must be positive');
  });
});
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(cognito): add support for custom email templates

fix(vpc): correct security group configuration for NAT gateways

docs: update README with new CloudFront examples

test(s3): add tests for lifecycle policy validation

chore: update dependencies to latest versions
```

## Pull Request Process

### Before Submitting

1. **Update your branch** with latest changes from `main`:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run the full test suite**:
   ```bash
   npm test
   npm run build
   ```

3. **Update documentation**:
   - Update README.md if adding new features
   - Add JSDoc comments to new code
   - Update CHANGELOG.md

### PR Template

When creating a PR, include:

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to break)
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] All tests passing locally
- [ ] Manually tested in AWS environment (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added for new functionality
- [ ] Dependent changes merged

## Related Issues
Closes #<issue_number>
```

### Review Process

1. **Automated checks** must pass (tests, build)
2. **Code review** by at least one maintainer
3. **Documentation review** for clarity and completeness
4. **Approval** required before merging

### After Approval

- Maintainers will merge using **squash and merge**
- Your commits will be combined into a single commit
- The PR number will be referenced in the commit message

## Release Process

Only maintainers can create releases:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create and push a git tag:
   ```bash
   git tag -a v0.3.0 -m "Release v0.3.0"
   git push origin v0.3.0
   ```
4. Publish to npm:
   ```bash
   npm publish --access public
   ```
5. Create GitHub release with release notes

## Getting Help

- **Documentation**: Check [README.md](README.md)
- **Issues**: Search [existing issues](https://github.com/designofadecade/cdk-constructs/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/designofadecade/cdk-constructs/discussions)
- **Email**: support@designofadecade.com

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes
- Special thanks in README (for significant contributions)

Thank you for contributing to @designofadecade/cdk-constructs! 🎉
