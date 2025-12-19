# SLA/SLO Documentation

## Overview

This document defines the Service Level Agreements (SLAs) and Service Level Objectives (SLOs) for Screenshot_Algo.

## Definitions

- **SLA (Service Level Agreement)**: Contractual commitment to customers
- **SLO (Service Level Objective)**: Internal target for service quality
- **SLI (Service Level Indicator)**: Metric used to measure SLO
- **Error Budget**: Allowed downtime/errors within SLO

## Service Level Objectives

### 1. Availability

| Metric | SLO Target | SLI Definition |
|--------|------------|----------------|
| Uptime | 99.9% | `(total_time - downtime) / total_time` |
| API Availability | 99.95% | `successful_requests / total_requests` |

**Error Budget (Monthly)**:
- 99.9% = 43.8 minutes downtime allowed
- 99.95% = 21.9 minutes downtime allowed

### 2. Latency

| Metric | SLO Target | SLI Definition |
|--------|------------|----------------|
| API Response (p50) | < 100ms | 50th percentile of response time |
| API Response (p95) | < 500ms | 95th percentile of response time |
| API Response (p99) | < 2s | 99th percentile of response time |
| Screenshot Capture | < 10s | Time from request to completion |

### 3. Throughput

| Metric | SLO Target | SLI Definition |
|--------|------------|----------------|
| Screenshots/hour | > 1000 | Successful screenshots per hour |
| Concurrent Requests | > 100 | Simultaneous active requests |

### 4. Error Rate

| Metric | SLO Target | SLI Definition |
|--------|------------|----------------|
| 5xx Error Rate | < 0.1% | `5xx_responses / total_responses` |
| Screenshot Failures | < 1% | `failed_screenshots / total_screenshots` |

## Measurement

### Prometheus Queries

```promql
# Availability (last 30 days)
1 - (
  sum(increase(http_requests_total{status=~"5.."}[30d])) /
  sum(increase(http_requests_total[30d]))
)

# P95 Latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

# Error Rate
sum(rate(http_requests_total{status=~"5.."}[5m])) /
sum(rate(http_requests_total[5m]))

# Screenshot Success Rate
sum(rate(screenshots_total{status="success"}[1h])) /
sum(rate(screenshots_total[1h]))
```

### Grafana Dashboard

Dashboard ID: `screenshot-algo-slo`

Panels:
- Availability (30-day rolling)
- Error Budget remaining
- Latency percentiles
- Error rate trend

## Alerting Thresholds

### Critical (Page Immediately)
- Availability < 99.5%
- P95 Latency > 5s for 5 minutes
- Error Rate > 5% for 5 minutes

### Warning (Slack Alert)
- Availability < 99.8%
- P95 Latency > 2s for 10 minutes
- Error Rate > 1% for 10 minutes

### Info (Dashboard Only)
- Approaching 50% error budget burn
- Latency trending upward

## Error Budget Policy

### When Error Budget is Available
- Deploy new features freely
- Experiment with optimizations
- Focus on feature development

### When Error Budget < 25%
- Increase deployment review rigor
- Prioritize reliability improvements
- Consider feature freeze

### When Error Budget Exhausted
- Feature freeze
- All hands on reliability
- Post-mortem required for any incident

## SLA Commitments (External)

### Standard Tier
- 99.5% monthly uptime
- 4-hour response time for critical issues
- Business hours support

### Premium Tier
- 99.9% monthly uptime
- 1-hour response time for critical issues
- 24/7 support
- Dedicated account manager

### Enterprise Tier
- 99.95% monthly uptime
- 15-minute response time for critical issues
- 24/7 support with escalation
- Custom SLA terms available

## Incident Classification

| Severity | Description | Response Time | Example |
|----------|-------------|---------------|---------|
| P1 | Complete outage | 15 min | Service unreachable |
| P2 | Major degradation | 30 min | >50% requests failing |
| P3 | Minor degradation | 4 hours | Slow performance |
| P4 | Minor issue | Next business day | Cosmetic bugs |

## Reporting

### Weekly Report
- SLO compliance summary
- Error budget status
- Incident summary
- Action items

### Monthly Report
- Detailed SLO analysis
- Trend analysis
- Capacity planning
- Customer-facing report

### Quarterly Review
- SLO adjustment proposals
- Architecture improvements
- Team capacity assessment

## Exclusions

The following are excluded from SLA calculations:
- Scheduled maintenance (announced 48h in advance)
- Force majeure events
- Customer-caused issues
- Third-party service outages (with documentation)

## Review Process

SLOs are reviewed:
- Quarterly for accuracy
- After major incidents
- When customer requirements change
- When architecture changes significantly

## Contact

- **SRE Team**: sre@example.com
- **On-Call**: See [on-call-guide.md](../runbooks/on-call-guide.md)
- **Escalation**: See incident response procedures

---

**Last Updated**: December 2024
**Next Review**: March 2025
