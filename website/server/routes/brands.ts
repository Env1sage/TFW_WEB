import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import * as db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function adminOnly(req: Request, res: Response, next: any) {
  const roles = ['admin', 'super_admin', 'product_manager'];
  if (!roles.includes((req as any).userRole)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

function shapeBrand(r: any) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    logo: r.logo || '',
    categoryId: r.category_id || null,
    categoryName: r.category_name || null,
    categorySlug: r.category_slug || null,
    active: r.active,
    sortOrder: r.sort_order,
    modelCount: parseInt(r.model_count ?? '0', 10),
    createdAt: r.created_at,
  };
}

function shapeModel(r: any) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    displayName: r.display_name || r.name,
    brandId: r.brand_id,
    brandName: r.brand_name || null,
    brandSlug: r.brand_slug || null,
    categorySlug: r.category_slug || null,
    active: r.active,
    inStock: r.in_stock ?? true,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

/* ──────────────────────── Public Routes ──────────────────────── */

// GET /api/brands  — all brands, optionally filtered by ?categoryId= or ?categorySlug=
router.get('/', async (req, res) => {
  try {
    let categoryId = req.query.categoryId as string | undefined;
    if (!categoryId && req.query.categorySlug) {
      // resolve slug → id
      const cats = await db.pool.query(
        'SELECT id FROM website_categories WHERE slug=$1',
        [req.query.categorySlug]
      );
      categoryId = cats.rows[0]?.id;
    }
    const rows = await db.getBrands(categoryId);
    res.json(rows.map(shapeBrand));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/brands/by-category/:categorySlug  (SEO-clean URL used by frontend)
router.get('/by-category/:categorySlug', async (req, res) => {
  try {
    const cats = await db.pool.query(
      'SELECT id FROM website_categories WHERE slug=$1',
      [req.params.categorySlug]
    );
    if (!cats.rows.length) return res.status(404).json({ error: 'Category not found' });
    const rows = await db.getBrands(cats.rows[0].id);
    res.json(rows.map(shapeBrand));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/brands/:brandSlug  — brand detail
router.get('/:brandSlug', async (req, res) => {
  try {
    // Don't match "models" sub-path here — let the next route handle it
    if (req.params.brandSlug === 'models') return res.status(404).json({ error: 'Not found' });
    const brand = await db.getBrandBySlug(req.params.brandSlug);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    res.json(shapeBrand(brand));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/brands/:brandSlug/models  — models for a brand
router.get('/:brandSlug/models', async (req, res) => {
  try {
    const brand = await db.getBrandBySlug(req.params.brandSlug);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    const rows = await db.getModelsByBrand(brand.id);
    res.json(rows.map(shapeModel));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/brands/:brandSlug/models/:modelSlug  — single model
router.get('/:brandSlug/models/:modelSlug', async (req, res) => {
  try {
    const model = await db.getModelBySlug(req.params.brandSlug, req.params.modelSlug);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json(shapeModel(model));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ──────────────────────── Admin Routes ──────────────────────── */

// Admin: list all brands (including inactive)
router.get('/admin/all', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const rows = await db.getAllBrands();
    res.json(rows.map(shapeBrand));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Admin: list all models (including inactive)
router.get('/admin/models', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const rows = await db.getAllModels();
    res.json(rows.map(shapeModel));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Admin: create brand
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, logo, categoryId, active, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const slug = slugify(name);
    const brand = await db.createBrand({
      id: uuid(), name, slug, logo: logo || '',
      categoryId: categoryId || undefined,
      active: active !== false, sortOrder: sortOrder || 0,
    });
    res.status(201).json(shapeBrand(brand));
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Brand with this name already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Admin: update brand
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, logo, categoryId, active, sortOrder } = req.body;
    const slug = name ? slugify(name) : undefined;
    const updated = await db.updateBrand(req.params.id as string, {
      name, slug, logo, categoryId, active, sortOrder,
    });
    if (!updated) return res.status(404).json({ error: 'Brand not found' });
    res.json(shapeBrand(updated));
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Brand slug already in use' });
    res.status(500).json({ error: e.message });
  }
});

// Admin: delete brand
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const ok = await db.deleteBrand(req.params.id as string);
    if (!ok) return res.status(404).json({ error: 'Brand not found' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Admin: create model under a brand
router.post('/:brandId/models', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, displayName, active, sortOrder, inStock } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const slug = slugify(name);
    const model = await db.createModel({
      id: uuid(), name, slug,
      displayName: displayName || name,
      brandId: req.params.brandId as string,
      active: active !== false, sortOrder: sortOrder || 0, inStock: inStock !== false,
    });
    res.status(201).json(shapeModel(model));
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Model with this name already exists for this brand' });
    res.status(500).json({ error: e.message });
  }
});

// Admin: update model
router.put('/models/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, displayName, brandId, active, sortOrder, inStock } = req.body;
    const slug = name ? slugify(name) : undefined;
    const updated = await db.updateModel(req.params.id as string, {
      name, slug, displayName, brandId, active, sortOrder, inStock,
    });
    if (!updated) return res.status(404).json({ error: 'Model not found' });
    res.json(shapeModel(updated));
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Model slug already in use for this brand' });
    res.status(500).json({ error: e.message });
  }
});

// Admin: delete model
router.delete('/models/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const ok = await db.deleteModel(req.params.id as string);
    if (!ok) return res.status(404).json({ error: 'Model not found' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
