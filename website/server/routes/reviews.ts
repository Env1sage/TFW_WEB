import { Router, Request, Response } from 'express';
import { pool } from '../database.js';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/reviews/:productId — public
router.get('/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { rows } = await pool.query(
      `SELECT r.id, r.rating, r.title, r.body, r.helpful_count, r.created_at,
              u.name as user_name
       FROM website_reviews r
       JOIN website_users u ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [productId],
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to fetch reviews' }); }
});

// GET /api/reviews/:productId/mine — get current user's review for this product
router.get('/:productId/mine', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { productId } = req.params;
    const { rows } = await pool.query(
      `SELECT id, rating, title, body FROM website_reviews WHERE product_id = $1 AND user_id = $2`,
      [productId, userId],
    );
    res.json(rows[0] ?? null);
  } catch { res.status(500).json({ error: 'Failed to fetch review' }); }
});

// POST /api/reviews/:productId — create or update review
router.post('/:productId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { productId } = req.params;
    const { rating, title = '', body = '' } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const prod = await pool.query(`SELECT id FROM website_products WHERE id = $1`, [productId]);
    if (!prod.rows.length) return res.status(404).json({ error: 'Product not found' });

    await pool.query(
      `INSERT INTO website_reviews (id, product_id, user_id, rating, title, body, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (product_id, user_id) DO UPDATE
       SET rating = $4, title = $5, body = $6, updated_at = NOW()`,
      [uuid(), productId, userId, rating, title.slice(0, 100), body.slice(0, 2000)],
    );

    // Re-aggregate rating on product
    await pool.query(
      `UPDATE website_products SET
         rating = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM website_reviews WHERE product_id = $1), 0),
         review_count = (SELECT COUNT(*) FROM website_reviews WHERE product_id = $1)
       WHERE id = $1`,
      [productId],
    );

    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to save review' }); }
});

// DELETE /api/reviews/:reviewId — own review or admin
router.delete('/:reviewId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const userRole = (req as any).userRole;
    const { reviewId } = req.params;

    const existing = await pool.query(
      `SELECT product_id, user_id FROM website_reviews WHERE id = $1`,
      [reviewId],
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Review not found' });

    const review = existing.rows[0];
    if (userRole !== 'admin' && review.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query(`DELETE FROM website_reviews WHERE id = $1`, [reviewId]);

    await pool.query(
      `UPDATE website_products SET
         rating = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM website_reviews WHERE product_id = $1), 0),
         review_count = (SELECT COUNT(*) FROM website_reviews WHERE product_id = $1)
       WHERE id = $1`,
      [review.product_id],
    );

    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to delete review' }); }
});

export default router;
