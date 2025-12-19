#!/bin/bash
# Monitoring Setup Script - Screenshot_Algo
# Sets up monitoring infrastructure for the project

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 Monitoring Setup - Screenshot_Algo${NC}\n"

ACTION="${1:-help}"

case "$ACTION" in
    "docker")
        echo -e "${YELLOW}Setting up monitoring stack with Docker...${NC}\n"

        # Create monitoring network
        docker network create monitoring 2>/dev/null || true

        # Prometheus
        echo -e "${YELLOW}1. Starting Prometheus...${NC}"
        docker run -d \
            --name prometheus \
            --network monitoring \
            -p 9090:9090 \
            -v "$(pwd)/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml" \
            prom/prometheus:latest 2>/dev/null || echo "Prometheus already running"
        echo -e "${GREEN}  ✓ Prometheus running on http://localhost:9090${NC}"

        # Grafana
        echo -e "\n${YELLOW}2. Starting Grafana...${NC}"
        docker run -d \
            --name grafana \
            --network monitoring \
            -p 3001:3000 \
            -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
            grafana/grafana:latest 2>/dev/null || echo "Grafana already running"
        echo -e "${GREEN}  ✓ Grafana running on http://localhost:3001 (admin/admin)${NC}"

        # Loki (Log aggregation)
        echo -e "\n${YELLOW}3. Starting Loki...${NC}"
        docker run -d \
            --name loki \
            --network monitoring \
            -p 3100:3100 \
            grafana/loki:latest 2>/dev/null || echo "Loki already running"
        echo -e "${GREEN}  ✓ Loki running on http://localhost:3100${NC}"

        echo -e "\n${GREEN}✅ Monitoring stack is running!${NC}"
        echo -e ""
        echo -e "${BLUE}Access URLs:${NC}"
        echo -e "  • Prometheus: http://localhost:9090"
        echo -e "  • Grafana:    http://localhost:3001"
        echo -e "  • Loki:       http://localhost:3100"
        ;;

    "stop")
        echo -e "${YELLOW}Stopping monitoring stack...${NC}"
        docker stop prometheus grafana loki 2>/dev/null || true
        docker rm prometheus grafana loki 2>/dev/null || true
        echo -e "${GREEN}✓ Monitoring stack stopped${NC}"
        ;;

    "status")
        echo -e "${YELLOW}Monitoring Stack Status:${NC}\n"
        docker ps --filter "name=prometheus" --filter "name=grafana" --filter "name=loki" \
            --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;

    "local")
        echo -e "${YELLOW}Setting up local monitoring...${NC}\n"

        # Install prom-client for Node.js
        npm install prom-client --save

        # Create metrics endpoint
        mkdir -p src/api/routes

        cat > src/api/routes/metrics.ts << 'EOF'
import { Router } from 'express';
import { collectDefaultMetrics, Registry, Counter, Histogram } from 'prom-client';

const router = Router();
const register = new Registry();

// Collect default metrics
collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const screenshotCounter = new Counter({
  name: 'screenshots_total',
  help: 'Total number of screenshots captured',
  labelNames: ['format', 'status'],
  registers: [register],
});

export const screenshotDuration = new Histogram({
  name: 'screenshot_duration_seconds',
  help: 'Duration of screenshot captures in seconds',
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
EOF

        echo -e "${GREEN}✓ Metrics endpoint created at src/api/routes/metrics.ts${NC}"
        echo -e ""
        echo -e "${BLUE}Add to your Express app:${NC}"
        echo -e "  import metricsRouter from './routes/metrics';"
        echo -e "  app.use(metricsRouter);"
        ;;

    *)
        echo -e "${BLUE}Monitoring Setup Script${NC}"
        echo -e ""
        echo -e "${YELLOW}Usage:${NC} $0 [command]"
        echo -e ""
        echo -e "${YELLOW}Commands:${NC}"
        echo -e "  ${BLUE}docker${NC}  - Start monitoring stack (Prometheus, Grafana, Loki)"
        echo -e "  ${BLUE}stop${NC}    - Stop monitoring stack"
        echo -e "  ${BLUE}status${NC}  - Show status of monitoring containers"
        echo -e "  ${BLUE}local${NC}   - Set up local metrics endpoint"
        ;;
esac
