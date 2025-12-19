#!/bin/bash
# Kubernetes Development Environment Setup Script
# This script sets up a local K8s development environment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-screenshot-algo-dev}"
K8S_TOOL="${K8S_TOOL:-kind}"  # kind or k3d
NAMESPACE="screenshot-algo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing=()

    if ! command_exists docker; then
        missing+=("docker")
    fi

    if ! command_exists kubectl; then
        missing+=("kubectl")
    fi

    if [[ "$K8S_TOOL" == "kind" ]] && ! command_exists kind; then
        missing+=("kind")
    fi

    if [[ "$K8S_TOOL" == "k3d" ]] && ! command_exists k3d; then
        missing+=("k3d")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing[*]}"
        echo ""
        echo "Installation instructions:"
        echo "  docker: https://docs.docker.com/get-docker/"
        echo "  kubectl: https://kubernetes.io/docs/tasks/tools/"
        echo "  kind: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
        echo "  k3d: https://k3d.io/v5.4.6/#installation"
        exit 1
    fi

    # Check Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi

    log_success "All prerequisites satisfied"
}

# Create cluster
create_cluster() {
    log_info "Creating Kubernetes cluster with $K8S_TOOL..."

    if [[ "$K8S_TOOL" == "kind" ]]; then
        if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
            log_warn "Cluster '$CLUSTER_NAME' already exists"
            read -p "Delete and recreate? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                kind delete cluster --name "$CLUSTER_NAME"
            else
                log_info "Using existing cluster"
                return
            fi
        fi
        kind create cluster --config "$PROJECT_ROOT/kind.yaml"
    elif [[ "$K8S_TOOL" == "k3d" ]]; then
        if k3d cluster list 2>/dev/null | grep -q "$CLUSTER_NAME"; then
            log_warn "Cluster '$CLUSTER_NAME' already exists"
            read -p "Delete and recreate? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                k3d cluster delete "$CLUSTER_NAME"
            else
                log_info "Using existing cluster"
                return
            fi
        fi
        k3d cluster create --config "$PROJECT_ROOT/k3d.yaml"
    fi

    log_success "Cluster created successfully"
}

# Start supporting services
start_services() {
    log_info "Starting supporting services..."

    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.k8s-dev.yml up -d postgres redis

    # Wait for services
    log_info "Waiting for services to be ready..."
    sleep 5

    # Check PostgreSQL
    local retries=30
    while ! docker exec screenshot-algo-postgres pg_isready -U screenshot -d screenshot_algo >/dev/null 2>&1; do
        retries=$((retries - 1))
        if [[ $retries -eq 0 ]]; then
            log_error "PostgreSQL failed to start"
            exit 1
        fi
        sleep 1
    done

    # Check Redis
    retries=30
    while ! docker exec screenshot-algo-redis redis-cli ping >/dev/null 2>&1; do
        retries=$((retries - 1))
        if [[ $retries -eq 0 ]]; then
            log_error "Redis failed to start"
            exit 1
        fi
        sleep 1
    done

    log_success "Supporting services are running"
}

# Install ingress controller
install_ingress() {
    log_info "Installing NGINX Ingress Controller..."

    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

    log_info "Waiting for ingress controller to be ready..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=180s

    log_success "Ingress controller installed"
}

# Create namespace and secrets
setup_namespace() {
    log_info "Setting up namespace and secrets..."

    # Create namespace if not exists
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Create secrets (using host.docker.internal for services running in Docker)
    kubectl create secret generic screenshot-algo-secrets \
        --namespace "$NAMESPACE" \
        --from-literal=DATABASE_URL="postgresql://screenshot:screenshot_dev_password@host.docker.internal:5432/screenshot_algo" \
        --from-literal=REDIS_URL="redis://host.docker.internal:6379" \
        --from-literal=JWT_SECRET="dev-jwt-secret-change-in-production" \
        --dry-run=client -o yaml | kubectl apply -f -

    log_success "Namespace and secrets configured"
}

