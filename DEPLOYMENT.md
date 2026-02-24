# Production Deployment Checklist

Use this checklist before deploying infrastructure to production using `@designofadecade/cdk-constructs`.

## Pre-Deployment

### Infrastructure Review

- [ ] **Review all CDK code** for hardcoded values
- [ ] **Verify environment variables** are set correctly
- [ ] **Check resource naming conventions** follow your organization's standards
- [ ] **Review IAM policies** follow principle of least privilege
- [ ] **Confirm cost estimates** using AWS Cost Calculator
- [ ] **Document architecture** with diagrams (use draw.io, Lucidchart, etc.)

### Security

- [ ] **Enable encryption** for all data at rest (S3, RDS, DynamoDB)
- [ ] **Enable encryption** for data in transit (HTTPS, TLS)
- [ ] **Configure VPC** with private subnets for sensitive resources
- [ ] **Set up VPC Flow Logs** for network monitoring
- [ ] **Enable MFA** for Cognito when applicable
- [ ] **Review security groups** - no overly permissive rules
- [ ] **Use Secrets Manager** for sensitive credentials
- [ ] **Enable AWS CloudTrail** for audit logging
- [ ] **Configure AWS Config** for compliance monitoring
- [ ] **Set up AWS GuardDuty** for threat detection

### High Availability

- [ ] **Deploy across multiple AZs** (minimum 2, preferably 3)
- [ ] **Enable Multi-AZ** for RDS databases
- [ ] **Configure Auto Scaling** for compute resources
- [ ] **Set up CloudFront** for global content delivery
- [ ] **Configure health checks** for load balancers
- [ ] **Enable S3 versioning** for critical data
- [ ] **Set up cross-region replication** if needed

### Monitoring & Alerts

- [ ] **Configure CloudWatch alarms** for critical metrics
- [ ] **Set up SNS topics** for alert notifications
- [ ] **Enable CloudWatch Logs** for Lambda functions
- [ ] **Configure log retention periods** (7-30 days recommended)
- [ ] **Set up dashboards** for key metrics
- [ ] **Configure AWS X-Ray** for distributed tracing
- [ ] **Enable RDS Performance Insights** if using RDS

### Backup & Recovery

- [ ] **Enable automated backups** for databases (7-30 day retention)
- [ ] **Configure S3 lifecycle policies** for long-term storage
- [ ] **Set up DynamoDB point-in-time recovery**
- [ ] **Test restore procedures** for critical data
- [ ] **Document RTO/RPO requirements**
- [ ] **Create disaster recovery runbook**

### Performance

- [ ] **Right-size EC2 instances** based on workload
- [ ] **Configure Lambda memory** appropriately (more memory = more CPU)
- [ ] **Set Lambda timeout values** realistically
- [ ] **Enable CloudFront caching** for static content
- [ ] **Configure DynamoDB capacity** (on-demand vs. provisioned)
- [ ] **Set up RDS read replicas** if needed
- [ ] **Enable API Gateway caching** where appropriate

### Cost Optimization

- [ ] **Review and set billing alerts**
- [ ] **Tag all resources** for cost allocation
- [ ] **Use Reserved Instances** or Savings Plans for predictable workloads
- [ ] **Configure S3 Intelligent-Tiering** for storage optimization
- [ ] **Set up Lambda reserved concurrency** only if needed
- [ ] **Review NAT Gateway usage** (consider NAT instances for dev)
- [ ] **Disable unused resources** (dev/test environments)

## Deployment

### Pre-Deployment Steps

1. **Create a deployment window**
   ```bash
   # Example: Low-traffic hours
   # Friday 10 PM - Saturday 2 AM
   ```

2. **Notify stakeholders**
   - Email team members
   - Update status page
   - Post in Slack/communication channels

3. **Take backups**
   ```bash
   # Database backup
   aws rds create-db-snapshot \
     --db-instance-identifier prod-db \
     --db-snapshot-identifier prod-db-pre-deploy-$(date +%Y%m%d)
   
   # S3 bucket backup
   aws s3 sync s3://prod-bucket s3://prod-bucket-backup
   ```

4. **Run final tests**
   ```bash
   npm test
   npm run build
   cdk synth  # Synthesize CloudFormation template
   ```

5. **Review CloudFormation changes**
   ```bash
   cdk diff --profile production
   ```

### Deployment Steps

1. **Deploy to production**
   ```bash
   # Set AWS profile
   export AWS_PROFILE=production
   
   # Deploy with approval
   cdk deploy --require-approval broadening
   
   # Or deploy specific stack
   cdk deploy MyProductionStack
   ```

