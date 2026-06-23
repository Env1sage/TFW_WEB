/**
 * Analytics Route
 *
 * Public:
 *   POST /api/analytics/event            — ingest a tracking event (fire-and-forget)
 *
 * Admin only:
 *   GET  /api/analytics/dashboard        — advanced dashboard data
 *   GET  /api/analytics/export           — CSV export of orders or events
 */

import { Router, Request, Response } from 'express';
import * as db from '../database.js';
import { pool } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = Router();

function adminOnly(req: Request, res: Response, next: any) {
  const role = (req as any).userRole;
  if (!['admin', 'super_admin', 'product_manager'].includes(role))
    return res.status(403).json({ error: 'Forbidden' });
  next();
}

const eventLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracking events' },
});

// ── POST /api/analytics/event ────────────────────────────────────────────────
// Receives client-side tracking events. Fast, non-blocking.
router.post('/event', eventLimiter, async (req: Request, res: Response) => {
  // Respond immediately so we never block the client
  res.status(204).end();
  const { type, productId, productName, category, brandId, brandName,
          size, color, sessionId, price, quantity } = req.body;
  if (!type || !sessionId) return;
  const userId = (req as any).userId || undefined;
  db.insertProductEvent({
    eventType: type, productId, productName, category,
    brandId, brandName, size, color,
    sessionId, userId, price, quantity,
  }).catch(() => { /* silent — never break the client */ });
});

// ── GET /api/analytics/dashboard ────────────────────────────────────────────
router.get('/dashboard', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { from, to, groupBy } = req.query as Record<string, string>;

    const toDate   = to   ? new Date(to)   : new Date();
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000);

    // Clamp: max 1-year range
    const diffDays = (toDate.getTime() - fromDate.getTime()) / 86400_000;
    const gb: 'day' | 'week' | 'month' =
      groupBy === 'week'  ? 'week'  :
      groupBy === 'month' ? 'month' :
      diffDays > 90       ? 'week'  : 'day';

    const data = await db.getAdvancedAnalytics(
      fromDate.toISOString(), toDate.toISOString(), gb,
    );
    res.json({ ...data, from: fromDate.toISOString(), to: toDate.toISOString(), groupBy: gb });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/analytics/export ────────────────────────────────────────────────
// Returns a CSV download. type=orders|events|products
router.get('/export', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { from, to, type = 'orders' } = req.query as Record<string, string>;

    const toDate   = to   ? new Date(to)   : new Date();
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000);

    let rows: any[] = [];
    let headers: string[] = [];

    if (type === 'orders') {
      const { rows: r } = await pool.query(`
        SELECT o.id, 'product' as type, u.name as customer, u.email,
               o.total, o.status, o.shipping_address, o.created_at,
               o.payment_status, o.coupon_code, o.delivery_method
        FROM website_orders o
        LEFT JOIN website_users u ON u.id = o.user_id
        WHERE o.created_at BETWEEN $1 AND $2
        UNION ALL
        SELECT d.id, 'custom' as type, u.name as customer, u.email,
               d.total, d.status, d.shipping_address, d.created_at,
               null, null, d.delivery_method
        FROM website_design_orders d
        LEFT JOIN website_users u ON u.id = d.user_id
        WHERE d.created_at BETWEEN $1 AND $2
        ORDER BY created_at DESC
      `, [fromDate.toISOString(), toDate.toISOString()]);
      rows = r;
      headers = ['id', 'type', 'customer', 'email', 'total', 'status', 'shipping_address', 'created_at', 'payment_status', 'coupon_code', 'delivery_method'];
    } else if (type === 'events') {
      const { rows: r } = await pool.query(`
        SELECT event_type, product_id, product_name, category, brand_name,
               size, color, session_id, price, quantity, created_at
        FROM website_product_events
        WHERE created_at BETWEEN $1 AND $2
        ORDER BY created_at DESC LIMIT 50000
      `, [fromDate.toISOString(), toDate.toISOString()]);
      rows = r;
      headers = ['event_type', 'product_id', 'product_name', 'category', 'brand_name', 'size', 'color', 'session_id', 'price', 'quantity', 'created_at'];
    } else if (type === 'products') {
      const { rows: r } = await pool.query(`
        SELECT p.id, p.name, p.category, p.price, p.stock,
               p.weight_grams, p.length_cm, p.breadth_cm, p.height_cm,
               COALESCE(sold.qty, 0) as total_sold,
               COALESCE(sold.revenue, 0) as total_revenue
        FROM website_products p
        LEFT JOIN (
          SELECT (item->>'productId') as pid,
                 SUM((item->>'quantity')::int) as qty,
                 SUM((item->>'price')::numeric * (item->>'quantity')::int) as revenue
          FROM website_orders, jsonb_array_elements(items) as item
          WHERE created_at BETWEEN $1 AND $2 AND status != 'cancelled'
          GROUP BY pid
        ) sold ON sold.pid = p.id
        ORDER BY total_sold DESC
      `, [fromDate.toISOString(), toDate.toISOString()]);
      rows = r;
      headers = ['id', 'name', 'category', 'price', 'stock', 'weight_grams', 'length_cm', 'breadth_cm', 'height_cm', 'total_sold', 'total_revenue'];
    }

    // Build CSV
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
    ].join('\r\n');

    const filename = `tfw-${type}-${fromDate.toISOString().slice(0, 10)}-to-${toDate.toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
