# Capacity Planning

## Overview

This document outlines capacity planning for Screenshot_Algo to ensure the system can handle current and projected loads.

## Current Capacity

### Compute Resources

| Resource | Current | Utilization | Max Capacity |
|----------|---------|-------------|--------------|
| API Pods | 3 | 40% CPU | 10 (HPA limit) |
| Worker Pods | 5 | 60% CPU | 20 (HPA limit) |
| Browser Pool | 10 instances | 70% | 50 instances |

### Database

| Metric | Current | Limit |
|--------|---------|-------|
| Instance Type | db.r5.large | db.r5.2xlarge |
| Storage | 100 GB | 1 TB (auto-expand) |
| Connections | 150 | 500 |
| IOPS | 3,000 | 10,000 |

### Storage

| Type | Current Usage | Limit |
|------|---------------|-------|
| Screenshots (S3) | 500 GB | Unlimited |
| Labels (S3) | 50 GB | Unlimited |
| Temp Storage | 20 GB | 100 GB |

### Network

| Metric | Current | Limit |
|--------|---------|-------|
| Bandwidth In | 100 Mbps | 1 Gbps |
| Bandwidth Out | 500 Mbps | 5 Gbps |
| Requests/sec | 500 | 5,000 |

## Traffic Analysis

### Current Traffic Patterns

```
Daily Traffic Distribution:
00:00-06:00: 10% (low)
06:00-09:00: 20% (ramp up)
09:00-12:00: 25% (peak)
12:00-14:00: 15% (lunch)
14:00-18:00: 25% (peak)
18:00-24:00: 5% (low)

Weekly Pattern:
Mon-Fri: 95% of traffic
Sat-Sun: 5% of traffic
```

### Historical Growth

| Month | Screenshots/Day | Growth |
|-------|-----------------|--------|
| Oct 2024 | 10,000 | - |
| Nov 2024 | 12,500 | +25% |
| Dec 2024 | 15,000 | +20% |
| Jan 2025 | 18,000 (proj) | +20% |

## Capacity Models

### Screenshots Processing

```
Variables:
- Average screenshot time: 3 seconds
- Browser instances: B
- Concurrent per browser: 1
- Screenshots per hour: S

Formula:
S = B × (3600 / 3) = B × 1200

Current (B=10): 12,000 screenshots/hour
Target (B=20): 24,000 screenshots/hour
```

### API Throughput

```
Variables:
- Pod count: P
- Requests per pod per second: R
- Total RPS: T

Formula:
T = P × R

Current (P=3, R=100): 300 RPS
Peak (P=5, R=100): 500 RPS
Max (P=10, R=100): 1,000 RPS
```

### Database Capacity

```
Variables:
- Connections per pod: C = 10
- Pod count: P
- Total connections: T

Formula:
T = P × C + overhead (50)

Current (P=8): 130 connections
Peak (P=15): 200 connections
Limit: 500 connections
```

## Scaling Thresholds

### Horizontal Pod Autoscaler

```yaml
# Current HPA configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: screenshot-algo
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: screenshot-algo
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Scaling Triggers

| Metric | Scale Up | Scale Down |
|--------|----------|------------|
| CPU | > 70% for 2 min | < 30% for 5 min |
| Memory | > 80% for 2 min | < 40% for 5 min |
| Queue Depth | > 100 jobs | < 10 jobs |
| Response Time | p95 > 2s | p95 < 500ms |

## Growth Projections

### 6-Month Forecast

| Month | Users | Screenshots/Day | Required Capacity |
|-------|-------|-----------------|-------------------|
| Jan 2025 | 500 | 18,000 | Current |
| Feb 2025 | 600 | 22,000 | +20% compute |
| Mar 2025 | 750 | 27,000 | +50% compute |
| Apr 2025 | 900 | 32,000 | +80% compute |
| May 2025 | 1,100 | 40,000 | +120% compute |
| Jun 2025 | 1,300 | 50,000 | Database upgrade |

### Resource Requirements

#### Compute (Q2 2025)
- API Pods: 5-15 (up from 3-10)
- Worker Pods: 10-30 (up from 5-20)
- Browser Pool: 30 instances (up from 10)

#### Database (Q2 2025)
- Upgrade to db.r5.xlarge
- Enable read replicas
- Increase connection pool

#### Storage (Q2 2025)
- S3: ~2 TB projected
- Implement lifecycle policies
- Enable intelligent tiering

## Capacity Alerts

### Warning Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU Utilization | 70% | 85% |
| Memory Utilization | 75% | 90% |
| Database Connections | 60% | 80% |
| Storage | 70% | 85% |
| Queue Depth | 200 | 500 |

### Prometheus Alerts

```yaml
groups:
  - name: capacity
    rules:
      - alert: HighCPUUtilization
        expr: |
          avg(rate(container_cpu_usage_seconds_total{namespace="screenshot-algo"}[5m]))
          / avg(kube_pod_container_resource_limits{resource="cpu",namespace="screenshot-algo"}) > 0.7
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU utilization - consider scaling"

      - alert: ApproachingConnectionLimit
        expr: |
          pg_stat_activity_count{datname="screenshot_algo"}
          / pg_settings_max_connections > 0.6
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connections approaching limit"
```

## Capacity Planning Process

### Monthly Review

1. **Collect Metrics**
   - Traffic trends
   - Resource utilization
   - Error rates
   - Response times

2. **Analyze Growth**
   - User growth rate
   - Usage pattern changes
   - Feature impact

3. **Project Requirements**
   - 3-month forecast
   - 6-month forecast
   - Seasonal adjustments

4. **Plan Actions**
   - Infrastructure changes
   - Code optimizations
   - Budget requirements

### Quarterly Planning

1. Review growth projections
2. Update capacity models
3. Plan major upgrades
4. Budget allocation

## Load Testing

### Regular Tests

| Test Type | Frequency | Target |
|-----------|-----------|--------|
| Smoke Test | Daily | Baseline verification |
| Load Test | Weekly | 2x current load |
| Stress Test | Monthly | Find breaking point |
| Soak Test | Quarterly | 24-hour sustained load |

### Load Test Commands

```bash
# Run load test
npm run test:load -- --users 100 --duration 600

# Run stress test
npm run test:stress -- --max-users 500 --ramp-up 300

# Generate capacity report
npm run report:capacity
```

## Bottleneck Analysis

### Identified Bottlenecks

1. **Browser Pool** (Primary)
   - Current limit: 10 browsers
   - Impact: Screenshot throughput
   - Solution: Increase pool, optimize browser reuse

2. **Database Connections** (Secondary)
   - Current: 150 connections
   - Impact: API response time
   - Solution: Connection pooling, read replicas

3. **Network Egress** (Future)
   - Current: 500 Mbps
   - Impact: Screenshot delivery
   - Solution: CDN, compression

## Contacts

- **Capacity Planning**: platform-team@example.com
- **Infrastructure**: infra@example.com
- **On-Call**: See [on-call-guide.md](docs/runbooks/on-call-guide.md)

---

**Last Updated**: December 2024
**Next Review**: January 2025
