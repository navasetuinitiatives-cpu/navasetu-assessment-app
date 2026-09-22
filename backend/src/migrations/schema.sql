-- NavaSetu Assessment Platform - Database Schema
-- PostgreSQL 13+

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  role VARCHAR(50) DEFAULT 'individual', -- individual, school_admin, consultant, platform_admin
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, archived
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_role CHECK (role IN ('individual', 'school_admin', 'consultant', 'platform_admin')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  district VARCHAR(255),
  state VARCHAR(255),
  country VARCHAR(255) DEFAULT 'India',
  school_type VARCHAR(100), -- government, private, semi-private
  admin_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, active
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schools_admin_id ON schools(admin_id);
CREATE INDEX idx_schools_status ON schools(status);

-- School Teachers mapping
CREATE TABLE IF NOT EXISTS school_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  user_id UUID NOT NULL REFERENCES users(id),
  teacher_id VARCHAR(100),
  designation VARCHAR(255),
  subject VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_school_teacher UNIQUE(school_id, user_id)
);

CREATE INDEX idx_school_teachers_school_id ON school_teachers(school_id);
CREATE INDEX idx_school_teachers_user_id ON school_teachers(user_id);

-- Assessments table (core data)
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  school_id UUID REFERENCES schools(id),
  status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, submitted, completed
  progress_percentage INT DEFAULT 0,
  responses JSONB, -- Store all assessment responses
  scores JSONB, -- Calculated scores by dimension
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assessments_user_id ON assessments(user_id);
CREATE INDEX idx_assessments_school_id ON assessments(school_id);
CREATE INDEX idx_assessments_status ON assessments(status);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id),
  user_id UUID NOT NULL REFERENCES users(id),
  plan_type VARCHAR(50), -- Discover, Explore, Navigate
  wellness_score DECIMAL(5,2),
  burnout_score DECIMAL(5,2),
  professional_score DECIMAL(5,2),
  recommendations JSONB,
  pdf_path VARCHAR(500),
  pdf_generated_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending', -- pending, generating, ready, error
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_assessment_id ON reports(assessment_id);
CREATE INDEX idx_reports_status ON reports(status);

-- Orders (Payment) table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  razorpay_order_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  plan_type VARCHAR(50) NOT NULL, -- Discover, Explore, Navigate
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, cancelled
  payment_method VARCHAR(50), -- card, upi, netbanking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_razorpay_order_id ON orders(razorpay_order_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Payment Logs table
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  razorpay_payment_id VARCHAR(100),
  status VARCHAR(50),
  response JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_logs_order_id ON payment_logs(order_id);

-- Consultants table
CREATE TABLE IF NOT EXISTS consultants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  specialization VARCHAR(255),
  bio TEXT,
  hourly_rate DECIMAL(10,2),
  max_consultations_per_day INT DEFAULT 5,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consultants_user_id ON consultants(user_id);

-- Consultation Availability
CREATE TABLE IF NOT EXISTS consultant_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES consultants(id),
  day_of_week INT, -- 0-6 (Sunday-Saturday)
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consultant_availability_consultant_id ON consultant_availability(consultant_id);

-- Consultation Requests (Bookings)
CREATE TABLE IF NOT EXISTS consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  consultant_id UUID NOT NULL REFERENCES consultants(id),
  report_id UUID REFERENCES reports(id),
  scheduled_at TIMESTAMP,
  duration_minutes INT DEFAULT 30,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  zoom_link VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consultation_requests_user_id ON consultation_requests(user_id);
CREATE INDEX idx_consultation_requests_consultant_id ON consultation_requests(consultant_id);

-- School Analytics (cached aggregates)
CREATE TABLE IF NOT EXISTS school_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  total_teachers INT DEFAULT 0,
  completed_assessments INT DEFAULT 0,
  avg_wellness_score DECIMAL(5,2),
  avg_burnout_score DECIMAL(5,2),
  avg_professional_score DECIMAL(5,2),
  high_burnout_count INT DEFAULT 0,
  low_wellness_count INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_school_analytics UNIQUE(school_id)
);

CREATE INDEX idx_school_analytics_school_id ON school_analytics(school_id);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(255),
  entity_type VARCHAR(100),
  entity_id UUID,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Initial seed data
INSERT INTO users (email, password_hash, full_name, role, status)
VALUES ('admin@navasetu.online', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/1Pq', 'Admin User', 'platform_admin', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO consultants (user_id, specialization, bio, hourly_rate, max_consultations_per_day)
SELECT id, 'Mental Health & Wellness', 'Senior Consultant', 500.00, 5
FROM users WHERE email = 'admin@navasetu.online' AND NOT EXISTS (SELECT 1 FROM consultants LIMIT 1)
ON CONFLICT DO NOTHING;
