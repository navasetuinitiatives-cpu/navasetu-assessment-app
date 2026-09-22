#!/bin/bash

# NavaSetu Teacher Assessment Platform - Frontend Deployment Script
# Automates deployment of React frontend to Vercel

set -e

echo "🚀 NavaSetu Teacher Assessment - Frontend Deployment"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if in correct directory
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: frontend/package.json not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

cd frontend

# Step 1: Verify dependencies are installed
echo -e "\n${BLUE}Step 1: Verifying dependencies${NC}"
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Step 2: Test build locally
echo -e "\n${BLUE}Step 2: Testing build locally${NC}"
echo "🔨 Building frontend..."
npm run build
if [ -d "dist" ]; then
    echo "✅ Build successful"
    ls -lh dist/
else
    echo "❌ Build failed - dist directory not created"
    exit 1
fi

# Step 3: Check Vercel CLI
echo -e "\n${BLUE}Step 3: Checking Vercel CLI${NC}"
if ! command -v npx &> /dev/null || ! npx vercel --version &> /dev/null; then
    echo "⚠️  Vercel CLI not available, will use npx"
fi

# Step 4: Verify Vercel project is linked
echo -e "\n${BLUE}Step 4: Checking Vercel project link${NC}"
if [ ! -d ".vercel" ]; then
    echo "⚠️  Project not linked to Vercel yet"
    echo "Run: npx vercel link"
    echo "Select: Create a new project"
    echo "Project name: navasetu-assessment"
    echo "Framework: Vite"
    echo "Root: ./"
    exit 1
else
    echo "✅ Project linked to Vercel"
fi

# Step 5: Display pre-deployment checklist
echo -e "\n${YELLOW}Pre-Deployment Checklist${NC}"
echo "═══════════════════════════════"
echo "□ Backend API is running: https://backend-production-5f670.up.railway.app/api/health"
echo "□ VITE_API_URL environment variable set in Vercel"
echo "□ Backend URL is: https://backend-production-5f670.up.railway.app"
echo ""
echo "Continue with deployment? (yes/no)"
read -r response

if [ "$response" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Step 6: Deploy to Vercel
echo -e "\n${BLUE}Step 6: Deploying to Vercel${NC}"
echo "🚀 Pushing to production..."

if npx vercel --prod; then
    echo -e "\n${GREEN}✅ Frontend deployment successful!${NC}"
    echo "Check Vercel dashboard for deployment URL"
    npx vercel inspect --prod
else
    echo -e "\n${YELLOW}⚠️  Deployment may have encountered issues${NC}"
    echo "Check Vercel dashboard for details"
fi

echo -e "\n${GREEN}Deployment Complete!${NC}"
echo "═══════════════════════════════════════════"
echo "Frontend URL: https://navasetu-assessment.vercel.app"
echo "Backend URL: https://backend-production-5f670.up.railway.app"
echo ""
echo "Next Steps:"
echo "1. Test the frontend at the URL above"
echo "2. Verify API connectivity"
echo "3. Run end-to-end tests"

