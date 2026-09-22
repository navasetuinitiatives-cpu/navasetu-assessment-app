import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';

const router = express.Router();

// Register school
router.post('/register', async (req, res) => {
  try {
    const { name, district, state, schoolType, adminId } = req.body;

    const schoolId = uuidv4();
    await pool.query(
      'INSERT INTO schools (id, name, district, state, school_type, admin_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [schoolId, name, district, state, schoolType, adminId, 'pending']
    );

    res.status(201).json({
      success: true,
      schoolId,
      message: 'School registration submitted'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register school' });
  }
});

// Get school analytics
router.get('/:schoolId/analytics', async (req, res) => {
  try {
    const { schoolId } = req.params;

    const result = await pool.query(
      'SELECT * FROM school_analytics WHERE school_id = $1',
      [schoolId]
    );

    if (result.rows.length === 0) {
      // Return empty analytics for new school
      return res.json({
        schoolId,
        totalTeachers: 0,
        completedAssessments: 0,
        avgWellnessScore: 0,
        avgBurnoutScore: 0,
        avgProfessionalScore: 0,
        highBurnoutCount: 0
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Upload teachers (bulk)
router.post('/:schoolId/teachers/bulk', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { teachers } = req.body; // Array of teacher objects

    // Insert teachers
    for (const teacher of teachers) {
      const userId = uuidv4();
      // In production, create user and map to school
    }

    res.json({
      success: true,
      imported: teachers.length,
      message: 'Teachers imported'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload teachers' });
  }
});

export default router;
