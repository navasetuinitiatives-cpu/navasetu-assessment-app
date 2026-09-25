import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin, requireStaff } from '../middleware/auth.js';
import { questionBank } from '../utils/scoring.js';

const router = express.Router();

router.use(requireAuth);

// Returns true if the logged-in staff member (admin or counsellor) may act
// on this lead. Admins can always act; counsellors only on leads assigned
// to them. Centralized here so every per-lead route enforces it the same
// way — this is the actual security boundary, not just UI hiding.
async function canAccessLead(req, userId) {
  if (req.user.role === 'platform_admin') return true;
  if (req.user.role !== 'counsellor') return false;
  const result = await pool.query('SELECT assigned_to FROM users WHERE id = $1', [userId]);
  return result.rows.length > 0 && result.rows[0].assigned_to === req.user.userId;
}

// --- NavaSetu staff accounts (platform_admin + counsellor roles) --------
// Lets an existing admin create/edit/remove other staff, each with their
// own email + password. Admin-only — counsellors never see this list.

router.get('/admins', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, created_at, last_login FROM users
       WHERE role IN ('platform_admin', 'counsellor') ORDER BY role, created_at ASC`
    );
    res.json({ admins: result.rows });
  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

router.post('/admins', requireAdmin, async (req, res) => {
  try {
    let { email, password, fullName, role } = req.body;
    role = role === 'counsellor' ? 'counsellor' : 'platform_admin';
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Name, email and password are all required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    // Normalize so this always matches an existing account regardless of
    // how the email was capitalized when that person first registered —
    // Postgres text equality is case-sensitive, so without this, adding an
    // admin whose email differs only in case from an existing row creates a
    // silent duplicate (a second account) instead of promoting the real one.
    email = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      // They already have an account (e.g. took the assessment first) —
      // promote it to staff rather than erroring out or duplicating it.
      const result = await pool.query(
        `UPDATE users SET role = $1, full_name = $2, password_hash = $3 WHERE id = $4
         RETURNING id, email, full_name, role, created_at`,
        [role, fullName, passwordHash, existing.rows[0].id]
      );
      return res.status(200).json({ admin: result.rows[0], promoted: true });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, client_type, status)
       VALUES ($1, $2, $3, $4, $5, 'b2c', 'active')
       RETURNING id, email, full_name, role, created_at`,
      [id, email, passwordHash, fullName, role]
    );
    res.status(201).json({ admin: result.rows[0] });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

router.put('/admins/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let { email, password, fullName, role } = req.body;
    if (email) email = email.trim().toLowerCase();
    if (role && !['platform_admin', 'counsellor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be platform_admin or counsellor' });
    }

    const target = await pool.query(`SELECT * FROM users WHERE id = $1 AND role IN ('platform_admin', 'counsellor')`, [id]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

    if (email && email !== target.rows[0].email) {
      const clash = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (clash.rows.length > 0) return res.status(409).json({ error: 'That email is already registered' });
    }
    if (password && password.length > 0 && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    // Demoting the last remaining admin to counsellor would lock everyone out.
    if (role === 'counsellor' && target.rows[0].role === 'platform_admin') {
      const countResult = await pool.query(`SELECT COUNT(*) AS n FROM users WHERE role = 'platform_admin'`);
      if (parseInt(countResult.rows[0].n, 10) <= 1) {
        return res.status(400).json({ error: 'At least one admin account must remain' });
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : target.rows[0].password_hash;
    const result = await pool.query(
      `UPDATE users SET email = $1, full_name = $2, password_hash = $3, role = $4 WHERE id = $5
       RETURNING id, email, full_name, role, created_at`,
      [email || target.rows[0].email, fullName || target.rows[0].full_name, passwordHash, role || target.rows[0].role, id]
    );
    res.json({ admin: result.rows[0] });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

router.delete('/admins/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.userId) {
      return res.status(400).json({ error: "You can't remove your own account while logged in as it" });
    }
    const target = await pool.query(`SELECT role FROM users WHERE id = $1 AND role IN ('platform_admin', 'counsellor')`, [id]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });
    if (target.rows[0].role === 'platform_admin') {
      const countResult = await pool.query(`SELECT COUNT(*) AS n FROM users WHERE role = 'platform_admin'`);
      if (parseInt(countResult.rows[0].n, 10) <= 1) {
        return res.status(400).json({ error: 'At least one admin account must remain' });
      }
    }
    // Reassign any leads this counsellor owned back to unassigned rather
    // than leaving a dangling assigned_to (the FK itself would already
    // SET NULL on delete, but doing it explicitly first lets us tell the
    // admin how many leads need re-assignment).
    const orphaned = await pool.query(`SELECT COUNT(*) AS n FROM users WHERE assigned_to = $1`, [id]);
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 AND role IN ('platform_admin', 'counsellor') RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });
    res.json({ success: true, unassignedLeads: parseInt(orphaned.rows[0].n, 10) });
  } catch (error) {
    console.error('Delete admin error:', error);
    // 23503 = Postgres foreign-key violation. This account owns real data
    // elsewhere (e.g. it was promoted from an existing individual/teacher
    // account with its own reports or orders) — deleting it would orphan
    // that data, so we refuse instead of failing silently.
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'This account still owns other records (e.g. reports, orders, or an assessment history from before it was promoted to staff) and can\'t be deleted while those exist.'
      });
    }
    res.status(500).json({ error: 'Failed to remove staff member' });
  }
});

