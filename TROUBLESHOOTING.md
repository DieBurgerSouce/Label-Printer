# Troubleshooting Guide

This guide helps diagnose and resolve common issues with Screenshot_Algo.

## Quick Diagnostics

```bash
# Health check
curl -s http://localhost:3000/health | jq

# Check pod status
kubectl get pods -n screenshot-algo

# View recent logs
kubectl logs -l app=screenshot-algo --tail=100 -n screenshot-algo

# Check database connectivity
psql -h localhost -U postgres -d screenshot_algo -c "SELECT 1"

# Check Redis connectivity
redis-cli ping
```

## Common Issues

### 1. Application Won't Start

#### Symptoms
- Container keeps restarting
- "Connection refused" errors
- Health check failing

#### Diagnosis
```bash
# Check pod events
kubectl describe pod <pod-name> -n screenshot-algo

# Check logs
kubectl logs <pod-name> -n screenshot-algo --previous

# Check environment variables
kubectl exec <pod-name> -n screenshot-algo -- env | grep -E "(DATABASE|REDIS|PORT)"
```

#### Solutions

**Missing environment variables:**
```bash
# Verify ConfigMap and Secrets
kubectl get configmap -n screenshot-algo
kubectl get secrets -n screenshot-algo

# Check if mounted correctly
kubectl exec <pod-name> -n screenshot-algo -- cat /app/.env
```

**Database connection failed:**
```bash
# Test database connectivity from pod
kubectl exec <pod-name> -n screenshot-algo -- \
  nc -zv postgres-service 5432

# Check connection string format
# postgresql://user:password@host:5432/database
```

**Port conflict:**
```bash
# Check if port is in use
kubectl exec <pod-name> -n screenshot-algo -- netstat -tlnp | grep 3000
```

---

### 2. Screenshots Failing

#### Symptoms
- Screenshots returning errors
- Timeout errors
- Blank/corrupted images

#### Diagnosis
```bash
# Check screenshot queue
curl -s http://localhost:3000/api/queue/status | jq

# Check browser pool
curl -s http://localhost:3000/api/browser/status | jq

# View screenshot-specific logs
kubectl logs -l app=screenshot-algo -n screenshot-algo | grep -i screenshot
```

#### Solutions

**Timeout errors:**
```javascript
// Increase timeout in configuration
SCREENSHOT_TIMEOUT=60000  // 60 seconds
NAVIGATION_TIMEOUT=30000  // 30 seconds
```

**Browser crashes:**
```bash
# Check memory limits
kubectl top pods -n screenshot-algo

# Increase memory if needed
kubectl set resources deployment/screenshot-algo \
  --limits=memory=1Gi -n screenshot-algo
```

**Chromium missing dependencies:**
```dockerfile
# Ensure Dockerfile includes:
RUN apt-get update && apt-get install -y \
  chromium \
  libx11-xcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxi6 \
  libxtst6 \
  libnss3 \
  libcups2 \
  libxss1 \
  libxrandr2 \
  libasound2 \
  libpangocairo-1.0-0 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libgtk-3-0
```

---

### 3. Database Issues

#### Symptoms
- "Connection pool exhausted"
- Slow queries
- Transaction deadlocks

#### Diagnosis
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'screenshot_algo';

-- Find long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- Check for locks
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.usename AS blocked_user,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### Solutions

**Connection pool exhausted:**
```javascript
// Increase pool size in configuration
DATABASE_POOL_SIZE=20
DATABASE_POOL_IDLE_TIMEOUT=30000
```

**Slow queries:**
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_articles_number ON articles(article_number);
CREATE INDEX CONCURRENTLY idx_screenshots_article ON screenshots(article_id);

-- Analyze tables
ANALYZE articles;
ANALYZE screenshots;
```

**Kill stuck queries:**
```sql
-- Terminate specific query
SELECT pg_terminate_backend(<pid>);

