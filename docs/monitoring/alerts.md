# Alert Rules Documentation

## Alert Categories

### 1. Availability Alerts

#### Service Down
```yaml
alert: ServiceDown
expr: up{job="screenshot-algo"} == 0
for: 1m
labels:
  severity: critical
annotations:
  summary: "Screenshot_Algo service is down"
  description: "The service has been unreachable for more than 1 minute"
  runbook: "docs/runbooks/service-down.md"
```

#### Health Check Failing
```yaml
alert: HealthCheckFailing
expr: screenshot_health_check_status == 0
for: 2m
labels:
  severity: critical
annotations:
  summary: "Health check is failing"
  description: "The /health endpoint is returning errors"
```

### 2. Performance Alerts

#### High Latency
```yaml
alert: HighLatency
expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 5
for: 5m
labels:
  severity: warning
annotations:
  summary: "High request latency detected"
  description: "95th percentile latency is above 5 seconds"
```

#### Screenshot Timeout
```yaml
alert: ScreenshotTimeout
expr: rate(screenshot_errors_total{error="timeout"}[5m]) > 0.1
for: 5m
labels:
  severity: warning
annotations:
  summary: "Screenshot timeouts increasing"
  description: "Screenshot capture timeouts are elevated"
```

### 3. Error Rate Alerts

#### High Error Rate
```yaml
alert: HighErrorRate
expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
for: 5m
labels:
  severity: critical
annotations:
  summary: "High error rate detected"
  description: "Error rate is above 5%"
```

#### Elevated 4xx Errors
```yaml
alert: Elevated4xxErrors
expr: rate(http_requests_total{status=~"4.."}[5m]) / rate(http_requests_total[5m]) > 0.1
for: 10m
labels:
  severity: warning
annotations:
  summary: "Elevated client error rate"
  description: "4xx error rate is above 10%"
```

### 4. Resource Alerts

#### High Memory Usage
```yaml
alert: HighMemoryUsage
expr: process_resident_memory_bytes / 1024 / 1024 > 512
for: 5m
labels:
  severity: warning
annotations:
  summary: "High memory usage"
  description: "Memory usage is above 512MB"
```

#### High CPU Usage
```yaml
alert: HighCPUUsage
expr: rate(process_cpu_seconds_total[5m]) > 0.8
for: 10m
labels:
  severity: warning
annotations:
  summary: "High CPU usage"
  description: "CPU usage is above 80%"
```

### 5. Queue Alerts

#### Queue Backlog
```yaml
alert: QueueBacklog
expr: screenshot_queue_depth > 100
for: 5m
labels:
  severity: warning
annotations:
  summary: "Screenshot queue backlog"
  description: "Queue has more than 100 pending jobs"
```

#### Queue Stalled
```yaml
alert: QueueStalled
expr: increase(screenshot_queue_processed_total[5m]) == 0 and screenshot_queue_depth > 0
for: 5m
labels:
  severity: critical
annotations:
  summary: "Queue processing has stalled"
  description: "No jobs processed in 5 minutes with pending queue"
```

### 6. Browser Pool Alerts

#### Browser Pool Exhausted
```yaml
alert: BrowserPoolExhausted
expr: browser_pool_available == 0
for: 2m
labels:
  severity: warning
annotations:
  summary: "Browser pool exhausted"
  description: "No available browser instances"
```

#### Browser Crashes
```yaml
alert: BrowserCrashes
expr: rate(browser_crashes_total[5m]) > 0.5
for: 5m
labels:
  severity: warning
annotations:
  summary: "Elevated browser crashes"
  description: "Browser instances are crashing frequently"
```

## Alert Routing

### Severity Levels

| Level | Response Time | Notification |
|-------|--------------|--------------|
| Critical | Immediate | PagerDuty, Slack, Email |
| Warning | 30 minutes | Slack, Email |
| Info | Best effort | Slack only |

### Escalation Policy

1. **0-5 min**: Primary on-call
2. **5-15 min**: Secondary on-call
3. **15-30 min**: Team lead
4. **30+ min**: Engineering manager

## Silencing Rules

### Maintenance Windows

```yaml
# Silence during deployments
matchers:
  - name: alertname
    value: ".*"
startsAt: "2024-01-01T00:00:00Z"
endsAt: "2024-01-01T01:00:00Z"
comment: "Scheduled deployment"
```

### Known Issues

```yaml
# Silence known flaky alert
matchers:
  - name: alertname
    value: "BrowserCrashes"
startsAt: "2024-01-01T00:00:00Z"
endsAt: "2024-01-07T00:00:00Z"
comment: "Known issue, fix in progress"
```

## Runbook Links

- [Service Down](../runbooks/service-down.md)
- [High Latency](../runbooks/high-latency.md)
- [Queue Issues](../runbooks/queue-issues.md)
- [Memory Issues](../runbooks/memory-issues.md)
