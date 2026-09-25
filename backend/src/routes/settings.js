import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin, requireStaff } from '../middleware/auth.js';

const router = express.Router();

// Public: org name + whether a custom logo has been uploaded
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT org_name, (logo_data IS NOT NULL) AS has_logo, updated_at FROM platform_settings WHERE id = 1');
    res.json(result.rows[0] || { org_name: 'NavaSetu Initiatives', has_logo: false });
  } catch (error) {
    console.error('Fetch settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings', detail: error.message });
  }
});

// Staff: full org profile (name, address, GST) — shown on the HR Panel
// Settings tab. Any logged-in staff member can view; only admins can edit.
router.get('/org', requireAuth, requireStaff, async (req, res) => {
  try {
    const result = await pool.query('SELECT org_name, address, gst_number, updated_at FROM platform_settings WHERE id = 1');
    res.json(result.rows[0] || { org_name: 'NavaSetu Initiatives', address: '', gst_number: '' });
  } catch (error) {
    console.error('Fetch org settings error:', error);
    res.status(500).json({ error: 'Failed to fetch org settings' });
  }
});

router.put('/org', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orgName, address, gstNumber } = req.body;
    const result = await pool.query(
      `UPDATE platform_settings SET org_name = COALESCE($1, org_name), address = $2, gst_number = $3,
              updated_by = $4, updated_at = CURRENT_TIMESTAMP WHERE id = 1
       RETURNING org_name, address, gst_number, updated_at`,
      [orgName || null, address || null, gstNumber || null, req.user.userId]
    );
    res.json({ success: true, settings: result.rows[0] });
  } catch (error) {
    console.error('Update org settings error:', error);
    res.status(500).json({ error: 'Failed to update org settings' });
  }
});

// Self-service: any staff member (admin or counsellor) changes their own
// password, verifying the current one first.
router.post('/change-password', requireAuth, requireStaff, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are both required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Tables that make up the CRM/lead operational dataset — used by both the
// JSON backup/restore and the "Clear Trial Data" reset below. Staff accounts
// (users with role platform_admin/counsellor) and platform_settings are
// deliberately excluded from both, per the pilot's explicit requirement that
// wiping trial data must never take out logins or org configuration.
const LEAD_ROLE_FILTER = `role NOT IN ('platform_admin', 'counsellor')`;

// Admin: export every lead/CRM/school record as one JSON file the browser
// downloads. This is an application-level export (not a raw Postgres dump —
// there's no way to take one of those from inside a hosted Neon/Railway app),
// but it's a complete, restorable snapshot of everything the CRM shows.
router.get('/backup', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [users, demographics, schools, schoolTeachers, assessments, reports, orders, appointments, activity] = await Promise.all([
      pool.query(`SELECT * FROM users WHERE ${LEAD_ROLE_FILTER}`),
      pool.query(`SELECT d.* FROM user_demographics d JOIN users u ON u.id = d.user_id WHERE ${LEAD_ROLE_FILTER.replace('role', 'u.role')}`),
      pool.query('SELECT * FROM schools'),
      pool.query('SELECT * FROM school_teachers'),
      pool.query(`SELECT a.* FROM assessments a JOIN users u ON u.id = a.user_id WHERE ${LEAD_ROLE_FILTER.replace('role', 'u.role')}`),
      pool.query(`SELECT r.* FROM reports r JOIN users u ON u.id = r.user_id WHERE ${LEAD_ROLE_FILTER.replace('role', 'u.role')}`),
      pool.query(`SELECT o.* FROM orders o JOIN users u ON u.id = o.user_id WHERE ${LEAD_ROLE_FILTER.replace('role', 'u.role')}`),
      pool.query(`SELECT c.* FROM consultation_requests c JOIN users u ON u.id = c.user_id WHERE ${LEAD_ROLE_FILTER.replace('role', 'u.role')}`),
      pool.query('SELECT * FROM lead_activity')
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      version: 1,
      data: {
        users: users.rows,
        userDemographics: demographics.rows,
        schools: schools.rows,
        schoolTeachers: schoolTeachers.rows,
        assessments: assessments.rows,
        reports: reports.rows,
        orders: orders.rows,
        appointments: appointments.rows,
        leadActivity: activity.rows
      }
    });
  } catch (error) {
    console.error('Backup export error:', error);
    res.status(500).json({ error: 'Failed to build backup' });
  }
});

