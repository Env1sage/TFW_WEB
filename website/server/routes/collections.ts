import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import * as db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function adminOnly(req: Request, res: Response, next: any) {
  const roles = ['admin', 'super_admin', 'product_manager'];
  if (!roles.includes((req as any).userRole)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

/* ── Public ── */
router.get('/', async (_req, res) => {
  try {
    const collections = await db.getCollections(true);
    res.json(collections);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const collection = await db.getCollectionById(req.params.id);
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    res.json(collection);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/products', async (req, res) => {
  try {
    const rows = await db.getCollectionProducts(req.params.id);
    // Shape into Product-like objects matching the frontend Product type
    const products = rows.map((r: any) => ({
      id: r.id, sku: r.sku, name: r.name, description: r.description,
      price: parseFloat(r.price), category: r.category, categoryId: r.category_id,
      image: r.image, images: r.images || [],
      customizable: r.customizable, colors: r.colors || [], sizes: r.sizes || [],
      stock: r.stock, rating: parseFloat(r.rating), reviewCount: r.review_count,
      featured: r.featured, mockupId: r.mockup_id || undefined, createdAt: r.created_at,
    }));
    res.json(products);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Admin ── */
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, tagline, tag, gradient, glow, shimmer, symbol, badge, badgeColor, featured, active, sortOrder, coverImage } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const collection = await db.createCollection({
      id: uuid(), name, tagline: tagline || '', tag: tag || 'Custom',
      gradient: gradient || 'linear-gradient(135deg,#0E7C61 0%,#0A5C49 100%)',
      glow: glow || '#0E7C61',
      shimmer: shimmer || 'rgba(255,255,255,0.15)',
      symbol: symbol || '✨', badge: badge || 'New',
      badgeColor: badgeColor || '#C6A75E',
      featured: !!featured, active: active !== false, sortOrder: sortOrder || 0,
      coverImage: coverImage || '',
    });
    res.status(201).json(collection);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const updated = await db.updateCollection(req.params.id as string, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const ok = await db.deleteCollection(req.params.id as string);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/products', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { productId, sortOrder } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });
    await db.addProductToCollection(req.params.id as string, productId, sortOrder || 0);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/products/:productId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.removeProductFromCollection(req.params.id as string, req.params.productId as string);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
