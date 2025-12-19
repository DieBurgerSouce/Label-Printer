#!/bin/bash
# Release Preparation Script - Screenshot_Algo
# Prepares the project for a new release

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

echo -e "${BLUE}📦 Release Preparation - Screenshot_Algo${NC}\n"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC}"

# Get release type from argument or prompt
RELEASE_TYPE="${1:-}"
if [ -z "$RELEASE_TYPE" ]; then
    echo -e ""
    echo -e "Release types:"
    echo -e "  ${YELLOW}patch${NC} - Bug fixes (1.0.0 → 1.0.1)"
    echo -e "  ${YELLOW}minor${NC} - New features (1.0.0 → 1.1.0)"
    echo -e "  ${YELLOW}major${NC} - Breaking changes (1.0.0 → 2.0.0)"
    echo -e ""
    read -p "Select release type [patch/minor/major]: " RELEASE_TYPE
fi

# Validate release type
if [[ ! "$RELEASE_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}❌ Invalid release type: $RELEASE_TYPE${NC}"
    exit 1
fi

echo -e "\n${YELLOW}1. Checking prerequisites...${NC}"

# Check for clean working directory
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}❌ Working directory is not clean${NC}"
    echo -e "Please commit or stash your changes first."
    git status --short
    exit 1
fi
echo -e "${GREEN}  ✓ Working directory is clean${NC}"

# Check we're on main/develop branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]] && [[ "$CURRENT_BRANCH" != "develop" ]]; then
    echo -e "${YELLOW}  ⚠ Not on main/develop branch (current: $CURRENT_BRANCH)${NC}"
    read -p "Continue anyway? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        exit 0
    fi
else
    echo -e "${GREEN}  ✓ On $CURRENT_BRANCH branch${NC}"
fi

# Pull latest changes
echo -e "${GREEN}  ✓ Pulling latest changes...${NC}"
git pull origin "$CURRENT_BRANCH"

echo -e "\n${YELLOW}2. Running quality checks...${NC}"

# Run linting
echo -e "  Running lint..."
npm run lint || { echo -e "${RED}❌ Linting failed${NC}"; exit 1; }
echo -e "${GREEN}  ✓ Linting passed${NC}"

# Run type checking
echo -e "  Running type check..."
npx tsc --noEmit || { echo -e "${RED}❌ Type check failed${NC}"; exit 1; }
echo -e "${GREEN}  ✓ Type check passed${NC}"

# Run tests
echo -e "  Running tests..."
npm test || { echo -e "${RED}❌ Tests failed${NC}"; exit 1; }
echo -e "${GREEN}  ✓ Tests passed${NC}"

# Build project
echo -e "  Building project..."
npm run build || { echo -e "${RED}❌ Build failed${NC}"; exit 1; }
echo -e "${GREEN}  ✓ Build successful${NC}"

echo -e "\n${YELLOW}3. Checking dependencies...${NC}"

# Check for security vulnerabilities
echo -e "  Running security audit..."
npm audit --audit-level=high || {
    echo -e "${YELLOW}  ⚠ Security vulnerabilities found${NC}"
    read -p "Continue anyway? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        exit 1
    fi
}
echo -e "${GREEN}  ✓ Security audit passed${NC}"

# Check for outdated dependencies
echo -e "  Checking outdated dependencies..."
npm outdated || true

echo -e "\n${YELLOW}4. Updating version...${NC}"

# Calculate new version
NEW_VERSION=$(npm version "$RELEASE_TYPE" --no-git-tag-version)
echo -e "${GREEN}  ✓ Version updated: $CURRENT_VERSION → $NEW_VERSION${NC}"

echo -e "\n${YELLOW}5. Generating changelog...${NC}"

# Generate changelog if conventional-changelog is available
if command -v npx &> /dev/null; then
    npx conventional-changelog -p angular -i CHANGELOG.md -s 2>/dev/null || {
        echo -e "${YELLOW}  ⚠ conventional-changelog not available${NC}"
    }
fi
echo -e "${GREEN}  ✓ Changelog updated${NC}"

echo -e "\n${GREEN}✅ Release preparation complete!${NC}"
echo -e ""
echo -e "${BLUE}Summary:${NC}"
echo -e "  • Version: ${YELLOW}$CURRENT_VERSION → $NEW_VERSION${NC}"
echo -e "  • Type: ${YELLOW}$RELEASE_TYPE${NC}"
echo -e ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Review changes: ${YELLOW}git diff${NC}"
echo -e "  2. Review CHANGELOG.md"
echo -e "  3. Commit: ${YELLOW}git add . && git commit -m \"chore(release): $NEW_VERSION\"${NC}"
echo -e "  4. Tag: ${YELLOW}git tag -a v$NEW_VERSION -m \"Release $NEW_VERSION\"${NC}"
echo -e "  5. Push: ${YELLOW}git push origin $CURRENT_BRANCH --tags${NC}"
echo -e ""
echo -e "Or run: ${YELLOW}./scripts/publish-release.sh${NC}"
