import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Basic format checks only — no OTP/SMS/email verification, per instruction.
// These just catch obvious typos/junk before they land in the CRM as a lead
// (a mistyped email means a report/lead nobody can ever follow up on).
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts a plain 10-digit Indian mobile number (starts 6-9), tolerating a
// leading +91/91/0 and any spaces/dashes a person might type or paste in.
function isValidIndianMobile(raw) {
  const digits = String(raw).replace(/[^\d]/g, '');
  const normalized = digits.replace(/^(91)/, '').replace(/^0/, '');
  return /^[6-9]\d{9}$/.test(normalized);
}

// Register
router.post('/register', async (req, res) => {
  try {
    let { email, password, fullName, phoneNumber } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Normalize so 'Foo@x.com' and 'foo@x.com' are always the same account —
    // Postgres text equality is case-sensitive, so without this two accounts
    // for the same person could silently be created (and only one of them
    // would carry any role change made later, e.g. promoting to admin).
    email = email.trim().toLowerCase();

    if (!EMAIL_FORMAT.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    // Mobile is optional at the DB level (some legacy/B2B paths don't collect
    // it), but if one is supplied it has to actually look like a phone
    // number — this is the field counsellors call back on, so a junk value
    // here is worse than a blank one.
    if (phoneNumber && !isValidIndianMobile(phoneNumber)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    // Check if user exists
    const userExists = await pool.query('SELECT id, has_registered FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0 && userExists.rows[0].has_registered) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    let user;
    if (userExists.rows.length > 0) {
      // A counsellor/admin already added this person as a manual CRM lead
      // (has_registered = false, placeholder password) — this is that same
      // person registering for real, so claim the existing row rather than
      // erroring out or creating a duplicate account.
      const claimed = await pool.query(
        `UPDATE users SET password_hash = $1, full_name = $2, phone_number = COALESCE($3, phone_number), has_registered = true
         WHERE id = $4 RETURNING id, email, full_name, role`,
        [passwordHash, fullName, phoneNumber || null, userExists.rows[0].id]
      );
      user = claimed.rows[0];
    } else {
      const userId = uuidv4();
      const result = await pool.query(
        'INSERT INTO users (id, email, password_hash, full_name, phone_number, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, full_name, role',
        [userId, email, passwordHash, fullName, phoneNumber || null, 'individual']
      );
      user = result.rows[0];
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
    );

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    email = email.trim().toLowerCase();

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Blocked accounts (admin-controlled via the HR Panel) can't log in to
    // either app, since both share this same login route. Checked only after
    // the password is confirmed correct, so a blocked user gets a clear
    // reason rather than a generic "invalid credentials".
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'This account has been blocked. Please contact NavaSetu support for help.' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
    );

    const demographicsResult = await pool.query('SELECT * FROM user_demographics WHERE user_id = $1', [user.id]);
    const demographics = demographicsResult.rows[0] || null;

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      demographics, // if present, the frontend should skip the demographics form entirely
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Current user + demographics (used on page reload to restore session)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, email, full_name, role FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const demographicsResult = await pool.query('SELECT * FROM user_demographics WHERE user_id = $1', [req.user.userId]);

    res.json({
      user: userResult.rows[0],
      demographics: demographicsResult.rows[0] || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Save/update demographics — called once; subsequent logins reuse this via GET /me or the login response
router.put('/demographics', requireAuth, async (req, res) => {
  try {
    const { age, location, institution, institutionType, experience, subject } = req.body;
    await pool.query(
      `INSERT INTO user_demographics (user_id, age, location, institution, institution_type, experience_years, subject, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         age = EXCLUDED.age, location = EXCLUDED.location, institution = EXCLUDED.institution,
         institution_type = EXCLUDED.institution_type, experience_years = EXCLUDED.experience_years,
         subject = EXCLUDED.subject, updated_at = CURRENT_TIMESTAMP`,
      [req.user.userId, age || null, location || null, institution || null, institutionType || null, experience || null, subject || null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Save demographics error:', error);
    res.status(500).json({ error: 'Failed to save demographics' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    const accessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

export default router;
