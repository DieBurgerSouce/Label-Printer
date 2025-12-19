#!/bin/bash
# Git Hooks Setup Script - Screenshot_Algo
# Installs and configures git hooks for the project

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Setting up Git Hooks for Screenshot_Algo${NC}\n"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Error: npm is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}1. Installing Husky...${NC}"
npm install husky --save-dev

echo -e "\n${YELLOW}2. Initializing Husky...${NC}"
npx husky install

echo -e "\n${YELLOW}3. Installing commit helpers...${NC}"
npm install --save-dev @commitlint/cli @commitlint/config-conventional lint-staged

echo -e "\n${YELLOW}4. Configuring git hooks...${NC}"

# Pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged" 2>/dev/null || true
echo -e "${GREEN}  ✓ Pre-commit hook configured${NC}"

# Commit-msg hook
npx husky add .husky/commit-msg "npx --no -- commitlint --edit \$1" 2>/dev/null || true
echo -e "${GREEN}  ✓ Commit-msg hook configured${NC}"

# Pre-push hook (optional)
cat > .husky/pre-push << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🚀 Running pre-push checks..."

# Run tests
npm test -- --passWithNoTests

# Run type checking
npx tsc --noEmit

echo "✅ Pre-push checks passed!"
EOF
chmod +x .husky/pre-push
echo -e "${GREEN}  ✓ Pre-push hook configured${NC}"

echo -e "\n${YELLOW}5. Adding npm script...${NC}"
# Check if "prepare" script exists and add husky install
if grep -q '"prepare"' package.json; then
    echo -e "${YELLOW}  ⚠ 'prepare' script already exists in package.json${NC}"
else
    npm pkg set scripts.prepare="husky install"
    echo -e "${GREEN}  ✓ Added 'prepare' script to package.json${NC}"
fi

echo -e "\n${GREEN}✅ Git hooks setup complete!${NC}"
echo -e ""
echo -e "${BLUE}Installed hooks:${NC}"
echo -e "  • ${YELLOW}pre-commit${NC}: Runs lint-staged (ESLint, Prettier)"
echo -e "  • ${YELLOW}commit-msg${NC}: Validates commit messages (Conventional Commits)"
echo -e "  • ${YELLOW}pre-push${NC}: Runs tests and type checking"
echo -e ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Ensure commitlint.config.js exists"
echo -e "  2. Ensure lint-staged.config.js exists"
echo -e "  3. Try a commit: ${YELLOW}git commit -m \"feat: test hooks\"${NC}"
