import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { generateSchoolReportHtml } from '../utils/schoolReport.js';
import { sendBulkInviteEmails } from '../utils/mailer.js';

const router = express.Router();

// Tiny CSV parser (name,email[,designation[,subject]]) — no external
// dependency needed for a pilot-scale roster. Handles a header row if present.
function parseRosterCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const rows = lines.map((line) => line.split(',').map((c) => c.trim()));
  const first = rows[0].map((c) => c.toLowerCase());
  const hasHeader = first.includes('email') || first.includes('name');
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const nameIdx = hasHeader ? first.indexOf('name') : 0;
  const emailIdx = hasHeader ? first.indexOf('email') : 1;
  const designationIdx = hasHeader ? first.indexOf('designation') : 2;
  const subjectIdx = hasHeader ? first.indexOf('subject') : 3;

  return dataRows
    .filter((r) => r[emailIdx])
    .map((r) => ({
      fullName: r[nameIdx] || r[emailIdx].split('@')[0],
      email: r[emailIdx].toLowerCase(),
      designation: designationIdx >= 0 ? r[designationIdx] || null : null,
      subject: subjectIdx >= 0 ? r[subjectIdx] || null : null
    }));
}

// --- Admin: school block management -----------------------------------

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, district, state, country, schoolType, contactName, contactEmail, contactPhone } = req.body;
    if (!name) return res.status(400).json({ error: 'School name is required' });

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO schools (id, name, district, state, country, school_type, contact_name, contact_email, contact_phone, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, name, district || null, state || null, country || 'India', schoolType || null, contactName || null, contactEmail || null, contactPhone || null, req.user.userId]
    );

    res.status(201).json({ success: true, school: result.rows[0] });
  } catch (error) {
    console.error('Create school error:', error);
    res.status(500).json({ error: 'Failed to create school' });
  }
});

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const result = await pool.query(
      `SELECT s.*, COUNT(st.id) AS total_teachers,
              COUNT(st.id) FILTER (WHERE st.status = 'completed') AS completed_teachers
       FROM schools s
       LEFT JOIN school_teachers st ON st.school_id = s.id
       WHERE ($1::text IS NULL OR s.status = $1)
       GROUP BY s.id ORDER BY s.created_at DESC`,
      [status || null]
    );
    res.json({ schools: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

router.get('/:schoolId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM schools WHERE id = $1', [req.params.schoolId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch school' });
  }
});

// --- Admin: teacher roster upload (CSV text, or a manual JSON array) ----

router.post('/:schoolId/teachers/upload', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { csvText, teachers } = req.body; // either raw CSV text or a pre-parsed array

    const school = await pool.query('SELECT id FROM schools WHERE id = $1', [schoolId]);
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const roster = Array.isArray(teachers) ? teachers : (csvText ? parseRosterCsv(csvText) : []);
    if (roster.length === 0) return res.status(400).json({ error: 'No teacher rows found — provide csvText or a teachers array' });

    let imported = 0;
    let skipped = 0;
    for (const t of roster) {
      if (!t.email || !t.fullName) { skipped++; continue; }
      const result = await pool.query(
        `INSERT INTO school_teachers (school_id, full_name, email, designation, subject, status)
         VALUES ($1, $2, $3, $4, $5, 'invited')
         ON CONFLICT (school_id, email) DO UPDATE SET full_name = EXCLUDED.full_name,
           designation = EXCLUDED.designation, subject = EXCLUDED.subject
         RETURNING id`,
        [schoolId, t.fullName, t.email.toLowerCase(), t.designation || null, t.subject || null]
      );
      if (result.rows.length > 0) imported++;
    }

    res.json({ success: true, imported, skipped, total: roster.length });
  } catch (error) {
    console.error('Roster upload error:', error);
    res.status(500).json({ error: 'Failed to upload roster' });
  }
});

