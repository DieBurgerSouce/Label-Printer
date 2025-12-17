# Screenshot_Algo Makefile
# Common development and deployment commands for Node.js/TypeScript

.PHONY: help install dev test clean docker-build docker-up docker-down deploy

# Variables
NODE_VERSION := 20
DOCKER_COMPOSE := docker-compose
PROJECT_NAME := screenshot-algo

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Default target
help: ## Show this help message
	@echo "$(GREEN)Screenshot_Algo - Available Commands$(NC)"
	@echo "======================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

# ============================================
# Development Setup
# ============================================
install: ## Install all dependencies
	npm ci
	npx husky install 2>/dev/null || true
	@echo "$(GREEN)✓ Dependencies installed!$(NC)"

install-dev: ## Install with dev dependencies
	npm install
	npx husky install 2>/dev/null || true
	pre-commit install 2>/dev/null || true
	@echo "$(GREEN)✓ Development environment ready!$(NC)"

update: ## Update all dependencies
	npm update
	npm outdated || true
	@echo "$(GREEN)✓ Dependencies updated!$(NC)"

dev: ## Run development server with hot reload
	npm run dev

dev-backend: ## Run backend development server
	npm run dev:backend

dev-frontend: ## Run frontend development server
	npm run dev:frontend

# ============================================
# Testing
# ============================================
test: ## Run all tests
	npm test

test-unit: ## Run unit tests only
	npm test -- --testPathPattern="unit"

test-integration: ## Run integration tests
	npm test -- --testPathPattern="integration"

test-e2e: ## Run end-to-end tests with Playwright
	npx playwright test

test-cov: ## Run tests with coverage report
	npm test -- --coverage

test-watch: ## Run tests in watch mode
	npm test -- --watch

# ============================================
# Code Quality
# ============================================
lint: ## Run ESLint checks
	npm run lint

lint-fix: ## Fix ESLint issues automatically
	npm run lint -- --fix

format: ## Format code with Prettier
	npm run format

format-check: ## Check code formatting
	npm run format:check

type-check: ## Run TypeScript type checking
	npx tsc --noEmit

quality: lint format-check type-check ## Run all code quality checks
	@echo "$(GREEN)✓ All quality checks passed!$(NC)"

# ============================================
# Build
# ============================================
build: ## Build the project
	npm run build

build-prod: ## Build for production
	NODE_ENV=production npm run build

clean-build: ## Clean and rebuild
	rm -rf dist build .next .nuxt
	npm run build
	@echo "$(GREEN)✓ Clean build complete!$(NC)"

# ============================================
# Docker Commands
# ============================================
docker-build: ## Build Docker images
	$(DOCKER_COMPOSE) build

docker-up: ## Start all services with Docker Compose
	$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)✓ Services started!$(NC)"
	@echo "$(BLUE)Application: http://localhost:3001$(NC)"
	@echo "$(BLUE)API: http://localhost:3001/api$(NC)"

docker-down: ## Stop all Docker services
	$(DOCKER_COMPOSE) down

docker-logs: ## Show Docker logs
	$(DOCKER_COMPOSE) logs -f

docker-clean: ## Remove all containers and volumes
	$(DOCKER_COMPOSE) down -v
	docker system prune -f
	@echo "$(YELLOW)⚠ All containers and volumes removed$(NC)"

docker-dev: ## Run development environment in Docker
	$(DOCKER_COMPOSE) -f docker-compose.dev.yml up -d

docker-shell: ## Open shell in app container
	$(DOCKER_COMPOSE) exec app /bin/sh

# ============================================
# Database (Prisma)
# ============================================
db-generate: ## Generate Prisma client
	npx prisma generate

db-migrate: ## Run database migrations
	npx prisma migrate deploy

db-migrate-dev: ## Create and run migration in development
	npx prisma migrate dev

db-push: ## Push schema changes without migration
	npx prisma db push

db-seed: ## Seed the database
	npx prisma db seed

db-reset: ## Reset database (WARNING: destroys all data)
	npx prisma migrate reset --force
	@echo "$(YELLOW)⚠ Database reset complete$(NC)"

db-studio: ## Open Prisma Studio
	npx prisma studio

# ============================================
# Production & Deployment
# ============================================
deploy: ## Deploy to production
	@echo "$(YELLOW)Starting production deployment...$(NC)"
	npm run build
	$(MAKE) db-migrate
	@echo "$(GREEN)✓ Deployment complete!$(NC)"

