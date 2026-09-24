import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// List active consultants
router.get('/consultants', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, full_name, specialization, bio FROM consultants WHERE status = 'active'`);
    res.json({ consultants: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch consultants' });
  }
});

// Request the Navigate plan's 1 counselling session (booking itself is
// confirmed manually by NavaSetu for the pilot — no live calendar yet)
router.post('/request', requireAuth, async (req, res) => {
  try {
    const { reportId, consultantId, preferredSlot, notes } = req.body;

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO consultation_requests (id, user_id, report_id, consultant_id, preferred_slot, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'requested') RETURNING *`,
      [id, req.user.userId, reportId || null, consultantId || null, preferredSlot || null, notes || null]
    );

    res.status(201).json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Consultation request error:', error);
    res.status(500).json({ error: 'Failed to submit consultation request' });
  }
});

router.get('/:requestId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM consultation_requests WHERE id = $1', [req.params.requestId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = result.rows[0];
    if (row.user_id !== req.user.userId && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// Admin: all pending consultation requests, and scheduling
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cr.*, u.full_name, u.email FROM consultation_requests cr
       JOIN users u ON u.id = cr.user_id ORDER BY cr.created_at DESC LIMIT 200`
    );
    res.json({ requests: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.post('/:requestId/schedule', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    const result = await pool.query(
      `UPDATE consultation_requests SET status = 'scheduled', scheduled_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [scheduledAt, req.params.requestId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to schedule' });
  }
});

export default router;
