import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';

const router = express.Router();

// Create report for assessment
router.post('/', async (req, res) => {
  try {
    const { assessmentId, userId, planType } = req.body;

    // Get assessment data
    const assessment = await pool.query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);
    if (assessment.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const reportId = uuidv4();
    const scores = assessment.rows[0].scores || {};

    await pool.query(
      'INSERT INTO reports (id, assessment_id, user_id, plan_type, wellness_score, burnout_score, professional_score, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        reportId,
        assessmentId,
        userId,
        planType || 'Discover',
        scores.wellness_score || 50,
        scores.burnout_score || 45,
        scores.professional_score || 55,
        'generating'
      ]
    );

    // For Discover plan, generate report immediately
    if (planType === 'Discover') {
      // Simulate report generation
      setTimeout(async () => {
        await pool.query(
          'UPDATE reports SET status = $1, pdf_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['ready', reportId]
        );
      }, 2000);
    }

    res.status(201).json({
      success: true,
      reportId,
      message: 'Report generation started'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// Get report
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Download PDF
router.get('/:reportId/download', async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];

    if (report.status !== 'ready') {
      return res.status(400).json({ error: 'Report not ready yet' });
    }

    // In production, serve the actual PDF file
    res.json({
      success: true,
      message: 'PDF download initiated',
      pdfPath: report.pdf_path
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to download report' });
  }
});

export default router;