2. **Monitor deployment**
   - Watch CloudFormation console
   - Monitor CloudWatch metrics
   - Check application logs

3. **Verify deployment**
   ```bash
   # Test API endpoints
   curl https://api.example.com/health
   
   # Check Lambda functions
   aws lambda invoke \
     --function-name prod-my-function \
     --payload '{"test": true}' \
     response.json
   
   # Verify database connectivity
   aws rds describe-db-instances \
     --db-instance-identifier prod-db
   ```

### Post-Deployment Steps

1. **Smoke tests**
   - [ ] Test critical user flows
   - [ ] Verify authentication works
   - [ ] Check database connectivity
   - [ ] Test API endpoints
   - [ ] Verify S3 uploads/downloads
   - [ ] Test email sending (if applicable)

2. **Monitor for issues**
   - [ ] Watch CloudWatch metrics for 30 minutes
   - [ ] Check error rates
   - [ ] Monitor latency
   - [ ] Review application logs
   - [ ] Check database performance

3. **Update documentation**
   - [ ] Update architecture diagrams
   - [ ] Document new resources
   - [ ] Update runbooks
   - [ ] Record deployment notes

4. **Notify stakeholders**
   - [ ] Send deployment complete notification
   - [ ] Update status page
   - [ ] Close deployment window

## Rollback Plan

If issues occur, follow this rollback procedure:

### Quick Rollback

```bash
# Option 1: Rollback entire stack
cdk deploy --rollback

# Option 2: Delete problematic resources
aws cloudformation delete-stack --stack-name MyStack

# Option 3: Deploy previous version
git checkout <previous-commit>
cdk deploy
```

### Database Rollback

```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier prod-db \
  --db-snapshot-identifier prod-db-pre-deploy-20260224
```

### S3 Rollback

```bash
# Restore from backup
aws s3 sync s3://prod-bucket-backup s3://prod-bucket

# Or use versioning
aws s3api list-object-versions --bucket prod-bucket
aws s3api delete-object --bucket prod-bucket --key file.txt --version-id <version>
```

## Post-Incident Review

If rollback was required, conduct a review:

- [ ] **Document what went wrong**
- [ ] **Identify root cause**
- [ ] **Create action items** to prevent recurrence
- [ ] **Update deployment checklist**
- [ ] **Improve testing procedures**
- [ ] **Update monitoring and alerts**

## Environment-Specific Configurations

### Development

```typescript
const devConfig = {
  vpc: { maxAzs: 1, natGateways: 0 },
  rds: { multiAz: false, instanceType: 't3.micro' },
  lambda: { reservedConcurrency: undefined },
};
```

### Staging

```typescript
const stagingConfig = {
  vpc: { maxAzs: 2, natGateways: 1 },
  rds: { multiAz: true, instanceType: 't3.small' },
  lambda: { reservedConcurrency: undefined },
};
```

### Production

```typescript
const prodConfig = {
  vpc: { maxAzs: 3, natGateways: 2 },
  rds: { multiAz: true, instanceType: 'm5.large' },
  lambda: { reservedConcurrency: 100 },  // If needed
  backupRetention: Duration.days(30),
  enableMonitoring: true,
};
```

## Compliance Checks

### HIPAA

- [ ] Encryption enabled for all PHI
- [ ] Access logging configured
- [ ] Audit trails enabled
- [ ] BAA signed with AWS

### PCI DSS

- [ ] Network segmentation implemented
- [ ] Encryption for cardholder data
- [ ] Access controls configured
- [ ] Security monitoring enabled

### SOC 2

- [ ] Change management process documented
- [ ] Access controls reviewed
- [ ] Audit logging enabled
- [ ] Incident response plan documented

## Useful Commands

```bash
# List all stacks
cdk list

# Show CloudFormation template
cdk synth

# Compare deployed stack with local changes
cdk diff

# Deploy with specific profile
cdk deploy --profile production

# Destroy stack (use with caution!)
cdk destroy

# View stack outputs
aws cloudformation describe-stacks \
  --stack-name MyStack \
  --query 'Stacks[0].Outputs'

# Check stack events
aws cloudformation describe-stack-events \
  --stack-name MyStack \
  --max-items 20
```

## Emergency Contacts

Maintain an updated list of emergency contacts:

| Role | Contact | Phone | Email |
|------|---------|-------|-------|
| DevOps Lead | | | |
| Security Team | | | |
| Database Admin | | | |
| AWS Support | | | |
| On-Call Engineer | | | |

## Additional Resources

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [AWS Operational Excellence Pillar](https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/welcome.html)
- [CDK Best Practices](https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html)

---

**Last Updated**: February 24, 2026
**Version**: 1.0
**Owner**: DevOps Team
