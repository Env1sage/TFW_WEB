import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import * as db from '../database.js';
import { authMiddleware, adminMiddleware, requireRole } from '../middleware/auth.js';
import { sendOrderConfirmation, sendAdminOrderNotification, sendDesignOrderConfirmation, sendAdminDesignOrderNotification } from '../email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOCKUP_UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'mockups');
if (!fs.existsSync(MOCKUP_UPLOADS_DIR)) fs.mkdirSync(MOCKUP_UPLOADS_DIR, { recursive: true });

const PRODUCT_UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'products');
if (!fs.existsSync(PRODUCT_UPLOADS_DIR)) fs.mkdirSync(PRODUCT_UPLOADS_DIR, { recursive: true });

const mockupStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MOCKUP_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const productStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PRODUCT_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadMockup = multer({
  storage: mockupStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG, JPEG, and WebP images are allowed'));
  },
});

const uploadProduct = multer({
  storage: productStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG, JPEG, and WebP images are allowed'));
  },
});

const router = Router();

// Razorpay config (test keys — replace with live keys in production)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';

// Get all products (public)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { category, search, featured, sort, minPrice, maxPrice } = _req.query;
    const products = await db.getProducts({
      category: category as string,
      search: search as string,
      featured: featured === 'true' ? true : undefined,
      sort: sort as string,
      minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
    });
    res.json(products);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Product image upload
