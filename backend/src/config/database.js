import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL from environment (Neon on Railway)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    // Neon's compute suspends immediately when idle (suspend_timeout_seconds: 0
    // on this project) — a cold-start wake can take a few seconds, so 2s was
    // too aggressive and caused spurious connection timeouts on the first
    // request after any idle period.
    connectionTimeoutMillis: 10000,
  });
} else {
  // Fall back to individual connection parameters
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'navasetu_assessment',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

export { pool };
