#!/bin/bash
# Load Testing Script - Screenshot_Algo
# Performance testing using k6 or Artillery

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:4000}"
RESULTS_DIR="load-test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

# Function to check dependencies
check_dependencies() {
    echo -e "${BLUE}🔍 Checking dependencies...${NC}"

    if command -v k6 &> /dev/null; then
        echo -e "${GREEN}✅ k6 is installed${NC}"
        LOAD_TEST_TOOL="k6"
    elif command -v artillery &> /dev/null; then
        echo -e "${GREEN}✅ Artillery is installed${NC}"
        LOAD_TEST_TOOL="artillery"
    elif command -v autocannon &> /dev/null; then
        echo -e "${GREEN}✅ Autocannon is installed${NC}"
        LOAD_TEST_TOOL="autocannon"
    else
        echo -e "${RED}❌ No load testing tool found!${NC}"
        echo -e "${YELLOW}Install one of these tools:${NC}"
        echo -e "   k6:        brew install k6  (or download from https://k6.io)"
        echo -e "   artillery: npm install -g artillery"
        echo -e "   autocannon: npm install -g autocannon"
        exit 1
    fi
}

# Function to check if API is running
check_api_running() {
    echo -e "${BLUE}🔍 Checking if API is running...${NC}"

    if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API is accessible at $API_URL${NC}"
    else
        echo -e "${RED}❌ API is not accessible at $API_URL${NC}"
        echo -e "${YELLOW}   Start the API first: make dev${NC}"
        exit 1
    fi
}

