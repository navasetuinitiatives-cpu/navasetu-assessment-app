import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';

const router = express.Router();

// Create order (Razorpay)
router.post('/orders', async (req, res) => {
  try {
    const { userId, amount, planType } = req.body;

    const orderId = uuidv4();
    await pool.query(
      'INSERT INTO orders (id, user_id, amount, plan_type, status) VALUES ($1, $2, $3, $4, $5)',
      [orderId, userId, amount, planType, 'pending']
    );

    res.status(201).json({
      success: true,
      orderId,
      amount,
      planType
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Verify payment
router.post('/verify', async (req, res) => {
  try {
    const { orderId, razorpayPaymentId, razorpaySignature } = req.body;

    // In production, verify signature with Razorpay
    await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['paid', orderId]
    );

    res.json({
      success: true,
      message: 'Payment verified'
    });
  } catch (error) {
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Get order
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export default router;
