#!/bin/bash
# Database Backup Script - Screenshot_Algo
# Automated backup for PostgreSQL database

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${RETENTION_DAYS:-7}

# Database connection (from environment or defaults)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-screenshot_algo}"
DB_USER="${DB_USER:-postgres}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}💾 Database Backup Script${NC}"
echo -e "${BLUE}═════════════════════════${NC}"
echo ""

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}❌ pg_dump not found. Install PostgreSQL client tools.${NC}"
    exit 1
fi

# Check database connectivity
echo -e "${BLUE}🔍 Checking database connectivity...${NC}"
if PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database is accessible${NC}"
else
    echo -e "${RED}❌ Cannot connect to database${NC}"
    exit 1
fi

# Create backup filename
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

# Perform backup
echo -e "${BLUE}📦 Creating backup...${NC}"
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="$BACKUP_FILE" \
    2>&1 | while read line; do echo -e "   $line"; done

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup created: $BACKUP_FILE ($BACKUP_SIZE)${NC}"
else
    echo -e "${RED}❌ Backup failed${NC}"
    exit 1
fi

# Clean old backups
echo -e "${BLUE}🧹 Cleaning backups older than $RETENTION_DAYS days...${NC}"
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# List recent backups
echo ""
echo -e "${BLUE}📋 Recent backups:${NC}"
ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -5 || echo "   No backups found"

echo ""
echo -e "${GREEN}✅ Backup complete!${NC}"
