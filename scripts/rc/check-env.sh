#!/bin/bash
# scripts/rc/check-env.sh
# Verify required environment variables are set WITHOUT printing values
# Usage: ./scripts/rc/check-env.sh [backend|frontend|all]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_var() {
    local var_name="$1"
    local required="$2"
    local value="${!var_name}"
    
    if [ -n "$value" ]; then
        echo -e "${GREEN}✓${NC} $var_name: SET (${#value} chars)"
    elif [ "$required" = "required" ]; then
        echo -e "${RED}✗${NC} $var_name: NOT SET (REQUIRED)"
        return 1
    else
        echo -e "${YELLOW}○${NC} $var_name: NOT SET (optional)"
    fi
}

check_backend() {
    echo ""
    echo "========================================"
    echo "Backend Environment Variables"
    echo "========================================"
    
    local failed=0
    
    check_var "SERVER_DEV_MODE" "required" || failed=1
    check_var "REVENUECAT_SECRET_KEY" "required" || failed=1
    check_var "REVENUECAT_WEBHOOK_SECRET" "required" || failed=1
    check_var "JWT_SECRET_KEY" "optional"
    check_var "MONGO_URL" "required" || failed=1
    
    echo ""
    if [ "$SERVER_DEV_MODE" = "true" ]; then
        echo -e "${YELLOW}⚠️  WARNING: SERVER_DEV_MODE=true (not production-ready)${NC}"
    elif [ "$SERVER_DEV_MODE" = "false" ]; then
        echo -e "${GREEN}✓ SERVER_DEV_MODE=false (production mode)${NC}"
    fi
    
    return $failed
}

check_frontend() {
    echo ""
    echo "========================================"
    echo "Frontend Environment Variables"
    echo "========================================"
    
    local failed=0
    
    check_var "EXPO_PUBLIC_ENV" "required" || failed=1
    check_var "EXPO_PUBLIC_BACKEND_URL" "required" || failed=1
    check_var "EXPO_PUBLIC_SENTRY_DSN" "optional"
    check_var "EXPO_PUBLIC_ANALYTICS_ENABLED" "optional"
    check_var "EXPO_PUBLIC_REVENUECAT_API_KEY" "optional"
    
    echo ""
    if [ "$EXPO_PUBLIC_ENV" = "production" ]; then
        echo -e "${GREEN}✓ EXPO_PUBLIC_ENV=production${NC}"
    elif [ "$EXPO_PUBLIC_ENV" = "staging" ]; then
        echo -e "${YELLOW}○ EXPO_PUBLIC_ENV=staging${NC}"
    elif [ "$EXPO_PUBLIC_ENV" = "development" ]; then
        echo -e "${YELLOW}⚠️  EXPO_PUBLIC_ENV=development (not production-ready)${NC}"
    fi
    
    # Check HTTPS for production
    if [ "$EXPO_PUBLIC_ENV" = "production" ]; then
        if [[ "$EXPO_PUBLIC_BACKEND_URL" == https://* ]]; then
            echo -e "${GREEN}✓ EXPO_PUBLIC_BACKEND_URL uses HTTPS${NC}"
        else
            echo -e "${RED}✗ EXPO_PUBLIC_BACKEND_URL should use HTTPS in production${NC}"
            failed=1
        fi
    fi
    
    return $failed
}

# Main
case "${1:-all}" in
    backend)
        check_backend
        ;;
    frontend)
        check_frontend
        ;;
    all)
        backend_ok=0
        frontend_ok=0
        
        check_backend || backend_ok=1
        check_frontend || frontend_ok=1
        
        echo ""
        echo "========================================"
        echo "Summary"
        echo "========================================"
        
        if [ $backend_ok -eq 0 ] && [ $frontend_ok -eq 0 ]; then
            echo -e "${GREEN}✓ All required environment variables are set${NC}"
            exit 0
        else
            echo -e "${RED}✗ Some required environment variables are missing${NC}"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [backend|frontend|all]"
        exit 1
        ;;
esac
