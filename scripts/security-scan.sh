#!/bin/bash
# Security Scanning Script - Screenshot_Algo
# Comprehensive security analysis for Node.js/TypeScript projects

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPORTS_DIR="security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Ensure reports directory exists
mkdir -p "$REPORTS_DIR"

# Tracking variables
ISSUES_CRITICAL=0
ISSUES_HIGH=0
ISSUES_MEDIUM=0
ISSUES_LOW=0

# Function to check dependencies
check_dependencies() {
    echo -e "${BLUE}🔍 Checking security tools...${NC}"

    TOOLS_AVAILABLE=()
    TOOLS_MISSING=()

    # Check npm audit (built-in)
    if command -v npm &> /dev/null; then
        TOOLS_AVAILABLE+=("npm-audit")
    else
        TOOLS_MISSING+=("npm")
    fi

    # Check Snyk (optional)
    if command -v snyk &> /dev/null; then
        TOOLS_AVAILABLE+=("snyk")
    else
        TOOLS_MISSING+=("snyk")
    fi

    # Check ESLint security plugin
    if npm list eslint-plugin-security > /dev/null 2>&1; then
        TOOLS_AVAILABLE+=("eslint-security")
    fi

    # Check Trivy (container/dependency scanner)
    if command -v trivy &> /dev/null; then
        TOOLS_AVAILABLE+=("trivy")
    else
        TOOLS_MISSING+=("trivy")
    fi

    # Check detect-secrets
    if command -v detect-secrets &> /dev/null; then
        TOOLS_AVAILABLE+=("detect-secrets")
    else
        TOOLS_MISSING+=("detect-secrets")
    fi

    # Display results
    if [ ${#TOOLS_AVAILABLE[@]} -gt 0 ]; then
        echo -e "${GREEN}✅ Available tools: ${TOOLS_AVAILABLE[*]}${NC}"
    fi

    if [ ${#TOOLS_MISSING[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Optional tools not installed: ${TOOLS_MISSING[*]}${NC}"
        echo -e "${BLUE}   Install with:${NC}"
        echo -e "     npm install -g snyk"
        echo -e "     brew install trivy  (or download from https://trivy.dev)"
        echo -e "     pip install detect-secrets"
    fi
}

# Function to run npm audit
run_npm_audit() {
    echo -e "${BLUE}🛡️  Running npm audit...${NC}"

    NPM_AUDIT_REPORT="$REPORTS_DIR/npm-audit-$TIMESTAMP.json"

    # Run npm audit
    npm audit --json > "$NPM_AUDIT_REPORT" 2>/dev/null || true

    # Parse results
    if [ -f "$NPM_AUDIT_REPORT" ]; then
        CRITICAL=$(cat "$NPM_AUDIT_REPORT" | jq '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
        HIGH=$(cat "$NPM_AUDIT_REPORT" | jq '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
        MEDIUM=$(cat "$NPM_AUDIT_REPORT" | jq '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")
        LOW=$(cat "$NPM_AUDIT_REPORT" | jq '.metadata.vulnerabilities.low // 0' 2>/dev/null || echo "0")

        ISSUES_CRITICAL=$((ISSUES_CRITICAL + CRITICAL))
        ISSUES_HIGH=$((ISSUES_HIGH + HIGH))
        ISSUES_MEDIUM=$((ISSUES_MEDIUM + MEDIUM))
        ISSUES_LOW=$((ISSUES_LOW + LOW))

        echo -e "${GREEN}✅ npm audit complete${NC}"
        echo -e "   Critical: $CRITICAL issues"
        echo -e "   High:     $HIGH issues"
        echo -e "   Medium:   $MEDIUM issues"
        echo -e "   Low:      $LOW issues"
        echo -e "   Report: $NPM_AUDIT_REPORT"
    fi
}

# Function to run Snyk scan
run_snyk() {
    if ! command -v snyk &> /dev/null; then
        return
    fi

    echo -e "${BLUE}🔒 Running Snyk security scan...${NC}"

    SNYK_REPORT="$REPORTS_DIR/snyk-$TIMESTAMP.json"

    # Run Snyk
    snyk test --json > "$SNYK_REPORT" 2>/dev/null || true

    # Parse results
    if [ -f "$SNYK_REPORT" ]; then
        HIGH=$(cat "$SNYK_REPORT" | jq '[.vulnerabilities[] | select(.severity == "high")] | length' 2>/dev/null || echo "0")
        MEDIUM=$(cat "$SNYK_REPORT" | jq '[.vulnerabilities[] | select(.severity == "medium")] | length' 2>/dev/null || echo "0")

        ISSUES_HIGH=$((ISSUES_HIGH + HIGH))
        ISSUES_MEDIUM=$((ISSUES_MEDIUM + MEDIUM))

        echo -e "${GREEN}✅ Snyk scan complete${NC}"
        echo -e "   High:   $HIGH issues"
        echo -e "   Medium: $MEDIUM issues"
        echo -e "   Report: $SNYK_REPORT"
    fi
}

# Function to run Trivy scan
run_trivy() {
    if ! command -v trivy &> /dev/null; then
        return
    fi

    echo -e "${BLUE}🔍 Running Trivy security scan...${NC}"

    TRIVY_REPORT="$REPORTS_DIR/trivy-$TIMESTAMP.json"

    # Scan filesystem
    trivy fs . \
        --format json \
        --output "$TRIVY_REPORT" \
        --severity HIGH,CRITICAL \
        --scanners vuln,config,secret \
        || true

    # Parse results
    if [ -f "$TRIVY_REPORT" ]; then
        CRITICAL=$(cat "$TRIVY_REPORT" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' 2>/dev/null || echo "0")
        HIGH=$(cat "$TRIVY_REPORT" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' 2>/dev/null || echo "0")

        ISSUES_CRITICAL=$((ISSUES_CRITICAL + CRITICAL))
        ISSUES_HIGH=$((ISSUES_HIGH + HIGH))

        echo -e "${GREEN}✅ Trivy scan complete${NC}"
        echo -e "   Critical: $CRITICAL issues"
        echo -e "   High:     $HIGH issues"
        echo -e "   Report: $TRIVY_REPORT"
    fi
}

# Function to run ESLint security checks
run_eslint_security() {
    echo -e "${BLUE}🔎 Running ESLint security checks...${NC}"

    ESLINT_REPORT="$REPORTS_DIR/eslint-security-$TIMESTAMP.json"

    # Run ESLint with security focus
    npx eslint . \
        --ext .js,.jsx,.ts,.tsx \
        --format json \
        --output-file "$ESLINT_REPORT" \
        --rule 'no-eval: error' \
        --rule 'no-implied-eval: error' \
        --rule 'no-new-func: error' \
        2>/dev/null || true

    if [ -f "$ESLINT_REPORT" ]; then
        ERRORS=$(cat "$ESLINT_REPORT" | jq '[.[] | .errorCount] | add // 0' 2>/dev/null || echo "0")

        if [ "$ERRORS" -gt 0 ]; then
            ISSUES_HIGH=$((ISSUES_HIGH + ERRORS))
            echo -e "${YELLOW}⚠️  Found $ERRORS ESLint security issues${NC}"
        else
            echo -e "${GREEN}✅ No ESLint security issues found${NC}"
        fi
    fi
}

# Function to check for hardcoded secrets
check_secrets() {
    echo -e "${BLUE}🔐 Checking for hardcoded secrets...${NC}"

    # Common secret patterns
    PATTERNS=(
        "password\s*[:=]\s*['\"][^'\"]{8,}"
        "api[_-]?key\s*[:=]\s*['\"][^'\"]{16,}"
        "secret[_-]?key\s*[:=]\s*['\"][^'\"]{16,}"
        "token\s*[:=]\s*['\"][^'\"]{16,}"
        "aws[_-]?access[_-]?key"
        "-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----"
        "sk_live_[a-zA-Z0-9]+"
        "pk_live_[a-zA-Z0-9]+"
    )

    SECRETS_FOUND=0

    for pattern in "${PATTERNS[@]}"; do
        MATCHES=$(grep -r -i -E "$pattern" backend/ frontend/ 2>/dev/null | grep -v "node_modules" | grep -v ".test." | wc -l)
        SECRETS_FOUND=$((SECRETS_FOUND + MATCHES))
    done

    if [ "$SECRETS_FOUND" -gt 0 ]; then
        echo -e "${RED}❌ Found $SECRETS_FOUND potential hardcoded secrets${NC}"
        ISSUES_HIGH=$((ISSUES_HIGH + SECRETS_FOUND))
    else
        echo -e "${GREEN}✅ No hardcoded secrets detected${NC}"
    fi
}

# Function to check TypeScript strict mode
check_typescript_security() {
    echo -e "${BLUE}📝 Checking TypeScript security configuration...${NC}"

    if [ -f "tsconfig.json" ]; then
        STRICT=$(cat tsconfig.json | jq '.compilerOptions.strict // false' 2>/dev/null || echo "false")
        NO_IMPLICIT_ANY=$(cat tsconfig.json | jq '.compilerOptions.noImplicitAny // false' 2>/dev/null || echo "false")

        if [ "$STRICT" == "true" ]; then
            echo -e "${GREEN}✅ TypeScript strict mode enabled${NC}"
        else
            echo -e "${YELLOW}⚠️  TypeScript strict mode not enabled${NC}"
            ISSUES_MEDIUM=$((ISSUES_MEDIUM + 1))
        fi
    else
        echo -e "${YELLOW}⚠️  tsconfig.json not found${NC}"
    fi
}

# Function to check Docker security
check_docker_security() {
    echo -e "${BLUE}🐳 Checking Docker security...${NC}"

    if [ ! -f "docker-compose.yml" ]; then
        echo -e "${YELLOW}⚠️  docker-compose.yml not found${NC}"
        return
    fi

    # Check for running as root
    if grep -q "user: root" docker-compose.yml; then
        echo -e "${YELLOW}⚠️  Containers running as root detected${NC}"
        ISSUES_MEDIUM=$((ISSUES_MEDIUM + 1))
    fi

    # Check for privileged mode
    if grep -q "privileged: true" docker-compose.yml; then
        echo -e "${RED}❌ Privileged containers detected${NC}"
        ISSUES_HIGH=$((ISSUES_HIGH + 1))
    fi

    # Check for host network mode
    if grep -q "network_mode: host" docker-compose.yml; then
        echo -e "${YELLOW}⚠️  Host network mode detected${NC}"
        ISSUES_MEDIUM=$((ISSUES_MEDIUM + 1))
    fi

    echo -e "${GREEN}✅ Docker security check complete${NC}"
}

# Function to check package.json for suspicious scripts
check_package_scripts() {
    echo -e "${BLUE}📦 Checking package.json scripts...${NC}"

    if [ -f "package.json" ]; then
        # Check for potentially dangerous commands
        DANGEROUS=$(cat package.json | jq '.scripts | to_entries[] | select(.value | test("curl|wget|rm -rf|eval|exec")) | .key' 2>/dev/null)

        if [ -n "$DANGEROUS" ]; then
            echo -e "${YELLOW}⚠️  Potentially dangerous scripts found: $DANGEROUS${NC}"
            ISSUES_MEDIUM=$((ISSUES_MEDIUM + 1))
        else
            echo -e "${GREEN}✅ No suspicious scripts detected${NC}"
        fi
    fi
}

# Function to generate summary report
generate_summary() {
    SUMMARY_FILE="$REPORTS_DIR/security-summary-$TIMESTAMP.txt"

    cat > "$SUMMARY_FILE" <<EOF
═══════════════════════════════════════════════════
   Screenshot_Algo - Security Scan Summary
═══════════════════════════════════════════════════

Scan Date: $(date)

ISSUES BY SEVERITY:
  🔴 Critical: $ISSUES_CRITICAL
  🟠 High:     $ISSUES_HIGH
  🟡 Medium:   $ISSUES_MEDIUM
  ⚪ Low:      $ISSUES_LOW

TOTAL ISSUES: $((ISSUES_CRITICAL + ISSUES_HIGH + ISSUES_MEDIUM + ISSUES_LOW))

RISK ASSESSMENT:
EOF

    TOTAL_ISSUES=$((ISSUES_CRITICAL + ISSUES_HIGH + ISSUES_MEDIUM + ISSUES_LOW))

    if [ "$ISSUES_CRITICAL" -gt 0 ]; then
        echo "  ❌ CRITICAL: Immediate action required!" >> "$SUMMARY_FILE"
    elif [ "$ISSUES_HIGH" -gt 10 ]; then
        echo "  ⚠️  HIGH RISK: Address issues before deployment" >> "$SUMMARY_FILE"
    elif [ "$ISSUES_HIGH" -gt 0 ] || [ "$ISSUES_MEDIUM" -gt 20 ]; then
        echo "  ⚠️  MODERATE RISK: Review and remediate" >> "$SUMMARY_FILE"
    elif [ "$TOTAL_ISSUES" -gt 0 ]; then
        echo "  ✅ LOW RISK: Minor issues to address" >> "$SUMMARY_FILE"
    else
        echo "  ✅ NO ISSUES: Security posture is good" >> "$SUMMARY_FILE"
    fi

    cat >> "$SUMMARY_FILE" <<EOF

RECOMMENDATIONS:
  1. Review all CRITICAL and HIGH severity issues immediately
  2. Update vulnerable dependencies (run: npm audit fix)
  3. Rotate any exposed secrets or credentials
  4. Implement recommended security patches
  5. Run security scans regularly (at least weekly)
  6. Integrate security scanning into CI/CD pipeline

NEXT STEPS:
  • View detailed reports: ls $REPORTS_DIR/
  • Fix vulnerabilities: npm audit fix
  • Re-run scan: ./scripts/security-scan.sh
  • Update dependencies: npm update

═══════════════════════════════════════════════════
EOF

    echo -e "${GREEN}✅ Summary report: $SUMMARY_FILE${NC}"
}

# Function to display results
display_results() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}   Security Scan Complete! 🔒${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}📊 Issues by Severity:${NC}"
    echo -e "   ${RED}🔴 Critical: $ISSUES_CRITICAL${NC}"
    echo -e "   ${YELLOW}🟠 High:     $ISSUES_HIGH${NC}"
    echo -e "   ${YELLOW}🟡 Medium:   $ISSUES_MEDIUM${NC}"
    echo -e "   ${GREEN}⚪ Low:      $ISSUES_LOW${NC}"
    echo ""

    TOTAL=$((ISSUES_CRITICAL + ISSUES_HIGH + ISSUES_MEDIUM + ISSUES_LOW))
    echo -e "${BLUE}Total Issues: $TOTAL${NC}"
    echo ""

    if [ "$ISSUES_CRITICAL" -gt 0 ]; then
        echo -e "${RED}❌ CRITICAL ISSUES FOUND - DO NOT DEPLOY!${NC}"
    elif [ "$ISSUES_HIGH" -gt 10 ]; then
        echo -e "${YELLOW}⚠️  HIGH RISK - Address before deployment${NC}"
    elif [ "$TOTAL" -eq 0 ]; then
        echo -e "${GREEN}✅ No security issues detected!${NC}"
    else
        echo -e "${GREEN}✅ Security posture is acceptable${NC}"
    fi

    echo ""
    echo -e "${BLUE}📁 Reports saved in: $REPORTS_DIR${NC}"
    echo ""
}

# Main script
main() {
    echo -e "${BLUE}🔒 Security Scanning Script${NC}"
    echo -e "${BLUE}═══════════════════════════${NC}"
    echo ""

    check_dependencies
    echo ""

    run_npm_audit
    echo ""

    run_snyk
    echo ""

    run_trivy
    echo ""

    run_eslint_security
    echo ""

    check_secrets
    echo ""

    check_typescript_security
    echo ""

    check_docker_security
    echo ""

    check_package_scripts
    echo ""

    generate_summary
    display_results

    # Exit with error if critical issues found
    if [ "$ISSUES_CRITICAL" -gt 0 ]; then
        exit 1
    fi
}

# Run main function
main
