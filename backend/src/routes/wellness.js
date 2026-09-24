import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';
import { calculateWellnessScores } from '../utils/scoring.js';

const router = express.Router();

// Email-based login/register
router.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Create user if doesn't exist
    await pool.query(
      'INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email]
    );

    res.json({
      success: true,
      email,
      message: 'Logged in successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// Create new assessment session
router.post('/session/create', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const sessionId = uuidv4();
    await pool.query(
      'INSERT INTO assessment_sessions (session_id, email) VALUES ($1, $2)',
      [sessionId, email]
    );

    res.status(201).json({
      success: true,
      sessionId,
      message: 'Session created'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session', details: error.message });
  }
});

// Save all responses (all 53 questions at once)
router.post('/responses', async (req, res) => {
  try {
    const { sessionId, email, responses } = req.body;
    
    if (!sessionId || !email || !responses || Object.keys(responses).length === 0) {
      return res.status(400).json({ error: 'SessionId, email, and responses required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify session belongs to user
      const sessionCheck = await client.query(
        'SELECT session_id FROM assessment_sessions WHERE session_id = $1 AND email = $2',
        [sessionId, email]
      );

      if (sessionCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Session not found or unauthorized' });
      }

      // Insert all responses
      for (const [questionId, answer] of Object.entries(responses)) {
        await client.query(
          'INSERT INTO responses (session_id, question_id, user_answer) VALUES ($1, $2, $3)',
          [sessionId, questionId, answer]
        );
      }

      await client.query('COMMIT');

      // Calculate scores
      const scores = calculateWellnessScores(responses);

      res.json({
        success: true,
        sessionId,
        message: 'Responses saved successfully',
        scores
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to save responses', details: error.message });
  }
});

// Get responses for a session
router.get('/responses/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Verify authorization
    const sessionCheck = await pool.query(
      'SELECT session_id FROM assessment_sessions WHERE session_id = $1 AND email = $2',
      [sessionId, email]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      'SELECT question_id, user_answer FROM responses WHERE session_id = $1 ORDER BY question_id',
      [sessionId]
    );

    const responses = {};
    result.rows.forEach(row => {
      responses[row.question_id] = row.user_answer;
    });

    res.json({
      success: true,
      sessionId,
      responses,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch responses', details: error.message });
  }
});

// List all sessions for a user
router.get('/user-sessions', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const result = await pool.query(
      'SELECT session_id, created_at, updated_at FROM assessment_sessions WHERE email = $1 ORDER BY created_at DESC',
      [email]
    );

    res.json({
      success: true,
      email,
      sessions: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions', details: error.message });
  }
});

// Generate and save report
router.post('/reports', async (req, res) => {
  try {
    const { sessionId, email, reportType } = req.body;
    
    if (!sessionId || !email || !reportType) {
      return res.status(400).json({ error: 'SessionId, email, and reportType required' });
    }

    if (!['Discover', 'Explore', 'Navigate'].includes(reportType)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    // Get responses
    const responses = await pool.query(
      'SELECT question_id, user_answer FROM responses WHERE session_id = $1',
      [sessionId]
    );

    if (responses.rows.length === 0) {
      return res.status(404).json({ error: 'No responses found for session' });
    }

    // Convert to object
    const responseData = {};
    responses.rows.forEach(row => {
      responseData[row.question_id] = row.user_answer;
    });

    // Calculate scores
    const scores = calculateWellnessScores(responseData);

    // Prepare report data based on type
    const reportData = {
      generatedAt: new Date().toISOString(),
      reportType,
      dimensions: scores.dimensions,
      parameters: reportType === 'Navigate' ? scores.parameters : undefined,
      recommendations: reportType !== 'Discover' ? generateRecommendations(scores) : undefined
    };

    // Save report
    await pool.query(
      'INSERT INTO reports (session_id, report_type, report_data, dimension_scores) VALUES ($1, $2, $3, $4)',
      [sessionId, reportType, JSON.stringify(reportData), JSON.stringify(scores.dimensions)]
    );

    res.status(201).json({
      success: true,
      reportType,
      ...reportData
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
});

// Get reports for a session
router.get('/reports/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Verify authorization
    const sessionCheck = await pool.query(
      'SELECT session_id FROM assessment_sessions WHERE session_id = $1 AND email = $2',
      [sessionId, email]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      'SELECT id, report_type, report_data, generated_at FROM reports WHERE session_id = $1 ORDER BY generated_at DESC',
      [sessionId]
    );

    const reports = result.rows.map(row => ({
      id: row.id,
      type: row.report_type,
      data: row.report_data,
      generatedAt: row.generated_at
    }));

    res.json({
      success: true,
      sessionId,
      reports,
      count: reports.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports', details: error.message });
  }
});

// Helper function to generate recommendations
function generateRecommendations(scores) {
  const recommendations = [];
  
  // Low emotional wellbeing
  if (scores.dimensions['Emotional Well-being'] < 2.5) {
    recommendations.push({
      area: 'Emotional Well-being',
      severity: 'high',
      suggestion: 'Consider seeking support from a mental health professional'
    });
  }

  // Low work fulfillment
  if (scores.dimensions['Work Fulfillment'] < 2.5) {
    recommendations.push({
      area: 'Work Fulfillment',
      severity: 'high',
      suggestion: 'Reflect on your teaching goals and career alignment'
    });
  }

  // Low work-life balance
  if (scores.dimensions['Work-Life Balance'] < 2.5) {
    recommendations.push({
      area: 'Work-Life Balance',
      severity: 'high',
      suggestion: 'Implement boundaries between work and personal time'
    });
  }

  return recommendations;
}

export default router;
