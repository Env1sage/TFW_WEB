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

function shapeBanner(r: any) {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle || '',
    badgeText: r.badge_text || '',
    badgeType: r.badge_type || 'featured',
    imageUrl: r.image_url || '',
    ctaLabel: r.cta_label || 'Shop Now',
    ctaUrl: r.cta_url || '/products',
    ctaLabel2: r.cta_label_2 || '',
    ctaUrl2: r.cta_url_2 || '',
    bgGradient: r.bg_gradient || 'linear-gradient(135deg,#0E7C61 0%,#0A5C49 100%)',
    accentColor: r.accent_color || '#C6A75E',
    textColor: r.text_color || '#ffffff',
    active: r.active,
    sortOrder: r.sort_order,
    startDate: r.start_date || null,
    endDate: r.end_date || null,
    createdAt: r.created_at,
  };
}

/* ── Public ── */
router.get('/', async (_req, res) => {
  try {
    const rows = await db.getActiveBanners();
    res.json(rows.map(shapeBanner));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Admin ── */
router.get('/all', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const rows = await db.getAllBanners();
    res.json(rows.map(shapeBanner));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      title, subtitle, badgeText, badgeType, imageUrl,
      ctaLabel, ctaUrl, ctaLabel2, ctaUrl2,
      bgGradient, accentColor, textColor,
      active, sortOrder, startDate, endDate,
    } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
    const banner = await db.createBanner({
      id: uuid(),
      title: title.trim(),
      subtitle: subtitle || '',
      badgeText: badgeText || '',
      badgeType: badgeType || 'featured',
      imageUrl: imageUrl || '',
      ctaLabel: ctaLabel || 'Shop Now',
      ctaUrl: ctaUrl || '/products',
      ctaLabel2: ctaLabel2 || '',
      ctaUrl2: ctaUrl2 || '',
      bgGradient: bgGradient || 'linear-gradient(135deg,#0E7C61 0%,#0A5C49 100%)',
      accentColor: accentColor || '#C6A75E',
      textColor: textColor || '#ffffff',
      active: active !== false,
      sortOrder: Number(sortOrder) || 0,
      startDate: startDate || null,
      endDate: endDate || null,
    });
    res.status(201).json(shapeBanner(banner));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      title, subtitle, badgeText, badgeType, imageUrl,
      ctaLabel, ctaUrl, ctaLabel2, ctaUrl2,
      bgGradient, accentColor, textColor,
      active, sortOrder, startDate, endDate,
    } = req.body;
    const updated = await db.updateBanner(req.params.id as string, {
      title, subtitle, badgeText, badgeType, imageUrl,
      ctaLabel, ctaUrl, ctaLabel2, ctaUrl2,
      bgGradient, accentColor, textColor,
      active, sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      startDate: startDate || null,
      endDate: endDate || null,
    });
    if (!updated) return res.status(404).json({ error: 'Banner not found' });
    res.json(shapeBanner(updated));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const ok = await db.deleteBanner(req.params.id as string);
    if (!ok) return res.status(404).json({ error: 'Banner not found' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