router.get('/:schoolId/teachers', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT st.*, a.status AS assessment_status, a.submitted_at
       FROM school_teachers st
       LEFT JOIN assessments a ON a.school_teacher_id = st.id
       WHERE st.school_id = $1 ORDER BY st.full_name`,
      [req.params.schoolId]
    );
    res.json({ teachers: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// --- Admin: bulk personalized email invite -----------------------------

router.post('/:schoolId/invite', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { message, assessmentUrl } = req.body;

    const schoolResult = await pool.query('SELECT * FROM schools WHERE id = $1', [schoolId]);
    if (schoolResult.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    const school = schoolResult.rows[0];

    const teachersResult = await pool.query(
      `SELECT * FROM school_teachers WHERE school_id = $1 AND status != 'completed'`,
      [schoolId]
    );

    const link = assessmentUrl || `${process.env.APP_URL || ''}/assessment?school=${schoolId}`;
    const outcome = await sendBulkInviteEmails({
      teachers: teachersResult.rows,
      schoolName: school.name,
      link,
      customMessage: message || ''
    });

    await pool.query(
      `UPDATE school_teachers SET invited_at = CURRENT_TIMESTAMP WHERE school_id = $1 AND status != 'completed'`,
      [schoolId]
    );

    res.json({ success: true, ...outcome });
  } catch (error) {
    console.error('Bulk invite error:', error);
    res.status(500).json({ error: 'Failed to send invites' });
  }
});

// --- Public-ish: teacher joins via the shared school link ---------------
// Matches the caller's email against the school's roster (email is the match
// key), creating her user account if needed, and returns a token so she can
// proceed straight into the assessment.
router.post('/:schoolId/join', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { email, fullName, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const rosterResult = await pool.query(
      'SELECT * FROM school_teachers WHERE school_id = $1 AND email = $2',
      [schoolId, email.toLowerCase()]
    );
    if (rosterResult.rows.length === 0) {
      return res.status(404).json({ error: 'This email was not found on the school roster. Please check with your school administrator.' });
    }
    const rosterEntry = rosterResult.rows[0];

    if (rosterEntry.status === 'completed' && !rosterEntry.retake_enabled) {
      return res.status(409).json({ error: 'A submission already exists for this email. Contact NavaSetu if you need a retake.' });
    }

    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    let user;
    if (userResult.rows.length === 0) {
      const passwordHash = await bcrypt.hash(password || uuidv4(), 10);
      const created = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, client_type)
         VALUES ($1, $2, $3, 'teacher', 'b2b') RETURNING *`,
        [email.toLowerCase(), passwordHash, fullName || rosterEntry.full_name]
      );
      user = created.rows[0];
    } else {
      user = userResult.rows[0];
    }

    await pool.query('UPDATE school_teachers SET user_id = $1 WHERE id = $2', [user.id, rosterEntry.id]);

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    res.json({
      success: true,
      accessToken,
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
      schoolTeacherId: rosterEntry.id,
      schoolId
    });
  } catch (error) {
    console.error('School join error:', error);
    res.status(500).json({ error: 'Failed to join school assessment' });
  }
});

// --- Admin: project-level aggregate report (school never sees this directly) ---

router.get('/:schoolId/project-report', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const schoolResult = await pool.query('SELECT * FROM schools WHERE id = $1', [schoolId]);
    if (schoolResult.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const scoresResult = await pool.query(
      `SELECT a.scores FROM assessments a
       JOIN school_teachers st ON st.id = a.school_teacher_id
       WHERE a.school_id = $1 AND a.status = 'submitted'`,
      [schoolId]
    );

    const rosterCountResult = await pool.query('SELECT COUNT(*) FROM school_teachers WHERE school_id = $1', [schoolId]);

    const { html, analytics } = generateSchoolReportHtml({
      school: schoolResult.rows[0],
      totalTeachers: parseInt(rosterCountResult.rows[0].count, 10),
      submittedScores: scoresResult.rows.map((r) => r.scores)
    });

    await pool.query(
      `INSERT INTO school_analytics (school_id, total_teachers, completed_assessments, avg_scores, at_risk_count, generated_html, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (school_id) DO UPDATE SET total_teachers = EXCLUDED.total_teachers,
         completed_assessments = EXCLUDED.completed_assessments, avg_scores = EXCLUDED.avg_scores,
         at_risk_count = EXCLUDED.at_risk_count, generated_html = EXCLUDED.generated_html, last_updated = CURRENT_TIMESTAMP`,
      [schoolId, analytics.totalTeachers, analytics.completedAssessments, JSON.stringify(analytics.avgScores), analytics.atRiskCount, html]
    );

    res.json({ html, analytics });
  } catch (error) {
    console.error('Project report error:', error);
    res.status(500).json({ error: 'Failed to generate project report' });
  }
});

// --- Archive / re-import (Task #21 — not yet implemented) ---------------

router.post('/:schoolId/archive', requireAuth, requireAdmin, async (req, res) => {
  res.status(501).json({
    error: 'Not implemented yet. Export-to-folder (roster as Excel + per-teacher PDFs + project report) and DB cleanup is planned as a follow-up feature.'
  });
});

router.post('/reimport', requireAuth, requireAdmin, async (req, res) => {
  res.status(501).json({ error: 'Not implemented yet — see the archive feature above.' });
});

export default router;
