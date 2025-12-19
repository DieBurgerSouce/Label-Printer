# GitOps Configuration

Enterprise GitOps setup for Screenshot_Algo using ArgoCD and FluxCD.

## Overview

This directory contains GitOps configurations for continuous deployment:

```
gitops/
├── argocd/
│   ├── application.yaml      # ArgoCD Application resources
│   ├── project.yaml          # ArgoCD AppProject with RBAC
│   └── applicationset.yaml   # Multi-environment deployments
├── fluxcd/
│   ├── kustomization.yaml    # FluxCD Kustomization resources
│   ├── git-repository.yaml   # Git source configuration
│   ├── helm-release.yaml     # Helm deployments
│   ├── image-policy.yaml     # Image update policies
│   └── image-update.yaml     # Automated image updates
└── README.md
```

## ArgoCD Setup

### Prerequisites

```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### Deploy Application

```bash
# Apply project first
kubectl apply -f gitops/argocd/project.yaml

# Apply application
kubectl apply -f gitops/argocd/application.yaml

# Or apply ApplicationSet for all environments
kubectl apply -f gitops/argocd/applicationset.yaml
```

### Access ArgoCD UI

```bash
# Port forward
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Open https://localhost:8080
```

## FluxCD Setup

### Prerequisites

```bash
# Install Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# Bootstrap Flux
flux bootstrap github \
  --owner=screenshot-algo \
  --repository=screenshot-algo \
  --branch=main \
  --path=./gitops/fluxcd \
  --personal
```

### Deploy Resources

```bash
# Apply Git repository source
kubectl apply -f gitops/fluxcd/git-repository.yaml

# Apply Kustomization
kubectl apply -f gitops/fluxcd/kustomization.yaml

# Apply Helm releases
kubectl apply -f gitops/fluxcd/helm-release.yaml

# Enable image automation
kubectl apply -f gitops/fluxcd/image-policy.yaml
kubectl apply -f gitops/fluxcd/image-update.yaml
```

### Check Status

```bash
# Flux status
flux get all

# Kustomization status
flux get kustomizations

# Helm releases
flux get helmreleases

# Image policies
flux get images all
```

## Environment Strategy

| Environment | Branch | Auto Sync | Prune | ArgoCD | FluxCD |
|-------------|--------|-----------|-------|--------|--------|
| Development | develop | Yes | Yes | ✅ | ✅ |
| Staging | develop | Yes | Yes | ✅ | ✅ |
| Production | main | No | No | ✅ | ✅ |

## Image Update Flow

### Production (Semantic Versioning)
1. CI builds and tags image with semver (e.g., `1.2.3`)
2. FluxCD/ArgoCD detects new tag matching `>=1.0.0`
3. Policy selects highest semver
4. Automation commits updated image tag
5. GitOps syncs deployment

### Staging (Build Numbers)
1. CI builds and tags image with `staging-<timestamp>`
2. Automation selects latest timestamp
3. Updates staged automatically

### Development (Git SHA)
1. CI builds and tags image with `dev-<sha>`
2. Automation selects latest commit
3. Updates deployed automatically

## Secrets Management

### SOPS (Recommended)
```bash
# Encrypt secrets
sops --encrypt --in-place secrets.yaml

# FluxCD will decrypt automatically using sops-gpg secret
```

### Sealed Secrets
```bash
# Seal a secret
kubeseal --format yaml < secret.yaml > sealed-secret.yaml
```

### External Secrets
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: screenshot-algo
spec:
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: screenshot-algo-secrets
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: screenshot-algo/production/database
```

## Rollback

### ArgoCD
```bash
# View history
argocd app history screenshot-algo

# Rollback
argocd app rollback screenshot-algo <revision>
```

### FluxCD
```bash
# Suspend reconciliation
flux suspend kustomization screenshot-algo

# Rollback Helm release
helm rollback screenshot-algo -n screenshot-algo

# Resume reconciliation
flux resume kustomization screenshot-algo
```

## Monitoring

### ArgoCD Metrics
- Available at `/metrics` on ArgoCD server
- Prometheus ServiceMonitor included

### FluxCD Metrics
```bash
# Check reconciliation status
flux stats

# View events
flux events
```

## Troubleshooting

### ArgoCD Sync Failed
```bash
# Check application status
argocd app get screenshot-algo

# View sync details
argocd app sync screenshot-algo --dry-run

# Force sync
argocd app sync screenshot-algo --force
```

### FluxCD Reconciliation Failed
```bash
# Check kustomization status
flux get kustomization screenshot-algo

# View logs
flux logs --kind=Kustomization --name=screenshot-algo

# Force reconciliation
flux reconcile kustomization screenshot-algo --with-source
```

## Best Practices

1. **Separation of Concerns**: Keep application config separate from infrastructure
2. **Environment Parity**: Use same manifests with environment-specific overlays
3. **Secrets Management**: Never commit plain text secrets
4. **Review Process**: Require PR reviews for production changes
5. **Monitoring**: Set up alerts for sync failures
6. **Documentation**: Document all customizations

## Related Documentation

- [Kubernetes Manifests](../k8s/README.md)
- [Helm Charts](../helm/README.md)
- [Terraform Infrastructure](../terraform/README.md)
- [ArgoCD Docs](https://argo-cd.readthedocs.io/)
- [FluxCD Docs](https://fluxcd.io/docs/)
