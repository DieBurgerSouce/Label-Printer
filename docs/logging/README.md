# Logging Guide

## Overview

Screenshot_Algo uses structured JSON logging for all application logs.

## Log Levels

| Level | Value | When to Use |
|-------|-------|-------------|
| `error` | 0 | Application errors, exceptions |
| `warn` | 1 | Warning conditions, deprecated usage |
| `info` | 2 | General operational information |
| `http` | 3 | HTTP request/response logs |
| `debug` | 4 | Detailed debugging information |
| `silly` | 5 | Very verbose debugging |

## Configuration

### Environment Variables

```bash
# Log level (default: info)
LOG_LEVEL=debug

# Log format (json or simple)
LOG_FORMAT=json

# Log file path (optional)
LOG_FILE=/var/log/screenshot-algo/app.log
```

### Winston Configuration

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'screenshot-algo',
    version: process.env.npm_package_version,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});
```

## Log Format

### Standard Fields

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Screenshot captured successfully",
  "service": "screenshot-algo",
  "version": "1.0.0",
  "traceId": "abc123def456",
  "requestId": "req_789xyz"
}
```

### Request Logging

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "http",
  "message": "HTTP Request",
  "method": "POST",
  "path": "/api/screenshot",
  "statusCode": 200,
  "duration": 1234,
  "userAgent": "Mozilla/5.0...",
  "ip": "192.168.1.1",
  "requestId": "req_789xyz"
}
```

### Error Logging

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "error",
  "message": "Screenshot capture failed",
  "error": {
    "name": "TimeoutError",
    "message": "Navigation timeout exceeded",
    "stack": "TimeoutError: Navigation timeout...",
    "code": "TIMEOUT"
  },
  "context": {
    "url": "https://example.com",
    "attempt": 2,
    "maxAttempts": 3
  }
}
```

## Best Practices

### Do's

1. **Use structured logging**
   ```typescript
   // Good
   logger.info('Screenshot captured', {
     url: request.url,
     duration: duration,
     format: request.format,
   });
   ```

2. **Include context**
   ```typescript
   logger.error('Operation failed', {
     operation: 'screenshot',
     requestId: req.id,
     error: error.message,
   });
   ```

3. **Use appropriate levels**
   ```typescript
   logger.debug('Processing request', { details });
   logger.info('Request completed');
   logger.warn('Rate limit approaching');
   logger.error('Request failed', { error });
   ```

### Don'ts

1. **Don't log sensitive data**
   ```typescript
   // Bad
   logger.info('User login', { password: user.password });

   // Good
   logger.info('User login', { userId: user.id });
   ```

2. **Don't use console.log in production**
   ```typescript
   // Bad
   console.log('Something happened');

   // Good
   logger.info('Something happened');
   ```

3. **Don't log excessively in loops**
   ```typescript
   // Bad
   items.forEach(item => logger.debug('Processing', { item }));

   // Good
   logger.debug('Processing items', { count: items.length });
   ```

## Log Aggregation

### Loki Configuration

```yaml
# promtail-config.yml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: screenshot-algo
    static_configs:
      - targets:
          - localhost
        labels:
          job: screenshot-algo
          __path__: /var/log/screenshot-algo/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            service: service
      - labels:
          level:
          service:
```

### Querying Logs

```logql
# All errors
{service="screenshot-algo"} |= "error"

# Screenshot failures
{service="screenshot-algo"} | json | level="error" | message=~".*screenshot.*"

# Slow requests
{service="screenshot-algo"} | json | duration > 5000
```

## Retention Policy

| Environment | Retention |
|-------------|-----------|
| Development | 7 days |
| Staging | 14 days |
| Production | 30 days |
| Compliance | 1 year |

## Troubleshooting

### Missing Logs

1. Check log level configuration
2. Verify file permissions
3. Check disk space
4. Verify Loki/aggregator connection

### Performance Issues

1. Reduce log level in production
2. Use async transports
3. Implement log sampling
4. Review logging in hot paths
