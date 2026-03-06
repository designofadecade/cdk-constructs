# ParameterStore

A CDK construct for creating and managing AWS Systems Manager Parameter Store parameters with automatic tagging, type safety, and convenient helper methods.

## Features

- **Multiple Parameter Types**: Support for String, StringList, and SecureString parameters
- **JSON Support**: Automatically serialize objects to JSON strings
- **Automatic Tagging**: Apply consistent tags across all parameters
- **Access Management**: Built-in methods for granting read/write permissions
- **CloudFormation Outputs**: Automatically exports parameter ARN and name
- **Static Helpers**: Convenience methods for common use cases
- **Placeholder Support**: Use `REPLACE_ME` constant for sensitive values

## Basic Usage

### String Parameter

```typescript
const apiEndpoint = new ParameterStore(this, 'ApiEndpoint', {
  name: '/app/api-endpoint',
  value: 'https://api.example.com',
  description: 'API endpoint URL',
  stack: { 
    config: { parameterNamePrefix: '/prod/' }, 
    tags: [
      { key: 'Environment', value: 'production' },
      { key: 'Team', value: 'backend' }
    ]
  },
});
```

### JSON Parameter

```typescript
const appConfig = new ParameterStore(this, 'AppConfig', {
  name: '/app/config',
  value: {
    timeout: 30,
    retries: 3,
    endpoint: 'https://api.example.com',
    features: {
      caching: true,
      logging: true
    }
  },
  description: 'Application configuration',
  stack: { 
    config: { parameterNamePrefix: '/prod/' }, 
    tags: []
  },
});
```

### Secure String Parameter

```typescript
const apiKey = new ParameterStore(this, 'ApiKey', {
  name: '/app/api-key',
  value: ParameterStore.REPLACE_ME, // Replace manually in console
  type: ParameterType.SECURE_STRING,
  description: 'API key for external service',
  stack: { 
    config: { parameterNamePrefix: '/prod/' }, 
    tags: []
  },
});
```

## Static Helper Methods

### `ParameterStore.string()`

Create a string parameter without requiring a prefix:

```typescript
const endpoint = ParameterStore.string(this, 'Endpoint', {
  name: '/app/endpoint',
  value: 'https://api.example.com',
  stack: { id: 'my-stack', tags: [] }
});
```

### `ParameterStore.json()`

Create a parameter with JSON value:

```typescript
const config = ParameterStore.json(this, 'Config', {
  name: '/app/config',
  value: { 
    key1: 'value1',
    key2: 'value2'
  },
  stack: { id: 'my-stack', tags: [] }
});
```

### `ParameterStore.secureString()`

Create a secure string parameter:

```typescript
const secret = ParameterStore.secureString(this, 'Secret', {
  name: '/app/secret',
  value: ParameterStore.REPLACE_ME,
  description: 'Sensitive value',
  stack: { id: 'my-stack', tags: [] }
});
```

### `ParameterStore.fromExistingParameter()`

Import an existing parameter:

```typescript
const existingParam = ParameterStore.fromExistingParameter(
  this,
  'Existing',
  '/existing/parameter/name'
);

// Use in your code
const value = existingParam.stringValue;
```

## Advanced Configuration

### Parameter Tiers

Use Advanced tier for large parameter values (>4KB):

```typescript
const largeConfig = new ParameterStore(this, 'LargeConfig', {
  name: '/app/large-config',
  value: veryLargeStringValue,
  tier: ParameterTier.ADVANCED,
  stack: { 
    config: { parameterNamePrefix: '' }, 
    tags: []
  },
});
```

### Allowed Patterns

Enforce value patterns using regex:

```typescript
const portNumber = new ParameterStore(this, 'Port', {
  name: '/app/port',
  value: '8080',
  allowedPattern: '^[0-9]{1,5}$',
  description: 'Application port number',
  stack: { 
    config: { parameterNamePrefix: '' }, 
    tags: []
  },
});
```

## Access Management

### Grant Read Access

```typescript
const config = new ParameterStore(this, 'Config', {
  name: '/app/config',
  value: 'config-value',
  stack: { 
    config: { parameterNamePrefix: '' }, 
    tags: []
  },
});

// Grant Lambda function read access
const fn = new Function(this, 'MyFunction', { /* ... */ });
config.grantRead(fn);
```

### Grant Write Access

```typescript
// Grant Lambda function write access
config.grantWrite(fn);
```

