import { Router, Request, Response } from 'express';
import { pool, rowToProduct } from '../database.js';
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

// GET /api/wishlist — full product objects (camelCase-mapped) in wishlist
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { rows } = await pool.query(
      `SELECT p.*, m.id AS m_id, m.front_image AS m_front_image, m.back_image AS m_back_image,
              m.front_shadow AS m_front_shadow, m.back_shadow AS m_back_shadow, m.print_area AS m_print_area,
              c.size_chart AS cat_size_chart, w.created_at AS wishlisted_at
       FROM website_wishlist w
       JOIN website_products p ON w.product_id = p.id
       LEFT JOIN website_mockups m ON m.id = p.mockup_id
       LEFT JOIN website_categories c ON c.id = p.category_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [userId],
    );
    res.json(rows.map(rowToProduct));
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
