# Disaster Recovery Plan

## Overview

This document outlines the disaster recovery (DR) procedures for Screenshot_Algo to ensure business continuity in the event of major incidents.

## Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | 4 hours | Maximum acceptable downtime |
| **RPO** (Recovery Point Objective) | 1 hour | Maximum acceptable data loss |
| **MTTR** (Mean Time To Recovery) | 2 hours | Average recovery time target |

## Disaster Categories

### Category 1: Infrastructure Failure
- Single server/pod failure
- Network partition
- Storage failure

**Response**: Automatic failover, minimal intervention

### Category 2: Regional Outage
- Cloud provider region down
- Data center failure
- Major network issues

**Response**: Manual failover to DR region

### Category 3: Data Corruption
- Database corruption
- Ransomware attack
- Accidental deletion

**Response**: Restore from backup

### Category 4: Security Incident
- Breach detected
- Compromised credentials
- DDoS attack

**Response**: Incident response + isolation

## Architecture for DR

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DISASTER RECOVERY ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────────────┘

    PRIMARY REGION (eu-central-1)              DR REGION (eu-west-1)
    ┌─────────────────────────────┐           ┌─────────────────────────────┐
    │                             │           │                             │
    │  ┌───────────────────────┐  │           │  ┌───────────────────────┐  │
    │  │     Load Balancer     │  │           │  │     Load Balancer     │  │
    │  └───────────┬───────────┘  │           │  └───────────┬───────────┘  │
    │              │              │           │              │              │
    │  ┌───────────▼───────────┐  │           │  ┌───────────▼───────────┐  │
    │  │    Application (3x)   │  │           │  │   Application (1x)    │  │
    │  │       (Active)        │  │  Async    │  │      (Standby)        │  │
    │  └───────────┬───────────┘  │  Repl.    │  └───────────┬───────────┘  │
    │              │              │ ────────► │              │              │
    │  ┌───────────▼───────────┐  │           │  ┌───────────▼───────────┐  │
    │  │      PostgreSQL       │  │           │  │      PostgreSQL       │  │
    │  │       (Primary)       │  │           │  │       (Replica)       │  │
    │  └───────────────────────┘  │           │  └───────────────────────┘  │
    │                             │           │                             │
    └─────────────────────────────┘           └─────────────────────────────┘

                              ┌─────────────────────────────┐
                              │       S3 Cross-Region       │
                              │        Replication          │
                              └─────────────────────────────┘
```

## Backup Strategy

### Database Backups

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Full Backup | Daily 02:00 UTC | 30 days | S3 (both regions) |
| Incremental | Hourly | 7 days | S3 (both regions) |
| Transaction Logs | Continuous | 7 days | S3 (both regions) |

### Application Backups

| Component | Frequency | Retention |
|-----------|-----------|-----------|
| Container Images | On release | 90 days |
| Configuration | On change | 30 versions |
| Secrets | On change | 10 versions |

### File Storage Backups

| Type | Frequency | Retention |
|------|-----------|-----------|
| Screenshots | Real-time replication | 90 days |
| Generated Labels | Real-time replication | 30 days |
| User Uploads | Real-time replication | Indefinite |

## Recovery Procedures

### Procedure 1: Single Pod Failure

**Trigger**: Pod crash or eviction
**Automation**: Kubernetes handles automatically
**Manual Steps**: None required

```bash
# Verify recovery
kubectl get pods -n screenshot-algo
kubectl describe pod <failed-pod>
```

### Procedure 2: Database Failover

**Trigger**: Primary database unavailable
**Time**: 5-15 minutes

```bash
# Step 1: Verify primary is down
pg_isready -h primary.db.internal -p 5432

# Step 2: Promote replica (if not auto)
# AWS RDS: Automatic failover
# Self-managed:
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/data

# Step 3: Update connection strings
kubectl set env deployment/screenshot-algo DATABASE_URL=<new-primary>

# Step 4: Verify application connectivity
curl -s https://api.screenshot-algo.com/health
```

### Procedure 3: Region Failover

**Trigger**: Primary region unavailable
**Time**: 30-60 minutes

```bash
# Step 1: Verify primary region is down
curl -s --max-time 10 https://api.screenshot-algo.com/health || echo "Primary down"

# Step 2: Update DNS to DR region
# Route53: Update weighted routing to 100% DR
aws route53 change-resource-record-sets --hosted-zone-id Z123456 \
  --change-batch file://dr-dns-change.json

# Step 3: Scale up DR application
kubectl --context dr-cluster scale deployment/screenshot-algo --replicas=3 -n screenshot-algo

# Step 4: Verify DR region
curl -s https://api.screenshot-algo.com/health

# Step 5: Notify stakeholders
# Send incident communication
```

### Procedure 4: Database Restore from Backup

**Trigger**: Data corruption or deletion
**Time**: 1-4 hours depending on data size

```bash
# Step 1: Stop application writes
kubectl scale deployment/screenshot-algo --replicas=0 -n screenshot-algo

# Step 2: Identify restore point
aws rds describe-db-snapshots --db-instance-identifier screenshot-algo-db

# Step 3: Restore to new instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier screenshot-algo-db-restored \
  --db-snapshot-identifier <snapshot-id>

# Step 4: Wait for restore (this takes time)
aws rds wait db-instance-available --db-instance-identifier screenshot-algo-db-restored

# Step 5: Update connection strings
kubectl set env deployment/screenshot-algo DATABASE_URL=<restored-db-url>

# Step 6: Scale up application
kubectl scale deployment/screenshot-algo --replicas=3 -n screenshot-algo

# Step 7: Verify data integrity
npm run db:verify
```

## Testing Schedule

| Test Type | Frequency | Scope |
|-----------|-----------|-------|
| Backup Restore | Monthly | Random backup verification |
| Pod Failure | Weekly | Chaos engineering |
| Database Failover | Quarterly | Full failover test |
| Region Failover | Annually | Full DR drill |

### Test Checklist

- [ ] Backup restoration successful
- [ ] RPO met (data loss within target)
- [ ] RTO met (recovery within target)
- [ ] All services functional after recovery
- [ ] Documentation accurate
- [ ] Team familiar with procedures

## Communication Plan

### During Incident

| Audience | Channel | Frequency |
|----------|---------|-----------|
| Internal Team | Slack #incidents | Real-time |
| Stakeholders | Email | Every 30 min |
| Customers | Status Page | Every update |

### Post-Incident

- Post-mortem within 48 hours
- Customer communication within 24 hours
- Documentation updates within 1 week

## Key Contacts

| Role | Name | Contact |
|------|------|---------|
| Primary On-Call | Rotation | PagerDuty |
| Database Admin | DBA Team | dba@example.com |
| Cloud Infra | Platform Team | platform@example.com |
| Security | Security Team | security@example.com |
| VP Engineering | Leadership | escalation@example.com |

## Runbook References

- [Incident Response](../runbooks/incident-response.md)
- [Database Recovery](../runbooks/database-recovery.md)
- [Rollback Procedures](../runbooks/rollback-procedures.md)
- [On-Call Guide](../runbooks/on-call-guide.md)

## Review and Maintenance

- **Review Frequency**: Quarterly
- **Last Tested**: [Date of last DR drill]
- **Document Owner**: SRE Team
- **Approval**: VP Engineering

---

**Emergency?** Start with [Incident Response Runbook](../runbooks/incident-response.md)
