# NavaSetu Teacher Assessment Platform

A comprehensive full-stack application for assessing teacher mental wellness and professional competence.

## 📋 Project Structure

```
navasetu-assessment-app/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── server.js       # Main Express app
│   │   ├── config/
│   │   │   ├── database.js # PostgreSQL connection
│   │   ├── routes/         # API endpoints
│   │   ├── migrations/     # Database schema
│   │   └── ...
│   ├── package.json
│   └── .env.example
├── frontend/                # React + Vite SPA
│   ├── src/
│   ├── index.html
│   └── vite.config.js
├── package.json            # Root scripts
└── Procfile               # Railway deployment config
```

## 🚀 Quick Start (Railway Deployment)

### Prerequisites
- Node.js 18+ 
- PostgreSQL (via Neon)
- Razorpay account (optional, for payments)

### Step 1: Prepare Backend

```bash
cd backend
npm install
```

### Step 2: Environment Configuration

Create `backend/.env` from `.env.example`:

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://neondb_owner:npg_...@...neon.tech/neondb?sslmode=require
JWT_SECRET=pEczL5uce0HggmNPm3ip2MfLOuweWqJ+VMgf08D18LA=
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

### Step 3: Database Initialization

```bash
npm run migrate
```

This creates all tables and initializes the database schema.

### Step 4: Start Backend

```bash
npm start
```

Expected output:
```
✅ Backend API running on http://localhost:5000
📡 Environment: production
🗄️  Database: neondb@...neon.tech
```

## 🎨 Frontend Setup

### Build for Production

```bash
cd frontend
npm install
npm run build
```

This creates optimized production build in `dist/` folder.

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variable (from Railway)
vercel env add VITE_API_URL https://your-railway-domain.com
```

## 🗄️ Database Schema

The application uses 13 PostgreSQL tables:

- **users** - User accounts (individual, school_admin, consultant, platform_admin)
- **schools** - School registration and profiles
- **school_teachers** - Teacher roster mapping
- **assessments** - Assessment responses and progress
- **reports** - Generated wellness/professional reports
- **orders** - Payment orders (Razorpay)
- **payment_logs** - Transaction history
- **consultants** - Consultant profiles
- **consultant_availability** - Availability scheduling
- **consultation_requests** - Booking requests
- **school_analytics** - Aggregated school metrics
- **audit_logs** - System audit trail

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token

### Assessments
- `POST /api/assessments` - Start new assessment
- `PUT /api/assessments/:id` - Save progress
- `POST /api/assessments/:id/submit` - Submit completed assessment
- `GET /api/assessments/:id` - Get assessment details

### Reports
- `POST /api/reports` - Generate report
- `GET /api/reports/:id` - Get report
- `GET /api/reports/:id/download` - Download PDF

### Payments (Razorpay)
- `POST /api/payments/orders` - Create order
- `POST /api/payments/verify` - Verify payment

### Consultations
- `GET /api/consultations/consultants` - List consultants
- `POST /api/consultations/book` - Book consultation

### Schools
- `POST /api/schools/register` - Register school
- `GET /api/schools/:id/analytics` - Get school analytics
- `POST /api/schools/:id/teachers/bulk` - Upload teachers

### Admin
- `GET /api/admin/system` - System status
- `GET /api/admin/users` - List users
- `PUT /api/admin/schools/:id/approve` - Approve school

## 🎯 Features

✅ **Dual-Track Assessment**
- Mental Wellness (GHQ-12, MBI-ES)
- Professional Development (PsyCap, Self-Efficacy, OSI)

✅ **Reporting**
- Instant PDF reports
- Adaptive recommendations
- Download & print support

✅ **Payment Processing**
- Razorpay integration (card/UPI)
- Plan selection (Discover/Explore/Navigate)

✅ **School Programs**
- Bulk teacher upload
- Analytics dashboard
- Teacher tracking

✅ **Consultation Booking**
- Consultant scheduling
- Session management

## 📊 Assessment Plans

- **Discover** (Free) - Instant report, no consultation
- **Explore** (₹2,499) - Report + additional features
- **Navigate** (₹4,999) - Report + 5 consultation sessions

## 🔧 Configuration

### JWT Secrets
Generate new secret in production:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Database URL
Format: `postgresql://user:password@host:port/database?sslmode=require`

For Neon: Copy from Neon Console → Connection String

## 📦 Deployment Checklist

- [ ] PostgreSQL database created (Neon)
- [ ] Environment variables set on Railway
- [ ] Database migrations executed (`npm run migrate`)
- [ ] Backend deployed to Railway
- [ ] Frontend built and deployed to Vercel
- [ ] VITE_API_URL set on Vercel
- [ ] Health check: `GET /api/health` returns OK
- [ ] Can register new user
- [ ] Can start and submit assessment

## 🆘 Troubleshooting

### Database Connection Error
```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Migration Failures
```bash
# Check logs
node backend/src/migrations/run.js
```

### CORS Errors
- Ensure CORS_ORIGIN includes your frontend domain
- Restart backend after updating

### Payment Issues
- Verify Razorpay keys in .env
- Check payment signature verification logic

## 📚 Documentation

- **Architecture**: See HYBRID_DEPLOYMENT_GUIDE.md
- **API Details**: See API_DOCUMENTATION.md
- **Psychometric Scales**: See ASSESSMENT_DESIGN.md

## 📧 Support

Issues? Check logs:
```bash
# Backend logs
tail -f backend/logs/app.log

# Database query errors
psql $DATABASE_URL -c "\dt"
```

## 📄 License

ISC

---

**Built with:**
- Node.js + Express
- React + Vite
- PostgreSQL (Neon)
- Razorpay
- Railway

**Deploy to Railway:** Push this repo and Railway will automatically build and deploy based on Procfile.