router.post('/upload', authMiddleware, requireRole('admin', 'product_manager'), uploadProduct.single('image'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/products/${req.file.filename}`;
  res.json({ url });
});

// Get categories (public) — returns full category objects with id/name/slug/tokenId
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const cats = await db.getCategories();
    res.json(cats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create category (admin)
router.post('/categories', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required' });
    const trimmed = name.trim();
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Pre-flight: check for case-insensitive name duplicate
    const existing = await db.getCategories();
    if (existing.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return res.status(409).json({ error: `Category "${trimmed}" already exists` });
    }
    const category = await db.addCategory({ id: uuid(), name: trimmed, slug });
    res.status(201).json(category);
  } catch (e: any) {
    if ((e as any).code === '23505') return res.status(409).json({ error: 'A category with this name already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Update category (admin)
router.put('/categories/:id', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required' });
    const trimmed = name.trim();
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Pre-flight: check for case-insensitive name duplicate (exclude self)
    const existing = await db.getCategories();
    if (existing.some(c => c.id !== req.params.id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      return res.status(409).json({ error: `Category "${trimmed}" already exists` });
    }
    const updated = await db.updateCategory(String(req.params.id), { name: trimmed, slug });
    if (!updated) return res.status(404).json({ error: 'Category not found' });
    // Keep products' category text in sync
    res.json(updated);
  } catch (e: any) {
    if ((e as any).code === '23505') return res.status(409).json({ error: 'A category with this name already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Delete category (admin)
router.delete('/categories/:id', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    await db.deleteCategory(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Mockup categories ──

// Get mockup categories (public)
router.get('/mockup-categories', async (_req: Request, res: Response) => {
  try {
    const cats = await db.getMockupCategories();
    res.json(cats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create mockup category (admin)
router.post('/mockup-categories', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required' });
    const trimmed = name.trim();
    const existing = await db.getMockupCategories();
    if (existing.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return res.status(409).json({ error: `Mockup category "${trimmed}" already exists` });
    }
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cat = await db.addMockupCategory({ id: uuid(), name: trimmed, slug });
    res.status(201).json(cat);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'A mockup category with this name already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Update mockup category (admin)
router.put('/mockup-categories/:id', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required' });
    const trimmed = name.trim();
    const existing = await db.getMockupCategories();
    if (existing.some(c => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== id)) {
      return res.status(409).json({ error: `Mockup category "${trimmed}" already exists` });
    }
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cat = await db.updateMockupCategory(id, { name: trimmed, slug });
    if (!cat) return res.status(404).json({ error: 'Mockup category not found' });
    res.json(cat);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'A mockup category with this name already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Delete mockup category (admin)
router.delete('/mockup-categories/:id', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    await db.deleteMockupCategory(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Saved Designs ---
router.get('/saved-designs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const designs = await db.getSavedDesignsByUser((req as any).userId);
    res.json(designs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/saved-designs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, productType, colorHex, colorName, printSize, canvasData, thumbnail } = req.body;
    if (!productType || !canvasData) return res.status(400).json({ error: 'Product type and canvas data required' });
    const design = await db.addSavedDesign({
      id: uuid(), userId: (req as any).userId,
      name: name || 'Untitled Design', productType,
      colorHex: colorHex || '#ffffff', colorName: colorName || 'White',
      printSize: printSize || 'full', canvasData, thumbnail: thumbnail || '',
    });
    res.status(201).json(design);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/saved-designs/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await db.deleteSavedDesign(String(req.params.id), (req as any).userId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// --- Invoice ---
router.get('/orders/:id/invoice', authMiddleware, async (req: Request, res: Response) => {
  try {
    const invoice = await db.getOrderForInvoice(String(req.params.id));
    if (!invoice) return res.status(404).json({ error: 'Order not found' });
    res.json(invoice);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// --- Database viewer (admin) ---
router.get('/db-viewer', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const data = await db.getDbViewer();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Analytics (must be before /:id) ---
router.get('/analytics', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const data = await db.getAnalytics();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Design Orders (must be before /:id) ---
router.post('/design-orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { productType, colorHex, colorName, printSize, sides, designImages, uploadedImages, quantity, unitPrice, total, shippingAddress, customerEmail, customerName } = req.body;
    if (!productType || !designImages || !quantity) return res.status(400).json({ error: 'Product type, design images, and quantity are required' });
    const userId: string = (req as any).userId;
    let resolvedName = customerName || 'Customer';
    let resolvedEmail = customerEmail || '';
    const user = await db.findUserById(userId);
    if (user) {
      resolvedName = user.name;
      resolvedEmail = user.email;
    }
    const order = await db.addDesignOrder({
      id: uuid(), userId, productType, colorHex: colorHex || '#ffffff',
      colorName: colorName || 'White', printSize: printSize || 'full',
      sides: sides || [], designImages: designImages || {},
      uploadedImages: uploadedImages || {},
      quantity: quantity || 1, unitPrice: unitPrice || 0,
      total: total || 0, shippingAddress: shippingAddress || '',
    });

    // Send emails (non-blocking)
    if (resolvedEmail) {
      const emailData = {
        orderId: order.id,
        customerName: resolvedName,
        customerEmail: resolvedEmail,
        productType: order.productType,
        colorName: order.colorName,
        printSize: order.printSize,
        sides: order.sides,
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        total: order.total,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
      };
      sendDesignOrderConfirmation(emailData).catch(e => console.error('[Email] design order confirmation failed:', e));
      sendAdminDesignOrderNotification(emailData).catch(e => console.error('[Email] admin design notification failed:', e));
    }

    res.status(201).json(order);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/design-orders/all', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const orders = await db.getAllDesignOrders();
    res.json(orders);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get current user's own design orders
router.get('/design-orders/mine', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orders = await db.getDesignOrdersByUser((req as any).userId);
    res.json(orders);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/design-orders/:id', async (req: Request, res: Response) => {
  try {
    const order = await db.getDesignOrderById(String(req.params.id));
    if (!order) return res.status(404).json({ error: 'Design order not found' });
    res.json(order);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/design-orders/:id/status', authMiddleware, requireRole('admin', 'order_manager'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const updated = await db.updateDesignOrder(String(req.params.id), { status });
    if (!updated) return res.status(404).json({ error: 'Design order not found' });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/design-orders/:id', async (req: Request, res: Response) => {
  try {
    const { shippingAddress, status } = req.body;
    const updated = await db.updateDesignOrder(String(req.params.id), { shippingAddress, status });
    if (!updated) return res.status(404).json({ error: 'Design order not found' });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Mockups (must be before /:id) ---
// Public: active mockups for design studio (no auth required)
router.get('/mockups/active', async (_req: Request, res: Response) => {
  try {
    const mockups = await db.getAllMockups();
    res.json(mockups.filter(m => m.active));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/mockups', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const mockups = await db.getAllMockups();
    res.json(mockups);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Orders (must be before /:id) ---

// Create Razorpay order
router.post('/razorpay/create-order', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    // Create a Razorpay order via API
    const Razorpay = await import('razorpay').then(m => m.default || m);
    const rzp = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
    const order = await rzp.orders.create({
      amount: Math.round(amount * 100), // amount in paise
      currency: 'INR',
      receipt: `rcpt_${uuid().slice(0, 8)}`,
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: RAZORPAY_KEY_ID });
  } catch (e: any) {
    console.error('Razorpay order error:', e.message);
    // Fallback: if Razorpay is unavailable or keys are placeholder, still allow checkout
    if (RAZORPAY_KEY_ID === 'rzp_test_placeholder') {
      return res.json({ orderId: `sim_${uuid().slice(0, 12)}`, amount: Math.round(req.body.amount * 100), currency: 'INR', keyId: RAZORPAY_KEY_ID, simulated: true });
    }
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Verify Razorpay payment
router.post('/razorpay/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // If simulated (no real Razorpay keys), skip verification
    if (razorpay_order_id?.startsWith('sim_')) {
      return res.json({ verified: true, simulated: true });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(body).digest('hex');

    if (expectedSignature === razorpay_signature) {
      res.json({ verified: true });
    } else {
      res.status(400).json({ verified: false, error: 'Invalid payment signature' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create order (auth required)
router.post('/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { items, shippingAddress } = req.body;
    if (!items?.length || !shippingAddress) return res.status(400).json({ error: 'Items and address required' });

    let total = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await db.getProductById(item.productId);
      if (!product) return res.status(400).json({ error: `Product ${item.productId} not found` });
      const price = product.price * (item.quantity || 1);
      total += price;
      orderItems.push({ ...item, price, productName: product.name, productImage: product.image });
    }

    const order = await db.addOrder({
      id: uuid(),
      userId: (req as any).userId,
      items: orderItems,
      total: Math.round(total * 100) / 100,
      status: 'pending',
      shippingAddress,
    });

    // Send emails (non-blocking — don't let email failure block the response)
    const user = await db.findUserById((req as any).userId);
    if (user) {
      const emailData = {
        orderId: order.id,
        customerName: user.name,
        customerEmail: user.email,
        items: orderItems,
        total: order.total,
        shippingAddress,
        createdAt: order.createdAt,
      };
      sendOrderConfirmation(emailData).catch(e => console.error('[Email] order confirmation failed:', e));
      sendAdminOrderNotification(emailData).catch(e => console.error('[Email] admin notification failed:', e));
    }

    res.status(201).json(order);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get user orders
router.get('/orders/mine', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orders = await db.getOrdersByUser((req as any).userId);
    res.json(orders);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get all orders (admin)
router.get('/orders/all', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const orders = await db.getAllOrders();
    res.json(orders);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update order status (admin)
router.put('/orders/:id/status', authMiddleware, requireRole('admin', 'order_manager'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const updated = await db.updateOrder(String(req.params.id), { status });
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Mockup image upload
router.post('/mockups/upload', authMiddleware, requireRole('admin', 'product_manager'), uploadMockup.single('image'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/mockups/${req.file.filename}`;
  res.json({ url });
});

