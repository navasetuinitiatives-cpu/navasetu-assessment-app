import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import {
  bigFiveItems, traitItemBank, watWords, srtSituations, gtoScenarios, tatPrompts, sdtPrompts,
  calculateOLQProfile, buildImprovementPlan, buildItemSelection, buildSsbReportHtml, SSB_PLANS,
  buildTeaserSelection, computeTeaserScore
} from '../utils/ssbScoring.js';

const router = express.Router();

// Same pilot switch as reports.js (Razorpay isn't wired up yet) — re-declared
// here rather than imported so reports.js stays completely untouched. While
// true, every SSB report package releases immediately without real payment.
const PILOT_FREE_ACCESS = process.env.PILOT_FREE_ACCESS !== 'false';

// Fully isolated from the wellness assessment routes/tables in every way
// that matters for scoring (separate item banks, separate scoring module) —
// the only shared surface is the `assessments`/`reports` tables (via a new
// `track` column and a widened `plan_type` check, both additive) so SSB
// candidates show up in the same NavaSetu CRM leads list and report viewer
// admins already use for wellness leads, per the "same backend for leads &
// reports" requirement. Nothing in scoring.js or assessments.js is modified.

// Public: the full item bank, so the frontend never hardcodes question text.
router.get('/meta', (req, res) => {
  res.json({ bigFiveItems, traitItemBank, watWords, srtSituations, gtoScenarios, tatPrompts, sdtPrompts, plans: SSB_PLANS });
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

    // Fresh attempt: draw a brand-new random subset of WAT/SRT/GTO/TAT items
    // and freeze it on the row, so this attempt always shows the same items
    // on reload, but the *next* new attempt gets a different draw. Big Five +
    // the 4 trait scales are never rotated (see ssbScoring.js header for why).
    const itemSelection = buildItemSelection();

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO assessments (id, user_id, client_type, track, status, responses, item_selection)
       VALUES ($1, $2, 'b2c', 'ssb', 'in_progress', '{}'::jsonb, $3) RETURNING *`,
      [id, userId, JSON.stringify(itemSelection)]
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
//
// BUG FIX: this used to read the whole `responses` column, splice in this
// section, and write the whole column back (read-modify-write in JS). Fill
// Sample fires all 7 section saves at once (Promise.all) — under that
// concurrency, several requests would read the same stale `responses` before
// any of them had written back, so each one's UPDATE clobbered whatever the
// others had just saved. In practice that silently dropped the bigFive
// and/or traits sections, which then made submit fail with "please complete
// the trait scale" even though the user (or Fill Sample) had answered
// everything. Fixed by merging only this section's key at the database level
// via jsonb `||`, which Postgres applies against the row's value *at UPDATE
// time* (not the earlier SELECT), so concurrent saves to different sections
// can no longer overwrite each other.
router.put('/assessments/:id', requireAuth, async (req, res) => {
  try {
    const { section, answers } = req.body;
    const validSections = ['bigFive', 'traits', 'wat', 'srt', 'gto', 'tat', 'sdt'];
    if (!validSections.includes(section)) return res.status(400).json({ error: `section must be one of: ${validSections.join(', ')}` });

    const existing = await pool.query(`SELECT id, user_id, status, responses FROM assessments WHERE id = $1 AND track = 'ssb'`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    const assessment = existing.rows[0];
    if (assessment.user_id !== req.user.userId) return res.status(403).json({ error: 'Not your assessment' });
    if (assessment.status !== 'in_progress') return res.status(409).json({ error: 'This assessment has already been submitted' });

    const existingSection = (assessment.responses && assessment.responses[section]) || {};
    const mergedSection = Object.assign({}, existingSection, answers || {});

    const result = await pool.query(
      `UPDATE assessments
       SET responses = COALESCE(responses, '{}'::jsonb) || jsonb_build_object($1::text, $2::jsonb),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING id, responses`,
      [section, JSON.stringify(mergedSection), req.params.id]
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
    const requestedPlan = req.body?.planType;
    const planType = SSB_PLANS[requestedPlan] ? requestedPlan : 'ssb_basic';

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

    // itemSelection is this attempt's frozen random draw (older attempts made
    // before rotation was added won't have one — calculateOLQProfile/
    // buildSsbReportHtml fall back to the full bank in that case).
    const itemSelection = assessment.item_selection || null;

    const profile = calculateOLQProfile({
      wellnessResponses: responses.bigFive || {},
      traitResponses: responses.traits || {},
      watResponses: responses.wat || {},
      gtoResponses: responses.gto || {},
      itemSelection
    });
    const improvementPlan = buildImprovementPlan(profile.factorDetail);

    const result = await pool.query(
      `UPDATE assessments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, scores = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING id, status, submitted_at`,
      [JSON.stringify({ profile, improvementPlan }), req.params.id]
    );

    // Report HTML is now built here, server-side, from the same profile/plan
    // just computed — never trusted from (or rebuilt by) the browser. This is
    // the one and only place SSB report HTML is generated, so the candidate's
    // own view, the copy stored in `reports`, and what an admin opens in the
    // HR Panel are byte-identical by construction.
    const userRow = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.user.userId]);
    const candidateName = userRow.rows[0]?.full_name || null;
    const reportHtml = buildSsbReportHtml(profile, improvementPlan, candidateName, planType);

    // Same pilot behavior as the wellness Explore/Navigate tiers: while
    // PILOT_FREE_ACCESS is on (Razorpay isn't wired up yet), every paid
    // package releases immediately rather than blocking on payment. plan_type
    // and price are still recorded correctly for the CRM/admin view and for
    // when real payment collection goes live.
    const paymentStatus = PILOT_FREE_ACCESS ? 'admin_released' : 'pending';

    const reportId = uuidv4();
    const reportResult = await pool.query(
      `INSERT INTO reports (id, assessment_id, user_id, plan_type, html_content, payment_status, released_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, plan_type, payment_status, created_at`,
      [reportId, req.params.id, req.user.userId, planType, reportHtml, paymentStatus, paymentStatus === 'admin_released' ? new Date() : null]
    );

    res.json({
      success: true,
      assessment: result.rows[0],
      profile,
      improvementPlan,
      report: { id: reportResult.rows[0].id, planType, htmlContent: reportHtml, locked: paymentStatus === 'pending' }
    });
  } catch (error) {
    console.error('Submit SSB assessment error:', error);
    res.status(500).json({ error: 'Failed to submit your SSB assessment' });
  }
});

// Upgrade an already-submitted assessment's report to a higher paid tier —
// the SSB equivalent of the wellness Explore/Navigate "Upgrade" flow. Doesn't
// need new answers: the underlying trait/exercise responses don't change on
// an upgrade, only which sections the report includes, so this just re-runs
// buildSsbReportHtml against the profile/plan already stored on the
// assessment row at submit time and inserts one more `reports` row for the
// new tier. Same PILOT_FREE_ACCESS pilot behavior as everywhere else.
router.post('/assessments/:id/upgrade-report', requireAuth, async (req, res) => {
  try {
    const requestedPlan = req.body?.planType;
    if (!SSB_PLANS[requestedPlan]) return res.status(400).json({ error: 'Unknown report package' });
    const planType = requestedPlan;

    const existing = await pool.query(`SELECT * FROM assessments WHERE id = $1 AND track = 'ssb'`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    const assessment = existing.rows[0];
    if (assessment.user_id !== req.user.userId) return res.status(403).json({ error: 'Not your assessment' });
    if (assessment.status !== 'submitted' || !assessment.scores?.profile) {
      return res.status(409).json({ error: 'Submit your assessment before upgrading your report' });
    }

    const { profile, improvementPlan } = assessment.scores;
    const userRow = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.user.userId]);
    const candidateName = userRow.rows[0]?.full_name || null;
    const reportHtml = buildSsbReportHtml(profile, improvementPlan, candidateName, planType);

    const paymentStatus = PILOT_FREE_ACCESS ? 'admin_released' : 'pending';
    const reportId = uuidv4();
    const reportResult = await pool.query(
      `INSERT INTO reports (id, assessment_id, user_id, plan_type, html_content, payment_status, released_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, plan_type, payment_status, created_at`,
      [reportId, req.params.id, req.user.userId, planType, reportHtml, paymentStatus, paymentStatus === 'admin_released' ? new Date() : null]
    );

    res.json({
      success: true,
      report: { id: reportResult.rows[0].id, planType, htmlContent: reportHtml, locked: paymentStatus === 'pending' }
    });
  } catch (error) {
    console.error('Upgrade SSB report error:', error);
    res.status(500).json({ error: 'Failed to upgrade your report' });
  }
});

// --- Free "teaser" funnel test --------------------------------------------
// A short, ungated marketing exercise (5 quick trait items + 1 SRT + 1 TAT)
// for visitors who aren't ready to commit to the full assessment. Completely
// isolated from the `users`/`assessments` tables the real test uses — no
// login, no assessment row, just a lead captured in its own
// `ssb_teaser_leads` table — so it can never collide with or corrupt a real
// candidate's data. Every /teaser/meta call draws a fresh random subset, so
// a repeat visitor always gets new questions and a fresh score.
router.get('/teaser/meta', (req, res) => {
  const selection = buildTeaserSelection();
  res.json(Object.assign({}, selection, { plans: SSB_PLANS }));
});

router.post('/teaser/submit', async (req, res) => {
  try {
    const { name, email, phone, traitItemIds, traitResponses, srtText, tatText } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
    if (!Array.isArray(traitItemIds) || traitItemIds.length === 0) {
      return res.status(400).json({ error: 'Missing trait responses' });
    }
    const traitItems = traitItemIds.map((id) => traitItemBank.find((t) => t.id === id)).filter(Boolean);
    const { score, gradeBand } = computeTeaserScore({
      traitItems,
      traitResponses: traitResponses || {},
      srtText: srtText || '',
      tatText: tatText || ''
    });

    const id = uuidv4();
    await pool.query(
      `INSERT INTO ssb_teaser_leads (id, name, email, phone, responses, score, grade_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, name, email, phone || null, JSON.stringify({ traitItemIds, traitResponses, srtText, tatText }), score, gradeBand.label]
    );

    res.json({ success: true, score, gradeBand, plans: SSB_PLANS });
  } catch (error) {
    console.error('Submit SSB teaser error:', error);
    res.status(500).json({ error: 'Failed to score your free test' });
  }
});

export default router;
