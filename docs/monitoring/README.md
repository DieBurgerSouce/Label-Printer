# Monitoring Guide

## Overview

This document describes the monitoring strategy for Screenshot_Algo.

## Monitoring Stack

### Recommended Tools

| Tool | Purpose | Port |
|------|---------|------|
| **Prometheus** | Metrics collection | 9090 |
| **Grafana** | Visualization | 3000 |
| **Loki** | Log aggregation | 3100 |
| **Jaeger** | Distributed tracing | 16686 |
| **AlertManager** | Alert routing | 9093 |

## Metrics

### Application Metrics

```typescript
// Key metrics to track
const metrics = {
  // Request metrics
  http_requests_total: Counter,
  http_request_duration_seconds: Histogram,
  http_request_size_bytes: Histogram,
  http_response_size_bytes: Histogram,

  // Screenshot metrics
  screenshots_total: Counter,
  screenshot_duration_seconds: Histogram,
  screenshot_queue_depth: Gauge,
  screenshot_errors_total: Counter,

  // System metrics
  nodejs_heap_size_bytes: Gauge,
  nodejs_external_memory_bytes: Gauge,
  nodejs_active_handles: Gauge,
  nodejs_active_requests: Gauge,
};
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'screenshot-algo'
    static_configs:
      - targets: ['localhost:4000']
    metrics_path: '/metrics'
```

### Grafana Dashboards

1. **Overview Dashboard**
   - Request rate and latency
   - Error rate
   - Active screenshots
   - Queue depth

2. **Performance Dashboard**
   - Response time percentiles
   - CPU and memory usage
   - Browser pool health

3. **Business Dashboard**
   - Screenshots per minute
   - Success rate by format
   - Top requested URLs

## Logging

### Log Levels

| Level | When to Use |
|-------|-------------|
| `error` | Application errors requiring attention |
| `warn` | Warning conditions |
| `info` | General operational information |
| `debug` | Detailed debugging information |

### Log Format

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Screenshot captured",
  "service": "screenshot-algo",
  "traceId": "abc123",
  "metadata": {
    "url": "https://example.com",
    "duration": 1234,
    "format": "png"
  }
}
```

### Logging Best Practices

1. **Structured Logging**: Always use JSON format
2. **Context**: Include request IDs, user IDs
3. **Sensitive Data**: Never log passwords, API keys
4. **Performance**: Use appropriate log levels

## Alerting

### Critical Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| High Error Rate | > 5% errors in 5min | Critical |
| Service Down | Health check fails | Critical |
| High Latency | p95 > 10s | Critical |

### Warning Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Elevated Error Rate | > 1% errors | Warning |
| Queue Backlog | > 100 pending | Warning |
| Memory Usage | > 80% | Warning |

### Alert Configuration

```yaml
# alertmanager.yml
receivers:
  - name: 'critical'
    slack_configs:
      - channel: '#alerts-critical'
    pagerduty_configs:
      - service_key: '<key>'

  - name: 'warning'
    slack_configs:
      - channel: '#alerts-warning'

route:
  receiver: 'warning'
  routes:
    - match:
        severity: critical
      receiver: 'critical'
```

## Health Checks

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic health status |
| `GET /ready` | Readiness probe |
| `GET /live` | Liveness probe |
| `GET /metrics` | Prometheus metrics |

### Health Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "browser": "ok"
  }
}
```

## Distributed Tracing

### OpenTelemetry Setup

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: 'http://jaeger:14268/api/traces',
  }),
  serviceName: 'screenshot-algo',
});

sdk.start();
```

### Trace Context

- Include trace IDs in logs
- Propagate context across services
- Use baggage for business context

## Setup Scripts

```bash
# Start monitoring stack
./scripts/monitor-setup.sh docker

# View status
./scripts/monitor-setup.sh status

# Stop monitoring
./scripts/monitor-setup.sh stop
```

## Runbooks

### High Error Rate

1. Check logs for error patterns
2. Check external dependencies
3. Review recent deployments
4. Scale up if needed

### High Latency

1. Check queue depth
2. Check browser pool health
3. Check external service latency
4. Review resource usage

### Memory Issues

1. Check for memory leaks
2. Review recent code changes
3. Restart with increased memory
4. Profile memory usage

## Resources

- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
