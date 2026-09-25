import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { generateSchoolReportHtml } from '../utils/schoolReport.js';
import { sendBulkInviteEmails, sendEmailWithAttachment } from '../utils/mailer.js';
// Default import (not `import * as XLSX`) — xlsx is a CommonJS package, and
// the default import is the one interop pattern guaranteed to expose its
// exports (.utils, .write, etc.) regardless of how Node's ESM/CJS static
// analysis handles the package's internal export style.
import XLSX from 'xlsx';

// Column order/labels must match what the frontend's "Download Template"
// button and the roster upload parser both expect.
const ROSTER_TEMPLATE_HEADERS = ['Employee ID', 'Full Name', 'Email', 'Mobile Number', 'Subject (Optional)'];

function buildRosterTemplateBuffer() {
  const worksheet = XLSX.utils.aoa_to_sheet([ROSTER_TEMPLATE_HEADERS]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Teacher Roster');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

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

// Builds a short, human-typeable code from the school name (e.g. "Greenwood
// Public School" -> "GREENWOOD482"), retrying on the rare collision.
async function generateUniqueSchoolCode(name) {
  const base = (name || 'SCHOOL')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10) || 'SCHOOL';
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.floor(100 + Math.random() * 900); // 3 digits
    const code = `${base}${suffix}`;
    const existing = await pool.query('SELECT id FROM schools WHERE school_code = $1', [code]);
    if (existing.rows.length === 0) return code;
  }
  return `${base}${Date.now().toString().slice(-6)}`; // extremely unlikely fallback
}

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, district, state, country, schoolType, contactName, contactEmail, contactPhone, contactDesignation } = req.body;
    if (!name) return res.status(400).json({ error: 'School name is required' });

    const id = uuidv4();
    const schoolCode = await generateUniqueSchoolCode(name);
    const result = await pool.query(
      `INSERT INTO schools (id, name, district, state, country, school_type, contact_name, contact_email, contact_phone, contact_designation, created_by, school_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id, name, district || null, state || null, country || 'India', schoolType || null, contactName || null, contactEmail || null, contactPhone || null, contactDesignation || null, req.user.userId, schoolCode]
    );

    res.status(201).json({ success: true, school: result.rows[0] });
  } catch (error) {
    console.error('Create school error:', error);
    res.status(500).json({ error: 'Failed to create school' });
  }
});

// Admin can edit a school's own details (name, location, contact person)
// after creation — the "Manage" page's editable top section.
router.put('/:schoolId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { name, district, state, country, schoolType, contactName, contactEmail, contactPhone, contactDesignation } = req.body;
    const existing = await pool.query('SELECT * FROM schools WHERE id = $1', [schoolId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    const s = existing.rows[0];
    const result = await pool.query(
      `UPDATE schools SET name = $1, district = $2, state = $3, country = $4, school_type = $5,
         contact_name = $6, contact_email = $7, contact_phone = $8, contact_designation = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [
        name || s.name, district ?? s.district, state ?? s.state, country ?? s.country, schoolType ?? s.school_type,
        contactName ?? s.contact_name, contactEmail ?? s.contact_email, contactPhone ?? s.contact_phone,
        contactDesignation ?? s.contact_designation, schoolId
      ]
    );
    res.json({ success: true, school: result.rows[0] });
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({ error: 'Failed to update school' });
  }
});

