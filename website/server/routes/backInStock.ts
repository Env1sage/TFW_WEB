import { Router, Request, Response } from 'express';
import { pool } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendBackInStockEmail } from '../email.js';
import { sendTransactionalSMS } from '../sms.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const BASE_URL = (process.env.CLIENT_URL || 'https://theframedwall.com').replace(/\/$/, '');

function isAdmin(req: Request) {
  const role = (req as any).userRole;
  return role === 'admin' || role === 'super_admin';
}

// ── Public: submit a back-in-stock request ────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { productId, name = '', mobile = '', email = '' } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });
    if (!name && !mobile && !email) return res.status(400).json({ error: 'Provide at least name, mobile, or email' });

    const { rows: products } = await pool.query(
      'SELECT id, name, stock FROM website_products WHERE id = $1',
      [productId],
    );
    if (!products.length) return res.status(404).json({ error: 'Product not found' });
    if (products[0].stock > 0) return res.status(400).json({ error: 'Product is already in stock' });

    // Prevent duplicate requests from the same email/mobile for the same product
    if (email) {
      const { rows } = await pool.query(
        `SELECT id FROM website_back_in_stock WHERE product_id = $1 AND email = $2 AND status = 'pending'`,
        [productId, email],
      );
      if (rows.length) return res.status(409).json({ error: 'You already have a notification request for this product' });
    }
    if (mobile && !email) {
      const { rows } = await pool.query(
        `SELECT id FROM website_back_in_stock WHERE product_id = $1 AND mobile = $2 AND status = 'pending'`,
        [productId, mobile],
      );
      if (rows.length) return res.status(409).json({ error: 'You already have a notification request for this product' });
    }

    const { rows } = await pool.query(
      `INSERT INTO website_back_in_stock (id, product_id, product_name, name, mobile, email, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',NOW()) RETURNING *`,
      [uuidv4(), productId, products[0].name, name.trim(), mobile.trim(), email.trim().toLowerCase()],
    );

    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: list requests ──────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const {
    search = '', status = '', product_id = '',
    page = '1', limit = '50',
  } = req.query as Record<string, string>;

  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(200, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  const conds: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (search) {
    conds.push(`(b.name ILIKE $${i} OR b.email ILIKE $${i} OR b.mobile ILIKE $${i} OR b.product_name ILIKE $${i})`);
    params.push(`%${search}%`); i++;
  }
  if (status) { conds.push(`b.status = $${i++}`); params.push(status); }
  if (product_id) { conds.push(`b.product_id = $${i++}`); params.push(product_id); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const [rows, countRes, statsRes, productsRes] = await Promise.all([
    pool.query(
      `SELECT b.*, p.stock AS product_stock, p.image AS product_image, p.price AS product_price
       FROM website_back_in_stock b
       LEFT JOIN website_products p ON p.id = b.product_id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, lim, offset],
    ),
    pool.query(`SELECT COUNT(*) FROM website_back_in_stock b ${where}`, params),
    pool.query(`
      SELECT
        COUNT(*)                                     AS total,
        COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
        COUNT(*) FILTER (WHERE status = 'notified')  AS notified,
        COUNT(DISTINCT product_id)                   AS products
      FROM website_back_in_stock
    `),
    pool.query(`
      SELECT p.id, p.name, COUNT(b.id) AS request_count
      FROM website_products p
      JOIN website_back_in_stock b ON b.product_id = p.id
      WHERE b.status = 'pending'
      GROUP BY p.id, p.name
      ORDER BY request_count DESC
    `),
  ]);

  const total = parseInt(countRes.rows[0].count);
  const s = statsRes.rows[0];
  res.json({
    requests: rows.rows,
    total,
    page: pg,
    pages: Math.ceil(total / lim),
    stats: {
      total: parseInt(s.total),
      pending: parseInt(s.pending),
      notified: parseInt(s.notified),
      products: parseInt(s.products),
    },
    topProducts: productsRes.rows,
  });
});

// ── Admin: delete a request ───────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  await pool.query('DELETE FROM website_back_in_stock WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── Admin: manually trigger notifications for a product ───────────────────────
router.post('/notify/:productId', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { rows: products } = await pool.query(
    'SELECT id, name, image, price FROM website_products WHERE id = $1',
    [req.params.productId],
  );
  if (!products.length) return res.status(404).json({ error: 'Product not found' });
  const product = products[0];

  const { rows: pending } = await pool.query(
    `SELECT * FROM website_back_in_stock WHERE product_id = $1 AND status = 'pending'`,
    [product.id],
  );
  if (!pending.length) return res.json({ notified: 0 });

  const productUrl = `${BASE_URL}/products/${product.id}`;
  let notified = 0;

  for (const req_ of pending) {
    if (req_.email) {
      await sendBackInStockEmail({
        name: req_.name,
        email: req_.email,
        productName: product.name,
        productUrl,
        productImage: product.image,
        price: parseFloat(product.price),
      });
    }
    if (req_.mobile && process.env.MSG91_BIS_TEMPLATE_ID) {
      await sendTransactionalSMS(req_.mobile, process.env.MSG91_BIS_TEMPLATE_ID, {
        VAR1: req_.name || 'there',
        VAR2: product.name,
        VAR3: productUrl,
      });
    }
    await pool.query(
      `UPDATE website_back_in_stock SET status = 'notified', notified_at = NOW() WHERE id = $1`,
      [req_.id],
    );
    notified++;
  }

  res.json({ notified, product: product.name });
});

export default router;
