import express from 'express';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public: org name + whether a custom logo has been uploaded
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT org_name, (logo_data IS NOT NULL) AS has_logo, updated_at FROM platform_settings WHERE id = 1');
    res.json(result.rows[0] || { org_name: 'NavaSetu Initiatives', has_logo: false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
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