// System status
router.get('/system', requireAdmin, async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT COUNT(*) AS user_count FROM users');
    res.json({ status: 'ok', environment: process.env.NODE_ENV, database: 'connected', userCount: parseInt(dbCheck.rows[0].user_count, 10) });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// Central CRM: every lead (B2C individual + B2B teacher) with the columns
// the pilot's CRM view needs — name, email, mobile, type, institution, plan,
// status, and a stable, human-facing lead number. Counsellors only ever see
// leads assigned to them; admins see everyone and who each is assigned to.
router.get('/leads', requireStaff, async (req, res) => {
  try {
    const { search, clientType } = req.query;
    const isCounsellor = req.user.role === 'counsellor';
    const result = await pool.query(
      `SELECT u.id, u.lead_number, u.email, u.full_name, u.phone_number, u.role, u.client_type,
              u.lead_status, u.created_at, u.last_login, u.assigned_to, u.deleted_at, u.delete_reason,
              ass.full_name AS assigned_to_name,
              a.id AS latest_assessment_id, a.status AS assessment_status, a.submitted_at,
              COALESCE(d.institution, s.name) AS institution,
              r.plan_type AS plan,
              (SELECT COUNT(*) FROM reports rc WHERE rc.user_id = u.id) AS report_count
       FROM users u
       LEFT JOIN users ass ON ass.id = u.assigned_to
       LEFT JOIN LATERAL (
         SELECT * FROM assessments WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
       ) a ON true
       LEFT JOIN schools s ON s.id = a.school_id
       LEFT JOIN user_demographics d ON d.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT plan_type FROM reports WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
       ) r ON true
       WHERE u.role NOT IN ('platform_admin', 'counsellor')
         AND ($1::text IS NULL OR u.full_name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR u.client_type = $2)
         AND ($3::uuid IS NULL OR u.assigned_to = $3)
       ORDER BY u.lead_number ASC
       LIMIT 300`,
      [search || null, clientType || null, isCounsellor ? req.user.userId : null]
    );
    res.json({ leads: result.rows });
  } catch (error) {
    console.error('Leads fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Update a lead's CRM status (submitted -> counselling_booked -> counselled)
router.put('/leads/:userId/status', requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!(await canAccessLead(req, userId))) return res.status(403).json({ error: 'You do not have access to this lead' });
    const { status } = req.body;
    const allowed = ['fresh_lead', 'submitted', 'counselling_booked', 'counselled', 'junked'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }
    const result = await pool.query(
      `UPDATE users SET lead_status = $1 WHERE id = $2 AND role != 'platform_admin'
       RETURNING id, lead_number, lead_status`,
      [status, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Update lead status error:', error);
    res.status(500).json({ error: 'Failed to update lead status' });
  }
});

// Admin-only: assign/reassign/unassign a lead to a counsellor (or back to
// unassigned with counsellorId: null) — the "transfer" action.
router.put('/leads/:userId/assign', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { counsellorId } = req.body;
    if (counsellorId) {
      const counsellor = await pool.query(`SELECT id FROM users WHERE id = $1 AND role = 'counsellor'`, [counsellorId]);
      if (counsellor.rows.length === 0) return res.status(404).json({ error: 'Counsellor not found' });
    }
    const result = await pool.query(
      `UPDATE users SET assigned_to = $1 WHERE id = $2 AND role NOT IN ('platform_admin', 'counsellor')
       RETURNING id, assigned_to`,
      [counsellorId || null, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Assign lead error:', error);
    res.status(500).json({ error: 'Failed to assign lead' });
  }
});

// Manual lead entry — a counsellor (or admin) adding a prospect they know
// about before that person has registered/taken the assessment themselves.
// Auto-assigns to the creating counsellor (admins may optionally assign to
// someone else via counsellorId). Creates a placeholder account row
// (has_registered = false) with a random unusable password; if this person
// later actually registers with the same email, /auth/register recognizes
// the placeholder and "claims" it with their real password instead of
// rejecting it as a duplicate.
router.post('/leads', requireStaff, async (req, res) => {
  try {
    let { fullName, email, phoneNumber, institution, clientType, counsellorId } = req.body;
    if (!fullName || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    email = email.trim().toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A lead or account with that email already exists' });
    }

    let assignedTo = req.user.role === 'counsellor' ? req.user.userId : null;
    if (req.user.role === 'platform_admin' && counsellorId) {
      const counsellor = await pool.query(`SELECT id FROM users WHERE id = $1 AND role = 'counsellor'`, [counsellorId]);
      if (counsellor.rows.length === 0) return res.status(404).json({ error: 'Counsellor not found' });
      assignedTo = counsellorId;
    }

    const id = uuidv4();
    const placeholderHash = await bcrypt.hash(uuidv4(), 10);
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, phone_number, role, client_type, assigned_to, has_registered)
       VALUES ($1, $2, $3, $4, $5, 'individual', $6, $7, false)
       RETURNING id, lead_number, email, full_name, phone_number, lead_status, assigned_to`,
      [id, email, placeholderHash, fullName, phoneNumber || null, clientType === 'b2b' ? 'b2b' : 'b2c', assignedTo]
    );

    if (institution) {
      await pool.query(
        `INSERT INTO user_demographics (user_id, institution) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET institution = EXCLUDED.institution`,
        [id, institution]
      );
    }

    res.status(201).json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Manual lead create error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Soft-delete only — no route anywhere hard-deletes a lead. Counsellors can
// only do this on their own leads and must give a reason; the row stays in
// place (struck through in the UI) so admins retain a full audit trail.
router.post('/leads/:userId/delete', requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!(await canAccessLead(req, userId))) return res.status(403).json({ error: 'You do not have access to this lead' });
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'A reason is required to delete a lead' });
    const result = await pool.query(
      `UPDATE users SET deleted_at = CURRENT_TIMESTAMP, delete_reason = $1
       WHERE id = $2 AND role NOT IN ('platform_admin', 'counsellor') RETURNING id`,
      [reason.trim(), userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Admin-only: undo a soft-delete.
router.post('/leads/:userId/restore', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET deleted_at = NULL, delete_reason = NULL WHERE id = $1 RETURNING id`,
      [req.params.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore lead' });
  }
});

router.get('/leads/:userId', requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!(await canAccessLead(req, userId))) return res.status(403).json({ error: 'You do not have access to this lead' });

    const user = await pool.query(
      `SELECT u.id, u.lead_number, u.email, u.full_name, u.phone_number, u.role, u.client_type,
              u.lead_status, u.created_at, u.last_login, u.assigned_to, u.deleted_at, u.delete_reason,
              ass.full_name AS assigned_to_name
       FROM users u LEFT JOIN users ass ON ass.id = u.assigned_to WHERE u.id = $1`,
      [userId]
    );
    if (user.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const demographics = await pool.query('SELECT * FROM user_demographics WHERE user_id = $1', [userId]);
    const assessments = await pool.query('SELECT * FROM assessments WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    const reports = await pool.query('SELECT id, plan_type, payment_status, created_at, released_at FROM reports WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    const orders = req.user.role === 'platform_admin'
      ? (await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId])).rows
      : []; // payment/order detail stays admin-only, even for a counsellor's own lead

    res.json({
      user: user.rows[0],
      demographics: demographics.rows[0] || null,
      assessments: assessments.rows,
      reports: reports.rows,
      orders
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lead detail' });
  }
});

// --- Lead Activity (emails sent + manual notes) -------------------------
// Matched by user_id when known, falling back to the lead's email so an
// invite sent before a teacher had an account still shows up once they
// register (email is the only thing we have at invite time).
router.get('/leads/:userId/activity', requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!(await canAccessLead(req, userId))) return res.status(403).json({ error: 'You do not have access to this lead' });
    const user = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    const result = await pool.query(
      `SELECT la.*, u.full_name AS created_by_name FROM lead_activity la
       LEFT JOIN users u ON u.id = la.created_by
       WHERE la.user_id = $1 OR la.recipient_email = $2
       ORDER BY la.created_at DESC`,
      [userId, user.rows[0].email]
    );
    res.json({ activity: result.rows });
  } catch (error) {
    console.error('Fetch activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.post('/leads/:userId/notes', requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!(await canAccessLead(req, userId))) return res.status(403).json({ error: 'You do not have access to this lead' });
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: 'Note text is required' });
    const user = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    const result = await pool.query(
      `INSERT INTO lead_activity (user_id, recipient_email, type, body, created_by)
       VALUES ($1, $2, 'note', $3, $4) RETURNING *`,
      [userId, user.rows[0].email, body.trim(), req.user.userId]
    );
    res.status(201).json({ activity: result.rows[0] });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// --- Appointments (counselling sessions) --------------------------------
// Built on the existing consultation_requests table. consultant_name is a
// free-text field since the pilot doesn't maintain a consultants roster —
// consultant_id stays available for later if that changes.
router.get('/leads/:userId/appointments', requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!(await canAccessLead(req, userId))) return res.status(403).json({ error: 'You do not have access to this lead' });
    const result = await pool.query(
      `SELECT cr.*, u.full_name AS created_by_name FROM consultation_requests cr
       LEFT JOIN users u ON u.id = cr.created_by
       WHERE cr.user_id = $1 ORDER BY COALESCE(cr.scheduled_at, cr.preferred_slot) DESC NULLS LAST, cr.created_at DESC`,
      [userId]
    );
    res.json({ appointments: result.rows });
  } catch (error) {
    console.error('Fetch appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

router.post('/leads/:userId/appointments', requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!(await canAccessLead(req, userId))) return res.status(403).json({ error: 'You do not have access to this lead' });
    const { consultantName, scheduledAt, notes, status } = req.body;
    const user = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    const result = await pool.query(
      `INSERT INTO consultation_requests (user_id, consultant_name, scheduled_at, notes, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, consultantName || null, scheduledAt || null, notes || null, status || (scheduledAt ? 'scheduled' : 'requested'), req.user.userId]
    );
    // Booking an appointment is a strong signal to move the lead's CRM stage.
    if ((status || 'scheduled') !== 'cancelled') {
      await pool.query(
        `UPDATE users SET lead_status = 'counselling_booked' WHERE id = $1 AND lead_status NOT IN ('counselled', 'junked')`,
        [userId]
      );
    }
    res.status(201).json({ appointment: result.rows[0] });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

router.put('/appointments/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { consultantName, scheduledAt, notes, status } = req.body;
    const existing = await pool.query('SELECT * FROM consultation_requests WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    const current = existing.rows[0];
    if (!(await canAccessLead(req, current.user_id))) return res.status(403).json({ error: 'You do not have access to this lead' });
    const result = await pool.query(
      `UPDATE consultation_requests SET consultant_name = $1, scheduled_at = $2, notes = $3, status = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [
        consultantName !== undefined ? consultantName : current.consultant_name,
        scheduledAt !== undefined ? scheduledAt : current.scheduled_at,
        notes !== undefined ? notes : current.notes,
        status || current.status,
        id
      ]
    );
    if (status === 'completed') {
      await pool.query(`UPDATE users SET lead_status = 'counselled' WHERE id = $1`, [current.user_id]);
    }
    res.json({ appointment: result.rows[0] });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// All counselling appointments across every lead, for the Calendar tab.
// Kept simple (no pagination) — pilot scale, and the frontend groups these
// by date client-side to draw the month grid.
router.get('/appointments', requireStaff, async (req, res) => {
  try {
    const isCounsellor = req.user.role === 'counsellor';
    const result = await pool.query(
      `SELECT cr.*, u.full_name AS lead_name, u.email AS lead_email, u.lead_number
       FROM consultation_requests cr
       JOIN users u ON u.id = cr.user_id
       WHERE ($1::uuid IS NULL OR u.assigned_to = $1)
       ORDER BY COALESCE(cr.scheduled_at, cr.preferred_slot) ASC NULLS LAST`,
      [isCounsellor ? req.user.userId : null]
    );
    res.json({ appointments: result.rows });
  } catch (error) {
    console.error('Fetch all appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Admin can view a lead's raw assessment answers (question text + the
// option they picked), not just the generated report — useful when a
// counsellor wants to see exactly how someone answered before a session.
router.get('/assessments/:assessmentId/responses', requireStaff, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assessments WHERE id = $1', [req.params.assessmentId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    const assessment = result.rows[0];
    if (!(await canAccessLead(req, assessment.user_id))) return res.status(403).json({ error: 'You do not have access to this lead' });
    const responses = assessment.responses || {};
    const items = questionBank.map((q) => {
      const answerIdx = responses[q.id];
      return {
        id: q.id,
        text: q.text,
        answerText: (answerIdx !== undefined && answerIdx !== null && q.options) ? q.options[answerIdx] : null,
        answered: answerIdx !== undefined && answerIdx !== null
      };
    });
    res.json({
      assessmentId: assessment.id,
      status: assessment.status,
      submittedAt: assessment.submitted_at,
      items
    });
  } catch (error) {
    console.error('Fetch responses error:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// Admin can view any report's stored HTML directly (individual reports —
// this is the "NavaSetu can access any report" rule; the school cannot)
router.get('/reports/:reportId', requireStaff, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.reportId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    if (!(await canAccessLead(req, result.rows[0].user_id))) return res.status(403).json({ error: 'You do not have access to this lead' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

export default router;