// Admin: restore from a JSON backup produced by GET /backup above. This
// REPLACES all current lead/CRM data (staff accounts and org settings are
// left untouched) — it's meant for disaster recovery, not merging. Requires
// { confirm: 'RESTORE' } as an explicit safety check, same pattern as the
// destructive clear-trial-data route below.
router.post('/backup/restore', requireAuth, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { confirm, data } = req.body;
    if (confirm !== 'RESTORE') {
      return res.status(400).json({ error: 'Send { confirm: "RESTORE" } to acknowledge this replaces all current lead/CRM data' });
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Missing backup data payload' });
    }

    await client.query('BEGIN');
    // Delete in FK-safe order (children before parents), same order used by
    // clear-trial-data.
    await client.query('DELETE FROM lead_activity');
    await client.query('DELETE FROM consultation_requests');
    await client.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE ${LEAD_ROLE_FILTER})`);
    await client.query(`DELETE FROM reports WHERE user_id IN (SELECT id FROM users WHERE ${LEAD_ROLE_FILTER})`);
    await client.query(`DELETE FROM assessments WHERE user_id IN (SELECT id FROM users WHERE ${LEAD_ROLE_FILTER})`);
    await client.query('DELETE FROM school_teachers');
    await client.query('DELETE FROM schools');
    await client.query(`DELETE FROM users WHERE ${LEAD_ROLE_FILTER}`);

    const insertRows = async (table, columns, rows) => {
      for (const row of rows || []) {
        const cols = columns.filter((c) => Object.prototype.hasOwnProperty.call(row, c));
        const values = cols.map((c) => row[c]);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, values);
      }
    };

    await insertRows('users', ['id', 'email', 'password_hash', 'full_name', 'phone_number', 'role', 'client_type', 'status', 'lead_number', 'lead_status', 'assigned_to', 'deleted_at', 'delete_reason', 'has_registered', 'created_at', 'updated_at', 'last_login'], data.users);
    await insertRows('user_demographics', ['user_id', 'age', 'location', 'institution', 'institution_type', 'experience_years', 'subject', 'updated_at'], data.userDemographics);
    await insertRows('schools', ['id', 'name', 'district', 'state', 'country', 'school_type', 'contact_name', 'contact_email', 'contact_phone', 'contact_designation', 'created_by', 'school_code', 'status', 'archived_at', 'archive_path', 'created_at', 'updated_at'], data.schools);
    await insertRows('school_teachers', ['id', 'school_id', 'user_id', 'full_name', 'email', 'designation', 'subject', 'invited_at', 'matched_at', 'retake_enabled', 'status', 'created_at', 'employee_id', 'phone_number'], data.schoolTeachers);
    await insertRows('assessments', ['id', 'user_id', 'school_id', 'school_teacher_id', 'client_type', 'status', 'responses', 'scores', 'submitted', 'submitted_at', 'retake_of', 'created_at', 'updated_at'], data.assessments);
    await insertRows('reports', ['id', 'assessment_id', 'user_id', 'plan_type', 'html_content', 'payment_status', 'released_at', 'created_at'], data.reports);
    await insertRows('orders', ['id', 'user_id', 'report_id', 'razorpay_order_id', 'razorpay_payment_id', 'amount', 'currency', 'plan_type', 'status', 'payment_method', 'marked_paid_by', 'notes', 'created_at', 'updated_at'], data.orders);
    await insertRows('consultation_requests', ['id', 'user_id', 'report_id', 'consultant_id', 'preferred_slot', 'scheduled_at', 'status', 'notes', 'consultant_name', 'created_by', 'created_at', 'updated_at'], data.appointments);
    await insertRows('lead_activity', ['id', 'user_id', 'recipient_email', 'type', 'subject', 'body', 'created_by', 'created_at'], data.leadActivity);

    // Restored rows may carry explicit lead_number values higher than the
    // sequence's current position — resync it so the next manually-created
    // lead doesn't collide with a restored one.
    await client.query(`SELECT setval('users_lead_number_seq', COALESCE((SELECT MAX(lead_number) FROM users), 1))`);

    await client.query('COMMIT');
    res.json({ success: true, restored: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Backup restore error:', error);
    res.status(500).json({ error: 'Restore failed and was rolled back — no data was changed', detail: error.message });
  } finally {
    client.release();
  }
});

// Admin: destructive reset of all trial/demo CRM data. Keeps every staff
// account (admins + counsellors) and the org profile (name/address/GST/logo)
// intact — only leads, schools, assessments, reports, orders, appointments
// and activity are wiped. Requires typed confirmation from the frontend.
router.post('/clear-trial-data', requireAuth, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { confirm } = req.body;
    if (confirm !== 'DELETE ALL DATA') {
      return res.status(400).json({ error: 'Send { confirm: "DELETE ALL DATA" } to acknowledge this permanently erases all lead/CRM data' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM lead_activity');
    await client.query('DELETE FROM consultation_requests');
    await client.query(`DELETE FROM consultants WHERE user_id IN (SELECT id FROM users WHERE ${LEAD_ROLE_FILTER})`);
    await client.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE ${LEAD_ROLE_FILTER})`);
    await client.query(`DELETE FROM reports WHERE user_id IN (SELECT id FROM users WHERE ${LEAD_ROLE_FILTER})`);
    await client.query(`DELETE FROM assessments WHERE user_id IN (SELECT id FROM users WHERE ${LEAD_ROLE_FILTER})`);
    await client.query('DELETE FROM school_teachers');
    await client.query('DELETE FROM school_analytics');
    await client.query('DELETE FROM schools');
    await client.query(`DELETE FROM user_demographics WHERE user_id IN (SELECT id FROM users WHERE ${LEAD_ROLE_FILTER})`);
    const deleted = await client.query(`DELETE FROM users WHERE ${LEAD_ROLE_FILTER} RETURNING id`);
    await client.query('COMMIT');

    res.json({ success: true, leadsDeleted: deleted.rows.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Clear trial data error:', error);
    res.status(500).json({ error: 'Clear failed and was rolled back — no data was changed', detail: error.message });
  } finally {
    client.release();
  }
});

