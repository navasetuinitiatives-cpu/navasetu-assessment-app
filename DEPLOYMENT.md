# Railway Deployment Guide

Complete step-by-step guide for deploying NavaSetu Assessment Platform to Railway.

## ✅ Prerequisites Checklist

- [x] Neon PostgreSQL database created
  - Connection string obtained: `postgresql://neondb_owner:npg_...@...neon.tech/neondb?sslmode=require`
- [x] Railway project created: `navasetu-assessment`
  - Project ID: `3b138246-aa49-4d18-ae0a-7550d875f402`
- [x] Backend service created: `navasetu-backend`
  - Service ID: `d56a4795-5aaa-449b-896f-5b64d6d3cf8b`
- [x] Public domain generated: `backend-production-5f670.up.railway.app`
- [x] Environment variables configured:
  - DATABASE_URL (Neon connection string)
  - JWT_SECRET
  - NODE_ENV=production
  - PORT=5000
  - CORS_ORIGIN

---

## 🚀 Phase 3: Deploy from Local

### Step 1: Install Railway CLI

```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | bash

# Or using npm
npm install -g @railway/cli
```

### Step 2: Authenticate with Railway

```bash
# Login to Railway
railway login

# This opens a browser window. Authorize and return to terminal.
```

### Step 3: Link Project

```bash
# Navigate to backend directory
cd backend

# Link to your Railway project
railway link 3b138246-aa49-4d18-ae0a-7550d875f402

# When prompted, select "navasetu-assessment" project
```

### Step 4: Deploy Code

```bash
# Push code to Railway
railway up

# This will:
# 1. Build the Node.js application
# 2. Install dependencies
# 3. Execute Procfile commands
# 4. Deploy and restart service
```

**Expected output:**
```
Deploying...
✓ Built successfully
✓ Deployed to production
✓ Service restarted
→ https://backend-production-5f670.up.railway.app
```

### Step 5: Verify Deployment

```bash
# Test health endpoint
curl https://backend-production-5f670.up.railway.app/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-09-23T10:30:00.000Z",
  "environment": "production"
}
```

### Step 6: Run Database Migrations

The `Procfile` automatically runs migrations on deployment:

```
release: npm run migrate
web: node backend/src/server.js
```

**Check migration status:**
```bash
# View Railway logs
railway logs

# Should see:
# ✅ Database migrations completed successfully
```

---

## 🎨 Phase 4: Frontend Deployment (Vercel)

### Step 1: Prepare Frontend

```bash
cd frontend
npm install
npm run build
```

### Step 2: Create Vercel Project

**Option A: Using CLI**
```bash
npm install -g vercel
cd frontend
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: navasetu-assessment
# - Framework: Vite
# - Root directory: ./
```

**Option B: Using Web Dashboard**
1. Go to https://vercel.com/dashboard
2. Import → Select GitHub repository (or upload locally)
3. Select `frontend` directory
4. Deploy

### Step 3: Set Environment Variables on Vercel

```bash
vercel env add VITE_API_URL https://backend-production-5f670.up.railway.app
```

Or via Vercel dashboard:
1. Project Settings → Environment Variables
2. Add: `VITE_API_URL` = `https://backend-production-5f670.up.railway.app`
3. Redeploy

---

## 📊 Phase 5: Verification

### ✅ Backend Health Check

```bash
# Health endpoint
curl https://backend-production-5f670.up.railway.app/api/health
# ✓ Should return: {"status":"ok",...}

# Database connection check
curl https://backend-production-5f670.up.railway.app/api/system
# ✓ Should return: {"status":"ok","database":"connected",...}

# User count
curl https://backend-production-5f670.up.railway.app/api/admin/users
# ✓ Should return user list
```

### ✅ Frontend Loading

1. Open your Vercel URL in browser
2. Should see: "NavaSetu - Teacher Assessment Platform"
3. Open browser console (F12 → Console)
4. Should NOT see CORS errors
5. Verify API URL in network tab

### ✅ End-to-End Test

**1. Register User**
```bash
curl -X POST https://backend-production-5f670.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"Test123!@",
    "fullName":"Test User",
    "phoneNumber":"9999999999"
  }'

# ✓ Should return access token
```

**2. Create Assessment**
```bash
curl -X POST https://backend-production-5f670.up.railway.app/api/assessments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"userId":"USER_ID"}'

# ✓ Should return assessmentId
```

**3. Submit Assessment**
```bash
curl -X POST https://backend-production-5f670.up.railway.app/api/assessments/ASSESSMENT_ID/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "responses": {
      "q1": 3,
      "q2": 2,
      ...
    }
  }'

# ✓ Should return scores
```

---

## 🔧 Troubleshooting

### Application won't start
```bash
railway logs
# Check for:
# - Module not found errors
# - Syntax errors
# - Missing environment variables
```

### Database connection error
```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Check Neon connection
psql $DATABASE_URL -c "SELECT 1"

# Restart Railway service
railway restart
```

### Migrations failed
```bash
railway logs
# Look for migration error messages
# Re-run migrations:
railway run npm run migrate
```

