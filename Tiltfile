# Tiltfile for Screenshot_Algo
# Local Kubernetes development environment
# https://docs.tilt.dev/

# =============================================================================
# Configuration
# =============================================================================

# Load environment
load('ext://dotenv', 'dotenv')
dotenv()

# Configure Docker
docker_prune_settings(disable=False, max_age_mins=360)

# =============================================================================
# Docker Build
# =============================================================================

# Build application image
docker_build(
    'screenshot-algo',
    '.',
    dockerfile='Dockerfile',
    live_update=[
        # Sync source files
        sync('./src', '/app/src'),
        sync('./package.json', '/app/package.json'),
        # Restart on package changes
        run('npm install', trigger=['./package.json', './package-lock.json']),
    ],
    ignore=[
        'node_modules',
        'dist',
        'coverage',
        '__tests__',
        '.git',
        '*.md',
        'k8s',
        'helm',
        'terraform',
    ]
)

# =============================================================================
# Kubernetes Resources
# =============================================================================

# Apply Kubernetes manifests
k8s_yaml(kustomize('k8s/overlays/dev'))

# =============================================================================
# Resource Configuration
# =============================================================================

# Main application
k8s_resource(
    'dev-screenshot-algo',
    port_forwards=[
        port_forward(4000, 4000, name='API'),
        port_forward(9090, 9090, name='Metrics'),
    ],
    labels=['app'],
    resource_deps=['dev-postgresql', 'dev-redis'],
)

# PostgreSQL
k8s_resource(
    'dev-postgresql',
    port_forwards=[
        port_forward(5432, 5432, name='PostgreSQL'),
    ],
    labels=['database'],
)

# Redis
k8s_resource(
    'dev-redis',
    port_forwards=[
        port_forward(6379, 6379, name='Redis'),
    ],
    labels=['cache'],
)

# =============================================================================
# Local Resources
# =============================================================================

# Run npm test in watch mode
local_resource(
    'tests',
    serve_cmd='npm test -- --watch',
    deps=['src'],
    labels=['tests'],
    auto_init=False,
)

# Run linter
local_resource(
    'lint',
    cmd='npm run lint',
    deps=['src'],
    labels=['quality'],
    auto_init=False,
)

# Type check
local_resource(
    'typecheck',
    cmd='npm run typecheck',
    deps=['src'],
    labels=['quality'],
    auto_init=False,
)

# =============================================================================
# Extensions
# =============================================================================

# Helm support (for dependencies)
load('ext://helm_resource', 'helm_resource', 'helm_repo')

# Add Bitnami repo
helm_repo('bitnami', 'https://charts.bitnami.com/bitnami')

# PostgreSQL via Helm (alternative to kustomize)
# helm_resource(
#     'postgresql',
#     'bitnami/postgresql',
#     flags=[
#         '--set=auth.database=screenshot_algo',
#         '--set=auth.username=screenshot',
#         '--set=auth.password=devpassword',
#     ],
#     labels=['database'],
# )

# =============================================================================
# Buttons
# =============================================================================

# Database migration button
local_resource(
    'db-migrate',
    cmd='npm run db:migrate',
    labels=['database'],
    auto_init=False,
)

# Database seed button
local_resource(
    'db-seed',
    cmd='npm run db:seed',
    labels=['database'],
    auto_init=False,
)

# Database reset button
local_resource(
    'db-reset',
    cmd='npm run db:reset',
    labels=['database'],
    auto_init=False,
)

# =============================================================================
# CI Mode
# =============================================================================

# Enable CI mode for automated testing
config.define_bool('ci')
cfg = config.parse()
if cfg.get('ci', False):
    # In CI mode, fail fast
    update_settings(max_parallel_updates=1, k8s_upsert_timeout_secs=120)