## Properties

### Accessing Parameter Values

```typescript
const parameter = new ParameterStore(this, 'MyParam', { /* ... */ });

// Get the ARN
const arn = parameter.arn;

// Get the name
const name = parameter.name;

// Get the string value (for use in CloudFormation)
const value = parameter.stringValue;
```

## Common Patterns

### Environment-Specific Configuration

```typescript
interface StackConfig {
  environment: 'dev' | 'staging' | 'prod';
  region: string;
}

function createConfig(scope: Construct, config: StackConfig) {
  return new ParameterStore(scope, 'AppConfig', {
    name: `/app/config`,
    value: {
      environment: config.environment,
      region: config.region,
      apiUrl: `https://api.${config.environment}.example.com`,
    },
    stack: {
      config: { 
        parameterNamePrefix: `/${config.environment}/` 
      },
      tags: [
        { key: 'Environment', value: config.environment }
      ]
    }
  });
}
```

### Sharing Parameters Across Stacks

```typescript
// In Stack A - Create parameter
class StackA extends Stack {
  public readonly config: ParameterStore;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.config = new ParameterStore(this, 'SharedConfig', {
      name: '/shared/config',
      value: { key: 'value' },
      stack: { 
        config: { parameterNamePrefix: '' }, 
        tags: []
      }
    });
  }
}

// In Stack B - Reference parameter
class StackB extends Stack {
  constructor(scope: Construct, id: string, stackA: StackA) {
    super(scope, id);
    
    const configValue = stackA.config.stringValue;
    // Use configValue in your resources
  }
}
```

### Using Placeholder Values

For sensitive values that shouldn't be committed to code:

```typescript
const dbPassword = new ParameterStore(this, 'DbPassword', {
  name: '/app/db-password',
  value: ParameterStore.REPLACE_ME,
  type: ParameterType.SECURE_STRING,
  description: 'Database password - REPLACE IN CONSOLE',
  stack: { 
    config: { parameterNamePrefix: '/prod/' }, 
    tags: []
  }
});

// After deployment, manually update in AWS Console:
// aws ssm put-parameter --name "/prod//app/db-password" \
//   --value "actual-password" --type "SecureString" --overwrite
```

## Best Practices

1. **Use SecureString for Sensitive Data**: Always use `ParameterType.SECURE_STRING` for passwords, API keys, and other sensitive information
2. **Consistent Naming**: Use a consistent naming convention like `/environment/app/parameter`
3. **Descriptive Names**: Make parameter names self-documenting
4. **Avoid Hardcoding**: Use the `REPLACE_ME` placeholder for sensitive values
5. **Tag Everything**: Use tags for cost allocation and resource organization
6. **Use Prefixes**: Organize parameters with prefixes for different environments
7. **Advanced Tier**: Use Advanced tier only when needed (it costs more)
8. **Grant Least Privilege**: Only grant the minimum permissions needed (read vs. write)

## API Reference

### Constructor Props

```typescript
interface ParameterStoreProps {
  name: string;
  stack: {
    config: {
      parameterNamePrefix: string;
    };
    tags: ReadonlyArray<{ key: string; value: string }>;
  };
  value: string | Record<string, unknown>;
  description?: string;
  type?: ParameterType;
  tier?: ParameterTier;
  allowedPattern?: string;
}
```

### Instance Properties

- `arn: string` - The ARN of the parameter
- `name: string` - The name of the parameter
- `stringValue: string` - The value of the parameter

### Instance Methods

- `grantRead(principal: IGrantable): void` - Grant read permissions
- `grantWrite(principal: IGrantable): void` - Grant write permissions

### Static Methods

- `string(scope, id, props): ParameterStore` - Create a string parameter
- `json(scope, id, props): ParameterStore` - Create a JSON parameter
- `secureString(scope, id, props): ParameterStore` - Create a secure string parameter
- `fromExistingParameter(scope, id, name): IParameter` - Import existing parameter

### Constants

- `REPLACE_ME: string` - Placeholder value for sensitive data

## Related Constructs

- [Secrets](./Secrets.md) - For AWS Secrets Manager secrets
- [Function](./Function.md) - Lambda functions that can read parameters
- [Server](./Server.md) - EC2 instances that can read parameters

## See Also

- [AWS Systems Manager Parameter Store Documentation](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [CDK SSM Module](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ssm-readme.html)
