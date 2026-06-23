import { Router, Request, Response } from 'express';
import { pool } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Public: get a single setting by key
router.get('/:key', async (req: Request, res: Response) => {
  const { key } = req.params;
  const { rows } = await pool.query('SELECT value FROM website_settings WHERE key = $1', [key]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ key, value: rows[0].value });
});

// Admin: list all settings
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  if (!(['admin','super_admin'].includes((req as any).userRole))) return res.status(403).json({ error: 'Forbidden' });
  const { rows } = await pool.query('SELECT key, value, updated_at FROM website_settings ORDER BY key');
  res.json(rows);
});

// Admin: update a setting
router.put('/:key', authMiddleware, async (req: Request, res: Response) => {
  if (!(['admin','super_admin'].includes((req as any).userRole))) return res.status(403).json({ error: 'Forbidden' });
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined || value === null) return res.status(400).json({ error: 'value required' });
  const { rows } = await pool.query(
    `INSERT INTO website_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
     RETURNING key, value, updated_at`,
    [key, String(value)]
  );
  res.json(rows[0]);
});

export default router;
