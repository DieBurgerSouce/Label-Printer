# Deployment Guide

Complete deployment documentation for Screenshot_Algo.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Deployment Options](#deployment-options)
- [Production Checklist](#production-checklist)
- [Monitoring](#monitoring)
- [Rollback](#rollback)

## Prerequisites

### Required Services

- **Node.js** 20+ LTS
- **PostgreSQL** 16+
- **Redis** 7+
- **Docker** & Docker Compose (optional)

### Required Tools

```bash
# Verify installations
node --version    # v20.x.x
npm --version     # 10.x.x
docker --version  # 24.x.x
```

## Environment Setup

### Environment Variables

Create `.env` from template:

```bash
cp .env.example .env
```

Required variables:

```bash
# Application
NODE_ENV=production
PORT=4000
API_URL=https://api.example.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/screenshot_algo

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
API_KEY=your-api-key

# Optional
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Option 2: Manual Deployment

```bash
# Install dependencies
npm ci --production

# Build application
npm run build

# Run database migrations
npx prisma migrate deploy

# Start application
npm start
```

### Option 3: PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

## Production Checklist

### Pre-Deployment

- [ ] All tests pass (`npm test`)
- [ ] Linting clean (`npm run lint`)
- [ ] Type checking clean (`npm run type-check`)
- [ ] Security audit clean (`npm audit`)
- [ ] Environment variables set
- [ ] Database migrations ready
- [ ] SSL certificates valid

### Deployment

- [ ] Build successful
- [ ] Database migrations applied
- [ ] Health check passing
- [ ] Logs accessible
- [ ] Monitoring active

### Post-Deployment

- [ ] Smoke tests passing
- [ ] Performance acceptable
- [ ] Error rates normal
- [ ] Alerts configured

## Health Checks

### Endpoints

```bash
# Health check
curl https://api.example.com/health

# Readiness
curl https://api.example.com/ready

# Liveness
curl https://api.example.com/live
```

### Expected Response

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

## Monitoring

### Metrics

- Response time (p50, p95, p99)
- Error rate
- Request throughput
- CPU/Memory usage
- Database connections

### Logging

```bash
# View application logs
docker-compose logs -f app

# View all logs
docker-compose logs -f
```

### Alerts

Configure alerts for:

- Error rate > 1%
- Response time p95 > 500ms
- CPU usage > 80%
- Memory usage > 85%
- Disk space < 10GB

## Rollback

### Quick Rollback

```bash
# Stop current deployment
docker-compose down

# Deploy previous version
git checkout v1.0.0
docker-compose up -d
```

### Database Rollback

```bash
# Revert last migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

## Troubleshooting

### Common Issues

**Application won't start**
```bash
# Check logs
docker-compose logs app

# Verify environment
docker-compose exec app env | grep DATABASE
```

**Database connection failed**
```bash
# Test connection
docker-compose exec app npx prisma db pull

# Check network
docker network ls
```

**Redis connection failed**
```bash
# Test Redis
docker-compose exec redis redis-cli ping
```

## Security Considerations

- Use HTTPS in production
- Set secure headers (HSTS, CSP, etc.)
- Enable rate limiting
- Use secrets management
- Regular security updates
- Rotate credentials regularly

---

For issues, check logs first, then open a GitHub issue.
