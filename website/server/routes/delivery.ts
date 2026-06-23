/**
 * Delivery Options Route
 *
 * Three fulfilment modes:
 *  1. store_pickup   — customer collects from the store (₹0 shipping)
 *  2. hyperlocal     — same-city dispatch via Dunzo or Porter
 *  3. standard       — national courier via existing shipping zones
 *
 * Public endpoints:
 *   GET  /api/delivery/options          → available methods + dynamic pricing
 *   POST /api/delivery/hyperlocal/quote → live Dunzo / Porter quote (optional)
 *
 * Admin endpoints (auth required):
 *   GET  /api/delivery/admin/settings              → all config keys
 *   PUT  /api/delivery/admin/settings/:key         → update a config block
 *   POST /api/delivery/admin/hyperlocal/create-task → dispatch a hyperlocal task after order
 */

import { Router, Request, Response } from 'express';
import * as db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function adminOnly(req: Request, res: Response, next: any) {
  if (!['admin', 'super_admin', 'product_manager'].includes((req as any).userRole))
    return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ── Types ───────────────────────────────────────────────────────────────────
export type DeliveryMethodType = 'store_pickup' | 'hyperlocal' | 'standard';

export interface DeliveryProvider {
  name: 'dunzo' | 'porter';
  label: string;
  fee: number;
  eta: string;
  available: boolean;
}

export interface DeliveryOption {
  type: DeliveryMethodType;
  label: string;
  description: string;
  fee: number;
  freeAbove?: number;
  eta: string;
  available: boolean;
  storeInfo?: {
    name: string; address: string; city: string; state: string;
    pincode: string; phone: string; hours: string; landmark: string;
  };
  providers?: DeliveryProvider[];
  selectedProvider?: 'dunzo' | 'porter';
}

// ── Shipping zone helper (mirrors products.ts calculateShipping) ────────────
async function calcStandardFee(
  subtotal: number,
  pincode = '',
  weightGrams = 0,
  deliveryType = 'standard',
): Promise<{ fee: number; freeAbove: number; zone: string; estimatedDays: string }> {
  const fallback = { fee: subtotal >= 999 ? 0 : 49, freeAbove: 999, zone: 'Standard', estimatedDays: '5-7 days' };
  try {
    const zones = await db.getShippingZones();
    const sorted = [...zones].sort((a: any, b: any) => {
      if (a.pinPatterns.length > 0 && b.pinPatterns.length === 0) return -1;
      if (a.pinPatterns.length === 0 && b.pinPatterns.length > 0) return 1;
      return a.sortOrder - b.sortOrder;
    });
    for (const z of sorted as any[]) {
      if (!z.active) continue;
      const pinOk = z.pinPatterns.length === 0 || (pincode && z.pinPatterns.some((p: string) => pincode.startsWith(p)));
      if (!pinOk) continue;
      const wg = weightGrams || 0;
      const weightOk = wg === 0 || (wg >= (z.weightFromGrams ?? 0) && wg <= (z.weightToGrams ?? 99999));
      const typeOk = (z.deliveryType ?? 'standard') === 'standard' || (z.deliveryType ?? 'standard') === deliveryType;
      if (weightOk && typeOk) {
        return {
          fee: subtotal >= z.freeAbove ? 0 : z.shippingCharge,
          freeAbove: z.freeAbove,
          zone: z.label,
          estimatedDays: z.estimatedDays || '5-7 days',
        };
      }
    }
  } catch { /* fall through */ }
  return fallback;
}

// ── Hyperlocal: Dunzo quote ─────────────────────────────────────────────────
let _dunzoToken: string | null = null;
let _dunzoTokenExpiry = 0;

async function getDunzoToken(cfg: any): Promise<string> {
  if (_dunzoToken && Date.now() < _dunzoTokenExpiry) return _dunzoToken;
  const clientId = cfg.clientId || process.env.DUNZO_CLIENT_ID || '';
  const apiKey   = cfg.apiKey   || process.env.DUNZO_API_KEY   || '';
  if (!clientId || !apiKey) throw new Error('Dunzo credentials not configured');

  const res = await fetch('https://apis.dunzo.in/api/v0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: apiKey }),
  });
  const data = await res.json() as any;
  if (!res.ok || !data.token) throw new Error('Dunzo auth failed');
  _dunzoToken = data.token;
  _dunzoTokenExpiry = Date.now() + 55 * 60 * 1000;
  return _dunzoToken!;
}

