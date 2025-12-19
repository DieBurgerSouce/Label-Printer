#!/bin/bash
# Pre-Deployment Validation Script - Screenshot_Algo
# Comprehensive checks before deploying to production

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNINGS=0

# Function to report check result
report_check() {
    local status=$1
    local message=$2

    if [ "$status" == "pass" ]; then
        echo -e "${GREEN}✅ PASS:${NC} $message"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    elif [ "$status" == "fail" ]; then
        echo -e "${RED}❌ FAIL:${NC} $message"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    elif [ "$status" == "warn" ]; then
        echo -e "${YELLOW}⚠️  WARN:${NC} $message"
        CHECKS_WARNINGS=$((CHECKS_WARNINGS + 1))
    fi
}

# Check 1: Git repository is clean
check_git_clean() {
    echo -e "${BLUE}📋 Checking Git repository status...${NC}"

    if [ ! -d ".git" ]; then
        report_check "warn" "Not a Git repository"
        return
    fi

    if [ -z "$(git status --porcelain)" ]; then
        report_check "pass" "Git repository is clean"
    else
        report_check "fail" "Git repository has uncommitted changes"
        git status --short
    fi
}

# Check 2: All tests pass
check_tests() {
    echo -e "${BLUE}🧪 Running tests...${NC}"

    if npm test -- --passWithNoTests > /dev/null 2>&1; then
        report_check "pass" "All tests passed"
    else
        report_check "fail" "Some tests failed"
        echo -e "${YELLOW}   Run 'npm test' for details${NC}"
    fi
}

# Check 3: Code quality (linting)
check_linting() {
    echo -e "${BLUE}🔍 Checking code quality...${NC}"

    if npm run lint > /dev/null 2>&1; then
        report_check "pass" "No linting errors"
    else
        report_check "fail" "Linting errors found"
        echo -e "${YELLOW}   Run 'npm run lint' for details${NC}"
    fi
}

# Check 4: Type checking
check_types() {
    echo -e "${BLUE}🔤 Checking type annotations...${NC}"

    if npx tsc --noEmit > /dev/null 2>&1; then
        report_check "pass" "Type checking passed"
    else
        report_check "fail" "Type checking errors"
        echo -e "${YELLOW}   Run 'npx tsc --noEmit' for details${NC}"
    fi
}