deploy-preview: ## Deploy preview build
	npm run build:preview
	@echo "$(GREEN)✓ Preview deployment ready!$(NC)"

start: ## Start production server
	npm start

start-pm2: ## Start with PM2 process manager
	pm2 start ecosystem.config.js

stop-pm2: ## Stop PM2 processes
	pm2 stop all

# ============================================
# Security
# ============================================
audit: ## Run npm security audit
	npm audit

audit-fix: ## Fix security vulnerabilities
	npm audit fix

secrets-scan: ## Scan for secrets in codebase
	npx detect-secrets scan --baseline .secrets.baseline || true

# ============================================
# Monitoring & Health
# ============================================
health: ## Check system health
	@echo "Checking system health..."
	@curl -s http://localhost:3001/api/health | node -e "const d=require('fs').readFileSync(0,'utf-8');console.log(JSON.stringify(JSON.parse(d),null,2))" 2>/dev/null || echo "$(RED)Health check failed$(NC)"

logs: ## Show application logs
	$(DOCKER_COMPOSE) logs -f app

monitor: ## Open monitoring dashboards
	@echo "$(BLUE)Opening monitoring tools...$(NC)"
	@echo "Application: http://localhost:3001"
	@echo "API Docs: http://localhost:3001/api/docs"

# ============================================
# Utilities
# ============================================
clean: ## Clean temporary files and caches
	rm -rf node_modules/.cache
	rm -rf .next
	rm -rf .nuxt
	rm -rf dist
	rm -rf build
	rm -rf coverage
	rm -rf .turbo
	rm -rf *.log
	@echo "$(GREEN)✓ Cleanup complete!$(NC)"

clean-all: clean ## Deep clean including node_modules
	rm -rf node_modules
	rm -rf package-lock.json
	@echo "$(YELLOW)⚠ Full cleanup complete. Run 'make install' to reinstall.$(NC)"

psql: ## Open PostgreSQL shell
	$(DOCKER_COMPOSE) exec postgres psql -U postgres -d screenshot_algo

redis-cli: ## Open Redis CLI
	$(DOCKER_COMPOSE) exec redis redis-cli

# ============================================
# Development Workflow
# ============================================
pr-check: quality test ## Run checks before creating PR
	@echo "$(GREEN)✓ All checks passed! Ready for PR.$(NC)"

setup: install docker-build ## Complete development setup
	@echo "$(GREEN)✓ Development environment fully configured!$(NC)"

restart: docker-down docker-up ## Restart all services
	@echo "$(GREEN)✓ Services restarted!$(NC)"

fresh: clean-all install ## Fresh install from scratch
	@echo "$(GREEN)✓ Fresh installation complete!$(NC)"

# ============================================
# Git Hooks
# ============================================
hooks-install: ## Install git hooks
	npx husky install
	@echo "$(GREEN)✓ Git hooks installed!$(NC)"

hooks-uninstall: ## Uninstall git hooks
	npx husky uninstall
	@echo "$(YELLOW)⚠ Git hooks removed$(NC)"

pre-commit-run: ## Run pre-commit hooks manually
	pre-commit run --all-files

# ============================================
# Documentation
# ============================================
docs: ## Generate documentation
	npm run docs 2>/dev/null || echo "$(YELLOW)No docs script configured$(NC)"

docs-serve: ## Serve documentation locally
	npm run docs:serve 2>/dev/null || echo "$(YELLOW)No docs:serve script configured$(NC)"

# ============================================
# Release Management
# ============================================
version: ## Show current version
	@node -p "require('./package.json').version"

release: pr-check ## Prepare for release
	@echo "$(YELLOW)Preparing release...$(NC)"
	@echo "1. Run: npm version [patch|minor|major]"
	@echo "2. Push tags: git push --tags"
	@echo "3. CI will handle the rest"

changelog: ## Generate changelog
	npx conventional-changelog -p angular -i CHANGELOG.md -s

# ============================================
# Advanced Testing
# ============================================
test-critical: ## Run critical path tests only
	npm test -- --testPathPattern="critical" --bail
	@echo "$(GREEN)✓ Critical tests passed!$(NC)"

test-e2e-ui: ## Run E2E tests with Playwright UI
	npx playwright test --ui

