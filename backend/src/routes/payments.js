import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// --- SKELETAL Razorpay integration -----------------------------------------
// Not wired to the real Razorpay API yet (pilot). These two endpoints exist
// so the frontend has a stable contract to call once real keys are added —
// today they just record an order and never actually verify a signature.
// DO NOT treat /verify as trustworthy until real Razorpay signature
// verification is implemented — see the TODOs below.

router.post('/orders', requireAuth, async (req, res) => {
  try {
    const { reportId, amount, planType } = req.body;
    if (!amount || !planType) return res.status(400).json({ error: 'amount and planType are required' });

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO orders (id, user_id, report_id, amount, plan_type, status, payment_method)
       VALUES ($1, $2, $3, $4, $5, 'pending', 'razorpay') RETURNING *`,
      [id, req.user.userId, reportId || null, amount, planType]
    );

    res.status(201).json({
      success: true,
      order: result.rows[0],
      note: 'Razorpay is not yet connected for this pilot — this order is recorded but not sent to any payment gateway.'
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.post('/verify', requireAuth, async (req, res) => {
  // TODO (post-pilot): verify razorpaySignature against Razorpay's webhook
  // secret using crypto.createHmac('sha256', RAZORPAY_KEY_SECRET) before
  // trusting this call. Until then this route is intentionally disabled.
  return res.status(501).json({
    error: 'Razorpay verification is not implemented yet for this pilot. Use the admin manual-release flow instead.'
  });
});

router.get('/orders/:orderId', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = result.rows[0];
    if (order.user_id !== req.user.userId && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// --- Admin manual payment control (the pilot's real path) ------------------
// NavaSetu collects payment outside the portal (bank transfer, UPI, etc.)
// during the pilot, then an admin marks the order paid here, which also
// releases the associated report via /api/reports/:id/admin-release.

router.get('/orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const result = await pool.query(
      `SELECT o.*, u.full_name, u.email FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE ($1::text IS NULL OR o.status = $1)
       ORDER BY o.created_at DESC LIMIT 200`,
      [status || null]
    );
    res.json({ orders: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.post('/orders/:orderId/mark-paid', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;

    const result = await pool.query(
      `UPDATE orders SET status = 'admin_released', payment_method = 'admin_manual',
              marked_paid_by = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [req.user.userId, notes || null, orderId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = result.rows[0];
    if (order.report_id) {
      await pool.query(
        `UPDATE reports SET payment_status = 'admin_released', released_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [order.report_id]
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.userId, 'mark_order_paid', 'order', orderId, JSON.stringify({ notes: notes || null })]
    );

    res.json({ success: true, order });
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ error: 'Failed to mark order paid' });
  }
});

export default router;
