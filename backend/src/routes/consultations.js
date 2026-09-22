import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';

const router = express.Router();

// List available consultants
router.get('/consultants', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT c.id, u.full_name, c.specialization, c.hourly_rate FROM consultants c JOIN users u ON c.user_id = u.id WHERE c.status = $1',
      ['active']
    );

    res.json({
      success: true,
      consultants: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch consultants' });
  }
});

// Book consultation
router.post('/book', async (req, res) => {
  try {
    const { userId, consultantId, reportId, scheduledAt, notes } = req.body;

    const consultationId = uuidv4();
    await pool.query(
      'INSERT INTO consultation_requests (id, user_id, consultant_id, report_id, scheduled_at, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [consultationId, userId, consultantId, reportId || null, scheduledAt, notes || null, 'pending']
    );

    res.status(201).json({
      success: true,
      consultationId,
      message: 'Consultation booked'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to book consultation' });
  }
});

// Get consultation
router.get('/:consultationId', async (req, res) => {
  try {
    const { consultationId } = req.params;
    const result = await pool.query('SELECT * FROM consultation_requests WHERE id = $1', [consultationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch consultation' });
  }
});

export default router;
