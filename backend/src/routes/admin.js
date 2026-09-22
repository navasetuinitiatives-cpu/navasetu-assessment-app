import express from 'express';
import { pool } from '../config/database.js';

const router = express.Router();

// System status
router.get('/system', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT COUNT(*) as user_count FROM users');
    const userCount = dbCheck.rows[0].user_count;

    res.json({
      status: 'ok',
      environment: process.env.NODE_ENV,
      database: 'connected',
      userCount: parseInt(userCount)
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

// List users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC LIMIT 100');
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Approve school
router.put('/schools/:schoolId/approve', async (req, res) => {
  try {
    const { schoolId } = req.params;

    await pool.query(
      'UPDATE schools SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['approved', schoolId]
    );

    res.json({
      success: true,
      message: 'School approved'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve school' });
  }
});

// Get pending schools
router.get('/schools/pending', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM schools WHERE status = $1 ORDER BY created_at DESC',
      ['pending']
    );

    res.json({
      success: true,
      schools: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

export default router;
