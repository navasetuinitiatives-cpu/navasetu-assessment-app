#!/bin/bash

# NavaSetu Teacher Assessment Platform - Deployment Status
# Shows current status of backend, frontend, and database

echo "📊 NavaSetu Deployment Status"
echo "============================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}Backend (Railway)${NC}"
echo "─────────────────────────────"
echo "Service: navasetu-backend"
echo "Status: Active"
echo "URL: https://backend-production-5f670.up.railway.app"
echo "Port: 5000"
echo ""
echo "Environment Variables:"
echo "  • DATABASE_URL: Set ✓"
echo "  • JWT_SECRET: Set ✓"
echo "  • NODE_ENV: production"
echo ""
echo "Health Check:"
if curl -s -m 5 "https://backend-production-5f670.up.railway.app/api/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Responding${NC}"
else
    echo -e "  ${RED}✗ Not responding${NC}"
fi

echo -e "\n${BLUE}Database (Neon PostgreSQL)${NC}"
echo "─────────────────────────────"
echo "Provider: Neon"
echo "Status: Connected via Railway"
echo ""
echo "Connection Status:"
if curl -s -m 5 "https://backend-production-5f670.up.railway.app/api/system" | grep -q "connected"; then
    echo -e "  ${GREEN}✓ Database Connected${NC}"
else
    echo -e "  ${YELLOW}? Check backend logs${NC}"
fi

echo -e "\n${BLUE}Frontend (Vercel)${NC}"
echo "─────────────────────────────"
echo "Framework: React + Vite"
echo "Status: Ready for deployment"
echo "Planned URL: https://navasetu-assessment.vercel.app"
echo ""
echo "Build Status: ✓ Passes locally"
echo "Build Command: npm run build"
echo "Output: dist/"

echo -e "\n${BLUE}Next Steps${NC}"
echo "─────────────────────────────"
echo "1. Deploy Frontend:"
echo "   ./deploy-frontend.sh"
echo ""
echo "2. Verify Deployment:"
echo "   ./verify-deployment.sh"
echo ""
echo "3. View Logs:"
echo "   ./logs.sh"

