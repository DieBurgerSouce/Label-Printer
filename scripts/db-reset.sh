#!/bin/bash
# Database Reset Script - Screenshot_Algo
# Resets the database to a clean state

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Options
SKIP_SEED="${SKIP_SEED:-false}"
FORCE="${1:-}"

echo -e "${BLUE}🔄 Database Reset - Screenshot_Algo${NC}\n"

# Safety check for production
if [[ "$NODE_ENV" == "production" ]]; then
    echo -e "${RED}❌ Error: Cannot reset production database${NC}"
    echo -e "This command is disabled for production environments."
    exit 1
fi

# Confirmation
if [[ "$FORCE" != "--force" ]] && [[ "$FORCE" != "-f" ]]; then
    echo -e "${RED}⚠ WARNING: This will delete ALL data in the database!${NC}"
    echo -e ""
    echo -e "Database: ${YELLOW}${DATABASE_URL:-not set}${NC}"
    echo -e ""
    read -p "Are you absolutely sure? (type 'RESET' to confirm): " confirm
    if [ "$confirm" != "RESET" ]; then
        echo -e "${YELLOW}Aborted.${NC}"
        exit 0
    fi
fi

echo -e "${YELLOW}1. Stopping dependent services...${NC}"
# Stop any running services that use the database
pkill -f "node.*server" 2>/dev/null || true
echo -e "${GREEN}  ✓ Services stopped${NC}"

echo -e "\n${YELLOW}2. Dropping database...${NC}"
# Using Prisma if available
if [ -f "$PROJECT_ROOT/prisma/schema.prisma" ]; then
    echo -e "  Using Prisma..."
    npx prisma migrate reset --force --skip-seed
else
    # Manual drop (PostgreSQL example)
    if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
        echo -e "  Using psql..."
        # Extract database name from URL
        DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
        psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true
    fi
fi
echo -e "${GREEN}  ✓ Database dropped${NC}"

echo -e "\n${YELLOW}3. Running migrations...${NC}"
if [ -f "$PROJECT_ROOT/prisma/schema.prisma" ]; then
    npx prisma migrate dev --skip-seed
elif [ -d "$PROJECT_ROOT/migrations" ]; then
    npm run migrate
fi
echo -e "${GREEN}  ✓ Migrations applied${NC}"

if [[ "$SKIP_SEED" != "true" ]]; then
    echo -e "\n${YELLOW}4. Seeding database...${NC}"
    "$SCRIPT_DIR/db-seed.sh" default
else
    echo -e "\n${YELLOW}4. Skipping seed (SKIP_SEED=true)${NC}"
fi

echo -e "\n${GREEN}✅ Database reset complete!${NC}"
echo -e ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  • Start the server: ${YELLOW}npm run dev${NC}"
echo -e "  • Run additional seeds: ${YELLOW}./scripts/db-seed.sh [type]${NC}"
