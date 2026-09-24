-- NavaSetu Teacher Wellness Assessment Platform - Database Schema (Pilot Rebuild)
-- PostgreSQL 13+
-- Source of truth: matches navasetu_report_reference_v2_FIXED.html question bank,
-- scoring, and report tiers, plus the B2C/B2B business rules agreed for the pilot.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- USERS  (also serves as the central CRM / lead table — never deleted on
-- school archive; only the school link + assessment/report rows move out)
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- NULL until a B2B teacher sets a password / registers
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  role VARCHAR(50) DEFAULT 'individual', -- individual, teacher, platform_admin
  client_type VARCHAR(20) DEFAULT 'b2c', -- b2c, b2b
  status VARCHAR(50) DEFAULT 'active', -- active, inactive
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_role CHECK (role IN ('individual', 'teacher', 'platform_admin')),
  CONSTRAINT valid_client_type CHECK (client_type IN ('b2c', 'b2b'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Demographics captured once at first login, reused on every later visit
CREATE TABLE IF NOT EXISTS user_demographics (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age INT,
  location VARCHAR(255),
  institution VARCHAR(255),
  institution_type VARCHAR(100),
  experience_years INT,
  subject VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- SCHOOLS (B2B "school blocks" — NavaSetu admins only, schools never get
-- portal admin access; payment happens outside the portal entirely)
-- =========================================================================
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  district VARCHAR(255),
  state VARCHAR(255),
  country VARCHAR(255) DEFAULT 'India',
  school_type VARCHAR(100),
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  created_by UUID REFERENCES users(id), -- NavaSetu admin who created the block
  status VARCHAR(50) DEFAULT 'active', -- active, archived
  archived_at TIMESTAMP,
  archive_path VARCHAR(500), -- where the exported package was written on archive
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);

-- Teacher roster per school. Uploaded by admin (CSV/Excel/manual) BEFORE the
-- teacher necessarily has a user account. Matched to `users` by email when
-- she takes the assessment (email is the match key). Retakes are disabled
-- by default for B2B teachers; only a NavaSetu admin can flip retake_enabled.
CREATE TABLE IF NOT EXISTS school_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- NULL until she registers/submits
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  designation VARCHAR(255),
  subject VARCHAR(255),
  invited_at TIMESTAMP, -- last bulk-invite email send time
  matched_at TIMESTAMP, -- when her submission was matched to this roster row
  retake_enabled BOOLEAN DEFAULT FALSE, -- admin override; default is no retakes
  status VARCHAR(50) DEFAULT 'invited', -- invited, in_progress, completed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_school_teacher_email UNIQUE(school_id, email)
);

CREATE INDEX IF NOT EXISTS idx_school_teachers_school_id ON school_teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_school_teachers_email ON school_teachers(email);

-- =========================================================================
-- ASSESSMENTS (one row per attempt; frozen once submitted; a retake is a
-- brand-new row, only creatable when an admin has enabled it)
-- =========================================================================
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id), -- set for B2B attempts
  school_teacher_id UUID REFERENCES school_teachers(id),
  client_type VARCHAR(20) NOT NULL DEFAULT 'b2c', -- b2c, b2b
  status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, submitted
  responses JSONB DEFAULT '{}'::jsonb, -- draft answers, saved as the teacher progresses
  scores JSONB, -- computed only on submit, from the server-side scoring engine
  submitted BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP,
  retake_of UUID REFERENCES assessments(id), -- points to the prior attempt, if any
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_client_type CHECK (client_type IN ('b2c', 'b2b'))
);

CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_school_id ON assessments(school_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);

-- =========================================================================
-- REPORTS (one per plan generated for an assessment; B2B is always Navigate)
-- =========================================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  plan_type VARCHAR(50) NOT NULL, -- discover, explore, navigate
  html_content TEXT, -- server-rendered report HTML (source of truth for viewing/PDF)
  payment_status VARCHAR(50) DEFAULT 'not_required', -- not_required, pending, paid, admin_released
  released_at TIMESTAMP, -- when the report actually became viewable
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_plan_type CHECK (plan_type IN ('discover', 'explore', 'navigate')),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('not_required', 'pending', 'paid', 'admin_released'))
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_assessment_id ON reports(assessment_id);

-- =========================================================================
-- ORDERS (skeletal payment tracking for B2C Explore/Navigate. Razorpay
-- integration is stubbed for the pilot; a NavaSetu admin can also manually
-- mark an order paid and release the report, which is the pilot's real path.)
-- =========================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  report_id UUID REFERENCES reports(id),
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  plan_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, admin_released, failed, cancelled
  payment_method VARCHAR(50), -- razorpay, admin_manual
  marked_paid_by UUID REFERENCES users(id), -- admin who manually released it, if applicable
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- =========================================================================
-- CONSULTATIONS (Navigate plan's 1 counselling session)
-- =========================================================================
CREATE TABLE IF NOT EXISTS consultants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id),
  full_name VARCHAR(255),
  specialization VARCHAR(255),
  bio TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  report_id UUID REFERENCES reports(id),
  consultant_id UUID REFERENCES consultants(id),
  preferred_slot TIMESTAMP,
  scheduled_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'requested', -- requested, scheduled, completed, cancelled
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consultation_requests_user_id ON consultation_requests(user_id);

-- =========================================================================
-- SCHOOL PROJECT ANALYTICS (aggregate report NavaSetu shows to the school —
-- the school never sees individual teacher reports)
-- =========================================================================
CREATE TABLE IF NOT EXISTS school_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  total_teachers INT DEFAULT 0,
  completed_assessments INT DEFAULT 0,
  avg_scores JSONB, -- per-parameter and per-dimension averages
  at_risk_count INT DEFAULT 0, -- teachers with any dimension below a concern threshold
  generated_html TEXT, -- the compiled project report shown to NavaSetu admins
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- AUDIT LOG (admin actions: retake grants, manual payment releases, exports)
-- =========================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- =========================================================================
-- PLATFORM SETTINGS (singleton row) — NavaSetu logo/crest, used on the
-- frontend header, the admin panel, generated reports, and future tax
-- invoices. Stored as base64 in the DB for the pilot (no object storage
-- configured yet) and served back out via GET /api/settings/logo.
-- =========================================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id INT PRIMARY KEY DEFAULT 1,
  org_name VARCHAR(255) DEFAULT 'NavaSetu Initiatives',
  logo_data TEXT, -- base64-encoded image data, NULL until an admin uploads one
  logo_mime VARCHAR(50), -- e.g. image/png
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO platform_settings (id, org_name) VALUES (1, 'NavaSetu Initiatives')
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- SEED: one NavaSetu platform admin
-- Password below is a bcrypt hash of "NavaSetu@2026" — CHANGE THIS after first login
-- (there's no self-service password change UI yet; ask to have it added, or
-- update password_hash directly via SQL with a freshly generated bcrypt hash).
-- =========================================================================
INSERT INTO users (email, password_hash, full_name, role, client_type, status)
VALUES ('navasetuinitiatives@gmail.com', '$2a$10$P0suKczb13U9qOUMRjeocu6yt3m0j6cNPL.isC2pZQRJIWekxZgZC', 'NavaSetu Admin', 'platform_admin', 'b2c', 'active')
ON CONFLICT (email) DO NOTHING;
