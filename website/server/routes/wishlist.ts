import { Router, Request, Response } from 'express';
import { pool } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/wishlist/ids — product IDs the current user has wishlisted
router.get('/ids', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { rows } = await pool.query(
      `SELECT product_id FROM website_wishlist WHERE user_id = $1`,
      [userId],
    );
    res.json(rows.map((r: any) => r.product_id));
  } catch { res.status(500).json({ error: 'Failed to fetch wishlist' }); }
});

// GET /api/wishlist — full product objects in wishlist
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { rows } = await pool.query(
      `SELECT p.*, w.created_at as wishlisted_at
       FROM website_wishlist w
       JOIN website_products p ON w.product_id = p.id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [userId],
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to fetch wishlist' }); }
});

// POST /api/wishlist/:productId — add
router.post('/:productId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { productId } = req.params;
    const prod = await pool.query(`SELECT id FROM website_products WHERE id = $1`, [productId]);
    if (!prod.rows.length) return res.status(404).json({ error: 'Product not found' });
    await pool.query(
      `INSERT INTO website_wishlist (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, productId],
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to add to wishlist' }); }
});

// DELETE /api/wishlist/:productId — remove
router.delete('/:productId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { productId } = req.params;
    await pool.query(
      `DELETE FROM website_wishlist WHERE user_id = $1 AND product_id = $2`,
      [userId, productId],
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to remove from wishlist' }); }
});

export default router;
