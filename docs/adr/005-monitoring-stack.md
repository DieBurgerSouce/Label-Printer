# ADR 005: Monitoring Stack

## Status
Accepted

## Date
2024-12-17

## Context

Screenshot_Algo requires comprehensive monitoring to:
- Track application performance and health
- Detect and alert on issues before they impact users
- Enable debugging and root cause analysis
- Support capacity planning
- Meet SLA requirements

Key requirements:
- Metrics collection and visualization
- Log aggregation and search
- Distributed tracing
- Alerting and on-call integration
- Error tracking

## Decision

We will implement a **TEMPO** monitoring stack (Traces, Errors, Metrics, Prometheus, Observability):

### 1. Metrics: Prometheus + Grafana
- **Prometheus** for metrics collection and storage
- **Grafana** for visualization and dashboards
- Custom metrics via `prom-client` in Node.js

### 2. Logging: ELK/Loki
- **Loki** for log aggregation (or ELK stack)
- **Promtail** for log shipping
- Structured JSON logging in application

### 3. Tracing: OpenTelemetry + Jaeger
- **OpenTelemetry** SDK for instrumentation
- **Jaeger** for trace storage and visualization
- **OTEL Collector** for data processing

### 4. Error Tracking: Sentry
- **Sentry** for error aggregation
- Source map support
- Release tracking

### 5. Alerting: Alertmanager + PagerDuty
- **Alertmanager** for alert routing
- **PagerDuty** for on-call management
- **Slack** for team notifications

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MONITORING ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │         APPLICATION                  │
                    │  ┌─────────────────────────────────┐│
                    │  │      OpenTelemetry SDK          ││
                    │  │  (metrics, traces, logs)        ││
                    │  └─────────────────────────────────┘│
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │        OTEL Collector               │
                    │  (receive, process, export)         │
                    └─────────────────┬───────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐            ┌───────────────┐            ┌───────────────┐
│  Prometheus   │            │    Jaeger     │            │     Loki      │
│   (metrics)   │            │   (traces)    │            │    (logs)     │
└───────────────┘            └───────────────┘            └───────────────┘
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                                      ▼
                          ┌───────────────────┐
                          │      Grafana      │
                          │  (visualization)  │
                          └───────────────────┘
                                      │
                                      ▼
                          ┌───────────────────┐
                          │   Alertmanager    │
                          └───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
       ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
       │  PagerDuty  │        │    Slack    │        │    Email    │
       └─────────────┘        └─────────────┘        └─────────────┘
```

## Implementation Details

### Metrics Collection

```typescript
// src/metrics.ts
import { collectDefaultMetrics, Counter, Histogram } from 'prom-client';

// Collect default Node.js metrics
collectDefaultMetrics();

// Custom business metrics
export const screenshotsTotal = new Counter({
  name: 'screenshots_total',
  help: 'Total screenshots captured',
  labelNames: ['status']
});

export const screenshotDuration = new Histogram({
  name: 'screenshot_duration_seconds',
  help: 'Screenshot capture duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

// Usage
screenshotsTotal.inc({ status: 'success' });
screenshotDuration.observe(captureTime);
```

### Structured Logging

```typescript
// src/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'screenshot-algo',
    version: process.env.npm_package_version
  },
  transports: [
    new winston.transports.Console()
  ]
});

// Usage
logger.info('Screenshot captured', {
  articleId: article.id,
  duration: captureTime,
  traceId: span.spanContext().traceId
});
```

### Distributed Tracing

```typescript
// src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  }),
  instrumentations: [
    // Auto-instrument HTTP, Express, PostgreSQL, etc.
  ]
});

sdk.start();
```

### Alert Rules

```yaml
# prometheus/rules/application.yml
groups:
  - name: screenshot-algo
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: SlowScreenshots
        expr: histogram_quantile(0.95, screenshot_duration_seconds) > 10
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Screenshot capture is slow"
```

## Dashboards

### Main Dashboard
- Request rate and latency
- Error rate by endpoint
- Active users
- Queue depth

### Screenshot Dashboard
- Screenshots per minute
- Success/failure ratio
- Average capture time
- Browser pool utilization

### Infrastructure Dashboard
- CPU and memory usage
- Pod count and health
- Database connections
- Storage usage

## Consequences

### Positive
- **Full Observability**: Metrics, logs, traces unified
- **Proactive Alerting**: Issues detected before user impact
- **Debugging**: Easy root cause analysis with traces
- **SLA Tracking**: Clear metrics for SLOs

### Negative
- **Resource Overhead**: Monitoring consumes resources
- **Complexity**: Multiple systems to maintain
- **Cost**: Storage for metrics, logs, traces

### Mitigations
- Use managed services where possible (Grafana Cloud, Sentry)
- Implement log/metric sampling for high-volume data
- Set retention policies to manage storage costs
- Start with essential metrics, add more as needed

## Alternatives Considered

### Datadog
- **Pros**: All-in-one, easy setup
- **Cons**: Expensive at scale, vendor lock-in

### New Relic
- **Pros**: Good APM, easy setup
- **Cons**: Pricing model complexity

### CloudWatch (AWS)
- **Pros**: AWS-native, low operational overhead
- **Cons**: Limited querying, vendor lock-in

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- `prometheus/` directory in this repository
- `otel-collector.yaml` in this repository
