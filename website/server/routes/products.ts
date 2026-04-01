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

// ── Shiprocket API helper ──
const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';
let _srToken: string | null = null;
let _srTokenExpiry: number = 0;

async function getShiprocketToken(): Promise<string> {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) throw new Error('Shiprocket credentials not configured');
  if (_srToken && Date.now() < _srTokenExpiry) return _srToken;
  const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as any;
  if (!res.ok || !data.token) throw new Error(data.message || 'Shiprocket auth failed');
  _srToken = data.token;
  _srTokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 hours
  return _srToken!;
}

async function shiprocketRequest(method: string, endpoint: string, body?: object): Promise<any> {
  const token = await getShiprocketToken();
  const res = await fetch(`${SHIPROCKET_BASE}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.message || `Shiprocket API error: ${res.status}`);
  return data;
}

// ── Shiprocket status sync helper ──
const SR_STATUS_MAP: Record<string, string> = {
  'NEW': 'processing', 'READY TO SHIP': 'processing', 'PICKUP SCHEDULED': 'processing',
  'PICKED UP': 'shipped', 'IN TRANSIT': 'shipped', 'OUT FOR DELIVERY': 'out_for_delivery',
  'DELIVERED': 'delivered', 'CANCELED': 'cancelled', 'CANCELLED': 'cancelled',
  'RTO INITIATED': 'cancelled', 'RTO DELIVERED': 'cancelled',
};

async function syncShiprocketStatus(shipment: db.DBShipment): Promise<db.DBShipment> {
  if (!shipment.shiprocketOrderId) return shipment;
  try {
    const srData = await shiprocketRequest('GET', `/orders/show/${shipment.shiprocketOrderId}`);
    const srOrder = srData?.data || srData;
    const srStatus = (srOrder?.status || srOrder?.shipments?.[0]?.status || '').toString().toUpperCase();
    const mappedStatus = SR_STATUS_MAP[srStatus] || shipment.status;
    const awb = srOrder?.shipments?.[0]?.awb || shipment.awbCode;
    const courier = srOrder?.shipments?.[0]?.courier_name || shipment.courierName;
    const patch: Parameters<typeof db.updateShipment>[1] = {};
    let changed = false;
    if (mappedStatus !== shipment.status) { patch.status = mappedStatus; changed = true; }
    if (awb && awb !== shipment.awbCode) { patch.awbCode = awb; changed = true; }
    if (courier && courier !== shipment.courierName) { patch.courierName = courier; changed = true; }
    if (changed) {
      await db.updateShipment(shipment.id, patch);
      // Also sync order table status
      if (mappedStatus === 'cancelled' || mappedStatus === 'delivered' || mappedStatus === 'shipped' || mappedStatus === 'out_for_delivery') {
        await db.updateOrder(shipment.orderId, { status: mappedStatus });
      }
      console.log(`[Shiprocket] Synced order ${shipment.orderId}: ${shipment.status} → ${mappedStatus}`);
      return { ...shipment, ...patch } as db.DBShipment;
    }
  } catch (e: any) {
    console.error(`[Shiprocket] Status sync failed for order ${shipment.orderId}:`, e.message);
  }
  return shipment;
}

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

// Razorpay config
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn('WARNING: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — payments will be simulated');
}

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

router.get('/design-orders/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await db.getDesignOrderById(String(req.params.id));
    if (!order) return res.status(404).json({ error: 'Design order not found' });
    const userId = (req as any).userId;
    const userRole = (req as any).userRole;
    if (userRole !== 'admin' && userRole !== 'super_admin' && order.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(order);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/design-orders/:id/status', authMiddleware, requireRole('admin', 'order_manager'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !VALID_STATUSES.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    const updated = await db.updateDesignOrder(String(req.params.id), { status });
    if (!updated) return res.status(404).json({ error: 'Design order not found' });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/design-orders/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await db.getDesignOrderById(String(req.params.id));
    if (!order) return res.status(404).json({ error: 'Design order not found' });
    const userId = (req as any).userId;
    const userRole = (req as any).userRole;
    if (userRole !== 'admin' && userRole !== 'super_admin' && order.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { shippingAddress } = req.body;
    // Only admins can change status via this route
    const status = (userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_manager')
      ? req.body.status : undefined;
    const updated = await db.updateDesignOrder(String(req.params.id), {
      ...(shippingAddress !== undefined && { shippingAddress }),
      ...(status !== undefined && { status }),
    });
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

    // If Razorpay keys not configured, return simulated order
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.json({ orderId: `sim_${uuid().slice(0, 12)}`, amount: Math.round(amount * 100), currency: 'INR', keyId: '', simulated: true });
    }

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
    const { items, shippingAddress, razorpayOrderId, paymentId, couponCode, discountAmount } = req.body;
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

    // Apply discount
    const discount = discountAmount || 0;
    const finalTotal = Math.max(0, Math.round((total - discount) * 100) / 100);

    // Increment coupon use count
    if (couponCode) {
      await db.incrementCouponUseCount(couponCode);
    }

    const order = await db.addOrder({
      id: uuid(),
      userId: (req as any).userId,
      items: orderItems,
      total: finalTotal,
      status: 'pending',
      shippingAddress,
      razorpayOrderId: razorpayOrderId || undefined,
      paymentId: paymentId || undefined,
      paymentStatus: paymentId ? 'paid' : 'simulated',
      couponCode: couponCode || undefined,
      discountAmount: discount,
    });

    // Send emails (non-blocking)
    const user = await db.findUserById((req as any).userId);
    if (user) {
      const emailData = {
        orderId: order.id, customerName: user.name, customerEmail: user.email,
        items: orderItems, total: order.total, shippingAddress, createdAt: order.createdAt,
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
    // Sync Shiprocket status for orders that have shipments (in background, don't block response)
    const withSync = await Promise.all(orders.map(async (o: any) => {
      if (o.shipment?.shiprocketOrderId && o.status !== 'delivered' && o.status !== 'cancelled') {
        try {
          const synced = await syncShiprocketStatus(o.shipment);
          if (synced.status !== o.shipment.status) {
            const mappedOrderStatus = synced.status === 'cancelled' ? 'cancelled' : synced.status === 'delivered' ? 'delivered' : synced.status === 'out_for_delivery' ? 'out_for_delivery' : o.status;
            return { ...o, status: mappedOrderStatus, shipment: synced };
          }
        } catch { /* ignore sync errors */ }
      }
      return o;
    }));
    res.json(withSync);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get all orders (admin)
router.get('/orders/all', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const orders = await db.getAllOrders();
    // Sync Shiprocket status for active orders with shipments
    const withSync = await Promise.all(orders.map(async (o: any) => {
      if (o.shipment?.shiprocketOrderId && o.status !== 'delivered' && o.status !== 'cancelled') {
        try {
          const synced = await syncShiprocketStatus(o.shipment);
          if (synced.status !== o.shipment.status) {
            const mappedOrderStatus = synced.status === 'cancelled' ? 'cancelled' : synced.status === 'delivered' ? 'delivered' : synced.status === 'out_for_delivery' ? 'out_for_delivery' : o.status;
            return { ...o, status: mappedOrderStatus, shipment: synced };
          }
        } catch { /* ignore sync errors */ }
      }
      return o;
    }));
    res.json(withSync);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update order status (admin)
router.put('/orders/:id/status', authMiddleware, requireRole('admin', 'order_manager'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !VALID_STATUSES.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
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

// ── Coupons ──

// Validate coupon (authenticated — called from checkout)
router.post('/coupons/validate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, orderAmount } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code required' });
    const coupon = await db.getCouponByCode(code);
    if (!coupon || !coupon.active) return res.status(404).json({ error: 'Invalid or expired coupon code' });
    const now = new Date();
    if (coupon.validFrom && new Date(coupon.validFrom) > now)
      return res.status(400).json({ error: 'Coupon is not yet active' });
    if (coupon.validUntil && new Date(coupon.validUntil) < now)
      return res.status(400).json({ error: 'Coupon has expired' });
    if (coupon.maxUses !== null && coupon.useCount >= coupon.maxUses)
      return res.status(400).json({ error: 'Coupon usage limit reached' });
    if (orderAmount && parseFloat(orderAmount) < coupon.minOrderAmount)
      return res.status(400).json({ error: `Minimum order amount is ₹${coupon.minOrderAmount}` });
    const discountAmount = coupon.discountType === 'percentage'
      ? Math.round((parseFloat(orderAmount || '0') * coupon.discountValue / 100) * 100) / 100
      : coupon.discountValue;
    res.json({ valid: true, coupon, discountAmount });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Public: get all active coupons for announcement bar (no auth needed)
router.get('/coupons/active', async (_req: Request, res: Response) => {
  try {
    const coupons = await db.getActiveCoupons();
    res.json(coupons);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Public: get active popup coupon (no auth needed)
router.get('/coupons/popup', async (_req: Request, res: Response) => {
  try {
    const coupon = await db.getActivePopupCoupon();
    res.json(coupon || null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Admin: get all coupons
router.get('/coupons', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json(await db.getCoupons());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Admin: create coupon
router.post('/coupons', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, description, discountType, discountValue, minOrderAmount, maxUses, validFrom, validUntil, popupEnabled, popupMessage } = req.body;
    if (!code || !discountType || discountValue === undefined)
      return res.status(400).json({ error: 'Code, discount type, and discount value are required' });
    if (!['percentage', 'fixed'].includes(discountType))
      return res.status(400).json({ error: 'Discount type must be "percentage" or "fixed"' });
    const coupon = await db.addCoupon({
      id: uuid(), code, description: description || '',
      discountType, discountValue: parseFloat(discountValue),
      minOrderAmount: parseFloat(minOrderAmount || '0'),
      maxUses: maxUses ? parseInt(maxUses) : null,
      validFrom: validFrom || null, validUntil: validUntil || null,
      popupEnabled: !!popupEnabled, popupMessage: popupMessage || '',
    });
    res.status(201).json(coupon);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'A coupon with this code already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Admin: update coupon
router.put('/coupons/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const updated = await db.updateCoupon(String(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: 'Coupon not found' });
    res.json(updated);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'A coupon with this code already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Admin: delete coupon
router.delete('/coupons/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    await db.deleteCoupon(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Shiprocket Integration ──

// Admin: create Shiprocket shipment for an order
router.post('/orders/:id/create-shipment', authMiddleware, requireRole('admin', 'order_manager'), async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const orders = await db.getAllOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Check if shipment already exists
    const existing = await db.getShipmentByOrderId(orderId);
    if (existing?.shiprocketOrderId) {
      return res.status(409).json({ error: 'Shipment already exists for this order', shipment: existing });
    }

    // Parse address from the stored string format: "Name, Phone\nLine1, Line2\nCity, State - Pincode"
    const lines = order.shippingAddress.split('\n');
    const nameLine = lines[0] || '';
    const addrLine = lines[1] || '';
    const cityStatePinLine = lines[2] || '';
    const namePhone = nameLine.split(',').map(s => s.trim());
    const cityStatePin = cityStatePinLine.split(',');
    const cityPart = cityStatePin[0]?.trim() || '';
    const statePinPart = cityStatePin[1]?.trim() || '';
    const statePin = statePinPart.split('-').map(s => s.trim());

    // Merge any body overrides (admin can supply weight/dimensions)
    const { weight = 0.5, length = 30, breadth = 20, height = 5 } = req.body;
    let { pickupLocation } = req.body;

    // If no pickup location specified, fetch the first active one from Shiprocket
    if (!pickupLocation) {
      try {
        const pickups = await shiprocketRequest('GET', '/settings/company/pickup');
        const active = pickups?.data?.shipping_address?.find((a: any) => a.status === 1);
        pickupLocation = active?.pickup_location || pickups?.data?.shipping_address?.[0]?.pickup_location || 'Primary';
      } catch {
        pickupLocation = 'Primary';
      }
    }

    const srPayload = {
      order_id: `TFW-${orderId.slice(0, 12)}`,
      order_date: new Date(order.createdAt).toISOString().split('T')[0],
      pickup_location: pickupLocation,
      billing_customer_name: namePhone[0] || 'Customer',
      billing_last_name: '',
      billing_address: addrLine || order.shippingAddress,
      billing_city: cityPart || 'Mumbai',
      billing_pincode: statePin[1] || '400001',
      billing_state: statePin[0] || 'Maharashtra',
      billing_country: 'India',
      billing_email: order.customerEmail || '',
      billing_phone: namePhone[1] || '9000000000',
      shipping_is_billing: true,
      order_items: order.items.map((item: any) => ({
        name: item.productName || 'Custom Item',
        sku: item.productId || 'CUSTOM',
        units: item.quantity || 1,
        selling_price: item.price || 0,
      })),
      payment_method: 'Prepaid',
      sub_total: order.total,
      length, breadth, height, weight,
    };

    console.log('[Shiprocket] Creating order with pickup:', pickupLocation);
    const srResponse = await shiprocketRequest('POST', '/orders/create/adhoc', srPayload);
    console.log('[Shiprocket] Response:', JSON.stringify(srResponse).substring(0, 300));

    // Delete any broken local-only shipment record before inserting new one
    if (existing) {
      await db.deleteShipment(existing.id);
    }

    const shipment = await db.addShipment({
      id: uuid(), orderId,
      shiprocketOrderId: String(srResponse.order_id || ''),
      shiprocketShipmentId: String(srResponse.shipment_id || ''),
      awbCode: srResponse.awb_code || undefined,
      courierName: srResponse.courier_name || undefined,
      courierId: srResponse.courier_id || undefined,
      status: 'processing',
    });

    // Update order status to processing
    await db.updateOrder(orderId, { status: 'processing' });

    res.json({ shipment, shiprocketResponse: srResponse });
  } catch (e: any) {
    console.error('[Shiprocket] Create shipment error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Auth: get shipment/tracking for an order (customer or admin)
router.get('/orders/:id/tracking', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    let shipment = await db.getShipmentByOrderId(orderId);
    if (!shipment) return res.status(404).json({ error: 'No shipment found for this order' });

    // Sync status from Shiprocket (handles cancelled, AWB assignment, etc.)
    shipment = await syncShiprocketStatus(shipment);

    // If we have an AWB, fetch live tracking from Shiprocket
    if (shipment.awbCode) {
      try {
        const srTracking = await shiprocketRequest('GET', `/courier/track/awbs/${shipment.awbCode}`);
        // Merge Shiprocket data with existing tracking_data (preserve manual_events)
        const merged = { ...(shipment.trackingData || {}), ...srTracking };
        await db.updateShipment(shipment.id, {
          trackingData: merged,
          status: srTracking?.tracking_data?.shipment_track?.[0]?.current_status || shipment.status,
        });
        return res.json({ ...shipment, trackingData: merged });
      } catch {
        // Return cached tracking if live fails
      }
    }
    res.json(shipment);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get single order by ID (customer owns it, or admin)
router.get('/orders/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const userId = (req as any).userId;
    const userRole = (req as any).userRole;
    const order = await db.getOrderById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // Non-admins can only read their own orders
    if (userRole !== 'admin' && userRole !== 'super_admin' && order.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(order);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin/order_manager: create or update manual tracking info (no Shiprocket)
router.post('/orders/:id/tracking/manual', authMiddleware, requireRole('admin', 'order_manager'), async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const { courierName, awbCode, status, estimatedDelivery } = req.body;

    let shipment = await db.getShipmentByOrderId(orderId);
    if (!shipment) {
      shipment = await db.addShipment({
        id: uuid(), orderId,
        courierName: courierName || undefined,
        awbCode: awbCode || undefined,
        status: status || 'processing',
      });
    }

    const patch: Parameters<typeof db.updateShipment>[1] = {};
    if (courierName !== undefined) patch.courierName = courierName;
    if (awbCode !== undefined) patch.awbCode = awbCode;
    if (status !== undefined) patch.status = status;
    if (estimatedDelivery !== undefined) {
      patch.trackingData = { ...(shipment.trackingData || {}), estimatedDelivery };
    }
    if (Object.keys(patch).length) await db.updateShipment(shipment.id, patch);

    // Keep order status in sync
    if (status === 'shipped') await db.updateOrder(orderId, { status: 'shipped' });
    else if (status === 'delivered') await db.updateOrder(orderId, { status: 'delivered' });
    else if (status === 'processing') await db.updateOrder(orderId, { status: 'processing' });

    const updated = await db.getShipmentByOrderId(orderId);
    res.json({ shipment: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin/order_manager: append a manual tracking event checkpoint
router.post('/orders/:id/tracking/event', authMiddleware, requireRole('admin', 'order_manager'), async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const { status: evStatus, message, location } = req.body;
    if (!evStatus || !message) return res.status(400).json({ error: 'status and message are required' });

    let shipment = await db.getShipmentByOrderId(orderId);
    if (!shipment) {
      shipment = await db.addShipment({ id: uuid(), orderId, status: 'processing' });
    }

    const td = shipment.trackingData || {};
    const events: any[] = Array.isArray(td.manual_events) ? td.manual_events : [];
    const newEvent = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      status: evStatus,
      message,
      location: location || '',
    };
    events.unshift(newEvent); // newest first
    await db.updateShipment(shipment.id, { trackingData: { ...td, manual_events: events } });
    res.json({ event: newEvent });
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

export default router;