-- Terminate all connections (careful!)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'screenshot_algo' AND pid <> pg_backend_pid();
```

---

### 4. Memory Issues

#### Symptoms
- OOMKilled pods
- Slow performance
- Node pressure

#### Diagnosis
```bash
# Check pod memory usage
kubectl top pods -n screenshot-algo

# Check node memory
kubectl top nodes

# Check for memory leaks
kubectl exec <pod-name> -n screenshot-algo -- \
  node --expose-gc -e "console.log(process.memoryUsage())"
```

#### Solutions

**Increase limits:**
```yaml
resources:
  requests:
    memory: "512Mi"
  limits:
    memory: "1Gi"
```

**Fix memory leaks:**
```javascript
// Ensure browsers are closed
async function captureScreenshot(url) {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    const screenshot = await page.screenshot();
    return screenshot;
  } finally {
    await browser.close(); // Always close!
  }
}
```

---

### 5. Queue Backlog

#### Symptoms
- Jobs stuck in queue
- Processing delays
- Worker errors

#### Diagnosis
```bash
# Check queue status
curl -s http://localhost:3000/api/queue/status | jq

# Check Redis
redis-cli INFO | grep -E "(connected_clients|used_memory|blocked)"

# Check queue in Redis
redis-cli LLEN screenshot:queue
redis-cli LRANGE screenshot:queue 0 10
```

#### Solutions

**Clear stuck jobs:**
```bash
# Via API
curl -X POST http://localhost:3000/api/queue/clean

# Via Redis (careful!)
redis-cli DEL screenshot:queue:failed
```

**Increase workers:**
```javascript
// In queue configuration
QUEUE_CONCURRENCY=5
WORKER_COUNT=3
```

**Retry failed jobs:**
```bash
# Via API
curl -X POST http://localhost:3000/api/queue/retry-failed
```

---

### 6. Network Issues

#### Symptoms
- Connection timeouts
- DNS resolution failures
- Intermittent connectivity

#### Diagnosis
```bash
# Check DNS resolution
kubectl exec <pod-name> -n screenshot-algo -- nslookup google.com

# Check external connectivity
kubectl exec <pod-name> -n screenshot-algo -- curl -v https://example.com

# Check internal service discovery
kubectl exec <pod-name> -n screenshot-algo -- nslookup postgres-service

# Check network policies
kubectl get networkpolicies -n screenshot-algo
```

#### Solutions

**DNS issues:**
```yaml
# Add DNS config to pod spec
dnsConfig:
  options:
    - name: ndots
      value: "1"
```

**Proxy issues:**
```bash
# Set proxy environment variables
HTTP_PROXY=http://proxy.internal:3128
HTTPS_PROXY=http://proxy.internal:3128
NO_PROXY=localhost,127.0.0.1,.internal
```

---

## Debug Mode

Enable debug logging for detailed diagnostics:

```bash
# Via environment variable
LOG_LEVEL=debug

# Via API (runtime)
curl -X POST http://localhost:3000/api/debug/enable

# View debug logs
kubectl logs -l app=screenshot-algo -n screenshot-algo | grep -i debug
```

## Performance Profiling

```bash
# Enable Node.js profiling
NODE_OPTIONS="--prof"

# Generate flame graph
kubectl exec <pod-name> -n screenshot-algo -- \
  node --prof-process isolate-*.log > profile.txt

# Memory snapshot
kubectl exec <pod-name> -n screenshot-algo -- \
  node --heapsnapshot-signal=SIGUSR2 &
kubectl exec <pod-name> -n screenshot-algo -- kill -USR2 1
```

## Getting Help

1. Check this guide first
2. Search closed GitHub issues
3. Ask in #dev-support Slack channel
4. For emergencies, page on-call via PagerDuty

## Related Documentation

- [On-Call Guide](docs/runbooks/on-call-guide.md)
- [Incident Response](docs/runbooks/incident-response.md)
- [Database Recovery](docs/runbooks/database-recovery.md)
- [Architecture Overview](docs/onboarding/architecture-overview.md)