# Check 5: Security scan
check_security() {
    echo -e "${BLUE}🔒 Running security scan...${NC}"

    AUDIT_RESULT=$(npm audit --json 2>/dev/null || echo '{}')
    CRITICAL=$(echo "$AUDIT_RESULT" | jq '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
    HIGH=$(echo "$AUDIT_RESULT" | jq '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")

    if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 5 ]; then
        report_check "fail" "Critical/High security vulnerabilities found"
        echo -e "${YELLOW}   Run 'npm audit' for details${NC}"
    elif [ "$HIGH" -gt 0 ]; then
        report_check "warn" "$HIGH high severity vulnerabilities"
        echo -e "${YELLOW}   Run 'npm audit' for details${NC}"
    else
        report_check "pass" "No critical security issues found"
    fi
}

# Check 6: Build succeeds
check_build() {
    echo -e "${BLUE}🏗️  Checking build...${NC}"

    if npm run build > /dev/null 2>&1; then
        report_check "pass" "Build succeeded"
    else
        report_check "fail" "Build failed"
        echo -e "${YELLOW}   Run 'npm run build' for details${NC}"
    fi
}

# Check 7: Environment variables
check_environment() {
    echo -e "${BLUE}🔧 Checking environment configuration...${NC}"

    if [ ! -f ".env.example" ]; then
        report_check "warn" ".env.example not found"
        return
    fi

    # Check if all required env vars from .env.example are set
    MISSING_VARS=0
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ $line =~ ^#.*$ ]] && continue
        [[ -z "$line" ]] && continue

        VAR_NAME=$(echo "$line" | cut -d= -f1)

        if [ -z "${!VAR_NAME}" ]; then
            MISSING_VARS=$((MISSING_VARS + 1))
        fi
    done < .env.example

    if [ "$MISSING_VARS" -eq 0 ]; then
        report_check "pass" "All required environment variables are set"
    else
        report_check "warn" "$MISSING_VARS environment variable(s) not set"
        echo -e "${YELLOW}   Check .env.example for required variables${NC}"
    fi
}

# Check 8: Docker configuration
check_docker_build() {
    echo -e "${BLUE}🐳 Checking Docker configuration...${NC}"

    if [ -f "docker-compose.yml" ]; then
        if docker-compose -f docker-compose.yml config > /dev/null 2>&1; then
            report_check "pass" "Docker Compose configuration is valid"
        else
            report_check "fail" "Docker Compose configuration has errors"
        fi
    else
        report_check "warn" "docker-compose.yml not found"
    fi
}

# Check 9: Package.json version
check_version() {
    echo -e "${BLUE}📌 Checking version...${NC}"

    if [ -f "package.json" ]; then
        VERSION=$(cat package.json | jq -r '.version' 2>/dev/null || echo "")

        if [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
            report_check "pass" "Version: $VERSION"

            if [[ $VERSION == *"-dev"* ]] || [[ $VERSION == *"-beta"* ]]; then
                report_check "warn" "Deploying pre-release version"
            fi
        else
            report_check "fail" "Invalid version format: $VERSION"
        fi
    else
        report_check "fail" "package.json not found"
    fi
}

# Check 10: Critical files exist
check_critical_files() {
    echo -e "${BLUE}📁 Checking critical files...${NC}"

    CRITICAL_FILES=(
        "package.json"
        "tsconfig.json"
        "docker-compose.yml"
        "Makefile"
        "README.md"
    )

    MISSING_FILES=0
    for file in "${CRITICAL_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            report_check "fail" "Missing critical file: $file"
            MISSING_FILES=$((MISSING_FILES + 1))
        fi
    done

    if [ "$MISSING_FILES" -eq 0 ]; then
        report_check "pass" "All critical files present"
    fi
}

# Check 11: Node.js version
check_node_version() {
    echo -e "${BLUE}📦 Checking Node.js version...${NC}"

    REQUIRED_VERSION="18"
    CURRENT_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)

    if [ "$CURRENT_VERSION" -ge "$REQUIRED_VERSION" ]; then
        report_check "pass" "Node.js version: $(node -v)"
    else
        report_check "fail" "Node.js version $REQUIRED_VERSION+ required, found: $(node -v)"
    fi
}

# Check 12: Dependencies installed
check_dependencies() {
    echo -e "${BLUE}📦 Checking dependencies...${NC}"

    if [ -d "node_modules" ]; then
        report_check "pass" "Dependencies installed"
    else
        report_check "fail" "Dependencies not installed - run 'npm ci'"
    fi
}

# Check 13: Disk space
check_disk_space() {
    echo -e "${BLUE}💽 Checking disk space...${NC}"

    AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
    AVAILABLE_SPACE_GB=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')

    if [ "$AVAILABLE_SPACE_GB" -gt 5 ]; then
        report_check "pass" "Sufficient disk space: $AVAILABLE_SPACE available"
    else
        report_check "warn" "Low disk space: $AVAILABLE_SPACE available"
    fi
}

# Check 14: Network connectivity
check_network() {
    echo -e "${BLUE}🌐 Checking network connectivity...${NC}"

    # Check if we can reach npm registry
    if curl -s --connect-timeout 5 https://registry.npmjs.org > /dev/null 2>&1; then
        report_check "pass" "npm registry reachable"
    else
        report_check "warn" "Cannot reach npm registry"
    fi

    if curl -s --connect-timeout 5 https://hub.docker.com > /dev/null 2>&1; then
        report_check "pass" "Docker Hub reachable"
    else
        report_check "warn" "Cannot reach Docker Hub"
    fi
}

# Generate summary report
generate_summary() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}   Pre-Deployment Check Summary${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo ""
    echo -e "${GREEN}✅ Passed:${NC}   $CHECKS_PASSED"
    echo -e "${YELLOW}⚠️  Warnings:${NC} $CHECKS_WARNINGS"
    echo -e "${RED}❌ Failed:${NC}   $CHECKS_FAILED"
    echo ""

    if [ "$CHECKS_FAILED" -eq 0 ]; then
        if [ "$CHECKS_WARNINGS" -eq 0 ]; then
            echo -e "${GREEN}🎉 All checks passed! Ready to deploy.${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  Deployment possible with warnings.${NC}"
            echo -e "${YELLOW}   Review warnings before proceeding.${NC}"
            return 0
        fi
    else
        echo -e "${RED}❌ Deployment NOT recommended!${NC}"
        echo -e "${RED}   Fix failed checks before deploying.${NC}"
        return 1
    fi
}

# Main script
main() {
    echo -e "${BLUE}🔍 Pre-Deployment Validation Script${NC}"
    echo -e "${BLUE}════════════════════════════════════${NC}"
    echo ""

    # Run all checks
    check_git_clean
    check_node_version
    check_dependencies
    check_tests
    check_linting
    check_types
    check_security
    check_build
    check_environment
    check_docker_build
    check_version
    check_critical_files
    check_disk_space
    check_network

    # Generate summary
    generate_summary
    EXIT_CODE=$?

    # Touch marker file for tracking
    touch .last-deploy-check

    exit $EXIT_CODE
}

# Run main function
main
