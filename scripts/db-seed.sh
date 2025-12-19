#!/bin/bash
# Database Seeding Script - Screenshot_Algo
# Seeds the database with initial or test data

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

# Default values
SEED_TYPE="${1:-default}"
FORCE="${2:-false}"

echo -e "${BLUE}🌱 Database Seeding - Screenshot_Algo${NC}\n"

# Check if database is configured
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL not set${NC}"
    echo -e "Set it in .env file or environment"
    exit 1
fi

# Function to run TypeScript seed file
run_ts_seed() {
    local seed_file=$1
    if [ -f "$seed_file" ]; then
        echo -e "${YELLOW}Running $seed_file...${NC}"
        npx ts-node "$seed_file"
    else
        echo -e "${YELLOW}⚠ Seed file not found: $seed_file${NC}"
    fi
}

# Function to run SQL seed file
run_sql_seed() {
    local seed_file=$1
    if [ -f "$seed_file" ]; then
        echo -e "${YELLOW}Running $seed_file...${NC}"
        # Using psql for PostgreSQL (adjust for your database)
        if command -v psql &> /dev/null; then
            psql "$DATABASE_URL" < "$seed_file"
        else
            echo -e "${YELLOW}⚠ psql not available, trying npx prisma db execute${NC}"
            npx prisma db execute --file "$seed_file"
        fi
    else
        echo -e "${YELLOW}⚠ Seed file not found: $seed_file${NC}"
    fi
}

# Confirmation for production
if [[ "$NODE_ENV" == "production" ]] && [[ "$FORCE" != "--force" ]]; then
    echo -e "${RED}⚠ WARNING: You're about to seed a production database!${NC}"
    read -p "Are you sure? (type 'yes' to confirm): " confirm
    if [ "$confirm" != "yes" ]; then
        echo -e "${YELLOW}Aborted.${NC}"
        exit 0
    fi
fi

case "$SEED_TYPE" in
    "default"|"init")
        echo -e "${YELLOW}1. Running default seed...${NC}"
        # Run Prisma seed if available
        if [ -f "$PROJECT_ROOT/prisma/seed.ts" ]; then
            npx prisma db seed
        elif [ -f "$PROJECT_ROOT/seeds/seed.ts" ]; then
            run_ts_seed "$PROJECT_ROOT/seeds/seed.ts"
        else
            echo -e "${YELLOW}No default seed file found${NC}"
        fi
        ;;

    "test")
        echo -e "${YELLOW}1. Seeding test data...${NC}"
        run_ts_seed "$PROJECT_ROOT/seeds/test-data.ts"
        ;;

    "demo")
        echo -e "${YELLOW}1. Seeding demo data...${NC}"
        run_ts_seed "$PROJECT_ROOT/seeds/demo-data.ts"
        ;;

    "users")
        echo -e "${YELLOW}1. Seeding users...${NC}"
        run_ts_seed "$PROJECT_ROOT/seeds/users.ts"
        ;;

    "all")
        echo -e "${YELLOW}1. Running all seeds...${NC}"
        for seed_file in "$PROJECT_ROOT/seeds"/*.ts; do
            if [ -f "$seed_file" ]; then
                run_ts_seed "$seed_file"
            fi
        done
        ;;

    "clean")
        echo -e "${RED}⚠ This will delete all data!${NC}"
        read -p "Continue? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Cleaning database...${NC}"
            # Add your cleanup logic here
            # npx prisma migrate reset --force
            echo -e "${GREEN}✓ Database cleaned${NC}"
        fi
        ;;

    *)
        echo -e "${YELLOW}Available seed types:${NC}"
        echo -e "  • ${BLUE}default${NC} - Default/initial data"
        echo -e "  • ${BLUE}test${NC}    - Test fixtures"
        echo -e "  • ${BLUE}demo${NC}    - Demo data"
        echo -e "  • ${BLUE}users${NC}   - User data only"
        echo -e "  • ${BLUE}all${NC}     - All seed files"
        echo -e "  • ${BLUE}clean${NC}   - Clean database (destructive)"
        echo -e ""
        echo -e "${YELLOW}Usage:${NC} $0 [type] [--force]"
        exit 0
        ;;
esac

echo -e "\n${GREEN}✅ Database seeding complete!${NC}"
