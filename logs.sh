#!/bin/bash

# NavaSetu Teacher Assessment Platform - Logs Viewer
# Shows logs from Railway backend and Vercel frontend

echo "📋 NavaSetu Deployment Logs"
echo "============================"

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

case "${1:-menu}" in
    backend|b)
        echo -e "\n${BLUE}Backend (Railway) Logs${NC}"
        echo "Use Railway dashboard or CLI:"
        echo "  railway logs --lines 50"
        ;;
    frontend|f)
        echo -e "\n${BLUE}Frontend (Vercel) Logs${NC}"
        echo "Use Vercel dashboard:"
        echo "  https://vercel.com/dashboard"
        echo ""
        echo "Or via CLI:"
        echo "  vercel logs <deployment-id>"
        ;;
    database|d)
        echo -e "\n${BLUE}Database (Neon) Logs${NC}"
        echo "Use Neon dashboard:"
        echo "  https://console.neon.tech"
        ;;
    *)
        echo -e "\n${BLUE}Available Log Commands:${NC}"
        echo "  ./logs.sh backend    - Show backend (Railway) logs"
        echo "  ./logs.sh frontend   - Show frontend (Vercel) logs"
        echo "  ./logs.sh database   - Show database (Neon) logs"
        echo ""
        echo -e "${GREEN}Quick Links:${NC}"
        echo "  Railway Dashboard: https://railway.app/dashboard"
        echo "  Vercel Dashboard:  https://vercel.com/dashboard"
        echo "  Neon Console:      https://console.neon.tech"
        ;;
esac

