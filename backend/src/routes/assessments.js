import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { calculateScores, calculateDimensionScores, isComplete, unansweredQuestionIds, questionBank } from '../utils/scoring.js';

const router = express.Router();

// Serve the question bank to the frontend so it never has to hardcode it
router.get('/questions', (req, res) => {
  res.json({ questionBank });
});

// Start (or resume) the caller's current in-progress assessment.
// Returns the existing draft if one is open, otherwise creates a new one.
// schoolId/schoolTeacherId are supplied for the B2B shared-link flow, after
// the caller's email has been matched against that school's roster.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { schoolId, schoolTeacherId, clientType } = req.body;
    const userId = req.user.userId;

    const existing = await pool.query(
      `SELECT * FROM assessments WHERE user_id = $1 AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.json({ success: true, assessment: existing.rows[0], resumed: true });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO assessments (id, user_id, school_id, school_teacher_id, client_type, status, responses)
       VALUES ($1, $2, $3, $4, $5, 'in_progress', '{}'::jsonb) RETURNING *`,
      [id, userId, schoolId || null, schoolTeacherId || null, clientType === 'b2b' ? 'b2b' : 'b2c']
    );

    res.status(201).json({ success: true, assessment: result.rows[0], resumed: false });
  } catch (error) {
    console.error('Start assessment error:', error);
    res.status(500).json({ error: 'Failed to start assessment' });
  }
});

// Save draft responses as the teacher progresses through the 53 questions.
// Responses stay editable up to the point of final submission.
router.put('/:assessmentId', requireAuth, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { responses } = req.body;

    const check = await pool.query('SELECT status, user_id FROM assessments WHERE id = $1', [assessmentId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    if (check.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Not your assessment' });
    if (check.rows[0].status === 'submitted') return res.status(409).json({ error: 'This assessment is already submitted and frozen' });

    await pool.query(
      'UPDATE assessments SET responses = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(responses || {}), assessmentId]
    );

    res.json({ success: true, answered: Object.keys(responses || {}).length, total: questionBank.length });
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

// Final submit — freezes the responses. From this point the assessment is
// read-only for the teacher; only a NavaSetu admin retake grant creates a
// brand-new assessment row (see /:assessmentId/enable-retake below).
router.post('/:assessmentId/submit', requireAuth, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { responses } = req.body;

    const check = await pool.query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    const assessment = check.rows[0];
    if (assessment.user_id !== req.user.userId) return res.status(403).json({ error: 'Not your assessment' });
    if (assessment.status === 'submitted') return res.status(409).json({ error: 'Already submitted' });

    const finalResponses = responses || assessment.responses || {};
    const missing = unansweredQuestionIds(finalResponses);
    if (missing.length > 0) {
      return res.status(400).json({ error: 'Assessment incomplete', unanswered: missing });
    }

    const parameterScores = calculateScores(finalResponses);
    const dimensionScores = calculateDimensionScores(parameterScores);

    await pool.query(
      `UPDATE assessments
       SET status = 'submitted', submitted = true, submitted_at = CURRENT_TIMESTAMP,
           responses = $1, scores = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [JSON.stringify(finalResponses), JSON.stringify({ parameters: parameterScores, dimensions: dimensionScores }), assessmentId]
    );

    // B2B: mark the roster row matched/completed so the school dashboard reflects progress
    if (assessment.school_teacher_id) {
      await pool.query(
        `UPDATE school_teachers SET status = 'completed', matched_at = CURRENT_TIMESTAMP, user_id = $1 WHERE id = $2`,
        [req.user.userId, assessment.school_teacher_id]
      );
    }

    res.json({ success: true, parameterScores, dimensionScores });
  } catch (error) {
    console.error('Submit assessment error:', error);
    res.status(500).json({ error: 'Failed to submit assessment' });
  }
});

// A NavaSetu admin can re-open the door for one more attempt. This does NOT
// unfreeze the existing (frozen) row — it creates a fresh in_progress row
// linked back via retake_of, per the "review then freeze, admin-only retake" rule.
router.post('/:assessmentId/enable-retake', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const prior = await pool.query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);
    if (prior.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    const p = prior.rows[0];

    const newId = uuidv4();
    const created = await pool.query(
      `INSERT INTO assessments (id, user_id, school_id, school_teacher_id, client_type, status, responses, retake_of)
       VALUES ($1, $2, $3, $4, $5, 'in_progress', '{}'::jsonb, $6) RETURNING *`,
      [newId, p.user_id, p.school_id, p.school_teacher_id, p.client_type, assessmentId]
    );

    if (p.school_teacher_id) {
      await pool.query(`UPDATE school_teachers SET retake_enabled = true, status = 'invited' WHERE id = $1`, [p.school_teacher_id]);
    }

    await pool.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.userId, 'enable_retake', 'assessment', assessmentId, JSON.stringify({ newAssessmentId: newId })]
    );

    res.status(201).json({ success: true, assessment: created.rows[0] });
  } catch (error) {
    console.error('Enable retake error:', error);
    res.status(500).json({ error: 'Failed to enable retake' });
  }
});

// Fetch an assessment (owner or admin only)
router.get('/:assessmentId', requireAuth, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const result = await pool.query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });

    const assessment = result.rows[0];
    if (assessment.user_id !== req.user.userId && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized to view this assessment' });
    }

    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

export default router;
