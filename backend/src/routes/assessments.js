import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';

const router = express.Router();

// Start new assessment
router.post('/', async (req, res) => {
  try {
    const { userId, schoolId } = req.body;

    const assessmentId = uuidv4();
    await pool.query(
      'INSERT INTO assessments (id, user_id, school_id, status, progress_percentage) VALUES ($1, $2, $3, $4, $5)',
      [assessmentId, userId, schoolId || null, 'in_progress', 0]
    );

    res.status(201).json({
      success: true,
      assessmentId,
      message: 'Assessment started'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start assessment' });
  }
});

// Save assessment progress
router.put('/:assessmentId', async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { responses, progressPercentage } = req.body;

    await pool.query(
      'UPDATE assessments SET responses = $1, progress_percentage = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [JSON.stringify(responses), progressPercentage, assessmentId]
    );

    res.json({ success: true, message: 'Progress saved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

// Submit assessment
router.post('/:assessmentId/submit', async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { responses } = req.body;

    // Calculate scores from responses
    const scores = calculateScores(responses);

    await pool.query(
      'UPDATE assessments SET status = $1, responses = $2, scores = $3, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      ['submitted', JSON.stringify(responses), JSON.stringify(scores), assessmentId]
    );

    res.json({
      success: true,
      message: 'Assessment submitted',
      scores
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit assessment' });
  }
});

// Get assessment
router.get('/:assessmentId', async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const result = await pool.query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

function calculateScores(responses) {
  // Placeholder scoring logic
  // In production, this would implement proper psychometric scoring
  return {
    ghq12: 45,
    mbi_emotional_exhaustion: 35,
    mbi_depersonalization: 28,
    mbi_personal_accomplishment: 55,
    pscap_efficacy: 62,
    pscap_hope: 58,
    pscap_resilience: 51,
    pscap_optimism: 60
  };
}

export default router;