async function getDunzoQuote(cfg: any, fromPin: string, toPin: string): Promise<number | null> {
  try {
    const token = await getDunzoToken(cfg);
    // Dunzo needs lat/lng — we use pincode as city proxy for now
    // and fall back to flat fee if coordinates aren't available
    const res = await fetch('https://apis.dunzo.in/api/v0/request/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        pickup_details:   [{ lat: 0, lng: 0, reference_id: fromPin }],
        drop_details:     [{ lat: 0, lng: 0, reference_id: toPin }],
        payment_method: 'ONLINE',
      }),
    });
    const data = await res.json() as any;
    if (data?.estimated_price) return Math.round(data.estimated_price);
  } catch { /* fall through */ }
  return null;
}

// ── Hyperlocal: Porter quote ────────────────────────────────────────────────
async function getPorterQuote(cfg: any, fromPin: string, toPin: string): Promise<number | null> {
  try {
    const apiKey = cfg.apiKey || process.env.PORTER_API_KEY || '';
    if (!apiKey) return null;
    const res = await fetch('https://papi.porter.in/v1/get_quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        pickup_details:   { lat: 12.9716, lng: 77.5946 },  // placeholder — real impl needs geocoding
        drop_details:     { lat: 12.9716, lng: 77.5946 },
        vehicle_type:     { id: '2' },                     // 2 = Bike (< 10 kg)
      }),
    });
    const data = await res.json() as any;
    if (data?.fare?.minor_amount) return Math.round(data.fare.minor_amount / 100);
  } catch { /* fall through */ }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: GET /api/delivery/options?subtotal=1200&pincode=411001