# Build and load image
build_and_load_image() {
    log_info "Building Docker image..."

    cd "$PROJECT_ROOT"
    docker build -t screenshot-algo:dev .

    log_info "Loading image into cluster..."
    if [[ "$K8S_TOOL" == "kind" ]]; then
        kind load docker-image screenshot-algo:dev --name "$CLUSTER_NAME"
    elif [[ "$K8S_TOOL" == "k3d" ]]; then
        k3d image import screenshot-algo:dev -c "$CLUSTER_NAME"
    fi

    log_success "Image built and loaded"
}

# Deploy application
deploy_application() {
    log_info "Deploying application..."

    cd "$PROJECT_ROOT"
    kubectl apply -k k8s/overlays/dev

    log_info "Waiting for deployment to be ready..."
    kubectl rollout status deployment/screenshot-algo -n "$NAMESPACE" --timeout=300s

    log_success "Application deployed"
}

# Print status and URLs
print_status() {
    echo ""
    log_success "============================================"
    log_success "  Development Environment Ready!"
    log_success "============================================"
    echo ""
    echo "Cluster: $CLUSTER_NAME ($K8S_TOOL)"
    echo ""
    echo "Application URLs:"
    echo "  - API: http://localhost/api"
    echo "  - Health: http://localhost/health"
    echo ""
    echo "Supporting Services:"
    echo "  - PostgreSQL: localhost:5432"
    echo "  - Redis: localhost:6379"
    echo ""
    echo "Useful Commands:"
    echo "  kubectl get pods -n $NAMESPACE"
    echo "  kubectl logs -f -l app=screenshot-algo -n $NAMESPACE"
    echo "  kubectl port-forward svc/screenshot-algo 3000:80 -n $NAMESPACE"
    echo ""
    echo "To stop:"
    echo "  $K8S_TOOL delete cluster $CLUSTER_NAME"
    echo "  docker-compose -f docker-compose.k8s-dev.yml down"
    echo ""
}

# Cleanup function
cleanup() {
    log_info "Cleaning up development environment..."

    if [[ "$K8S_TOOL" == "kind" ]]; then
        kind delete cluster --name "$CLUSTER_NAME" || true
    elif [[ "$K8S_TOOL" == "k3d" ]]; then
        k3d cluster delete "$CLUSTER_NAME" || true
    fi

    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.k8s-dev.yml down -v || true

    log_success "Cleanup complete"
}

# Main function
main() {
    local action="${1:-setup}"

    case "$action" in
        setup)
            check_prerequisites
            create_cluster
            start_services
            install_ingress
            setup_namespace
            build_and_load_image
            deploy_application
            print_status
            ;;
        cleanup|clean|delete)
            cleanup
            ;;
        status)
            kubectl get all -n "$NAMESPACE"
            ;;
        logs)
            kubectl logs -f -l app=screenshot-algo -n "$NAMESPACE"
            ;;
        restart)
            kubectl rollout restart deployment/screenshot-algo -n "$NAMESPACE"
            ;;
        rebuild)
            build_and_load_image
            kubectl rollout restart deployment/screenshot-algo -n "$NAMESPACE"
            ;;
        help|--help|-h)
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  setup     Create and configure development environment (default)"
            echo "  cleanup   Delete cluster and stop services"
            echo "  status    Show current status of pods"
            echo "  logs      Stream application logs"
            echo "  restart   Restart application deployment"
            echo "  rebuild   Rebuild image and restart"
            echo "  help      Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  CLUSTER_NAME  Name of the cluster (default: screenshot-algo-dev)"
            echo "  K8S_TOOL      Kubernetes tool to use: kind or k3d (default: kind)"
            ;;
        *)
            log_error "Unknown command: $action"
            echo "Run '$0 help' for usage"
            exit 1
            ;;
    esac
}

main "$@"