### CORS errors on frontend
```bash
# Check CORS_ORIGIN environment variable
railway env
# Should include your Vercel domain

# Update if needed
railway env set CORS_ORIGIN "https://your-vercel-app.vercel.app"
railway restart
```

### Port already in use
```bash
# Railway assigns random ports internally
# Check PORT environment variable
railway env

# Should be 5000 (specified in Procfile)
```

---

## 📈 Monitoring

### View Logs
```bash
# Live logs
railway logs -f

# Last 100 lines
railway logs -n 100
```

### Check Metrics
```bash
# Via Railway CLI
railway metrics

# Or via dashboard:
# https://railway.app → navasetu-assessment → Analytics
```

### Restart Service
```bash
railway restart
```

---

## 🔐 Production Checklist

- [ ] DATABASE_URL set with Neon connection string
- [ ] JWT_SECRET set to strong random value
- [ ] NODE_ENV=production
- [ ] CORS_ORIGIN includes only your domains
- [ ] Razorpay keys configured (optional for MVP)
- [ ] Gmail credentials configured (optional for MVP)
- [ ] Backups enabled on Neon
- [ ] Monitoring/alerts set up
- [ ] SSL certificate (Railway provides auto)
- [ ] Rate limiting enabled (built into backend)

---

## 📱 Testing Checklist

- [ ] Health endpoint returns OK
- [ ] Can register new user
- [ ] Can login with email/password
- [ ] Can start assessment
- [ ] Can submit assessment
- [ ] Can generate report
- [ ] Can view report
- [ ] No CORS errors in browser console
- [ ] API calls from frontend successful
- [ ] Database tables created

---

## 🚀 Next Steps

### Development
```bash
# Local development
cd backend && npm run dev
cd frontend && npm run dev
```

### Scaling
- Monitor CPU/Memory on Railway Dashboard
- Upgrade compute if needed
- Enable auto-scaling

### Features to Add
- Razorpay payment integration
- Email notifications via Gmail MCP
- PDF report generation (Puppeteer)
- School bulk upload feature
- Consultation booking system

---

## 📞 Support

**Common Commands:**
```bash
# View environment
railway env

# Set variable
railway env set KEY=value

# View project info
railway project

# View service info
railway service

# Restart service
railway restart

# SSH into instance (if needed)
railway shell
```

**For more help:**
```bash
railway help
# or visit https://railway.app/docs
```

---

**Deployment Status:** ✅ Ready for production

Your application is now live at: `https://backend-production-5f670.up.railway.app`

Share your Vercel frontend URL with users!


---

## Phase 4: Deploy Frontend to Vercel

### Prerequisites
- Vercel account with appropriate project setup
- Vercel CLI (npx vercel) for deployment
- Backend API already deployed and running

### Step 1: Navigate to Frontend Directory

```bash
cd frontend
```

### Step 2: Link to Vercel Project (First Time Only)

```bash
# This will prompt you to:
# 1. Log in to Vercel (if not already authenticated)
# 2. Select "Create a new project"
# 3. Project name: navasetu-assessment
# 4. Framework: Vite
# 5. Root directory: ./

npx vercel link
```

After linking, verify the project is created by checking the `.vercel/project.json` file.

### Step 3: Configure Environment Variables

Set the API URL environment variable in Vercel dashboard or via CLI:

```bash
npx vercel env add VITE_API_URL
# Enter: https://backend-production-5f670.up.railway.app
```

Or manually in Vercel Dashboard:
- Navigate to Project Settings → Environment Variables
- Add: `VITE_API_URL = https://backend-production-5f670.up.railway.app`

### Step 4: Deploy to Vercel

```bash
# For production deployment
npx vercel --prod

# For preview/staging deployment (without --prod flag)
npx vercel
```

### Step 5: Verify Deployment

1. Check the deployment URL in the Vercel dashboard
2. Test the frontend health endpoint:
   ```bash
   curl https://navasetu-assessment.vercel.app/api/health
   ```
3. Verify the frontend connects to the backend

---

## Phase 5: End-to-End Testing

### Backend Testing

```bash
# Health check
curl https://backend-production-5f670.up.railway.app/api/health

# System status (database connection)
curl https://backend-production-5f670.up.railway.app/api/system
```

### Frontend Testing

1. Visit: `https://navasetu-assessment.vercel.app`
2. Test API connectivity through the frontend
3. Verify all forms and assessments load correctly
4. Test authentication flow (login/signup)

### Performance Monitoring

- Backend: Monitor Railway dashboard for logs and metrics
- Frontend: Monitor Vercel Analytics for deployment and performance
- Database: Monitor Neon PostgreSQL for query performance

---

## Deployment Troubleshooting

### Common Issues

1. **Frontend shows 502 error connecting to backend**
   - Verify `VITE_API_URL` environment variable is set correctly
   - Check backend is running and accessible from the public internet
   - Verify CORS settings in backend (`CORS_ORIGIN` environment variable)

2. **Vercel deployment fails**
   - Check `npm run build` succeeds locally
   - Verify all dependencies are listed in `package.json`
   - Check the Vercel build logs for detailed errors

3. **Database connection timeout**
   - Verify Neon database is not paused
   - Check `DATABASE_URL` is correctly set in Railway
   - Verify network access rules allow Railway to Neon connection

