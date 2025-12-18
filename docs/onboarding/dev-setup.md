# Developer Setup Guide

Complete setup guide for Screenshot_Algo development environment.

## Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| Node.js | 20.x LTS | [nvm](https://github.com/nvm-sh/nvm) |
| npm | 10.x | Included with Node.js |
| Git | 2.40+ | [git-scm.com](https://git-scm.com) |
| Docker | 24.x+ | [docker.com](https://docker.com) |
| VS Code | Latest | [code.visualstudio.com](https://code.visualstudio.com) |

### Recommended Tools

| Tool | Purpose | Installation |
|------|---------|--------------|
| kubectl | Kubernetes CLI | `brew install kubectl` |
| helm | K8s package manager | `brew install helm` |
| k9s | K8s TUI | `brew install k9s` |
| jq | JSON processor | `brew install jq` |
| httpie | HTTP client | `brew install httpie` |

## Initial Setup

### 1. Clone Repository

```bash
# Clone with SSH (recommended)
git clone git@github.com:screenshot-algo/screenshot-algo.git

# Or with HTTPS
git clone https://github.com/screenshot-algo/screenshot-algo.git

cd screenshot-algo
```

### 2. Install Node.js

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install correct Node.js version (reads .nvmrc)
nvm install
nvm use

# Verify
node --version  # Should match .nvmrc
```

### 3. Install Dependencies

```bash
# Install npm dependencies
npm ci

# Install git hooks
npm run prepare
```

### 4. Configure Environment

```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit with your local settings
# Required variables:
# - DATABASE_URL (PostgreSQL connection string)
# - REDIS_URL (Redis connection string)
# - SESSION_SECRET (for session management)
# - IMAGEKIT_PUBLIC_KEY (for image hosting)
# - IMAGEKIT_PRIVATE_KEY (for image hosting)
```

### 5. Start Development Server

```bash
# Start all services with Docker Compose (recommended)
docker-compose up -d

# Or start backend and frontend separately
cd backend && npm run dev  # API at http://localhost:3001
cd frontend && npm run dev # Frontend at http://localhost:5173

# The API will be available at http://localhost:3001
```

## Development Workflow

### Daily Development

```bash
# Start your day
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/TICKET-123-description

# Start development environment
npm run dev

# Run tests as you work
npm test -- --watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run typecheck

# Run all checks
npm run check
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- path/to/file.test.ts

# Run E2E tests
npm run test:e2e
```

### Committing Changes

```bash
# Stage changes
git add .

# Commit (follows conventional commits)
git commit -m "feat(api): add new endpoint for screenshots"

# Pre-commit hooks will run:
# - Linting
# - Type checking
# - Unit tests for changed files
```

## Docker Development

### Available Services

```yaml
# docker-compose.yml services
services:
  backend:    # Backend API (port 3001)
  postgres:   # PostgreSQL database (port 5432)
  redis:      # Redis cache & job queue (port 6379)
```

### Common Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Restart service
docker-compose restart backend

# Stop all services
docker-compose down

# Reset everything (including volumes)
docker-compose down -v
```

## Database

### Local Database Setup

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Run Prisma migrations
cd backend && npx prisma migrate dev

# Generate Prisma client
cd backend && npx prisma generate

# Seed with test data (if available)
cd backend && npx prisma db seed

# Reset database
cd backend && npx prisma migrate reset
```

### Database Access

```bash
# Connect to local database
psql postgresql://postgres:postgres@localhost:5432/screenshot_algo

# Or use Docker
docker-compose exec postgres psql -U postgres -d screenshot_algo
```

## VS Code Setup

### Required Extensions

Install these extensions for the best experience:

1. **ESLint** - Linting
2. **Prettier** - Code formatting
3. **TypeScript Vue Plugin** - Vue support
4. **Docker** - Container support
5. **GitLens** - Git insights
6. **Error Lens** - Inline errors

### Workspace Settings

The repository includes `.vscode/settings.json` with recommended settings:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :4000

# Kill process
kill -9 <PID>
```

### Node Modules Issues

```bash
# Clear and reinstall
rm -rf node_modules
rm package-lock.json
npm install
```

### Docker Issues

```bash
# Reset Docker environment
docker-compose down -v
docker system prune -f
docker-compose up -d --build
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Verify connection
docker-compose exec postgres pg_isready
```

## Getting Help

- **Slack**: #screenshot-algo-dev
- **Documentation**: /docs
- **Wiki**: [GitHub Wiki]
- **Team Lead**: @[name]

## Next Steps

1. Read [Architecture Overview](./architecture-overview.md)
2. Review [Code Style Guide](../CONVENTIONS.md)
3. Check [First PR Guide](./first-pr.md)
4. Join team Slack channel
