import express from 'express';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

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
