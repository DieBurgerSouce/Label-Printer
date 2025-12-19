# Cloud Cost Tracking

## Overview

This document provides guidelines and tools for tracking and optimizing cloud costs for Screenshot_Algo.

## Cost Centers

### Primary Cost Drivers

| Resource | Provider | Est. Monthly Cost | % of Total |
|----------|----------|-------------------|------------|
| Compute (K8s) | AWS EKS | $800 - $1,200 | 35% |
| Database (RDS) | AWS RDS | $400 - $600 | 20% |
| Storage (S3) | AWS S3 | $200 - $400 | 15% |
| CDN | CloudFront | $150 - $300 | 10% |
| Networking | VPC, LB | $100 - $200 | 8% |
| Monitoring | CloudWatch | $50 - $100 | 5% |
| Other | Various | $100 - $200 | 7% |
| **Total** | | **$1,800 - $3,000** | 100% |

### Per-Environment Breakdown

| Environment | Monthly Cost | Purpose |
|-------------|--------------|---------|
| Production | $1,500 - $2,500 | Live traffic |
| Staging | $200 - $400 | Pre-prod testing |
| Development | $100 - $200 | Dev/test |

## Cost Allocation Tags

### Required Tags

All AWS resources must have these tags:

```yaml
tags:
  Project: screenshot-algo
  Environment: production|staging|development
  Team: engineering
  CostCenter: eng-infra
  Owner: platform-team
  ManagedBy: terraform|manual
```

### Terraform Example

```hcl
locals {
  common_tags = {
    Project     = "screenshot-algo"
    Environment = var.environment
    Team        = "engineering"
    CostCenter  = "eng-infra"
    ManagedBy   = "terraform"
  }
}

resource "aws_instance" "example" {
  # ... configuration ...

  tags = merge(local.common_tags, {
    Name  = "screenshot-algo-worker"
    Owner = "platform-team"
  })
}
```

## Cost Monitoring

### AWS Cost Explorer Queries

#### Monthly Spend by Service
```
Filter: Tag: Project = screenshot-algo
Group by: Service
Time: Last 3 months
```

#### Daily Spend Trend
```
Filter: Tag: Project = screenshot-algo
Group by: Day
Granularity: Daily
```

#### Environment Comparison
```
Filter: Tag: Project = screenshot-algo
Group by: Tag: Environment
Time: Current month
```

### Budget Alerts

| Alert Level | Threshold | Action |
|-------------|-----------|--------|
| Warning | 80% of budget | Slack notification |
| Critical | 100% of budget | Email + PagerDuty |
| Emergency | 120% of budget | Auto-scaling limits |

### CloudWatch Alarm

```yaml
# cloudwatch-budget-alarm.yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  BudgetAlarm:
    Type: AWS::Budgets::Budget
    Properties:
      Budget:
        BudgetName: screenshot-algo-monthly
        BudgetLimit:
          Amount: 3000
          Unit: USD
        TimeUnit: MONTHLY
        BudgetType: COST
        CostFilters:
          TagKeyValue:
            - "user:Project$screenshot-algo"
      NotificationsWithSubscribers:
        - Notification:
            NotificationType: ACTUAL
            ComparisonOperator: GREATER_THAN
            Threshold: 80
          Subscribers:
            - SubscriptionType: EMAIL
              Address: platform-team@example.com
            - SubscriptionType: SNS
              Address: !Ref BudgetAlertTopic
```

## Cost Optimization Strategies

### 1. Compute Optimization

#### Right-sizing
```bash
# Check pod resource usage
kubectl top pods -n screenshot-algo

# Identify over-provisioned pods
kubectl get pods -n screenshot-algo -o json | \
  jq '.items[] | {name: .metadata.name, requests: .spec.containers[].resources.requests}'
```

#### Spot Instances
- Use spot instances for non-critical workloads
- Expected savings: 60-70%

```yaml
# k8s spot node pool
nodeSelector:
  node.kubernetes.io/capacity-type: spot
tolerations:
  - key: "spot"
    operator: "Equal"
    value: "true"
```

#### Reserved Instances
| Instance Type | 1-Year RI Savings | 3-Year RI Savings |
|---------------|-------------------|-------------------|
| t3.medium | 30% | 50% |
| m5.large | 35% | 55% |
| r5.xlarge | 40% | 60% |

### 2. Storage Optimization

#### S3 Lifecycle Policies
```json
{
  "Rules": [
    {
      "ID": "Archive old screenshots",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "screenshots/"
      },
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

#### Storage Class Selection
| Use Case | Storage Class | Cost/GB/Month |
|----------|---------------|---------------|
| Frequently accessed | S3 Standard | $0.023 |
| Infrequent access | S3 IA | $0.0125 |
| Archive | S3 Glacier | $0.004 |
| Deep archive | Glacier Deep | $0.00099 |

### 3. Database Optimization

#### RDS Right-sizing
- Review CloudWatch CPU/Memory metrics
- Consider Aurora Serverless for variable workloads

#### Read Replicas
- Use read replicas for reporting queries
- Offload read traffic from primary

### 4. Network Optimization

#### Data Transfer
- Use VPC endpoints for AWS services
- Cache static content at edge
- Compress data in transit

### 5. Scheduled Scaling

```yaml
# Scale down non-production at night
# kube-schedule-scaler config
schedules:
  - name: night-scale-down
    namespace: screenshot-algo-staging
    deployments:
      - screenshot-algo
    minReplicas: 1
    start: "0 22 * * 1-5"  # 10 PM weekdays
    end: "0 7 * * 1-5"     # 7 AM weekdays
```

## Cost Reports

### Weekly Cost Report

Generated every Monday:
- Week-over-week comparison
- Top 5 cost drivers
- Anomaly detection alerts
- Optimization recommendations

### Monthly Cost Review

First week of each month:
- Monthly trend analysis
- Budget vs actual
- Forecast for next month
- Action items

## Tools

### Cost Analysis
- AWS Cost Explorer
- CloudHealth
- Kubecost (for K8s)

### Optimization
- AWS Compute Optimizer
- Spot.io
- Terraform cost estimation

### Visualization
- Grafana dashboards
- Custom Metabase reports

## Responsibility

| Role | Responsibility |
|------|----------------|
| Platform Team | Infrastructure cost optimization |
| Dev Teams | Application efficiency |
| Finance | Budget approval, tracking |
| Engineering Manager | Cost reviews, decisions |

## Review Schedule

- **Weekly**: Automated cost report review
- **Monthly**: Cost optimization meeting
- **Quarterly**: Budget review and adjustment
- **Annually**: Architecture cost review

---

**Questions?** Contact #platform-team or finance@example.com
