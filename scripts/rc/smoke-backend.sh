#!/bin/bash
# scripts/rc/smoke-backend.sh
# Backend smoke tests - hits endpoints and asserts expected status codes
# Usage: ./scripts/rc/smoke-backend.sh [BASE_URL]
# Example: ./scripts/rc/smoke-backend.sh https://api.example.com

set -e

BASE_URL="${1:-http://localhost:8001/api}"
PASSED=0
FAILED=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test helper
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local data="$5"
    local headers="$6"
    
    echo -n "Testing: $name... "
    
    local curl_args="-s -o /tmp/response.json -w '%{http_code}'"
    
    if [ -n "$headers" ]; then
        curl_args="$curl_args -H '$headers'"
    fi
    
    if [ "$method" = "POST" ]; then
        curl_args="$curl_args -X POST -H 'Content-Type: application/json'"
        if [ -n "$data" ]; then
            curl_args="$curl_args -d '$data'"
        fi
    fi
    
    local actual_status
    actual_status=$(eval curl $curl_args "$BASE_URL$endpoint")
    
    if [ "$actual_status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $actual_status)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (expected $expected_status, got $actual_status)"
        ((FAILED++))
        return 1
    fi
}

# Test helper for JSON field existence
test_json_field() {
    local name="$1"
    local field="$2"
    
    echo -n "Checking: $name... "
    
    if jq -e ".$field" /tmp/response.json > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PRESENT${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ MISSING${NC}"
        ((FAILED++))
        return 1
    fi
}

echo "========================================"
echo "Backend Smoke Tests"
echo "Base URL: $BASE_URL"
echo "========================================"
echo ""

# Health Check
echo "--- Health Check ---"
test_endpoint "GET /health" "GET" "/health" "200" || true

# Authentication Tests
echo ""
echo "--- Authentication ---"

# Try to login with test credentials (may fail if user doesn't exist)
test_endpoint "POST /auth/login (valid)" "POST" "/auth/login" "200" \
    '{"username":"TestUser123","password":"testpass123"}' || true

# Get token for subsequent requests (if login succeeded)
TOKEN=""
if [ -f /tmp/response.json ]; then
    TOKEN=$(jq -r '.token // empty' /tmp/response.json 2>/dev/null || echo "")
fi

if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓ Got auth token${NC}"
    
    test_endpoint "GET /auth/verify (with token)" "GET" "/auth/verify" "200" \
        "" "Authorization: Bearer $TOKEN" || true
else
    echo -e "${YELLOW}⚠ No token obtained - some tests will be skipped${NC}"
fi

# Entitlements Tests
echo ""
echo "--- Entitlements ---"

if [ -n "$TOKEN" ]; then
    test_endpoint "GET /entitlements/snapshot" "GET" "/entitlements/snapshot" "200" \
        "" "Authorization: Bearer $TOKEN" || true
    
    # Check required fields in response
    test_json_field "server_time field" "server_time" || true
    test_json_field "ttl_seconds field" "ttl_seconds" || true
    test_json_field "version field" "version" || true
    test_json_field "entitlements field" "entitlements" || true
else
    echo -e "${YELLOW}⚠ Skipped (no auth token)${NC}"
fi

# Feature Flags
echo ""
echo "--- Feature Flags ---"
test_endpoint "GET /v1/features" "GET" "/v1/features" "200" || true

# Summary
echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -gt 0 ]; then
    echo ""
    echo -e "${RED}Some tests failed. Review before deploying.${NC}"
    exit 1
else
    echo ""
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
