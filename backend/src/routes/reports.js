import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Pilot switch: while true, Explore/Navigate reports release immediately
// without a real payment, since Razorpay isn't wired up yet and the user
// asked to be able to see all three tiers via the selection panel during
// the pilot. Flip PILOT_FREE_ACCESS=false in the environment once real
// payment collection goes live.
const PILOT_FREE_ACCESS = process.env.PILOT_FREE_ACCESS !== 'false';

// Store a generated report. The report HTML itself is rendered client-side
// by the (unchanged, approved) reference report template using the scores
// this server already computed at submit time — this endpoint just persists
// it so NavaSetu admins and the teacher herself can reopen it later, and so
// the payment gate (Explore/Navigate) can be enforced server-side.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { assessmentId, planType, htmlContent } = req.body;
    if (!assessmentId || !planType) return res.status(400).json({ error: 'assessmentId and planType are required' });

    const assessmentResult = await pool.query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);
    if (assessmentResult.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    const assessment = assessmentResult.rows[0];

    if (assessment.user_id !== req.user.userId) return res.status(403).json({ error: 'Not your assessment' });
    if (assessment.status !== 'submitted') return res.status(409).json({ error: 'Submit the assessment before generating a report' });

    // B2B is always Navigate tier, and school payment happens outside the portal
    const isB2B = assessment.client_type === 'b2b';
    const effectivePlan = isB2B ? 'navigate' : planType;

    let paymentStatus = 'not_required';
    if (!isB2B && (effectivePlan === 'explore' || effectivePlan === 'navigate')) {
      paymentStatus = PILOT_FREE_ACCESS ? 'admin_released' : 'pending';
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO reports (id, assessment_id, user_id, plan_type, html_content, payment_status, released_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, plan_type, payment_status, created_at`,
      [id, assessmentId, req.user.userId, effectivePlan, htmlContent || null, paymentStatus,
       paymentStatus === 'not_required' || paymentStatus === 'admin_released' ? new Date() : null]
    );

    res.status(201).json({ success: true, report: result.rows[0], locked: paymentStatus === 'pending' });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

// Fetch a report. Locked (pending payment) reports return 402 with no content
// for anyone but the owner/admin, who still see the lock rather than the HTML.
router.get('/:reportId', requireAuth, async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });

    const report = result.rows[0];
    if (report.user_id !== req.user.userId && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized to view this report' });
    }

    if (report.payment_status === 'pending') {
      return res.status(402).json({ error: 'Payment required to unlock this report', planType: report.plan_type });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// All reports generated for one assessment (used by the "My Reports" list / plan switcher)
router.get('/by-assessment/:assessmentId', requireAuth, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const result = await pool.query(
      'SELECT id, plan_type, payment_status, created_at, released_at FROM reports WHERE assessment_id = $1 ORDER BY created_at DESC',
      [assessmentId]
    );
    res.json({ reports: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Admin manually releases a locked report (pilot payment-control path)
router.post('/:reportId/admin-release', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await pool.query(
      `UPDATE reports SET payment_status = 'admin_released', released_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [reportId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });

    await pool.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [req.user.userId, 'admin_release_report', 'report', reportId]
    );

    res.json({ success: true, report: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to release report' });
  }
});

export default router;