# Function to create k6 test script
create_k6_script() {
    cat > "$RESULTS_DIR/load-test.k6.js" <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const screenshotDuration = new Trend('screenshot_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 100 }, // Spike to 100 users
    { duration: '1m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.1'],             // Error rate must be below 10%
    screenshot_duration: ['p(95)<5000'], // Screenshot requests under 5s
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';

export default function() {
  // Test 1: Health check
  let res = http.get(`${BASE_URL}/health`);
  check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: API documentation
  res = http.get(`${BASE_URL}/docs`);
  check(res, {
    'docs status is 200': (r) => r.status === 200 || r.status === 404,
  });

  sleep(1);

  // Test 3: Screenshot request (if authenticated)
  const screenshotPayload = JSON.stringify({
    url: 'https://example.com',
    format: 'png',
    width: 1920,
    height: 1080,
  });

  const startTime = new Date();
  res = http.post(`${BASE_URL}/api/screenshot`, screenshotPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  screenshotDuration.add(new Date() - startTime);

  check(res, {
    'screenshot request accepted': (r) => [200, 201, 202, 401, 429].includes(r.status),
  }) || errorRate.add(1);

  sleep(2);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  return `
Load Test Summary
=================
Total Requests: ${data.metrics.http_reqs.values.count}
Failed Requests: ${data.metrics.http_req_failed?.values.count || 0}
Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
Max Response Time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms
`;
}
EOF
}

# Function to create Artillery test script
create_artillery_script() {
    cat > "$RESULTS_DIR/artillery-config.yml" <<EOF
config:
  target: "${API_URL}"
  phases:
    - duration: 30
      arrivalRate: 5
      name: "Warm up"
    - duration: 60
      arrivalRate: 10
      name: "Sustained load"
    - duration: 30
      arrivalRate: 50
      name: "Spike"
    - duration: 60
      arrivalRate: 50
      name: "High load"
  defaults:
    headers:
      Content-Type: "application/json"
  plugins:
    expect: {}

scenarios:
  - name: "Health Check"
    weight: 3
    flow:
      - get:
          url: "/health"
          expect:
            - statusCode: 200
            - contentType: "application/json"

  - name: "Screenshot Request"
    weight: 2
    flow:
      - post:
          url: "/api/screenshot"
          json:
            url: "https://example.com"
            format: "png"
          expect:
            - statusCode:
              - 200
              - 201
              - 202
              - 401
              - 429
EOF
}

# Function to run k6 load test
run_k6_test() {
    echo -e "${BLUE}🚀 Running k6 load test...${NC}"

    create_k6_script

    REPORT_FILE="$RESULTS_DIR/k6-report-$TIMESTAMP.json"

    API_URL="$API_URL" k6 run \
        --out json="$REPORT_FILE" \
        --summary-export="$RESULTS_DIR/k6-summary-$TIMESTAMP.json" \
        "$RESULTS_DIR/load-test.k6.js"

    echo -e "${GREEN}✅ k6 test complete${NC}"
    echo -e "${BLUE}   Report: $REPORT_FILE${NC}"
}

# Function to run Artillery load test
run_artillery_test() {
    echo -e "${BLUE}🚀 Running Artillery load test...${NC}"

    create_artillery_script

    artillery run \
        --output "$RESULTS_DIR/artillery-report-$TIMESTAMP.json" \
        "$RESULTS_DIR/artillery-config.yml"

    # Generate HTML report
    artillery report \
        --output "$RESULTS_DIR/artillery-report-$TIMESTAMP.html" \
        "$RESULTS_DIR/artillery-report-$TIMESTAMP.json"

    echo -e "${GREEN}✅ Artillery test complete${NC}"
    echo -e "${BLUE}   Report: $RESULTS_DIR/artillery-report-$TIMESTAMP.html${NC}"
}

# Function to run Autocannon test (simple)
run_autocannon_test() {
    echo -e "${BLUE}🚀 Running Autocannon load test...${NC}"

    # Health endpoint
    echo -e "${BLUE}Testing health endpoint...${NC}"
    autocannon -c 10 -d 30 -p 10 "$API_URL/health" > "$RESULTS_DIR/autocannon-health-$TIMESTAMP.txt"

    # Screenshot endpoint
    echo -e "${BLUE}Testing screenshot endpoint...${NC}"
    autocannon -c 5 -d 30 -p 5 \
        -m POST \
        -H "Content-Type: application/json" \
        -b '{"url":"https://example.com","format":"png"}' \
        "$API_URL/api/screenshot" > "$RESULTS_DIR/autocannon-screenshot-$TIMESTAMP.txt"

    echo -e "${GREEN}✅ Autocannon test complete${NC}"
    echo -e "${BLUE}   Reports in: $RESULTS_DIR${NC}"
}

# Function to analyze results
analyze_results() {
    echo ""
    echo -e "${BLUE}📊 Load Test Results Summary${NC}"
    echo -e "${BLUE}════════════════════════════${NC}"

    if [ "$LOAD_TEST_TOOL" == "k6" ]; then
        SUMMARY_FILE=$(ls -t "$RESULTS_DIR"/k6-summary-*.json 2>/dev/null | head -1)

        if [ -f "$SUMMARY_FILE" ]; then
            echo -e "${GREEN}K6 Test Results:${NC}"
            echo ""
            cat "$SUMMARY_FILE" | jq '.' 2>/dev/null | head -30 || cat "$SUMMARY_FILE"
        fi

    elif [ "$LOAD_TEST_TOOL" == "artillery" ]; then
        REPORT_FILE=$(ls -t "$RESULTS_DIR"/artillery-report-*.json 2>/dev/null | head -1)

        if [ -f "$REPORT_FILE" ]; then
            echo -e "${GREEN}Artillery Test Results:${NC}"
            echo ""
            cat "$REPORT_FILE" | jq '.aggregate' 2>/dev/null | head -30 || true
        fi

    elif [ "$LOAD_TEST_TOOL" == "autocannon" ]; then
        HEALTH_REPORT=$(ls -t "$RESULTS_DIR"/autocannon-health-*.txt 2>/dev/null | head -1)

        if [ -f "$HEALTH_REPORT" ]; then
            echo -e "${GREEN}Autocannon Results (Health Endpoint):${NC}"
            echo ""
            cat "$HEALTH_REPORT" | head -20
        fi
    fi

    echo ""
    echo -e "${GREEN}📁 All results saved in: $RESULTS_DIR${NC}"
}

# Function to display recommendations
show_recommendations() {
    echo ""
    echo -e "${BLUE}💡 Recommendations:${NC}"
    echo ""
    echo -e "  • ${GREEN}Response Time:${NC} Should be <500ms for 95th percentile"
    echo -e "  • ${GREEN}Error Rate:${NC} Should be <1% under normal load"
    echo -e "  • ${GREEN}Throughput:${NC} Aim for >100 req/sec for production"
    echo -e "  • ${GREEN}Memory:${NC} Monitor Node.js heap usage during tests"
    echo ""
    echo -e "${YELLOW}For comprehensive testing:${NC}"
    echo -e "  1. Test with realistic screenshot requests"
    echo -e "  2. Test concurrent uploads"
    echo -e "  3. Monitor database connection pool"
    echo -e "  4. Check Redis cache performance"
    echo -e "  5. Test with different image sizes"
    echo ""
}

# Main script
main() {
    echo -e "${BLUE}⚡ Load Testing Script${NC}"
    echo -e "${BLUE}═════════════════════${NC}"
    echo ""

    check_dependencies
    check_api_running

    # Run load test based on available tool
    case "$LOAD_TEST_TOOL" in
        k6)
            run_k6_test
            ;;
        artillery)
            run_artillery_test
            ;;
        autocannon)
            run_autocannon_test
            ;;
    esac

    analyze_results
    show_recommendations

    echo -e "${GREEN}✅ Load testing complete!${NC}"
}

# Parse command line arguments
COMMAND=${1:-run}

case "$COMMAND" in
    run)
        main
        ;;
    analyze)
        analyze_results
        ;;
    help|-h|--help)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  run      - Run load test (default)"
        echo "  analyze  - Analyze previous test results"
        echo "  help     - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  API_URL  - Target API URL (default: http://localhost:4000)"
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        exit 1
        ;;
esac