// Admin can regenerate a school's code (e.g. if it leaked beyond the intended
// cohort and needs to be rotated).
router.post('/:schoolId/regenerate-code', requireAuth, requireAdmin, async (req, res) => {
  try {
    const school = await pool.query('SELECT name FROM schools WHERE id = $1', [req.params.schoolId]);
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const newCode = await generateUniqueSchoolCode(school.rows[0].name);
    const result = await pool.query(
      'UPDATE schools SET school_code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newCode, req.params.schoolId]
    );
    res.json({ success: true, school: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to regenerate code' });
  }
});

// Public: resolve a school code to a school id/name, used by the login/register
// screen's "Have a school code?" field before it calls /join.
router.get('/by-code/:code', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM schools WHERE school_code = $1 AND status = 'active'`,
      [req.params.code.toUpperCase().trim()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'That school code was not recognized. Please check with your school administrator.' });
    res.json({ schoolId: result.rows[0].id, schoolName: result.rows[0].name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to look up school code' });
  }
});

// Downloadable roster template — used by the "Download Template" button so
// the admin's copy and the one emailed to schools are always identical.
// Registered before GET /:schoolId so "roster-template.xlsx" isn't swallowed
// as a schoolId.
router.get('/roster-template.xlsx', requireAuth, requireAdmin, (req, res) => {
  const buffer = buildRosterTemplateBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="navasetu-teacher-roster-template.xlsx"');
  res.send(buffer);
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
        `INSERT INTO school_teachers (school_id, full_name, email, designation, subject, employee_id, phone_number, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'invited')
         ON CONFLICT (school_id, email) DO UPDATE SET full_name = EXCLUDED.full_name,
           designation = EXCLUDED.designation, subject = EXCLUDED.subject,
           employee_id = EXCLUDED.employee_id, phone_number = EXCLUDED.phone_number
         RETURNING id`,
        [schoolId, t.fullName, t.email.toLowerCase(), t.designation || null, t.subject || null, t.employeeId || null, t.phoneNumber || null]
      );
      if (result.rows.length > 0) imported++;
    }

    res.json({ success: true, imported, skipped, total: roster.length });
  } catch (error) {
    console.error('Roster upload error:', error);
    res.status(500).json({ error: 'Failed to upload roster' });
  }
});

// Admin/counsellor manual status override — independent of the automatic
// invited -> in_progress -> completed flow driven by actual assessment
// activity, for cases like "she emailed her responses separately".
router.put('/:schoolId/teachers/:teacherId/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { schoolId, teacherId } = req.params;
    const { status } = req.body;
    const allowed = ['invited', 'in_progress', 'completed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    const result = await pool.query(
      `UPDATE school_teachers SET status = $1 WHERE id = $2 AND school_id = $3 RETURNING *`,
      [status, teacherId, schoolId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Teacher not found on this roster' });
    res.json({ success: true, teacher: result.rows[0] });
  } catch (error) {
    console.error('Update teacher status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
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

// Downloadable roster template — used by the "Download Template" button so
// the admin's copy and the one emailed to schools are always identical.
// Emails the roster template + this school's code to its registered contact
// person, straight from the Manage page — so the admin doesn't have to
// download and forward it by hand.
router.post('/:schoolId/send-template', requireAuth, requireAdmin, async (req, res) => {
  try {
    const school = await pool.query('SELECT * FROM schools WHERE id = $1', [req.params.schoolId]);
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    const s = school.rows[0];
    if (!s.contact_email) {
      return res.status(400).json({ error: 'This school has no contact email on file yet — add one on the Manage page first.' });
    }

    const buffer = buildRosterTemplateBuffer();
    const text = `Dear ${s.contact_name || 'Sir/Madam'},

Please find attached the teacher roster template for ${s.name}'s NavaSetu Teacher Wellness Assessment.

Your school code is: ${s.school_code}

Fill in one row per teacher (Employee ID, Full Name, Email, Mobile Number, and Subject if applicable) and send it back to us, or share it with your NavaSetu point of contact to upload directly.

Warm regards,
NavaSetu Initiatives
navasetuinitiatives@gmail.com | www.navasetu.online`;

    const outcome = await sendEmailWithAttachment({
      to: s.contact_email,
      subject: `${s.name} — Teacher Roster Template & School Code`,
      text,
      attachment: { filename: 'navasetu-teacher-roster-template.xlsx', content: buffer }
    });

    res.json({ success: true, ...outcome });
  } catch (error) {
    console.error('Send template email error:', error);
    res.status(500).json({ error: 'Failed to send template email' });
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
      schoolCode: school.school_code,
      customMessage: message || ''
    });

    await pool.query(
      `UPDATE school_teachers SET invited_at = CURRENT_TIMESTAMP WHERE school_id = $1 AND status != 'completed'`,
      [schoolId]
    );

    // Log this invite into each teacher's lead activity feed so it shows up
    // in their admin detail view, even if they don't have an account yet
    // (matched by email — see GET /admin/leads/:userId/activity).
    const subject = `${school.name} — NavaSetu Teacher Wellness Assessment`;
    const activityBody = `Invite link: ${link}${message ? `\n\nPersonal message: ${message}` : ''}`;
    for (const teacher of teachersResult.rows) {
      const emailLower = (teacher.email || '').trim().toLowerCase();
      if (!emailLower) continue;
      const matchedUser = await pool.query('SELECT id FROM users WHERE email = $1', [emailLower]);
      await pool.query(
        `INSERT INTO lead_activity (user_id, recipient_email, type, subject, body, created_by)
         VALUES ($1, $2, 'email', $3, $4, $5)`,
        [matchedUser.rows[0] ? matchedUser.rows[0].id : null, emailLower, subject, activityBody, req.user.userId]
      );
    }

    res.json({ success: true, ...outcome });
  } catch (error) {
    console.error('Bulk invite error:', error);
    res.status(500).json({ error: 'Failed to send invites' });
  }
});

// --- Public-ish: teacher joins a school project (via shared link OR school
// code — both resolve to the same schoolId and run the same logic) ---------
// Matches the caller's email against the school's roster (email is the match
// key), creating her user account if needed, and returns a token so she can
// proceed straight into the assessment.
async function joinSchoolByEmail(schoolId, { email, fullName, password }, res) {
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

  // Returned the same way auth.js's /login does, so a teacher returning to an
  // in-progress school assessment doesn't get asked for her demographics again.
  const demographicsResult = await pool.query('SELECT * FROM user_demographics WHERE user_id = $1', [user.id]);

  res.json({
    success: true,
    accessToken,
    user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
    demographics: demographicsResult.rows[0] || null,
    schoolTeacherId: rosterEntry.id,
    schoolId
  });
}

router.post('/:schoolId/join', async (req, res) => {
  try {
    await joinSchoolByEmail(req.params.schoolId, req.body, res);
  } catch (error) {
    console.error('School join error:', error);
    res.status(500).json({ error: 'Failed to join school assessment' });
  }
});

// Same join flow, but starting from a human-typed school code instead of a
// pre-filled schoolId from a link — this is what the login/register screen's
// "Have a school code?" field calls.
router.post('/by-code/:code/join', async (req, res) => {
  try {
    const schoolResult = await pool.query(
      `SELECT id FROM schools WHERE school_code = $1 AND status = 'active'`,
      [req.params.code.toUpperCase().trim()]
    );
    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ error: 'That school code was not recognized. Please check with your school administrator.' });
    }
    await joinSchoolByEmail(schoolResult.rows[0].id, req.body, res);
  } catch (error) {
    console.error('School join-by-code error:', error);
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
