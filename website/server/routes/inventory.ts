import { Router, Request, Response } from 'express';
import { pool } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendBackInStockEmail } from '../email.js';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = (process.env.CLIENT_URL || 'https://theframedwall.com').replace(/\/$/, '');

async function triggerBackInStockNotifications(productId: string, productName: string, productImage: string, productPrice: number) {
  try {
    const { rows: pending } = await pool.query(
      `SELECT * FROM website_back_in_stock WHERE product_id = $1 AND status = 'pending'`,
      [productId],
    );
    if (!pending.length) return;

    const productUrl = `${BASE_URL}/products/${productId}`;
    for (const r of pending) {
      if (r.email) {
        await sendBackInStockEmail({ name: r.name, email: r.email, productName, productUrl, productImage, price: productPrice });
      }
      await pool.query(
        `UPDATE website_back_in_stock SET status = 'notified', notified_at = NOW() WHERE id = $1`,
        [r.id],
      );
    }
    console.log(`[BackInStock] Notified ${pending.length} subscriber(s) for "${productName}"`);
  } catch (e) {
    console.error('[BackInStock] Notification error:', e);
  }
}

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────────
type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

function stockStatus(qty: number, threshold: number): StockStatus {
  if (qty <= 0)         return 'out_of_stock';
  if (qty <= threshold) return 'low_stock';
  return 'in_stock';
}

function isAdmin(req: Request) {
  const role = (req as any).userRole;
  return role === 'admin' || role === 'super_admin';
}

async function logChange(
  productId: string,
  productName: string,
  sku: string,
  before: number,
  change: number,
  changeType: string,
  note: string,
) {
  await pool.query(
    `INSERT INTO website_inventory_logs
       (id, product_id, product_name, sku, change_type, quantity_before, quantity_change, quantity_after, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [uuidv4(), productId, productName, sku, changeType, before, change, before + change, note],
  );
}

// ── GET /api/inventory/metrics ────────────────────────────────────────────────
router.get('/metrics', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await pool.query(`
    SELECT
      COUNT(*)                                                                     AS total_products,
      COALESCE(SUM(stock), 0)                                                      AS total_stock,
      COUNT(*) FILTER (WHERE stock > 0 AND stock <= low_stock_threshold)           AS low_stock_count,
      COUNT(*) FILTER (WHERE stock <= 0)                                           AS out_of_stock_count,
      COUNT(*) FILTER (WHERE stock > low_stock_threshold)                          AS in_stock_count,
      COUNT(DISTINCT category)                                                     AS category_count
    FROM website_products
  `);

  const r = rows[0];
  res.json({
    totalProducts:    parseInt(r.total_products),
    totalStock:       parseInt(r.total_stock),
    lowStockCount:    parseInt(r.low_stock_count),
    outOfStockCount:  parseInt(r.out_of_stock_count),
    inStockCount:     parseInt(r.in_stock_count),
    categoryCount:    parseInt(r.category_count),
  });
});

// ── GET /api/inventory/logs ───────────────────────────────────────────────────
router.get('/logs', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { page = '1', limit = '50' } = req.query as Record<string, string>;
  const pg  = Math.max(1, parseInt(page));
  const lim = Math.min(200, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  const [logsRes, countRes] = await Promise.all([
    pool.query(
      `SELECT * FROM website_inventory_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [lim, offset],
    ),
    pool.query('SELECT COUNT(*) FROM website_inventory_logs'),
  ]);

  res.json({
    logs:  logsRes.rows,
    total: parseInt(countRes.rows[0].count),
    page:  pg,
    pages: Math.ceil(parseInt(countRes.rows[0].count) / lim),
  });
});

