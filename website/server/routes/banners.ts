import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import * as db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BANNER_UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'banners');
if (!fs.existsSync(BANNER_UPLOADS_DIR)) fs.mkdirSync(BANNER_UPLOADS_DIR, { recursive: true });

const bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BANNER_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadBanner = multer({
  storage: bannerStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG, JPEG, and WebP images are allowed'));
  },
});

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
    textAlign: r.text_align || 'left',
    imagePosition: r.image_position || 'center',
    active: r.active,
    sortOrder: r.sort_order,
    startDate: r.start_date || null,
    endDate: r.end_date || null,
    createdAt: r.created_at,
  };
}

/* ── Upload ── */
router.post('/upload', authMiddleware, adminOnly, (req: Request, res: Response) => {
  uploadBanner.single('image')(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/banners/${req.file.filename}` });
  });
});

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
      bgGradient, accentColor, textColor, textAlign, imagePosition,
      active, sortOrder, startDate, endDate,
    } = req.body;
    if (!title?.trim() && !imageUrl) return res.status(400).json({ error: 'Add a title or an image' });
    const banner = await db.createBanner({
      id: uuid(),
      title: title?.trim() || '',
      subtitle: subtitle || '',
      badgeText: badgeText || '',
      badgeType: badgeType || 'featured',
      imageUrl: imageUrl || '',
      ctaLabel: ctaLabel || 'Shop Now',
      ctaUrl: ctaUrl || '/products',
      ctaLabel2: ctaLabel2 || '',
      ctaUrl2: ctaUrl2 || '',
      textAlign: textAlign || 'left',
      imagePosition: imagePosition || 'center',
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
      bgGradient, accentColor, textColor, textAlign, imagePosition,
      active, sortOrder, startDate, endDate,
    } = req.body;
    const updated = await db.updateBanner(req.params.id as string, {
      title, subtitle, badgeText, badgeType, imageUrl,
      ctaLabel, ctaUrl, ctaLabel2, ctaUrl2,
      bgGradient, accentColor, textColor, textAlign, imagePosition,
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
