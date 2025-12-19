# Rollback Procedures

Enterprise rollback procedures for Screenshot_Algo deployments.

## Quick Rollback Commands

### Kubernetes Deployment Rollback
```bash
# Immediate rollback to previous version
kubectl -n screenshot-algo rollout undo deployment/screenshot-algo

# Rollback to specific revision
kubectl -n screenshot-algo rollout undo deployment/screenshot-algo --to-revision=5

# Check rollback status
kubectl -n screenshot-algo rollout status deployment/screenshot-algo
```

### Helm Rollback
```bash
# View release history
helm history screenshot-algo -n screenshot-algo

# Rollback to previous release
helm rollback screenshot-algo -n screenshot-algo

# Rollback to specific revision
helm rollback screenshot-algo 3 -n screenshot-algo

# Rollback with recreate pods
helm rollback screenshot-algo --recreate-pods -n screenshot-algo
```

### ArgoCD Rollback
```bash
# View application history
argocd app history screenshot-algo

# Rollback to specific revision
argocd app rollback screenshot-algo <revision-id>

# Sync to specific commit
argocd app sync screenshot-algo --revision <git-sha>
```

### FluxCD Rollback
```bash
# Suspend reconciliation first
flux suspend kustomization screenshot-algo

# Rollback Helm release
helm rollback screenshot-algo -n screenshot-algo

# Or revert git commit and force reconciliation
git revert HEAD
git push
flux reconcile kustomization screenshot-algo --with-source
```

## Detailed Rollback Procedures

### 1. Application Rollback

**Scenario**: New deployment causes errors, need to revert.

**Step 1: Verify the issue**
```bash
# Check current pods
kubectl -n screenshot-algo get pods

# Check recent events
kubectl -n screenshot-algo get events --sort-by='.lastTimestamp' | head -20

# Check error rate
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])"
```

**Step 2: Identify target revision**
```bash
# List deployment history
kubectl -n screenshot-algo rollout history deployment/screenshot-algo

# View specific revision
kubectl -n screenshot-algo rollout history deployment/screenshot-algo --revision=3
```

**Step 3: Execute rollback**
```bash
# Rollback
kubectl -n screenshot-algo rollout undo deployment/screenshot-algo --to-revision=3

# Wait for completion
kubectl -n screenshot-algo rollout status deployment/screenshot-algo --timeout=300s
```

**Step 4: Verify rollback**
```bash
# Check pods are running
kubectl -n screenshot-algo get pods

# Verify health endpoint
kubectl -n screenshot-algo exec -it deployment/screenshot-algo -- curl localhost:4000/health

# Check error rate decreased
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[1m])"
```

### 2. Database Migration Rollback

**Scenario**: Migration caused issues, need to revert schema changes.

**Step 1: Stop traffic**
```bash
# Scale down application
kubectl -n screenshot-algo scale deployment/screenshot-algo --replicas=0
```

**Step 2: Identify migration to rollback**
```bash
# List migrations
npm run migration:status

# Or with SQL
SELECT * FROM migrations ORDER BY id DESC LIMIT 10;
```

**Step 3: Rollback migration**
```bash
# Rollback last migration
npm run migration:rollback

# Rollback to specific version
npm run migration:rollback -- --to=20250101000000

# Or manually
psql -h $DB_HOST -U $DB_USER -d screenshot_algo -f migrations/rollback/20250115_rollback.sql
```

**Step 4: Restore traffic**
```bash
# Scale back up
kubectl -n screenshot-algo scale deployment/screenshot-algo --replicas=3

# Verify health
kubectl -n screenshot-algo rollout status deployment/screenshot-algo
```

### 3. Infrastructure Rollback (Terraform)

**Scenario**: Infrastructure change caused issues.

**Step 1: Identify changes**
```bash
# View Terraform state history
terraform show

# Check recent apply
cat terraform.tfstate.backup
```

**Step 2: Revert Terraform**
```bash
# Option 1: Restore from backup state
cp terraform.tfstate.backup terraform.tfstate

# Option 2: Re-apply previous commit
git checkout HEAD~1 -- terraform/
terraform plan -var-file=environments/production.tfvars
terraform apply -var-file=environments/production.tfvars
```

### 4. Configuration Rollback

**Scenario**: ConfigMap/Secret change caused issues.

```bash
# List ConfigMap revisions (if using rollout)
kubectl -n screenshot-algo get configmap screenshot-algo-config -o yaml

# Restore from backup
kubectl -n screenshot-algo apply -f backup/configmap-backup.yaml

# Restart deployment to pick up changes
kubectl -n screenshot-algo rollout restart deployment/screenshot-algo
```

## Canary/Blue-Green Rollback

### Canary Rollback
```bash
# Stop canary traffic
kubectl -n screenshot-algo patch virtualservice screenshot-algo --type=merge -p '
spec:
  http:
  - route:
    - destination:
        host: screenshot-algo
        subset: stable
      weight: 100
    - destination:
        host: screenshot-algo
        subset: canary
      weight: 0
'

# Delete canary deployment
kubectl -n screenshot-algo delete deployment screenshot-algo-canary
```

### Blue-Green Rollback
```bash
# Switch traffic back to blue (previous)
kubectl -n screenshot-algo patch service screenshot-algo --type=merge -p '
spec:
  selector:
    version: blue
'

# Verify traffic routing
kubectl -n screenshot-algo get endpoints screenshot-algo
```

## Emergency Procedures

### Complete Service Rollback
```bash
#!/bin/bash
# emergency-rollback.sh

echo "🚨 Starting emergency rollback..."

# 1. Stop new deployments
kubectl -n screenshot-algo annotate deployment screenshot-algo kubernetes.io/change-cause="EMERGENCY ROLLBACK"

# 2. Rollback application
kubectl -n screenshot-algo rollout undo deployment/screenshot-algo

# 3. Wait for rollback
kubectl -n screenshot-algo rollout status deployment/screenshot-algo --timeout=300s

# 4. Verify health
for i in {1..10}; do
  if kubectl -n screenshot-algo exec -it deployment/screenshot-algo -- curl -s localhost:4000/health | grep -q "healthy"; then
    echo "✅ Service healthy"
    break
  fi
  echo "Waiting for service health..."
  sleep 5
done

# 5. Notify
curl -X POST $SLACK_WEBHOOK -d '{"text":"🔄 Emergency rollback completed for Screenshot_Algo"}'

echo "✅ Rollback complete"
```

## Rollback Verification Checklist

- [ ] Pods are running (`kubectl get pods`)
- [ ] Health checks passing
- [ ] Error rate returned to baseline
- [ ] Latency returned to baseline
- [ ] No new alerts triggered
- [ ] Key functionality working
- [ ] External integrations working
- [ ] Logs show no errors

## When NOT to Rollback

1. **Data migration already applied** - May cause data inconsistency
2. **Breaking API changes in production** - Clients may depend on new version
3. **Security fix** - Rolling back would reintroduce vulnerability
4. **Database schema dependency** - New code requires new schema

In these cases, consider:
- Hotfix forward instead of rollback
- Feature flag to disable problematic code
- Traffic routing to bypass affected endpoints
