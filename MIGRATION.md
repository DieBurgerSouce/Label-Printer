# Migration Guide

This guide provides instructions for migrating between major versions of Screenshot_Algo.

## Table of Contents

- [Version Compatibility Matrix](#version-compatibility-matrix)
- [Migration Steps](#migration-steps)
- [Breaking Changes](#breaking-changes)
- [Rollback Procedures](#rollback-procedures)

## Version Compatibility Matrix

| From Version | To Version | Migration Complexity | Downtime Required |
|--------------|------------|---------------------|-------------------|
| 1.x | 2.x | Medium | Yes (5-15 min) |
| 2.x | 3.x | Low | No (rolling) |

## Migration Steps

### v1.x to v2.x Migration

#### Pre-Migration Checklist

- [ ] Backup database
- [ ] Notify users of scheduled maintenance
- [ ] Review breaking changes below
- [ ] Test migration in staging environment
- [ ] Prepare rollback plan

#### Step 1: Backup Current State

```bash
# Backup database
pg_dump -h localhost -U postgres screenshot_algo > backup_v1_$(date +%Y%m%d).sql

# Backup configuration
cp -r config/ config_backup_v1/

# Backup screenshots (if local storage)
tar -czf screenshots_backup_v1.tar.gz ./data/screenshots/
```

#### Step 2: Update Dependencies

```bash
# Update package.json to v2.x
npm install screenshot-algo@2.x

# Or for self-hosted
git fetch --tags
git checkout v2.0.0
npm install
```

#### Step 3: Run Database Migrations

```bash
# Apply v2 migrations
npm run db:migrate

# Verify migration
npm run db:verify
```

#### Step 4: Update Configuration

```diff
// config/default.js
module.exports = {
-  apiVersion: 'v1',
+  apiVersion: 'v2',

-  storage: {
-    type: 'local',
-    path: './screenshots'
-  },
+  storage: {
+    provider: 'local',  // Changed from 'type'
+    basePath: './data/screenshots'  // Changed from 'path'
+  },

+  // New in v2
+  queue: {
+    concurrency: 5,
+    retries: 3
+  }
};
```

#### Step 5: Update API Calls (if using as library)

```diff
// Before (v1)
- const result = await screenshotAlgo.capture(url, options);

// After (v2)
+ const result = await screenshotAlgo.screenshot.capture({
+   url,
+   ...options
+ });
```

#### Step 6: Verify Migration

```bash
# Health check
curl http://localhost:3000/health

# Test screenshot
curl -X POST http://localhost:3000/api/v2/screenshots \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Run integration tests
npm run test:integration
```

#### Step 7: Post-Migration Tasks

- [ ] Update documentation links
- [ ] Update monitoring dashboards
- [ ] Clear old caches
- [ ] Update client libraries
- [ ] Monitor error rates for 24 hours

---

### v2.x to v3.x Migration

This migration supports zero-downtime rolling updates.

#### Pre-Migration Checklist

- [ ] Verify all v2.x deprecation warnings have been addressed
- [ ] Update client SDKs to latest v2.x (compatible with v3)
- [ ] Test in staging with traffic mirroring

#### Step 1: Rolling Update

```bash
# Update Kubernetes deployment
kubectl set image deployment/screenshot-algo \
  screenshot-algo=screenshot-algo:v3.0.0 \
  -n screenshot-algo

# Monitor rollout
kubectl rollout status deployment/screenshot-algo -n screenshot-algo
```

#### Step 2: Run Post-Deployment Migrations

```bash
# These are backward-compatible
kubectl exec -it deployment/screenshot-algo -n screenshot-algo -- \
  npm run db:migrate
```

#### Step 3: Verify

```bash
# Health check
curl http://localhost:3000/health

# Version check
curl http://localhost:3000/api/version
```

---

## Breaking Changes

### v2.0.0

#### API Changes

| Change | Migration |
|--------|-----------|
| `POST /api/screenshot` → `POST /api/v2/screenshots` | Update all API calls |
| `options.width` → `options.viewport.width` | Nest viewport options |
| Response format changed | Update response parsing |

#### Configuration Changes

| Old Config | New Config |
|------------|------------|
| `storage.type` | `storage.provider` |
| `storage.path` | `storage.basePath` |
| `browser.timeout` | `screenshot.timeout` |

#### Database Changes

```sql
-- New tables added
-- Run automatically via migrations
CREATE TABLE screenshot_jobs (...);
CREATE TABLE screenshot_metadata (...);

-- Column changes
ALTER TABLE articles ADD COLUMN updated_by VARCHAR(255);
```

### v3.0.0

#### API Changes

| Change | Migration |
|--------|-----------|
| Auth header format | `Authorization: Bearer <token>` required |
| Pagination format | Use cursor-based pagination |

#### Removed Features

| Feature | Alternative |
|---------|-------------|
| XML export | Use JSON export |
| Legacy webhook format | Use CloudEvents format |

---

## Rollback Procedures

### Quick Rollback (within 1 hour)

```bash
# Kubernetes
kubectl rollout undo deployment/screenshot-algo -n screenshot-algo

# Database (if not yet migrated forward)
# No action needed - v2 is backward compatible with v1 schema
```

### Full Rollback (after database migration)

```bash
# Stop application
kubectl scale deployment/screenshot-algo --replicas=0 -n screenshot-algo

# Restore database
psql -h localhost -U postgres -d screenshot_algo < backup_v1_YYYYMMDD.sql

# Rollback deployment
kubectl set image deployment/screenshot-algo \
  screenshot-algo=screenshot-algo:v1.x.x \
  -n screenshot-algo

# Scale back up
kubectl scale deployment/screenshot-algo --replicas=3 -n screenshot-algo
```

### Rollback Verification

```bash
# Verify version
curl http://localhost:3000/api/version

# Run smoke tests
npm run test:smoke

# Check for errors
kubectl logs -l app=screenshot-algo --tail=100 -n screenshot-algo | grep -i error
```

---

## Migration Support

### Getting Help

- **Documentation**: Check this guide and CHANGELOG.md
- **Issues**: GitHub Issues with `migration` label
- **Support**: support@example.com for enterprise customers

### Reporting Issues

When reporting migration issues, include:

1. Source version
2. Target version
3. Error messages
4. Steps to reproduce
5. Logs (sanitized)

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

## Related Documents

- [DEPRECATIONS.md](./DEPRECATIONS.md) - Deprecated features
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [docs/runbooks/rollback-procedures.md](./docs/runbooks/rollback-procedures.md) - Detailed rollback
