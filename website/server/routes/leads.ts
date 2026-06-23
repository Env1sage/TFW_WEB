import { Router, Request, Response } from 'express';
import { pool } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ── Public: capture / upsert a lead ──────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const { name = '', mobile = '', email = '', source = 'organic', product } = req.body;
  if (!name && !mobile && !email) {
    return res.status(400).json({ error: 'At least one of name, mobile, or email is required' });
  }

  // Attempt to find existing lead (email first, then mobile)
  let existing: any = null;
  if (email) {
    const { rows } = await pool.query(`SELECT * FROM website_leads WHERE email = $1 LIMIT 1`, [email]);
    existing = rows[0] ?? null;
  }
  if (!existing && mobile) {
    const { rows } = await pool.query(`SELECT * FROM website_leads WHERE mobile = $1 LIMIT 1`, [mobile]);
    existing = rows[0] ?? null;
  }

  if (existing) {
    let products: any[] = existing.products_viewed ?? [];
    if (product && !products.some((p: any) => p.id === product.id)) {
      products = [...products, { id: product.id, name: product.name, viewed_at: new Date().toISOString() }];
    }
    const { rows } = await pool.query(
      `UPDATE website_leads
       SET last_activity = NOW(), products_viewed = $1,
           name = CASE WHEN name = '' THEN $2 ELSE name END,
           mobile = CASE WHEN mobile = '' THEN $3 ELSE mobile END,
           updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [JSON.stringify(products), name, mobile, existing.id]
    );
    return res.json(rows[0]);
  }

  const products = product
    ? [{ id: product.id, name: product.name, viewed_at: new Date().toISOString() }]
    : [];
  const { rows } = await pool.query(
    `INSERT INTO website_leads (id, name, mobile, email, source, products_viewed, status, last_activity, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'new',NOW(),NOW(),NOW()) RETURNING *`,
    [uuidv4(), name, mobile, email, source, JSON.stringify(products)]
  );
  res.status(201).json(rows[0]);
});

// ── Admin: export CSV (must be before /:id) ───────────────────────────────────
router.get('/export/csv', authMiddleware, async (req: Request, res: Response) => {
  if (!(['admin','super_admin'].includes((req as any).userRole))) return res.status(403).json({ error: 'Forbidden' });

  const { search = '', status = '', date = '' } = req.query as Record<string, string>;
  const { where, params } = buildWhere({ search, status, date });

  const { rows } = await pool.query(
    `SELECT * FROM website_leads ${where} ORDER BY last_activity DESC`,
    params
  );

  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['ID', 'Name', 'Mobile', 'Email', 'Status', 'Source', 'Products Viewed', 'Notes', 'Last Activity', 'Created At'];
  const csv = [
    header.join(','),
    ...rows.map(r => [
      escape(r.id),
      escape(r.name),
      escape(r.mobile),
      escape(r.email),
      escape(r.status),
      escape(r.source),
      escape((r.products_viewed ?? []).map((p: any) => p.name || p.id).join('; ')),
      escape(r.notes),
      escape(new Date(r.last_activity).toISOString()),
      escape(new Date(r.created_at).toISOString()),
    ].join(',')),
  ].join('\r\n');

  const filename = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + csv); // BOM for Excel UTF-8 compatibility
});

// ── Admin: list leads ─────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  if (!(['admin','super_admin'].includes((req as any).userRole))) return res.status(403).json({ error: 'Forbidden' });

  const { search = '', status = '', date = '', page = '1', limit = '25' } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  const { where, params } = buildWhere({ search, status, date });
  const pNext = params.length + 1;

  const [leadsRes, countRes, statsRes] = await Promise.all([
    pool.query(
      `SELECT * FROM website_leads ${where} ORDER BY last_activity DESC LIMIT $${pNext} OFFSET $${pNext + 1}`,
      [...params, lim, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM website_leads ${where}`, params),
    pool.query(`
      SELECT
        COUNT(*)                                        AS total,
        COUNT(*) FILTER (WHERE status = 'new')          AS new,
        COUNT(*) FILTER (WHERE status = 'contacted')    AS contacted,
        COUNT(*) FILTER (WHERE status = 'qualified')    AS qualified,
        COUNT(*) FILTER (WHERE status = 'converted')    AS converted,
        COUNT(*) FILTER (WHERE status = 'lost')         AS lost
      FROM website_leads
    `),
  ]);

  const total = parseInt(countRes.rows[0].count);
  const s = statsRes.rows[0];
  res.json({
    leads: leadsRes.rows,
    total,
    page: pg,
    pages: Math.ceil(total / lim),
    stats: {
      total: parseInt(s.total),
      new: parseInt(s.new),
      contacted: parseInt(s.contacted),
      qualified: parseInt(s.qualified),
      converted: parseInt(s.converted),
      lost: parseInt(s.lost),
    },
  });
});

// ── Admin: get single lead ────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!(['admin','super_admin'].includes((req as any).userRole))) return res.status(403).json({ error: 'Forbidden' });
  const { rows } = await pool.query('SELECT * FROM website_leads WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// ── Admin: update lead ────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!(['admin','super_admin'].includes((req as any).userRole))) return res.status(403).json({ error: 'Forbidden' });
  const { status, notes, name, mobile, email } = req.body;

  const VALID_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'];
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (name !== undefined)   { sets.push(`name = $${i++}`);   vals.push(name); }
  if (mobile !== undefined) { sets.push(`mobile = $${i++}`); vals.push(mobile); }
  if (email !== undefined)  { sets.push(`email = $${i++}`);  vals.push(email); }
  if (status !== undefined) { sets.push(`status = $${i++}`); vals.push(status); }
  if (notes !== undefined)  { sets.push(`notes = $${i++}`);  vals.push(notes); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  sets.push(`last_activity = NOW()`, `updated_at = NOW()`);
  vals.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE website_leads SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// ── Admin: delete lead ────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!(['admin','super_admin'].includes((req as any).userRole))) return res.status(403).json({ error: 'Forbidden' });
  const { rowCount } = await pool.query('DELETE FROM website_leads WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ── Shared query builder ──────────────────────────────────────────────────────
function buildWhere(opts: { search: string; status: string; date: string }) {
  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (opts.search) {
    conditions.push(`(name ILIKE $${i} OR email ILIKE $${i} OR mobile ILIKE $${i})`);
    params.push(`%${opts.search}%`);
    i++;
  }
  if (opts.status) {
    conditions.push(`status = $${i++}`);
    params.push(opts.status);
  }
  if (opts.date === 'today')  conditions.push(`created_at >= CURRENT_DATE`);
  if (opts.date === 'week')   conditions.push(`created_at >= CURRENT_DATE - INTERVAL '7 days'`);
  if (opts.date === 'month')  conditions.push(`created_at >= CURRENT_DATE - INTERVAL '30 days'`);

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export default router;
