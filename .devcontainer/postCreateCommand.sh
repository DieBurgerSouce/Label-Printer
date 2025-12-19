#!/bin/bash
# DevContainer Post-Create Command - Screenshot_Algo
# Runs after the container is created

set -e

echo "🚀 Running post-create setup..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Install dependencies
echo -e "\n${YELLOW}1. Installing npm dependencies...${NC}"
npm ci

# 2. Setup Husky hooks
echo -e "\n${YELLOW}2. Setting up Git hooks...${NC}"
npm run prepare 2>/dev/null || npx husky install 2>/dev/null || true

# 3. Generate Prisma client (if using Prisma)
if [ -f "prisma/schema.prisma" ]; then
    echo -e "\n${YELLOW}3. Generating Prisma client...${NC}"
    npx prisma generate
fi

# 4. Copy environment files
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo -e "\n${YELLOW}4. Creating .env file from example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}  ✓ Created .env - please update with your values${NC}"
fi

# 5. Install global tools
echo -e "\n${YELLOW}5. Installing global tools...${NC}"
npm install -g typescript ts-node nodemon

# 6. Setup git config (optional)
echo -e "\n${YELLOW}6. Configuring Git...${NC}"
git config --global init.defaultBranch main
git config --global pull.rebase false

# 7. Create required directories
echo -e "\n${YELLOW}7. Creating directories...${NC}"
mkdir -p logs tmp uploads

# 8. Display welcome message
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉 DevContainer setup complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e ""
echo -e "  ${YELLOW}Quick Start:${NC}"
echo -e "    npm run dev       - Start development server"
echo -e "    npm test          - Run tests"
echo -e "    npm run build     - Build for production"
echo -e ""
echo -e "  ${YELLOW}Useful Commands:${NC}"
echo -e "    make help         - Show all make targets"
echo -e "    npm run lint      - Run linting"
echo -e "    npm run lint:fix  - Fix linting issues"
echo -e ""
echo -e "  ${YELLOW}Documentation:${NC}"
echo -e "    README.md         - Project overview"
echo -e "    ARCHITECTURE.md   - System architecture"
echo -e "    CONTRIBUTING.md   - Contribution guide"
echo -e ""