// Public: serves the actual logo image bytes, used by <img src="/api/settings/logo">
// on the frontend header, the admin panel, and every generated report/invoice.
router.get('/logo', async (req, res) => {
  try {
    const result = await pool.query('SELECT logo_data, logo_mime FROM platform_settings WHERE id = 1');
    const row = result.rows[0];
    if (!row || !row.logo_data) return res.status(404).json({ error: 'No logo uploaded yet' });

    const buffer = Buffer.from(row.logo_data, 'base64');
    res.set('Content-Type', row.logo_mime || 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logo' });
  }
});

// Admin: upload/replace the logo. Frontend reads the chosen file as a
// data URL (FileReader.readAsDataURL) and posts it here — no multipart
// file-upload handling needed for a logo this small.
router.post('/logo', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { dataUrl, orgName } = req.body;
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'dataUrl must be a data: URL (e.g. from FileReader.readAsDataURL)' });
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Could not parse image data URL' });
    const [, mime, base64] = match;

    if (!mime.startsWith('image/')) return res.status(400).json({ error: 'Only image files are accepted' });
    if (Buffer.from(base64, 'base64').length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Logo must be under 2MB' });
    }

    await pool.query(
      `UPDATE platform_settings SET logo_data = $1, logo_mime = $2, org_name = COALESCE($3, org_name),
              updated_by = $4, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
      [base64, mime, orgName || null, req.user.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

router.delete('/logo', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query(`UPDATE platform_settings SET logo_data = NULL, logo_mime = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove logo' });
  }
});

export default router;
