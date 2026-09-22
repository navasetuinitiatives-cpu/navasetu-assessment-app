#!/bin/bash

# NavaSetu Teacher Assessment Platform - Deployment Verification Script
# Tests backend, frontend, and database connectivity

set -e

echo "🔍 NavaSetu Deployment Verification"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BACKEND_URL="https://backend-production-5f670.up.railway.app"
FRONTEND_URL="${VERCEL_URL:-https://navasetu-assessment.vercel.app}"

# Function to test URL
test_url() {
    local url=$1
    local name=$2
    
    echo -e "\n${BLUE}Testing: $name${NC}"
    echo "URL: $url"
    
    if response=$(curl -s -m 10 "$url"); then
        echo -e "${GREEN}✅ $name is responding${NC}"
        echo "Response: $response" | head -c 200
        echo ""
        return 0
    else
        echo -e "${RED}❌ $name is not responding${NC}"
        return 1
    fi
}

# Test Backend Health
echo -e "\n${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}Backend API Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"

test_url "$BACKEND_URL/api/health" "Backend Health Check" || true
test_url "$BACKEND_URL/api/system" "Backend System Status" || true

# Test Frontend
echo -e "\n${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}Frontend Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"

test_url "$FRONTEND_URL" "Frontend" || true

# Display summary
echo -e "\n${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}Deployment Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo "Backend URL:  $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""
echo "Manual Testing:"
echo "1. Visit frontend: $FRONTEND_URL"
echo "2. Check API connectivity in browser console"
echo "3. Test authentication flow"
echo "4. Verify database queries work"

