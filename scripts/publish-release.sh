#!/bin/bash
# Release Publishing Script - Screenshot_Algo
# Commits, tags, and pushes a prepared release

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

cd "$PROJECT_ROOT"

echo -e "${BLUE}🚀 Release Publishing - Screenshot_Algo${NC}\n"

# Get current version
VERSION=$(node -p "require('./package.json').version")
echo -e "Publishing version: ${YELLOW}v$VERSION${NC}"

# Check for uncommitted changes
if [[ -z $(git status --porcelain) ]]; then
    echo -e "${YELLOW}⚠ No changes to commit${NC}"
    echo -e "Run ${YELLOW}./scripts/prepare-release.sh${NC} first"
    exit 1
fi

echo -e "\n${YELLOW}1. Reviewing changes...${NC}"
git status --short
echo -e ""
git diff --stat

read -p "Continue with these changes? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted.${NC}"
    exit 0
fi

echo -e "\n${YELLOW}2. Committing changes...${NC}"
git add .
git commit -m "chore(release): v$VERSION

- Version bump to $VERSION
- Updated CHANGELOG.md
- Ready for release

🤖 Generated with [Claude Code](https://claude.com/claude-code)"

echo -e "${GREEN}  ✓ Changes committed${NC}"

echo -e "\n${YELLOW}3. Creating tag...${NC}"
git tag -a "v$VERSION" -m "Release v$VERSION"
echo -e "${GREEN}  ✓ Tag v$VERSION created${NC}"

echo -e "\n${YELLOW}4. Pushing to remote...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Push commits
git push origin "$CURRENT_BRANCH"
echo -e "${GREEN}  ✓ Commits pushed${NC}"

# Push tags
git push origin "v$VERSION"
echo -e "${GREEN}  ✓ Tag pushed${NC}"

echo -e "\n${GREEN}✅ Release v$VERSION published!${NC}"
echo -e ""
echo -e "${BLUE}What happens next:${NC}"
echo -e "  • GitHub Actions will create a release"
echo -e "  • Docker images will be built"
echo -e "  • npm package will be published (if configured)"
echo -e ""
echo -e "${BLUE}Links:${NC}"
echo -e "  • Releases: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/releases"
echo -e "  • Actions: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"