// Mockup CRUD
router.post('/mockups', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    const { name, category, frontImage, backImage, frontShadow, backShadow, printArea } = req.body;
    if (!name || !frontImage) return res.status(400).json({ error: 'Name and front image are required' });
    const mockup = await db.addMockup({ id: uuid(), name, category: category || 'T-Shirts', frontImage, backImage, frontShadow, backShadow, printArea });
    res.status(201).json(mockup);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/mockups/:id', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    const updated = await db.updateMockup(String(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: 'Mockup not found' });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/mockups/:id', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    await db.deleteMockup(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get single product (public) — MUST be after all named routes to avoid shadowing
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await db.getProductById(String(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create product (admin only)
router.post('/', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    const { name, description, price, category, categoryId, mockupId, image, customizable, colors, sizes, stock, featured } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Name, price, and category required' });

    // Resolve category name from categoryId if provided
    let resolvedCategory = category;
    let resolvedCategoryId = categoryId || null;
    if (categoryId) {
      const cat = await db.getCategoryById(categoryId);
      if (!cat) return res.status(400).json({ error: 'Invalid category ID' });
      resolvedCategory = cat.name;
      resolvedCategoryId = cat.id;
    }

    const product = await db.addProduct({
      id: uuid(),
      name,
      description: description || '',
      price: Number(price),
      category: resolvedCategory,
      categoryId: resolvedCategoryId,
      mockupId: mockupId || null,
      image: image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
      images: [],
      customizable: customizable ?? true,
      colors: colors || [],
      sizes: sizes || [],
      stock: stock ?? 100,
      rating: 0,
      reviewCount: 0,
      featured: featured ?? false,
    });
    res.status(201).json(product);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update product (admin only)
router.put('/:id', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    const existing = await db.getProductById(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const patch = { ...req.body };
    // If a categoryId is provided, resolve the name from the DB
    if (patch.categoryId) {
      const cat = await db.getCategoryById(patch.categoryId);
      if (!cat) return res.status(400).json({ error: 'Invalid category ID' });
      patch.category = cat.name;
    }

    const updated = await db.updateProduct(String(req.params.id), patch);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete product (admin only)
router.delete('/:id', authMiddleware, requireRole('admin', 'product_manager'), async (req: Request, res: Response) => {
  try {
    const existing = await db.getProductById(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    await db.deleteProduct(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Corporate / Bulk Inquiry Routes ── */
// Public — anyone can submit
router.post('/corporate-inquiry', async (req: Request, res: Response) => {
  try {
    const { companyName, contactName, email, phone, productInterest, quantity, message } = req.body;
    if (!companyName || !contactName || !email) return res.status(400).json({ error: 'Company name, contact name, and email are required' });
    const inquiry = await db.addCorporateInquiry({ companyName, contactName, email, phone: phone || '', productInterest: productInterest || '', quantity: Number(quantity) || 100, message: message || '' });
    res.json(inquiry);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: list all inquiries
router.get('/corporate-inquiries', authMiddleware, requireRole('admin', 'order_manager'), async (_req: Request, res: Response) => {
  try {
    const inquiries = await db.getCorporateInquiries();
    res.json(inquiries);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: update inquiry status
router.put('/corporate-inquiries/:id', authMiddleware, requireRole('admin', 'order_manager'), async (req: Request, res: Response) => {
  try {
    const updated = await db.updateInquiryStatus(String(req.params.id), req.body.status, req.body.adminNotes || '');
    if (!updated) return res.status(404).json({ error: 'Inquiry not found' });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