// ── GET /api/inventory ────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const {
    search = '', status = '', category = '',
    page = '1', limit = '30',
    sort = 'stock_asc',
  } = req.query as Record<string, string>;

  const pg    = Math.max(1, parseInt(page));
  const lim   = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  const conds: string[] = [];
  const params: any[]   = [];
  let i = 1;

  if (search) {
    conds.push(`(p.name ILIKE $${i} OR p.sku ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }
  if (category) {
    conds.push(`p.category = $${i++}`);
    params.push(category);
  }
  if (status === 'in_stock')      conds.push(`p.stock > p.low_stock_threshold`);
  if (status === 'low_stock')     conds.push(`p.stock > 0 AND p.stock <= p.low_stock_threshold`);
  if (status === 'out_of_stock')  conds.push(`p.stock <= 0`);

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const ORDER_MAP: Record<string, string> = {
    stock_asc:    'p.stock ASC',
    stock_desc:   'p.stock DESC',
    name_asc:     'p.name ASC',
    name_desc:    'p.name DESC',
    price_asc:    'p.price ASC',
    price_desc:   'p.price DESC',
    created_desc: 'p.created_at DESC',
  };
  const orderClause = ORDER_MAP[sort] ?? 'p.stock ASC';

  const [itemsRes, countRes] = await Promise.all([
    pool.query(
      `SELECT
         p.id, p.sku, p.name, p.category, p.price, p.stock,
         p.low_stock_threshold, p.variants, p.image, p.sizes, p.colors,
         p.created_at,
         CASE
           WHEN p.stock <= 0                      THEN 'out_of_stock'
           WHEN p.stock <= p.low_stock_threshold  THEN 'low_stock'
           ELSE 'in_stock'
         END AS stock_status
       FROM website_products p
       ${where}
       ORDER BY ${orderClause}
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, lim, offset],
    ),
    pool.query(`SELECT COUNT(*) FROM website_products p ${where}`, params),
  ]);

  const total = parseInt(countRes.rows[0].count);
  res.json({
    items: itemsRes.rows,
    total,
    page:  pg,
    pages: Math.ceil(total / lim),
  });
});

// ── GET /api/inventory/:id/logs ───────────────────────────────────────────────
router.get('/:id/logs', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await pool.query(
    `SELECT * FROM website_inventory_logs WHERE product_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.params.id],
  );
  res.json(rows);
});

// ── PUT /api/inventory/:id ────────────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const {
    stock, low_stock_threshold, variants,
    change_type = 'adjustment', note = '',
  } = req.body;

  // fetch current product
  const { rows: curr } = await pool.query(
    'SELECT id, name, sku, stock, low_stock_threshold, variants, image, price FROM website_products WHERE id = $1',
    [req.params.id],
  );
  if (!curr.length) return res.status(404).json({ error: 'Product not found' });
  const product = curr[0];

  const sets: string[] = [];
  const vals: any[]    = [];
  let pi = 1;

  if (stock !== undefined) {
    const newStock = Math.max(0, parseInt(stock));
    sets.push(`stock = $${pi++}`);
    vals.push(newStock);

    const prevStock = parseInt(product.stock);
    const change = newStock - prevStock;
    if (change !== 0) {
      await logChange(product.id, product.name, product.sku ?? '', prevStock, change, change_type, note);
    }
    // Auto-notify back-in-stock subscribers when restocking from zero
    if (prevStock <= 0 && newStock > 0) {
      triggerBackInStockNotifications(product.id, product.name, product.image ?? '', parseFloat(product.price));
    }
  }

  if (low_stock_threshold !== undefined) {
    sets.push(`low_stock_threshold = $${pi++}`);
    vals.push(Math.max(0, parseInt(low_stock_threshold)));
  }

  if (variants !== undefined) {
    sets.push(`variants = $${pi++}`);
    vals.push(JSON.stringify(variants));
  }

  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  vals.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE website_products
     SET ${sets.join(', ')}
     WHERE id = $${pi}
     RETURNING id, sku, name, category, price, stock, low_stock_threshold, variants, image,
       CASE WHEN stock <= 0 THEN 'out_of_stock'
            WHEN stock <= low_stock_threshold THEN 'low_stock'
            ELSE 'in_stock' END AS stock_status`,
    vals,
  );

  res.json(rows[0]);
});

// ── POST /api/inventory/bulk ──────────────────────────────────────────────────
router.post('/bulk', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const {
    ids,                    // string[]
    mode,                   // 'set' | 'add' | 'subtract'
    value,                  // number
    note = 'Bulk update',
  } = req.body;

  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
  if (!['set', 'add', 'subtract'].includes(mode)) return res.status(400).json({ error: 'mode must be set | add | subtract' });
  if (typeof value !== 'number' || isNaN(value)) return res.status(400).json({ error: 'value must be a number' });

  const { rows: products } = await pool.query(
    `SELECT id, name, sku, stock FROM website_products WHERE id = ANY($1::text[])`,
    [ids],
  );

  const updated: any[] = [];
  for (const p of products) {
    const before = parseInt(p.stock);
    let after: number;
    if (mode === 'set')      after = Math.max(0, value);
    else if (mode === 'add') after = Math.max(0, before + value);
    else                     after = Math.max(0, before - value);

    const change = after - before;
    await pool.query('UPDATE website_products SET stock = $1 WHERE id = $2', [after, p.id]);
    if (change !== 0) {
      await logChange(p.id, p.name, p.sku ?? '', before, change, 'bulk_update', note);
    }
    updated.push({ id: p.id, stockBefore: before, stockAfter: after });
  }

  res.json({ updated: updated.length, results: updated });
});

export default router;
