#!/bin/bash
# Smoke test for Finance API
# Usage: ./test_smoke.sh [base_url]

BASE_URL="${1:-http://localhost:8000}"
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local expected_field="$3"
    local data="$4"
    local description="$5"

    if [ -n "$data" ]; then
        response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -X "$method" "$BASE_URL$endpoint")
    fi

    if echo "$response" | grep -q "\"$expected_field\""; then
        echo -e "${GREEN}✓${NC} $method $endpoint"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $method $endpoint"
        echo -e "  ${YELLOW}Expected field '$expected_field' not found${NC}"
        echo "  Response: $(echo "$response" | head -c 200)"
        ((FAILED++))
    fi
}

echo "Finance API Smoke Test"
echo "======================"
echo "Base URL: $BASE_URL"
echo ""

# Check if server is running
if ! curl -s "$BASE_URL/health" | grep -q "ok"; then
    echo -e "${RED}Error: Server not responding at $BASE_URL${NC}"
    echo "Start the server with: finance-api"
    exit 1
fi
echo -e "${GREEN}✓${NC} Server is running"
echo ""

# Health
echo "--- Health ---"
test_endpoint "GET" "/health" "status"

# Portfolio
echo ""
echo "--- Portfolio ---"
test_endpoint "GET" "/api/v1/portfolio?no_prices=true" "total_value"

# Holdings
echo ""
echo "--- Holdings ---"
test_endpoint "GET" "/api/v1/holdings" "success"
test_endpoint "GET" "/api/v1/holdings/freshness" "is_stale"

# Profile
echo ""
echo "--- Profile ---"
test_endpoint "GET" "/api/v1/profile" "monthly_cash_flow"

# Advice
echo ""
echo "--- Advice ---"
test_endpoint "GET" "/api/v1/advice" "recommendations"
test_endpoint "GET" "/api/v1/advice?focus=goals" "recommendations"

# Statements
echo ""
echo "--- Statements ---"
test_endpoint "GET" "/api/v1/statements/history" "snapshots"

# Summary
echo ""
echo "======================"
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    exit 1
fi
