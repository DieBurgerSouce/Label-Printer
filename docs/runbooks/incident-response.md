# Incident Response Runbook

Enterprise incident response procedures for Screenshot_Algo.

## Severity Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| **SEV1** | Immediate (15 min) | Complete service outage, data breach, security incident |
| **SEV2** | 30 minutes | Partial outage, significant degradation, data loss |
| **SEV3** | 2 hours | Feature unavailable, minor degradation |
| **SEV4** | 24 hours | Minor issues, non-critical bugs |

## Incident Response Workflow

### 1. Detection & Triage (0-15 minutes)

**Alert Received**
1. Acknowledge alert in PagerDuty/OpsGenie
2. Assess severity using the matrix above
3. Open incident channel: `#incident-YYYYMMDD-HHMM`

**Initial Assessment**
```bash
# Check service status
kubectl -n screenshot-algo get pods
kubectl -n screenshot-algo get events --sort-by='.lastTimestamp' | tail -20

# Check recent deployments
kubectl -n screenshot-algo rollout history deployment/screenshot-algo

# Check error rates
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])"
```

**Notify Stakeholders**
- SEV1/SEV2: Notify on-call manager immediately
- SEV3/SEV4: Update in incident channel

### 2. Containment (15-30 minutes)

**If Application Issue**
```bash
# Rollback to previous version
kubectl -n screenshot-algo rollout undo deployment/screenshot-algo

# Scale down if needed
kubectl -n screenshot-algo scale deployment/screenshot-algo --replicas=0

# Check rollback status
kubectl -n screenshot-algo rollout status deployment/screenshot-algo
```

**If Database Issue**
```bash
# Check database connectivity
psql -h $DB_HOST -U $DB_USER -c "SELECT 1"

# Check connection pool
psql -h $DB_HOST -U $DB_USER -c "SELECT count(*) FROM pg_stat_activity"

# Kill long-running queries (if needed)
psql -h $DB_HOST -U $DB_USER -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE duration > interval '5 minutes' AND state = 'active'"
```

**If Redis Issue**
```bash
# Check Redis connectivity
redis-cli -h $REDIS_HOST ping

# Check memory usage
redis-cli -h $REDIS_HOST info memory

# Clear cache if needed (CAREFUL!)
redis-cli -h $REDIS_HOST FLUSHDB
```

### 3. Investigation (30 min - 2 hours)

**Log Analysis**
```bash
# Application logs
kubectl -n screenshot-algo logs -l app.kubernetes.io/name=screenshot-algo --tail=500

# Search for errors
kubectl -n screenshot-algo logs -l app.kubernetes.io/name=screenshot-algo | grep -i error

# Check Loki for historical logs
# Query: {namespace="screenshot-algo"} |= "error"
```

**Metrics Analysis**
```bash
# Check request latency
curl -s "http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))"

# Check error rate by endpoint
curl -s "http://prometheus:9090/api/v1/query?query=sum(rate(http_requests_total{status=~'5..'}[5m])) by (handler)"
```

**Distributed Tracing**
- Open Jaeger UI: http://jaeger:16686
- Search for traces with errors
- Identify root cause in trace

### 4. Resolution

**Deploy Fix**
```bash
# Deploy hotfix
kubectl -n screenshot-algo set image deployment/screenshot-algo screenshot-algo=ghcr.io/screenshot-algo/screenshot-algo:hotfix-v1

# Wait for rollout
kubectl -n screenshot-algo rollout status deployment/screenshot-algo

# Verify fix
curl -s http://screenshot-algo/health
```

**Verify Resolution**
- [ ] Health checks passing
- [ ] Error rate returned to baseline
- [ ] Latency returned to baseline
- [ ] No new alerts triggered

### 5. Post-Incident

**Immediate Actions**
1. Update incident channel with resolution
2. Close PagerDuty/OpsGenie incident
3. Update status page

**Post-Mortem (within 48 hours)**
1. Schedule post-mortem meeting
2. Create post-mortem document
3. Identify action items
4. Assign owners and due dates

## Escalation Matrix

| Time | Action |
|------|--------|
| 0 min | Primary on-call alerted |
| 15 min | Secondary on-call notified |
| 30 min | Team lead notified |
| 1 hour | Engineering manager notified |
| 2 hours | VP Engineering notified |

## Communication Templates

### Initial Message
```
🚨 INCIDENT: [Brief description]
Severity: SEV[X]
Status: Investigating
Impact: [Describe user impact]
Incident Commander: @[name]
Channel: #incident-YYYYMMDD-HHMM
```

### Update Message
```
📢 UPDATE: [Incident title]
Status: [Investigating/Identified/Monitoring/Resolved]
Current state: [What's happening now]
Next steps: [What we're doing]
ETA: [If known]
```

### Resolution Message
```
✅ RESOLVED: [Incident title]
Duration: [Total time]
Impact: [Number of users/requests affected]
Root cause: [Brief description]
Post-mortem: [Link to document]
```

## Quick Reference

### Common Issues

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| 5xx errors spike | App crash | Rollback deployment |
| High latency | DB/Redis | Check connections |
| Queue backlog | Worker issue | Restart workers |
| Memory OOM | Memory leak | Restart pods |
| Connection refused | Pod not ready | Check readiness probe |

### Important URLs

- Grafana: https://grafana.screenshot-algo.com
- Prometheus: https://prometheus.screenshot-algo.com
- Jaeger: https://jaeger.screenshot-algo.com
- ArgoCD: https://argocd.screenshot-algo.com

## Contacts

| Role | Name | Contact |
|------|------|---------|
| Primary On-Call | [Rotation] | PagerDuty |
| Team Lead | [Name] | Slack/Phone |
| Engineering Manager | [Name] | Slack/Phone |
