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
    const { isTest } = req.body || {};

    const existing = await pool.query(
      `SELECT * FROM assessments WHERE user_id = $1 AND track = 'ssb' AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (existing.rows.length > 0) {
      let row = existing.rows[0];
      // BUG FIX: fillSampleSSB() always passes isTest:true, expecting to
      // always start a genuinely fresh (and therefore correctly test-marked)
      // attempt — but the page's own auto-resume check (on login/page load)
      // can silently create an in-progress row first, with no isTest flag.
      // When that happens this endpoint used to just hand back that row as
      // "resumed", so the sample run would submit against a non-test row and
      // its report would never get the TEST REPORT banner. Only ever
      // escalates false -> true here (never demotes a real candidate's own
      // in-progress draft), and only for a row that hasn't been submitted yet.
      if (isTest && !row.is_test) {
        const updated = await pool.query(
          `UPDATE assessments SET is_test = true WHERE id = $1 AND status = 'in_progress' RETURNING *`,
          [row.id]
        );
        if (updated.rows.length > 0) row = updated.rows[0];
      }
      return res.json({ success: true, assessment: row, resumed: true });
    }

    // Fresh attempt: draw a brand-new random subset of WAT/SRT/GTO/TAT items
    // and freeze it on the row, so this attempt always shows the same items
    // on reload, but the *next* new attempt gets a different draw. Big Five +
    // the 4 trait scales are never rotated (see ssbScoring.js header for why).
    const itemSelection = buildItemSelection();

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO assessments (id, user_id, client_type, track, status, responses, item_selection, is_test)
       VALUES ($1, $2, 'b2c', 'ssb', 'in_progress', '{}'::jsonb, $3, $4) RETURNING *`,
      [id, userId, JSON.stringify(itemSelection), !!isTest]
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
      `SELECT id, status, created_at, submitted_at, is_test FROM assessments WHERE user_id = $1 AND track = 'ssb' ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ assessments: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your SSB assessments' });
  }
});

// Wipe every one of the caller's own pilot "Fill Sample" SSB attempts (and
// their reports, via cascade) in one call — used by the frontend right
// before Logout so test data never survives a session. Declared before the
// param routes below so "test-data" is never captured as :id. Never touches
// the `users` row, so a visitor who only ever ran a sample still shows up as
// a CRM lead.
router.delete('/assessments/test-data', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM assessments WHERE user_id = $1 AND track = 'ssb' AND is_test = true RETURNING id`,
      [req.user.userId]
    );
    res.json({ success: true, deleted: result.rows.length });
  } catch (error) {
    console.error('Delete my SSB test data error:', error);
    res.status(500).json({ error: 'Failed to delete your test data' });
  }
});

// Delete one of the caller's own pilot "Fill Sample" SSB attempts (cascades
// to its reports). Scoped to is_test = true — a real, submitted attempt can
// never be deleted this way.
router.delete('/assessments/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM assessments WHERE id = $1 AND user_id = $2 AND track = 'ssb' AND is_test = true RETURNING id`,
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found, not yours, or not a test attempt (only test attempts can be deleted)' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete test SSB assessment error:', error);
    res.status(500).json({ error: 'Failed to delete this attempt' });
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
    // TEST REPORT marking: inherited from the assessment's own is_test flag
    // (set only by the pilot "Fill Sample" feature at /assessments start),
    // never re-derived from anything the client sends at submit time.
    const isTest = !!assessment.is_test;
    const reportHtml = buildSsbReportHtml(profile, improvementPlan, candidateName, planType, isTest);

    // Same pilot behavior as the wellness Explore/Navigate tiers: while
    // PILOT_FREE_ACCESS is on (Razorpay isn't wired up yet), every paid
    // package releases immediately rather than blocking on payment. plan_type
    // and price are still recorded correctly for the CRM/admin view and for
    // when real payment collection goes live.
    const paymentStatus = PILOT_FREE_ACCESS ? 'admin_released' : 'pending';

    const reportId = uuidv4();
    const reportResult = await pool.query(
      `INSERT INTO reports (id, assessment_id, user_id, plan_type, html_content, payment_status, released_at, is_test)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, plan_type, payment_status, created_at, is_test`,
      [reportId, req.params.id, req.user.userId, planType, reportHtml, paymentStatus, paymentStatus === 'admin_released' ? new Date() : null, isTest]
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

    // Same inherited TEST REPORT marking as the submit route above.
    const isTest = !!assessment.is_test;

    // BUG FIX: mirrors the wellness reports.js fix — an upgrade click fired
    // twice (double-click, retry after a slow response, etc.) used to insert
    // a second copy of the same tier's report for a real candidate. Real
    // reports are generated once per tier and then immutable; test reports
    // keep the old always-insert behavior since multiple sample sets are
    // expected there.
    if (!isTest) {
      const existingReport = await pool.query(
        `SELECT id, plan_type, payment_status, created_at, html_content, is_test FROM reports
         WHERE assessment_id = $1 AND plan_type = $2 AND is_test = false LIMIT 1`,
        [req.params.id, planType]
      );
      if (existingReport.rows.length > 0) {
        const r = existingReport.rows[0];
        return res.json({ success: true, report: { id: r.id, planType: r.plan_type, htmlContent: r.html_content, locked: r.payment_status === 'pending' }, alreadyExisted: true });
      }
    }

    const { profile, improvementPlan } = assessment.scores;
    const userRow = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.user.userId]);
    const candidateName = userRow.rows[0]?.full_name || null;
    const reportHtml = buildSsbReportHtml(profile, improvementPlan, candidateName, planType, isTest);

    const paymentStatus = PILOT_FREE_ACCESS ? 'admin_released' : 'pending';
    const reportId = uuidv4();
    const reportResult = await pool.query(
      `INSERT INTO reports (id, assessment_id, user_id, plan_type, html_content, payment_status, released_at, is_test)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, plan_type, payment_status, created_at, is_test`,
      [reportId, req.params.id, req.user.userId, planType, reportHtml, paymentStatus, paymentStatus === 'admin_released' ? new Date() : null, isTest]
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
