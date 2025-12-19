# Database Recovery Runbook

Enterprise database recovery procedures for Screenshot_Algo.

## Recovery Scenarios

### 1. Point-in-Time Recovery (PITR)

**When to use**: Accidental data deletion, corruption, need to recover to specific time.

```bash
# 1. Identify recovery point
aws rds describe-db-cluster-snapshots \
  --db-cluster-identifier screenshot-algo-production

# 2. Create restore point
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier screenshot-algo-production \
  --target-db-instance-identifier screenshot-algo-recovery \
  --restore-time "2025-01-15T10:30:00Z" \
  --db-instance-class db.r6g.xlarge

# 3. Wait for instance to be available
aws rds wait db-instance-available \
  --db-instance-identifier screenshot-algo-recovery

# 4. Verify data
psql -h screenshot-algo-recovery.xxx.rds.amazonaws.com -U postgres -d screenshot_algo -c "SELECT count(*) FROM users"
```

### 2. Snapshot Recovery

**When to use**: Complete database failure, need full restore.

```bash
# 1. List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier screenshot-algo-production \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]'

# 2. Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier screenshot-algo-restored \
  --db-snapshot-identifier screenshot-algo-production-2025-01-15

# 3. Update DNS/connection string
# Update application configuration to point to new instance
```

### 3. Cross-Region Recovery

**When to use**: Regional outage, disaster recovery.

```bash
# 1. Copy snapshot to DR region
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier arn:aws:rds:eu-central-1:123456789:snapshot:screenshot-algo-daily \
  --target-db-snapshot-identifier screenshot-algo-dr-copy \
  --source-region eu-central-1 \
  --region eu-west-1

# 2. Restore in DR region
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier screenshot-algo-dr \
  --db-snapshot-identifier screenshot-algo-dr-copy \
  --region eu-west-1
```

## Data Corruption Recovery

### Identify Corruption
```sql
-- Check for table corruption
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');

-- Verify table integrity
SELECT pg_relation_filepath('table_name');
VACUUM VERBOSE table_name;

-- Check for index corruption
REINDEX TABLE table_name;
```

### Recover Single Table
```bash
# 1. Dump table from backup
pg_restore -h backup-host -U postgres -d temp_db -t table_name backup.dump

# 2. Export data
pg_dump -h backup-host -U postgres -t table_name temp_db > table_data.sql

# 3. Restore to production
psql -h prod-host -U postgres -d screenshot_algo < table_data.sql
```

## Connection Issues

### Max Connections Reached
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Show connections by application
SELECT application_name, count(*)
FROM pg_stat_activity
GROUP BY application_name;

-- Terminate idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < current_timestamp - INTERVAL '5 minutes';
```

### Connection Pooler Issues (PgBouncer)
```bash
# Check PgBouncer status
psql -h pgbouncer -p 6432 -U pgbouncer pgbouncer -c "SHOW POOLS"

# Show active connections
psql -h pgbouncer -p 6432 -U pgbouncer pgbouncer -c "SHOW CLIENTS"

# Pause and resume (for maintenance)
psql -h pgbouncer -p 6432 -U pgbouncer pgbouncer -c "PAUSE screenshot_algo"
psql -h pgbouncer -p 6432 -U pgbouncer pgbouncer -c "RESUME screenshot_algo"
```

## Replication Recovery

### Replica Lag
```sql
-- Check replication lag on primary
SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
       pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replication_lag
FROM pg_stat_replication;

-- On replica, check lag
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

### Rebuild Replica
```bash
# 1. Stop replica
aws rds stop-db-instance --db-instance-identifier screenshot-algo-replica

# 2. Delete replica
aws rds delete-db-instance --db-instance-identifier screenshot-algo-replica --skip-final-snapshot

# 3. Create new replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier screenshot-algo-replica \
  --source-db-instance-identifier screenshot-algo-production
```

## Performance Recovery

### High CPU/Memory
```sql
-- Find expensive queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC
LIMIT 10;

-- Kill long-running query
SELECT pg_terminate_backend(pid);

-- Analyze tables for query planner
ANALYZE VERBOSE;
```

### Vacuum Issues
```sql
-- Check vacuum status
SELECT relname, last_vacuum, last_autovacuum, n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- Force vacuum
VACUUM (VERBOSE, ANALYZE) table_name;

-- Full vacuum (locks table!)
VACUUM FULL table_name;
```

## Backup Verification

### Regular Verification (Weekly)
```bash
# 1. Restore latest backup to test instance
./scripts/restore-backup.sh --target=test-restore --latest

# 2. Run data integrity checks
psql -h test-restore -U postgres -f scripts/verify-backup.sql

# 3. Compare row counts
psql -h test-restore -U postgres -c "SELECT 'users' as table_name, count(*) FROM users"
psql -h production -U postgres -c "SELECT 'users' as table_name, count(*) FROM users"

# 4. Cleanup
aws rds delete-db-instance --db-instance-identifier test-restore --skip-final-snapshot
```

## Recovery Checklist

### Pre-Recovery
- [ ] Identify extent of damage/data loss
- [ ] Notify stakeholders
- [ ] Document current state
- [ ] Verify backup availability

### During Recovery
- [ ] Follow appropriate procedure above
- [ ] Monitor recovery progress
- [ ] Keep stakeholders updated
- [ ] Document all actions taken

### Post-Recovery
- [ ] Verify data integrity
- [ ] Run application tests
- [ ] Monitor for issues
- [ ] Update DNS if needed
- [ ] Schedule post-mortem

## Important Information

### RDS Instance Details
- **Production**: screenshot-algo-production.xxx.rds.amazonaws.com
- **Replica**: screenshot-algo-replica.xxx.rds.amazonaws.com
- **Instance Class**: db.r6g.xlarge
- **Storage**: 100GB gp3

### Backup Schedule
- **Automated Backups**: Daily at 03:00 UTC
- **Retention**: 30 days
- **Manual Snapshots**: Before major changes

### Contacts
- DBA Team: dba@screenshot-algo.com
- AWS Support: [Support Portal]
