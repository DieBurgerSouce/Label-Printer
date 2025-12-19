# Kubernetes Deployment Guide

Enterprise-grade Kubernetes configuration for Screenshot_Algo.

## Directory Structure

```
k8s/
├── base/                    # Base configurations
│   ├── namespace.yaml       # Namespace, ResourceQuota, LimitRange
│   ├── deployment.yaml      # Main application deployment
│   ├── service.yaml         # ClusterIP, Headless, LoadBalancer services
│   ├── configmap.yaml       # Application configuration
│   ├── secrets.yaml         # Secret templates (use External Secrets in prod)
│   ├── ingress.yaml         # Ingress with TLS
│   ├── hpa.yaml             # Horizontal Pod Autoscaler
│   ├── pdb.yaml             # Pod Disruption Budget
│   ├── networkpolicy.yaml   # Network security policies
│   └── kustomization.yaml   # Base kustomization
├── overlays/
│   ├── dev/                 # Development environment
│   ├── staging/             # Staging environment
│   └── production/          # Production environment
└── README.md                # This file
```

## Prerequisites

- Kubernetes 1.25+
- kubectl configured
- kustomize 4.x+
- Ingress controller (nginx-ingress recommended)
- cert-manager (for TLS)
- Prometheus Operator (for monitoring)

## Quick Start

### Deploy to Development

```bash
# Preview the configuration
kubectl kustomize k8s/overlays/dev

# Apply to cluster
kubectl apply -k k8s/overlays/dev

# Verify deployment
kubectl -n screenshot-algo-dev get all
```

### Deploy to Staging

```bash
kubectl apply -k k8s/overlays/staging
kubectl -n screenshot-algo-staging get all
```

### Deploy to Production

```bash
# Always preview first in production
kubectl kustomize k8s/overlays/production > production-manifest.yaml
kubectl diff -f production-manifest.yaml

# Apply changes
kubectl apply -k k8s/overlays/production
kubectl -n screenshot-algo rollout status deployment/screenshot-algo
```

## Environment Configurations

| Environment | Replicas | CPU Limit | Memory Limit | HPA Max |
|-------------|----------|-----------|--------------|---------|
| Development | 1 | 500m | 512Mi | 2 |
| Staging | 2 | 1 | 1Gi | 5 |
| Production | 3+ | 2 | 2Gi | 20 |

## Scaling

### Manual Scaling

```bash
kubectl -n screenshot-algo scale deployment/screenshot-algo --replicas=5
```

### HPA Configuration

The HPA is configured to scale based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)
- Custom metrics: requests per second, queue depth

## Monitoring

### Check Pod Status

```bash
kubectl -n screenshot-algo get pods -o wide
kubectl -n screenshot-algo describe pod <pod-name>
```

### View Logs

```bash
# All pods
kubectl -n screenshot-algo logs -l app.kubernetes.io/name=screenshot-algo -f

# Specific pod
kubectl -n screenshot-algo logs <pod-name> -f
```

### Port Forward for Local Access

```bash
# Application
kubectl -n screenshot-algo port-forward svc/screenshot-algo 4000:80

# Metrics
kubectl -n screenshot-algo port-forward svc/screenshot-algo 9090:9090
```

## Secrets Management

### Using External Secrets Operator (Recommended)

1. Install ESO:
```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets
```

2. Configure ClusterSecretStore for your provider (AWS, GCP, Vault, etc.)

3. Update `secrets.yaml` to use ExternalSecret resources

### Using Sealed Secrets

```bash
# Install kubeseal
brew install kubeseal

# Seal a secret
kubectl create secret generic my-secret --dry-run=client -o yaml | \
  kubeseal --controller-name=sealed-secrets --format=yaml > sealed-secret.yaml
```

## Troubleshooting

### Pod Not Starting

```bash
# Check events
kubectl -n screenshot-algo get events --sort-by='.lastTimestamp'

# Check pod description
kubectl -n screenshot-algo describe pod <pod-name>

# Check resource quotas
kubectl -n screenshot-algo describe resourcequota
```

### Network Issues

```bash
# Test DNS resolution
kubectl -n screenshot-algo run test --rm -it --image=busybox -- nslookup screenshot-algo

# Test connectivity
kubectl -n screenshot-algo run test --rm -it --image=curlimages/curl -- curl http://screenshot-algo/health
```

### Performance Issues

```bash
# Check resource usage
kubectl -n screenshot-algo top pods

# Check HPA status
kubectl -n screenshot-algo get hpa

# Check node pressure
kubectl describe nodes | grep -A5 "Conditions:"
```

## Rollback

```bash
# View rollout history
kubectl -n screenshot-algo rollout history deployment/screenshot-algo

# Rollback to previous version
kubectl -n screenshot-algo rollout undo deployment/screenshot-algo

# Rollback to specific revision
kubectl -n screenshot-algo rollout undo deployment/screenshot-algo --to-revision=2
```

## Maintenance

### Drain Node

```bash
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
```

### Update ConfigMap

```bash
kubectl -n screenshot-algo create configmap screenshot-algo-config \
  --from-literal=KEY=value \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart deployment to pick up changes
kubectl -n screenshot-algo rollout restart deployment/screenshot-algo
```

## Security Notes

1. **Secrets**: Never commit real secrets to version control
2. **Network Policies**: Default deny is enabled; only allow necessary traffic
3. **Pod Security**: Pods run as non-root with read-only filesystem
4. **RBAC**: Service accounts have minimal permissions

## Related Documentation

- [Helm Charts](../helm/README.md)
- [Terraform Infrastructure](../terraform/README.md)
- [GitOps Configuration](../gitops/README.md)
- [Monitoring Guide](../docs/monitoring/README.md)
