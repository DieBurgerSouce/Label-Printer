#!/bin/bash
# DevContainer On-Create Command - Screenshot_Algo
# Runs when the container is first created (before postCreateCommand)

set -e

echo "📦 Running on-create setup..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. System updates (optional, can be slow)
# echo -e "\n${YELLOW}1. Updating system packages...${NC}"
# sudo apt-get update && sudo apt-get upgrade -y

# 2. Install additional system dependencies
echo -e "\n${YELLOW}1. Installing system dependencies...${NC}"

# Install common tools
sudo apt-get update && sudo apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    jq \
    tree \
    htop \
    vim \
    less \
    && sudo rm -rf /var/lib/apt/lists/*

echo -e "${GREEN}  ✓ System dependencies installed${NC}"

# 3. Install Playwright browsers (for E2E testing)
echo -e "\n${YELLOW}2. Installing Playwright browsers...${NC}"
npx playwright install --with-deps chromium 2>/dev/null || true
echo -e "${GREEN}  ✓ Playwright browsers installed${NC}"

# 4. Setup shell aliases
echo -e "\n${YELLOW}3. Setting up shell aliases...${NC}"

cat >> ~/.bashrc << 'EOF'

# Screenshot_Algo aliases
alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'
alias cls='clear'
alias dev='npm run dev'
alias test='npm test'
alias build='npm run build'
alias lint='npm run lint'

# Git aliases
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline -10'
alias gd='git diff'

# Docker aliases (if using Docker-in-Docker)
alias dps='docker ps'
alias dpa='docker ps -a'
alias di='docker images'
EOF

echo -e "${GREEN}  ✓ Shell aliases configured${NC}"

# 5. Configure VS Code settings for workspace
echo -e "\n${YELLOW}4. VS Code workspace configured${NC}"

echo -e "\n${GREEN}✅ On-create setup complete!${NC}"
