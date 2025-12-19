# On-Call Guide

## Overview

This guide provides essential information for on-call engineers supporting Screenshot_Algo in production.

## Rotation Schedule

### Shifts
- **Primary On-Call**: Mon-Sun, 24/7
- **Secondary On-Call**: Escalation backup
- **Rotation**: Weekly, handoff on Mondays 09:00 UTC

### Handoff Checklist
- [ ] Review active incidents from previous week
- [ ] Check pending alerts and their status
- [ ] Verify access to all monitoring dashboards
- [ ] Test PagerDuty/Slack notification delivery
- [ ] Review any deployment scheduled this week

## Alert Response

### Severity Levels

| Severity | Response Time | Examples |
|----------|---------------|----------|
| P1 - Critical | 15 minutes | Service down, data loss |
| P2 - High | 30 minutes | Degraded performance, partial outage |
| P3 - Medium | 4 hours | Non-critical functionality impacted |
| P4 - Low | Next business day | Minor issues, cosmetic bugs |

### Initial Response Steps

1. **Acknowledge the alert** within SLA
2. **Assess impact**:
   - How many users affected?
   - Is data at risk?
   - Is revenue impacted?
3. **Communicate**:
   - Update #incidents channel
   - Notify stakeholders if P1/P2
4. **Investigate** using runbooks
5. **Escalate** if needed

## Key Systems Access

### Dashboards
- **Grafana**: https://grafana.screenshot-algo.internal
- **Prometheus**: https://prometheus.screenshot-algo.internal
- **Sentry**: https://sentry.io/organizations/screenshot-algo/

### Infrastructure
- **Kubernetes**: `kubectl --context production`
- **Logs**: `kubectl logs -n screenshot-algo`
- **Database**: PostgreSQL via `psql` or admin panel

### Access Verification
```bash
# Verify K8s access
kubectl auth can-i get pods -n screenshot-algo

# Verify database access
psql -h db.screenshot-algo.internal -U readonly -d screenshot_algo -c "SELECT 1"

# Verify monitoring access
curl -s https://prometheus.screenshot-algo.internal/-/healthy
```

## Common Scenarios

### 1. High Error Rate Alert
```
Runbook: docs/runbooks/incident-response.md
Steps:
1. Check error logs: kubectl logs -l app=screenshot-algo --tail=100
2. Check recent deployments: git log --oneline -5
3. Check database health: SELECT * FROM pg_stat_activity
4. Consider rollback if recent deployment
```

### 2. High Latency Alert
```
Runbook: docs/runbooks/incident-response.md
Steps:
1. Check resource utilization in Grafana
2. Check for slow queries in database
3. Check external dependencies (APIs, CDN)
4. Scale if resource-constrained
```

### 3. Service Down Alert
```
Runbook: docs/runbooks/incident-response.md
Steps:
1. kubectl get pods -n screenshot-algo
2. kubectl describe pod <failing-pod>
3. Check node health: kubectl get nodes
4. Check ingress: kubectl get ingress -n screenshot-algo
```

### 4. Database Issues
```
Runbook: docs/runbooks/database-recovery.md
Steps:
1. Check connection count
2. Check for locks
3. Check replication lag
4. Contact DBA if critical
```

## Escalation Path

### Level 1: Primary On-Call
- First responder
- Initial triage and investigation
- Can apply standard fixes

### Level 2: Secondary On-Call
- Escalate if no progress after 30 minutes
- Complex issues requiring additional expertise

### Level 3: Team Lead
- Escalate for P1 incidents lasting > 1 hour
- Decisions about major rollbacks
- Customer communication decisions

### Level 4: Engineering Manager
- Escalate for prolonged outages (> 2 hours)
- Resource allocation decisions
- Executive communication

## Communication Templates

### Incident Start
```
:rotating_light: **INCIDENT STARTED**
- **Severity**: P[1/2/3]
- **Impact**: [Description of user impact]
- **Status**: Investigating
- **On-Call**: @[your-name]
- **Thread**: [Link to incident thread]
```

### Incident Update
```
:hourglass_flowing_sand: **INCIDENT UPDATE**
- **Time**: [Duration since start]
- **Status**: [Investigating/Identified/Mitigating]
- **Update**: [What's new]
- **ETA**: [Expected resolution time if known]
```

### Incident Resolved
```
:white_check_mark: **INCIDENT RESOLVED**
- **Duration**: [Total time]
- **Root Cause**: [Brief description]
- **Resolution**: [What fixed it]
- **Follow-up**: [PIR scheduled? Action items?]
```

## Self-Care During On-Call

### Do's
- Take breaks when not actively firefighting
- Eat regular meals
- Get adequate sleep (use secondary for overnight if needed)
- Document everything for handoff

### Don'ts
- Don't stay awake all night for non-critical alerts
- Don't make major changes without review
- Don't skip handoff documentation
- Don't forget to claim on-call compensation

## Emergency Contacts

| Role | Contact | When to Use |
|------|---------|-------------|
| Security Team | security@example.com | Security incidents |
| Database Admin | dba@example.com | Database emergencies |
| Platform Team | platform@example.com | Infrastructure issues |
| VP Engineering | Slack: @vp-eng | P1 > 2 hours |

## Useful Commands Cheat Sheet

```bash
# Quick health check
kubectl get pods -n screenshot-algo
curl -s localhost:3000/health | jq

# View recent logs
kubectl logs -n screenshot-algo -l app=screenshot-algo --tail=100 -f

# Check resource usage
kubectl top pods -n screenshot-algo

# Restart deployment
kubectl rollout restart deployment/screenshot-algo -n screenshot-algo

# View events
kubectl get events -n screenshot-algo --sort-by='.lastTimestamp' | tail -20

# Database connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='screenshot_algo'"

# Check queue depth
curl -s localhost:3000/metrics | grep queue_depth
```

## Post-Incident

1. **Document** the incident in the incident log
2. **Schedule** a Post-Incident Review (PIR) for P1/P2
3. **Create** follow-up tickets for improvements
4. **Update** runbooks if gaps were found
5. **Share** learnings with the team

---

**Questions?** Reach out in #on-call-support
**Feedback?** Update this guide via PR