test-e2e-debug: ## Run E2E tests in debug mode
	npx playwright test --debug

# ============================================
# Performance Testing
# ============================================
benchmark: ## Run performance benchmarks
	@echo "$(BLUE)Running benchmarks...$(NC)"
	./scripts/load-test.sh run 2>/dev/null || npm run benchmark 2>/dev/null || echo "$(YELLOW)Configure benchmark script$(NC)"

load-test: ## Run load tests with k6
	@echo "$(BLUE)Running load tests...$(NC)"
	./scripts/load-test.sh 2>/dev/null || k6 run load-test-results/load-test.k6.js 2>/dev/null || echo "$(YELLOW)Install k6 for load testing$(NC)"

lighthouse: ## Run Lighthouse performance audit
	@echo "$(BLUE)Running Lighthouse audit...$(NC)"
	npx lighthouse http://localhost:3001 --output=json --output-path=./lighthouse-report.json 2>/dev/null || echo "$(YELLOW)Start frontend first$(NC)"

# ============================================
# Deployment Checks
# ============================================
deploy-check: ## Run pre-deployment validation
	@echo "$(BLUE)Running deployment checks...$(NC)"
	./scripts/deploy-check.sh 2>/dev/null || $(MAKE) pr-check

smoke-test: ## Run smoke tests
	@echo "$(BLUE)Running smoke tests...$(NC)"
	./scripts/health-check.sh 2>/dev/null || curl -sf http://localhost:3001/api/health || echo "$(RED)Smoke test failed$(NC)"

security-scan: ## Run comprehensive security scan
	@echo "$(BLUE)Running security scan...$(NC)"
	./scripts/security-scan.sh 2>/dev/null || npm audit

# ============================================
# Release Management (Extended)
# ============================================
release-patch: pr-check ## Release patch version (x.x.X)
	npm version patch
	git push --follow-tags
	@echo "$(GREEN)✓ Patch release complete!$(NC)"

release-minor: pr-check ## Release minor version (x.X.x)
	npm version minor
	git push --follow-tags
	@echo "$(GREEN)✓ Minor release complete!$(NC)"

release-major: pr-check ## Release major version (X.x.x)
	npm version major
	git push --follow-tags
	@echo "$(GREEN)✓ Major release complete!$(NC)"

# ============================================
# Validation
# ============================================
validate: validate-env validate-types ## Run all validations
	@echo "$(GREEN)✓ All validations passed!$(NC)"

validate-env: ## Validate environment configuration
	@echo "$(BLUE)Validating environment...$(NC)"
	@test -f .env || (echo "$(RED).env file missing!$(NC)" && exit 1)
	@echo "$(GREEN)✓ Environment valid$(NC)"

validate-types: type-check ## Validate TypeScript types (alias)

# ============================================
# CI/CD Helpers
# ============================================
ci: ci-install ci-lint ci-test ci-build ## Full CI pipeline
	@echo "$(GREEN)✓ CI pipeline complete!$(NC)"

ci-quick: ci-lint type-check ## Quick CI check (no tests)
	@echo "$(GREEN)✓ Quick CI check passed!$(NC)"

ci-install: ## CI optimized install
	npm ci --prefer-offline --no-audit

ci-test: ## CI test suite
	npm test -- --ci --coverage --maxWorkers=2

ci-build: ## CI build
	npm run build

ci-lint: ## CI lint check
	npm run lint -- --max-warnings=0

# ============================================
# Backup & Restore
# ============================================
backup: ## Create database backup
	./scripts/backup.sh 2>/dev/null || echo "$(YELLOW)Configure backup script$(NC)"

restore: ## Restore from backup
	@echo "$(YELLOW)Use: ./scripts/restore.sh <backup-file>$(NC)"

# ============================================
# Info & Status
# ============================================
info: ## Show project information
	@echo "$(BLUE)Project: Screenshot_Algo$(NC)"
	@echo "Node: $(shell node -v)"
	@echo "npm: $(shell npm -v)"
	@echo "Version: $(shell node -p "require('./package.json').version" 2>/dev/null || echo 'N/A')"

status: ## Show system status
	@echo "$(BLUE)Checking system status...$(NC)"
	@docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || echo "Docker not running"
	@echo ""
	$(MAKE) health

.DEFAULT_GOAL := help
