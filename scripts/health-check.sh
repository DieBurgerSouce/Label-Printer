#!/bin/bash
# Health Check Script - Screenshot_Algo
# Comprehensive system health verification

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:4000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

echo -e "${BLUE}🏥 Health Check Script${NC}"
echo -e "${BLUE}══════════════════════${NC}"
echo ""

# Check API health
echo -e "${BLUE}🔍 Checking API health...${NC}"
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")

if [ "$API_RESPONSE" == "200" ]; then
    echo -e "${GREEN}✅ API is healthy ($API_URL)${NC}"

    # Get detailed health info
    HEALTH_DATA=$(curl -s "$API_URL/health" 2>/dev/null || echo "{}")
    echo -e "   Response: $HEALTH_DATA"
else
    echo -e "${RED}❌ API is not responding (HTTP $API_RESPONSE)${NC}"
fi

# Check Frontend
echo ""
echo -e "${BLUE}🔍 Checking Frontend...${NC}"
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")

if [ "$FRONTEND_RESPONSE" == "200" ]; then
    echo -e "${GREEN}✅ Frontend is accessible ($FRONTEND_URL)${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend not accessible (HTTP $FRONTEND_RESPONSE)${NC}"
fi

# Check PostgreSQL
echo ""
echo -e "${BLUE}🔍 Checking PostgreSQL...${NC}"
if command -v pg_isready &> /dev/null; then
    if pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is running${NC}"
    else
        echo -e "${RED}❌ PostgreSQL is not running${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  pg_isready not available${NC}"
fi

# Check Redis
echo ""
echo -e "${BLUE}🔍 Checking Redis...${NC}"
if command -v redis-cli &> /dev/null; then
    if redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis is not responding${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  redis-cli not available${NC}"
fi

# Check Docker containers
echo ""
echo -e "${BLUE}🔍 Checking Docker containers...${NC}"
if command -v docker &> /dev/null; then
    RUNNING_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null | grep -E "screenshot|api|frontend|postgres|redis" || true)

    if [ -n "$RUNNING_CONTAINERS" ]; then
        echo -e "${GREEN}✅ Docker containers running:${NC}"
        echo "$RUNNING_CONTAINERS" | while read container; do
            echo -e "   - $container"
        done
    else
        echo -e "${YELLOW}⚠️  No relevant Docker containers running${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker not available${NC}"
fi

# Check disk space
echo ""
echo -e "${BLUE}🔍 Checking disk space...${NC}"
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
DISK_AVAILABLE=$(df -h . | awk 'NR==2 {print $4}')

if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✅ Disk space OK: $DISK_AVAILABLE available ($DISK_USAGE% used)${NC}"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠️  Disk space warning: $DISK_AVAILABLE available ($DISK_USAGE% used)${NC}"
else
    echo -e "${RED}❌ Disk space critical: $DISK_AVAILABLE available ($DISK_USAGE% used)${NC}"
fi

# Check memory
echo ""
echo -e "${BLUE}🔍 Checking memory...${NC}"
if command -v free &> /dev/null; then
    MEM_TOTAL=$(free -h | awk '/^Mem:/ {print $2}')
    MEM_USED=$(free -h | awk '/^Mem:/ {print $3}')
    MEM_AVAILABLE=$(free -h | awk '/^Mem:/ {print $7}')
    echo -e "${GREEN}✅ Memory: $MEM_USED used / $MEM_TOTAL total ($MEM_AVAILABLE available)${NC}"
else
    echo -e "${YELLOW}⚠️  free command not available${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}   Health Check Complete${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