// Returns all available delivery modes with dynamic pricing
// ─────────────────────────────────────────────────────────────────────────────
router.get('/options', async (req: Request, res: Response) => {
  try {
    const subtotal     = parseFloat(req.query.subtotal as string) || 0;
    const pincode      = (req.query.pincode as string)?.trim() || '';
    const weightGrams  = parseInt(req.query.weightGrams as string) || 0;
    const deliveryType = (req.query.deliveryType as string) || 'standard';
    const settings = await db.getDeliverySettings();

    const options: DeliveryOption[] = [];

    // ── 1. Store Pickup ───────────────────────────────────────────────────
    const spCfg = settings.store_pickup || {};
    if (spCfg.enabled) {
      options.push({
        type:        'store_pickup',
        label:       'Store Pickup',
        description: `Collect from ${spCfg.storeName || 'our store'}`,
        fee:         0,
        eta:         `Ready in ${spCfg.readyInDays ?? 1}–${(spCfg.readyInDays ?? 1) + 1} business day${(spCfg.readyInDays ?? 1) > 1 ? 's' : ''}`,
        available:   true,
        storeInfo: {
          name:     spCfg.storeName  || '',
          address:  spCfg.address    || '',
          city:     spCfg.city       || '',
          state:    spCfg.state      || '',
          pincode:  spCfg.pincode    || '',
          phone:    spCfg.phone      || '',
          hours:    spCfg.hours      || '',
          landmark: spCfg.landmark   || '',
        },
      });
    }

    // ── 2. Hyperlocal ─────────────────────────────────────────────────────
    const hlCfg = settings.hyperlocal || {};
    if (hlCfg.enabled) {
      const flatFee = Number(hlCfg.flatFee) || 99;
      const providers: DeliveryProvider[] = [];

      // Dunzo
      if (hlCfg.dunzo?.enabled) {
        const liveFee = pincode ? await getDunzoQuote(hlCfg.dunzo, pincode, pincode).catch(() => null) : null;
        providers.push({
          name:      'dunzo',
          label:     'Dunzo',
          fee:       liveFee ?? flatFee,
          eta:       '2–4 hours',
          available: true,
        });
      }
      // Porter
      if (hlCfg.porter?.enabled) {
        const liveFee = pincode ? await getPorterQuote(hlCfg.porter, pincode, pincode).catch(() => null) : null;
        providers.push({
          name:      'porter',
          label:     'Porter',
          fee:       liveFee ?? flatFee,
          eta:       '3–5 hours',
          available: true,
        });
      }

      if (providers.length > 0) {
        const cheapest = providers.reduce((a, b) => a.fee <= b.fee ? a : b);
        options.push({
          type:        'hyperlocal',
          label:       'Same-Day Delivery',
          description: 'Delivered to your door today',
          fee:         cheapest.fee,
          eta:         cheapest.eta,
          available:   true,
          providers,
          selectedProvider: cheapest.name,
        });
      }
    }

    // ── 3. Standard Shipping ──────────────────────────────────────────────
    const stdCfg = settings.standard || {};
    if (stdCfg.enabled !== false) {
      const { fee, freeAbove, zone, estimatedDays } = await calcStandardFee(subtotal, pincode, weightGrams, deliveryType);
      options.push({
        type:        'standard',
        label:       'Standard Shipping',
        description: zone !== 'Standard' ? `${zone} · Reliable national courier` : 'Reliable national courier delivery',
        fee,
        freeAbove,
        eta:         estimatedDays,
        available:   true,
      });
    }

    res.json(options);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: POST /api/delivery/hyperlocal/quote
// Body: { fromPin, toPin, provider: 'dunzo'|'porter' }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/hyperlocal/quote', async (req: Request, res: Response) => {
  try {
    const { fromPin, toPin, provider } = req.body;
    const settings = await db.getDeliverySettings();
    const hlCfg    = settings.hyperlocal || {};
    if (!hlCfg.enabled) return res.status(400).json({ error: 'Hyperlocal delivery not available' });

    let fee: number | null = null;
    if (provider === 'dunzo' && hlCfg.dunzo?.enabled) {
      fee = await getDunzoQuote(hlCfg.dunzo, fromPin, toPin);
    } else if (provider === 'porter' && hlCfg.porter?.enabled) {
      fee = await getPorterQuote(hlCfg.porter, fromPin, toPin);
    }
    res.json({ fee: fee ?? hlCfg.flatFee ?? 99, live: fee !== null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: GET /api/delivery/admin/settings
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/settings', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const s = await db.getDeliverySettings();
    // Mask API keys
    if (s.hyperlocal?.dunzo?.apiKey) s.hyperlocal.dunzo.apiKey = s.hyperlocal.dunzo.apiKey.substring(0, 6) + '…';
    if (s.hyperlocal?.porter?.apiKey) s.hyperlocal.porter.apiKey = s.hyperlocal.porter.apiKey.substring(0, 6) + '…';
    res.json(s);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: GET /api/delivery/admin/settings/:key (unmasked)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/settings/:key', authMiddleware, adminOnly, async (req, res) => {
  try {
    const value = await db.getDeliverySettingByKey(req.params.key as string);
    if (value === null) return res.status(404).json({ error: 'Setting not found' });
    res.json(value);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: PUT /api/delivery/admin/settings/:key
// Body: the full value object for that key
// ─────────────────────────────────────────────────────────────────────────────
router.put('/admin/settings/:key', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { key } = req.params as { key: string };
    if (!['store_pickup', 'hyperlocal', 'standard'].includes(key))
      return res.status(400).json({ error: 'Invalid settings key' });
    // Merge with existing so partial updates don't wipe fields
    const existing = await db.getDeliverySettingByKey(key) || {};
    const merged = deepMerge(existing, req.body);
    await db.updateDeliverySetting(key, merged);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: POST /api/delivery/admin/hyperlocal/create-task
// Creates a Dunzo/Porter delivery task for an already-placed order
// Body: { orderId, provider: 'dunzo'|'porter', pickupAddress, dropAddress, packageDescription }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin/hyperlocal/create-task', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { provider, pickupAddress, dropAddress, packageDescription } = req.body;
    const settings = await db.getDeliverySettings();
    const hlCfg    = settings.hyperlocal || {};

    if (provider === 'dunzo') {
      if (!hlCfg.dunzo?.enabled) return res.status(400).json({ error: 'Dunzo not enabled' });
      const token = await getDunzoToken(hlCfg.dunzo);
      const taskRes = await fetch('https://apis.dunzo.in/api/v0/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          request_type: 'delivery',
          pickup_details: [{ address: { street_address_1: pickupAddress }, reference_id: 'pickup' }],
          drop_details:   [{ address: { street_address_1: dropAddress },   reference_id: 'drop'   }],
          note_to_runner: packageDescription || 'Handle with care',
          payment_method: 'ONLINE',
        }),
      });
      const taskData = await taskRes.json() as any;
      if (!taskRes.ok) return res.status(502).json({ error: taskData?.message || 'Dunzo task creation failed' });
      return res.json({ provider: 'dunzo', taskId: taskData.id, status: taskData.state });
    }

    if (provider === 'porter') {
      if (!hlCfg.porter?.enabled) return res.status(400).json({ error: 'Porter not enabled' });
      const apiKey = hlCfg.porter.apiKey || process.env.PORTER_API_KEY || '';
      const orderRes = await fetch('https://papi.porter.in/v1/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          pickup_details: { address: { street_address: pickupAddress } },
          drop_details:   [{ address: { street_address: dropAddress }  }],
          payment_method: { type: 'pre-paid' },
          order_info:     { name: packageDescription || 'Package', quantity: 1, category: { id: '1' } },
        }),
      });
      const orderData = await orderRes.json() as any;
      if (!orderRes.ok) return res.status(502).json({ error: orderData?.message || 'Porter order failed' });
      return res.json({ provider: 'porter', taskId: orderData.order_id, status: orderData.status });
    }

    res.status(400).json({ error: 'Invalid provider. Use dunzo or porter.' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Utility: deep-merge two plain objects ────────────────────────────────────
function deepMerge(target: any, source: any): any {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object') {
      out[key] = deepMerge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

export default router;
