import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

// --- NavaSetu admin accounts (platform_admin role) ---------------------
// Lets an existing admin create/edit/remove other named admins, each with
// their own email + password, instead of everyone sharing one login.

router.get('/admins', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, created_at, last_login FROM users
       WHERE role = 'platform_admin' ORDER BY created_at ASC`
    );
    res.json({ admins: result.rows });
  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

router.post('/admins', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Name, email and password are all required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'That email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, client_type, status)
       VALUES ($1, $2, $3, $4, 'platform_admin', 'b2c', 'active')
       RETURNING id, email, full_name, created_at`,
      [id, email, passwordHash, fullName]
    );
    res.status(201).json({ admin: result.rows[0] });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

router.put('/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, fullName } = req.body;

    const target = await pool.query(`SELECT * FROM users WHERE id = $1 AND role = 'platform_admin'`, [id]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });

    if (email && email !== target.rows[0].email) {
      const clash = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (clash.rows.length > 0) return res.status(409).json({ error: 'That email is already registered' });
    }
    if (password && password.length > 0 && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : target.rows[0].password_hash;
    const result = await pool.query(
      `UPDATE users SET email = $1, full_name = $2, password_hash = $3 WHERE id = $4
       RETURNING id, email, full_name, created_at`,
      [email || target.rows[0].email, fullName || target.rows[0].full_name, passwordHash, id]
    );
    res.json({ admin: result.rows[0] });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

router.delete('/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.userId) {
      return res.status(400).json({ error: "You can't remove your own admin account while logged in as it" });
    }
    const countResult = await pool.query(`SELECT COUNT(*) AS n FROM users WHERE role = 'platform_admin'`);
    if (parseInt(countResult.rows[0].n, 10) <= 1) {
      return res.status(400).json({ error: 'At least one admin account must remain' });
    }
    const result = await pool.query(`DELETE FROM users WHERE id = $1 AND role = 'platform_admin' RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Failed to remove admin' });
  }
});

// System status
router.get('/system', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT COUNT(*) AS user_count FROM users');
    res.json({ status: 'ok', environment: process.env.NODE_ENV, database: 'connected', userCount: parseInt(dbCheck.rows[0].user_count, 10) });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// Central CRM: every lead (B2C individual + B2B teacher), their current
// school link (if any), and their latest assessment progress. This is the
// "leads, progress, reports" view the pilot needs as its backend CRM.
router.get('/leads', async (req, res) => {
  try {
    const { search, clientType } = req.query;
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.client_type, u.created_at, u.last_login,
              a.id AS latest_assessment_id, a.status AS assessment_status, a.submitted_at,
              s.name AS school_name, s.id AS school_id,
              (SELECT COUNT(*) FROM reports r WHERE r.user_id = u.id) AS report_count
       FROM users u
       LEFT JOIN LATERAL (
         SELECT * FROM assessments WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
       ) a ON true
       LEFT JOIN schools s ON s.id = a.school_id
       WHERE u.role != 'platform_admin'
         AND ($1::text IS NULL OR u.full_name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR u.client_type = $2)
       ORDER BY u.created_at DESC
       LIMIT 300`,
      [search || null, clientType || null]
    );
    res.json({ leads: result.rows });
  } catch (error) {
    console.error('Leads fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.get('/leads/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await pool.query('SELECT id, email, full_name, role, client_type, created_at, last_login FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const demographics = await pool.query('SELECT * FROM user_demographics WHERE user_id = $1', [userId]);
    const assessments = await pool.query('SELECT * FROM assessments WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    const reports = await pool.query('SELECT id, plan_type, payment_status, created_at, released_at FROM reports WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    const orders = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);

    res.json({
      user: user.rows[0],
      demographics: demographics.rows[0] || null,
      assessments: assessments.rows,
      reports: reports.rows,
      orders: orders.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lead detail' });
  }
});

// Admin can view any report's stored HTML directly (individual reports —
// this is the "NavaSetu can access any report" rule; the school cannot)
router.get('/reports/:reportId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.reportId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

export default router;
