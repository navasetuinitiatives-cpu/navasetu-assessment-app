import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import {
  bigFiveItems, traitItemBank, watWords, srtSituations, gtoScenarios, tatPrompts, sdtPrompts,
  calculateOLQProfile, buildImprovementPlan
} from '../utils/ssbScoring.js';

const router = express.Router();

// Fully isolated from the wellness assessment routes/tables in every way
// that matters for scoring (separate item banks, separate scoring module) —
// the only shared surface is the `assessments`/`reports` tables (via a new
// `track` column and a widened `plan_type` check, both additive) so SSB
// candidates show up in the same NavaSetu CRM leads list and report viewer
// admins already use for wellness leads, per the "same backend for leads &
// reports" requirement. Nothing in scoring.js or assessments.js is modified.

// Public: the full item bank, so the frontend never hardcodes question text.
router.get('/meta', (req, res) => {
  res.json({ bigFiveItems, traitItemBank, watWords, srtSituations, gtoScenarios, tatPrompts, sdtPrompts });
});

// Start (or resume) the caller's current in-progress SSB assessment.
router.post('/assessments', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const existing = await pool.query(
      `SELECT * FROM assessments WHERE user_id = $1 AND track = 'ssb' AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.json({ success: true, assessment: existing.rows[0], resumed: true });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO assessments (id, user_id, client_type, track, status, responses)
       VALUES ($1, $2, 'b2c', 'ssb', 'in_progress', '{}'::jsonb) RETURNING *`,
      [id, userId]
    );
    res.status(201).json({ success: true, assessment: result.rows[0], resumed: false });
  } catch (error) {
    console.error('Start SSB assessment error:', error);
    res.status(500).json({ error: 'Failed to start SSB assessment' });
  }
});

// Fetch a draft/submitted SSB assessment (for resuming or re-viewing).
router.get('/assessments/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM assessments WHERE id = $1 AND track = 'ssb'`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    const assessment = result.rows[0];
    if (assessment.user_id !== req.user.userId && req.user.role !== 'platform_admin' && req.user.role !== 'counsellor') {
      return res.status(403).json({ error: 'Not authorized to view this assessment' });
    }
    res.json({ assessment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

// All of the caller's own past SSB attempts, most recent first.
router.get('/assessments-mine/list', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, status, created_at, submitted_at FROM assessments WHERE user_id = $1 AND track = 'ssb' ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ assessments: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your SSB assessments' });
  }
});

// Autosave one section's answers (bigFive, traits, wat, srt, gto, tat, sdt).
// Responses are stored as { [section]: { [itemId]: answer } } in the same
// JSONB `responses` column the wellness flow uses — just namespaced by
// section so nothing collides with wellness's flat item-id keys.
router.put('/assessments/:id', requireAuth, async (req, res) => {
  try {
    const { section, answers } = req.body;
    const validSections = ['bigFive', 'traits', 'wat', 'srt', 'gto', 'tat', 'sdt'];
    if (!validSections.includes(section)) return res.status(400).json({ error: `section must be one of: ${validSections.join(', ')}` });

    const existing = await pool.query(`SELECT * FROM assessments WHERE id = $1 AND track = 'ssb'`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    const assessment = existing.rows[0];
    if (assessment.user_id !== req.user.userId) return res.status(403).json({ error: 'Not your assessment' });
    if (assessment.status !== 'in_progress') return res.status(409).json({ error: 'This assessment has already been submitted' });

    const responses = assessment.responses || {};
    responses[section] = Object.assign({}, responses[section] || {}, answers || {});

    const result = await pool.query(
      `UPDATE assessments SET responses = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, responses`,
      [JSON.stringify(responses), req.params.id]
    );
    res.json({ success: true, responses: result.rows[0].responses });
  } catch (error) {
    console.error('Save SSB section error:', error);
    res.status(500).json({ error: 'Failed to save your answers' });
  }
});

// Submit: scores the trait battery + WAT + GTO into the OLQ Readiness
// Profile, builds a per-factor improvement plan, and freezes the attempt.
// SRT/TAT/SDT are preserved verbatim for the candidate's own review and for
// an admin/counsellor to read, but are never auto-scored (see ssbScoring.js
// for why — real projective-test interpretation needs a trained assessor).
router.post('/assessments/:id/submit', requireAuth, async (req, res) => {
  try {
    const existing = await pool.query(`SELECT * FROM assessments WHERE id = $1 AND track = 'ssb'`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    const assessment = existing.rows[0];
    if (assessment.user_id !== req.user.userId) return res.status(403).json({ error: 'Not your assessment' });
    if (assessment.status !== 'in_progress') return res.status(409).json({ error: 'This assessment has already been submitted' });

    const responses = assessment.responses || {};
    const bigFiveAnswered = Object.keys(responses.bigFive || {}).length;
    const traitsAnswered = Object.keys(responses.traits || {}).length;
    if (bigFiveAnswered < bigFiveItems.length || traitsAnswered < traitItemBank.length) {
      return res.status(400).json({ error: 'Please complete the trait scale (Big Five + the 4 SSB-specific scales) before submitting.' });
    }

    const profile = calculateOLQProfile({
      wellnessResponses: responses.bigFive || {},
      traitResponses: responses.traits || {},
      watResponses: responses.wat || {},
      gtoResponses: responses.gto || {}
    });
    const improvementPlan = buildImprovementPlan(profile.factorDetail);

    const result = await pool.query(
      `UPDATE assessments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, scores = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING id, status, submitted_at`,
      [JSON.stringify({ profile, improvementPlan }), req.params.id]
    );

    res.json({ success: true, assessment: result.rows[0], profile, improvementPlan });
  } catch (error) {
    console.error('Submit SSB assessment error:', error);
    res.status(500).json({ error: 'Failed to submit your SSB assessment' });
  }
});

export default router;
