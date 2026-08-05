import { Router, Request, Response } from 'express';
import { pool, findUserById } from '../database.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { sendAbandonedCartEmail } from '../email.js';
import { sendTransactionalSMS } from '../sms.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const BASE_URL = (process.env.CLIENT_URL || 'https://theframedwall.com').replace(/\/$/, '');

function isAdmin(req: Request) {
  const role = (req as any).userRole;
  return role === 'admin' || role === 'super_admin';
}

function applyTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ── Cart sync (upsert) — called when logged-in user's cart changes ─────────────
router.post('/sync', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Login required' });

    const { items = [], designItems = [], total = 0 } = req.body;

    // If cart is empty, clear the abandoned cart record
    if (!items.length && !designItems.length) {
      await pool.query(
        `DELETE FROM website_abandoned_carts WHERE user_id = $1 AND converted = false`,
        [userId],
      );
      return res.json({ ok: true });
    }

    const user = await findUserById(userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    await pool.query(
      `INSERT INTO website_abandoned_carts (id, user_id, email, phone, name, items, design_items, total, converted, drip_step, last_updated, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,0,NOW(),NOW())
       ON CONFLICT (user_id) WHERE user_id IS NOT NULL
       DO UPDATE SET
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         name = EXCLUDED.name,
         items = EXCLUDED.items,
         design_items = EXCLUDED.design_items,
         total = EXCLUDED.total,
         converted = false,
         last_updated = NOW()`,
      [
        uuidv4(), userId,
        user.email || '', user.phone || '', user.name || '',
        JSON.stringify(items), JSON.stringify(designItems),
        parseFloat(total) || 0,
      ],
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Mark cart as converted (called after successful checkout) ─────────────────
router.post('/convert', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.json({ ok: true });

    await pool.query(
      `UPDATE website_abandoned_carts SET converted = true WHERE user_id = $1`,
      [userId],
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: list abandoned carts ───────────────────────────────────────────────
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { page = '1', limit = '50', converted = '' } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  const conds: string[] = [];
  if (converted === 'true') conds.push('converted = true');
  else if (converted === 'false') conds.push('converted = false');
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const [dataRes, countRes, statsRes] = await Promise.all([
    pool.query(
      `SELECT * FROM website_abandoned_carts ${where} ORDER BY last_updated DESC LIMIT $1 OFFSET $2`,
      [lim, offset],
    ),
    pool.query(`SELECT COUNT(*) FROM website_abandoned_carts ${where}`),
    pool.query(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE converted = false)        AS active,
        COUNT(*) FILTER (WHERE converted = true)         AS converted,
        COALESCE(SUM(total) FILTER (WHERE converted = false), 0) AS active_value
      FROM website_abandoned_carts
    `),
  ]);

  const total = parseInt(countRes.rows[0].count);
  const s = statsRes.rows[0];
  res.json({
    carts: dataRes.rows,
    total, page: pg, pages: Math.ceil(total / lim),
    stats: {
      total: parseInt(s.total),
      active: parseInt(s.active),
      converted: parseInt(s.converted),
      activeValue: parseFloat(s.active_value),
    },
  });
});

// ── Admin: delete a specific abandoned cart ───────────────────────────────────
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  await pool.query('DELETE FROM website_abandoned_carts WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── Admin: list drip templates ────────────────────────────────────────────────
router.get('/drip-templates', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const { rows } = await pool.query(`SELECT * FROM website_drip_templates ORDER BY step ASC, created_at ASC`);
  res.json(rows);
});

// ── Admin: create drip template ───────────────────────────────────────────────
router.post('/drip-templates', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const { name, step, delay_hours, subject, email_body, sms_body, active = true } = req.body;
  if (!name || !step || !delay_hours) return res.status(400).json({ error: 'name, step, delay_hours required' });

  const { rows } = await pool.query(
    `INSERT INTO website_drip_templates (id, name, trigger_type, step, delay_hours, subject, email_body, sms_body, active)
     VALUES ($1,$2,'abandoned_cart',$3,$4,$5,$6,$7,$8) RETURNING *`,
    [uuidv4(), name, parseInt(step), parseInt(delay_hours), subject || '', email_body || '', sms_body || '', active],
  );
  res.status(201).json(rows[0]);
});

// ── Admin: update drip template ───────────────────────────────────────────────
router.put('/drip-templates/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  const { name, step, delay_hours, subject, email_body, sms_body, active } = req.body;

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (name !== undefined)         { sets.push(`name = $${i++}`);         vals.push(name); }
  if (step !== undefined)         { sets.push(`step = $${i++}`);         vals.push(parseInt(step)); }
  if (delay_hours !== undefined)  { sets.push(`delay_hours = $${i++}`);  vals.push(parseInt(delay_hours)); }
  if (subject !== undefined)      { sets.push(`subject = $${i++}`);      vals.push(subject); }
  if (email_body !== undefined)   { sets.push(`email_body = $${i++}`);   vals.push(email_body); }
  if (sms_body !== undefined)     { sets.push(`sms_body = $${i++}`);     vals.push(sms_body); }
  if (active !== undefined)       { sets.push(`active = $${i++}`);       vals.push(active); }

  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  vals.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE website_drip_templates SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals,
  );
  if (!rows.length) return res.status(404).json({ error: 'Template not found' });
  res.json(rows[0]);
});

// ── Admin: delete drip template ───────────────────────────────────────────────
router.delete('/drip-templates/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  await pool.query('DELETE FROM website_drip_templates WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── Background drip processor ─────────────────────────────────────────────────
export async function runAbandonedCartDrip() {
  const { rows: templates } = await pool.query(
    `SELECT * FROM website_drip_templates WHERE active = true AND trigger_type = 'abandoned_cart' ORDER BY step ASC`,
  );
  if (!templates.length) return;

  // Find carts that are not converted, not empty, and are at least 30 min old
  const { rows: carts } = await pool.query(
    `SELECT * FROM website_abandoned_carts
     WHERE converted = false
       AND (items != '[]'::jsonb OR design_items != '[]'::jsonb)
       AND last_updated < NOW() - INTERVAL '30 minutes'`,
  );

  for (const cart of carts) {
    for (const tmpl of templates) {
      if (cart.drip_step >= tmpl.step) continue;

      const thresholdMs = tmpl.delay_hours * 60 * 60 * 1000;
      const cartAge = Date.now() - new Date(cart.created_at).getTime();
      if (cartAge < thresholdMs) break; // templates are ordered by step; earlier steps not due yet

      // Build template vars
      const firstName = (cart.name || 'there').split(' ')[0];
      const itemNames = (cart.items as any[]).map((i: any) => i.product?.name || 'item').join(', ');
      const cartLink = `${BASE_URL}/cart`;
      const vars: Record<string, string> = {
        firstName,
        items: itemNames || 'your items',
        totalAmount: parseFloat(cart.total).toFixed(0),
        cartLink,
        shopLink: BASE_URL,
      };

      if (cart.email && tmpl.email_body) {
        try {
          await sendAbandonedCartEmail(
            cart.email,
            applyTemplateVars(tmpl.subject, vars),
            applyTemplateVars(tmpl.email_body, vars),
          );
        } catch (e) {
          console.error('[Drip] Email error:', e);
        }
      }

      if (cart.phone && tmpl.sms_body && process.env.MSG91_DRIP_TEMPLATE_ID) {
        try {
          await sendTransactionalSMS(cart.phone, process.env.MSG91_DRIP_TEMPLATE_ID, {
            VAR1: firstName,
            VAR2: parseFloat(cart.total).toFixed(0),
            VAR3: cartLink,
          });
        } catch (e) {
          console.error('[Drip] SMS error:', e);
        }
      }

      // Advance drip step
      await pool.query(
        `UPDATE website_abandoned_carts SET drip_step = $1, last_drip_at = NOW() WHERE id = $2`,
        [tmpl.step, cart.id],
      );

      break; // send at most one drip per cart per run
    }
  }
}

export default router;
