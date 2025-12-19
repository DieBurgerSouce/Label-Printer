# ADR 004: Kubernetes Strategy

## Status
Accepted

## Date
2024-12-17

## Context

Screenshot_Algo needs a container orchestration strategy that:
- Supports horizontal scaling for screenshot workers
- Provides high availability and self-healing
- Enables zero-downtime deployments
- Integrates with our CI/CD pipeline
- Supports multiple environments (dev, staging, production)

We considered several options:
1. Docker Compose with Swarm
2. AWS ECS/Fargate
3. Kubernetes (self-managed or managed)
4. Nomad

## Decision

We will use **Kubernetes** with the following strategy:

### 1. Managed Kubernetes
- **Production**: AWS EKS (Elastic Kubernetes Service)
- **Alternative**: Azure AKS or Google GKE based on cloud provider
- **Local Development**: Kind or K3d

### 2. Configuration Management
- **Kustomize** for environment-specific configurations
- Base manifests in `k8s/base/`
- Overlays for dev/staging/production in `k8s/overlays/`

### 3. Deployment Strategy
- **Rolling Updates** as default
- **Blue-Green** for major releases via Argo Rollouts
- **Canary** deployments for high-risk changes

### 4. Resource Management
- **Horizontal Pod Autoscaler (HPA)** for automatic scaling
- **Pod Disruption Budgets (PDB)** for availability
- **Resource Quotas** per namespace

### 5. Networking
- **Ingress Controller**: nginx-ingress
- **Service Mesh**: Optional Istio for advanced traffic management
- **Network Policies** for pod-to-pod security

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Ingress Controller                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              │               │               │                  │
│              ▼               ▼               ▼                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │   Frontend    │  │    Backend    │  │   Workers     │       │
│  │   Deployment  │  │   Deployment  │  │  Deployment   │       │
│  │   (3 replicas)│  │   (3 replicas)│  │  (5 replicas) │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                              │               │                  │
│                              ▼               ▼                  │
│                     ┌───────────────────────────┐               │
│                     │         Redis             │               │
│                     │      (StatefulSet)        │               │
│                     └───────────────────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌───────────────────┐
                    │    PostgreSQL     │
                    │   (External RDS)  │
                    └───────────────────┘
```

## Manifest Structure

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   └── networkpolicy.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        └── kustomization.yaml
```

## Deployment Commands

```bash
# Deploy to dev
kubectl apply -k k8s/overlays/dev

# Deploy to staging
kubectl apply -k k8s/overlays/staging

# Deploy to production
kubectl apply -k k8s/overlays/production

# Check deployment status
kubectl rollout status deployment/screenshot-algo -n screenshot-algo

# Rollback if needed
kubectl rollout undo deployment/screenshot-algo -n screenshot-algo
```

## Resource Configuration

### Production Sizing
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### HPA Configuration
```yaml
spec:
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## Consequences

### Positive
- **Scalability**: Easy horizontal scaling
- **Reliability**: Self-healing, rolling updates
- **Portability**: Works across cloud providers
- **Ecosystem**: Rich tooling (Helm, Kustomize, ArgoCD)
- **Observability**: Native Prometheus integration

### Negative
- **Complexity**: Steeper learning curve
- **Cost**: Managed K8s has overhead costs
- **Operations**: Requires K8s expertise

### Mitigations
- Use managed K8s to reduce operational burden
- Document all procedures in runbooks
- Provide team training on K8s basics
- Start with simple deployments, add complexity gradually

## Alternatives Considered

### Docker Compose + Swarm
- **Pros**: Simpler, familiar
- **Cons**: Limited scaling, no managed options, smaller ecosystem

### AWS ECS
- **Pros**: AWS-native, simpler than K8s
- **Cons**: Vendor lock-in, less flexible, smaller community

### Nomad
- **Pros**: Simpler than K8s, HashiStack integration
- **Cons**: Smaller ecosystem, fewer managed options

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Kustomize Documentation](https://kustomize.io/)
- `k8s/` directory in this repository
