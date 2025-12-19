# Performance Guidelines

## Overview

Screenshot_Algo is designed for high performance. This document outlines performance targets, monitoring strategies, and optimization guidelines.

## Performance Targets

### Core Web Vitals

| Metric | Target | Good | Needs Improvement | Poor |
|--------|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | < 2.5s | 2.5s - 4s | > 4s |
| **FID** (First Input Delay) | < 100ms | < 100ms | 100ms - 300ms | > 300ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 | < 0.1 | 0.1 - 0.25 | > 0.25 |

### API Response Times

| Endpoint | Target (p95) | Max |
|----------|--------------|-----|
| `GET /health` | 50ms | 100ms |
| `GET /api/status` | 100ms | 200ms |
| `POST /api/screenshot` | 3s | 10s |
| `GET /api/screenshot/:id` | 100ms | 200ms |

### Throughput Targets

| Metric | Target |
|--------|--------|
| Requests per second | 100+ |
| Concurrent users | 1000+ |
| Screenshots per minute | 200+ |

## Performance Budget

### JavaScript

```json
{
  "main": "250KB (gzip: 80KB)",
  "vendor": "500KB (gzip: 150KB)",
  "total": "750KB (gzip: 230KB)"
}
```

### CSS

```json
{
  "styles": "100KB (gzip: 30KB)"
}
```

### Images

- Hero images: < 200KB each
- Thumbnails: < 50KB each
- Icons: SVG or < 5KB

## Optimization Strategies

### 1. Code Splitting

```typescript
// Lazy load non-critical modules
const heavyModule = await import('./heavyModule');
```

### 2. Image Optimization

- Use WebP with PNG fallback
- Implement responsive images
- Lazy load below-the-fold images

```html
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.png" loading="lazy" alt="...">
</picture>
```

### 3. Caching Strategy

```typescript
// Redis caching for API responses
const CACHE_TTL = 60 * 5; // 5 minutes

async function getCachedScreenshot(id: string) {
  const cached = await redis.get(`screenshot:${id}`);
  if (cached) return JSON.parse(cached);

  const screenshot = await fetchScreenshot(id);
  await redis.setex(`screenshot:${id}`, CACHE_TTL, JSON.stringify(screenshot));

  return screenshot;
}
```

### 4. Database Optimization

- Use indexes for frequently queried fields
- Implement connection pooling
- Use query optimization

```sql
-- Add index for common queries
CREATE INDEX idx_screenshots_user_id ON screenshots(user_id);
CREATE INDEX idx_screenshots_created_at ON screenshots(created_at DESC);
```

### 5. Browser Pool Management

```typescript
// Reuse browser instances
const browserPool = new BrowserPool({
  maxInstances: 10,
  idleTimeout: 30000,
  launchOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});
```

## Monitoring

### Metrics to Track

1. **Application Metrics**
   - Response times (p50, p95, p99)
   - Error rates
   - Request throughput
   - Queue depth

2. **System Metrics**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network I/O

3. **Business Metrics**
   - Screenshots captured
   - Success rate
   - Average capture time

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API Response Time (p95) | > 2s | > 5s |
| Error Rate | > 1% | > 5% |
| CPU Usage | > 70% | > 90% |
| Memory Usage | > 80% | > 95% |
| Queue Depth | > 100 | > 500 |

## Load Testing

### Tools

- **k6**: Load testing
- **Artillery**: Scenario testing
- **Lighthouse CI**: Performance auditing

### Running Load Tests

```bash
# Basic load test
npm run test:load

# Stress test
npm run test:stress

# Spike test
npm run test:spike
```

### Sample k6 Script

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '10s', target: 0 },
  ],
};

export default function () {
  const res = http.post('http://localhost:4000/api/screenshot', {
    url: 'https://example.com',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  sleep(1);
}
```

## Profiling

### CPU Profiling

```bash
# Generate CPU profile
node --prof app.js

# Process the profile
node --prof-process isolate-*.log > profile.txt
```

### Memory Profiling

```typescript
// Check memory usage
const used = process.memoryUsage();
console.log({
  heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
  heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
});
```

### Heap Snapshots

```bash
# Generate heap snapshot
kill -USR2 <pid>
```

## Best Practices

1. **Measure First**: Profile before optimizing
2. **Set Budgets**: Define and enforce performance budgets
3. **Monitor Continuously**: Use APM tools in production
4. **Test Regularly**: Run load tests before releases
5. **Optimize Critical Path**: Focus on user-facing performance
6. **Cache Aggressively**: Use caching at every layer
7. **Scale Horizontally**: Design for horizontal scaling

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse Documentation](https://developer.chrome.com/docs/lighthouse/)
- [k6 Documentation](https://k6.io/docs/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/performance/)
