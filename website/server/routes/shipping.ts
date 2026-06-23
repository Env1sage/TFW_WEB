/**
 * Automated Shipping Calculation Route
 * Carriers: Shiprocket · Delhivery · Blue Dart · DTDC
 *
 * Weight model:
 *   Dead Weight (DW)        = weight_grams / 1000  kg
 *   Volumetric Weight (VW)  = (L × W × H) / divisor  kg   (default divisor = 5000 cm³/kg)
 *   Chargeable Weight (CW)  = max(DW, VW)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// ── Roles ──────────────────────────────────────────────────────────────────
function adminOnly(req: Request, res: Response, next: any) {
  const roles = ['admin', 'super_admin', 'product_manager'];
  if (!roles.includes((req as any).userRole)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ── Weight Calculator ───────────────────────────────────────────────────────
export interface Dimensions {
  lengthCm: number;
  widthCm: number;   // breadth
  heightCm: number;
  weightGrams: number;
}

export interface WeightResult {
  deadWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  volumetricDivisor: number;
  dimensions: Dimensions;
}

export function calculateWeights(dims: Dimensions, divisor = 5000): WeightResult {
  const deadWeightKg    = dims.weightGrams / 1000;
  const volumetricWeightKg = (dims.lengthCm * dims.widthCm * dims.heightCm) / divisor;
  const chargeableWeightKg = Math.max(deadWeightKg, volumetricWeightKg);
  return {
    deadWeightKg:         Math.round(deadWeightKg * 1000) / 1000,
    volumetricWeightKg:   Math.round(volumetricWeightKg * 1000) / 1000,
    chargeableWeightKg:   Math.round(chargeableWeightKg * 1000) / 1000,
    volumetricDivisor: divisor,
    dimensions: dims,
  };
}

export interface ShippingRate {
  carrier: string;
  carrierLabel: string;
  courierName: string;
  mode: 'Surface' | 'Air' | 'Express';
  estimatedDays: string;
  baseRate: number;
  gst: number;
  totalRate: number;
  chargeableWeightKg: number;
  available: boolean;
  courierId?: string | number;
  source: 'live' | 'fallback' | 'cached';
  error?: string;
}

// ── Cache helpers ───────────────────────────────────────────────────────────
function makeCacheKey(carrier: string, fromPin: string, toPin: string, cw: number): string {
  const raw = `${carrier}:${fromPin}:${toPin}:${Math.ceil(cw * 10) / 10}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

// ── Markup application ──────────────────────────────────────────────────────
function applyMarkup(base: number, percent: number, flat: number): number {
  return Math.ceil(base * (1 + percent / 100) + flat);
}

// ── GST helper (18% on freight) ─────────────────────────────────────────────
function addGst(base: number): { baseRate: number; gst: number; totalRate: number } {
  const gst = Math.round(base * 0.18);
  return { baseRate: base, gst, totalRate: base + gst };
}

// ── SHIPROCKET ───────────────────────────────────────────────────────────────
const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';
let _srToken: string | null = null;
let _srTokenExpiry = 0;

async function getShiprocketToken(cfg: any): Promise<string> {
  if (_srToken && Date.now() < _srTokenExpiry) return _srToken;
  const email    = process.env.SHIPROCKET_EMAIL    || cfg.credentials?.email    || '';
  const password = process.env.SHIPROCKET_PASSWORD || cfg.credentials?.password || '';
  if (!email || !password) throw new Error('Shiprocket credentials not set');
  const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as any;
  if (!res.ok || !data.token) throw new Error(`Shiprocket auth failed: ${data.message || res.status}`);
  _srToken = data.token;
  _srTokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 h
  return _srToken!;
}

async function fetchShiprocketRates(
  cfg: any,
  fromPin: string,
  toPin: string,
  cw: number,
  dims: Dimensions,
  declaredValue: number,
): Promise<ShippingRate[]> {
  const token = await getShiprocketToken(cfg);
  const params = new URLSearchParams({
    pickup_postcode:   fromPin,
    delivery_postcode: toPin,
    weight:            String(Math.max(cw, 0.1)),
    length:            String(dims.lengthCm),
    breadth:           String(dims.widthCm),
    height:            String(dims.heightCm),
    declared_value:    String(declaredValue || 100),
    cod:               '0',
  });

  const res = await fetch(`${SHIPROCKET_BASE}/courier/serviceability/?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.message || `Shiprocket serviceability: HTTP ${res.status}`);

  const couriers: any[] = data?.data?.available_courier_companies || [];
  return couriers.slice(0, 8).map((c: any) => {
    const base = applyMarkup(c.rate || 0, cfg.markup_percent || 0, cfg.markup_flat || 0);
    const g    = addGst(base);
    return {
      carrier: 'shiprocket',
      carrierLabel: 'Shiprocket',
      courierName: c.courier_name || 'Unknown',
      mode: c.delivery_performance === 'Fast' ? 'Air' : 'Surface',
      estimatedDays: c.estimated_delivery_days
        ? `${c.estimated_delivery_days} day${c.estimated_delivery_days > 1 ? 's' : ''}`
        : 'Estimated 3–5 days',
      ...g,
      chargeableWeightKg: cw,
      available: true,
      courierId: c.courier_company_id,
      source: 'live' as const,
    };
  });
}

// ── DELHIVERY ────────────────────────────────────────────────────────────────
async function fetchDelhiveryRates(
  cfg: any,
  fromPin: string,
  toPin: string,
  cw: number,
  declaredValue: number,
): Promise<ShippingRate[]> {
  const apiKey = cfg.api_key || process.env.DELHIVERY_API_KEY || '';
  if (!apiKey) throw new Error('Delhivery API key not configured');

  const baseUrl = cfg.api_url || 'https://track.delhivery.com';
  const weightG = Math.ceil(cw * 1000);

  // Delhivery Rate Calculator API
  const url = `${baseUrl}/api/kinko/serviceability/?md=E&ss=Delivered&d_pin=${toPin}&o_pin=${fromPin}&cgm=${weightG}&pt=Pre-paid&cod=0`;
  const res = await fetch(url, {
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `Delhivery API error: ${res.status}`);

  const rates: ShippingRate[] = [];
  if (data?.Serviceability) {
    const svc = data.Serviceability;
    // Surface
    if (svc.surface_rate) {
      const base = applyMarkup(Math.round(svc.surface_rate), cfg.markup_percent || 0, cfg.markup_flat || 0);
      rates.push({ carrier: 'delhivery', carrierLabel: 'Delhivery', courierName: 'Delhivery Surface', mode: 'Surface', estimatedDays: '4–6 days', ...addGst(base), chargeableWeightKg: cw, available: true, source: 'live' });
    }
    // Express
    if (svc.express_rate) {
      const base = applyMarkup(Math.round(svc.express_rate), cfg.markup_percent || 0, cfg.markup_flat || 0);
      rates.push({ carrier: 'delhivery', carrierLabel: 'Delhivery', courierName: 'Delhivery Express', mode: 'Air', estimatedDays: '2–3 days', ...addGst(base), chargeableWeightKg: cw, available: true, source: 'live' });
    }
  }
  return rates;
}

// ── BLUE DART ────────────────────────────────────────────────────────────────
// Blue Dart requires an enterprise contract + SOAP/REST credentials.
// We use zone-based admin-configurable rates with optional live API override.
async function fetchBlueDartRates(
  cfg: any,
  fromPin: string,
  toPin: string,
  cw: number,
): Promise<ShippingRate[]> {
  const apiKey    = cfg.api_key    || process.env.BLUEDART_API_KEY    || '';
  const licenseId = cfg.api_secret || process.env.BLUEDART_LICENSE_ID || '';

  // If live credentials configured, try the Blue Dart Rate Calculator API
  if (apiKey && licenseId) {
    try {
      const baseUrl = cfg.api_url || 'https://api.bluedart.com/servlet/RoutingServiceV1';
      const payload = {
        handler: {
          request: {
            Pickup:  { AreaCode: fromPin.substring(0, 3), Pincode: fromPin },
            Consignee: { Pincode: toPin },
            Services: { ProductCode: 'A', SubProductCode: '', Pieces: 1, ActualWeight: cw, CollectableAmount: 0, DeclaredValue: 100 },
            Profile:  { Api_type: 'S', LicenceKey: licenseId, LoginID: apiKey },
          },
        },
      };
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', JWTToken: apiKey },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const services: any[] = data?.handler?.response?.Services || [];
        if (services.length) {
          return services.map((s: any) => {
            const base = applyMarkup(parseFloat(s.TotalCharge || '0'), cfg.markup_percent || 0, cfg.markup_flat || 0);
            return { carrier: 'bluedart', carrierLabel: 'Blue Dart', courierName: `Blue Dart ${s.ProductDesc || 'Priority'}`, mode: s.ProductCode === 'A' ? 'Air' : 'Surface', estimatedDays: s.ExpectedDelivery || '2–3 days', ...addGst(base), chargeableWeightKg: cw, available: true, source: 'live' as const };
          });
        }
      }
    } catch (e: any) { /* fall through to zone-based */ }
  }

  // Zone-based fallback (admin-configured zone rates)
  return zoneFallback('bluedart', 'Blue Dart', cfg, fromPin, toPin, cw);
}

// ── DTDC ─────────────────────────────────────────────────────────────────────
async function fetchDTDCRates(
  cfg: any,
  fromPin: string,
  toPin: string,
  cw: number,
): Promise<ShippingRate[]> {
  const apiKey = cfg.api_key || process.env.DTDC_API_KEY || '';
  const custId = cfg.api_secret || process.env.DTDC_CUSTOMER_ID || '';

  if (apiKey && custId) {
    try {
      const baseUrl = cfg.api_url || 'https://blktapi.dtdc.com/DTDCAPI';
      const payload = {
        CustId: custId,
        Apikey: apiKey,
        REQ_typ: 'RC',
        addOn: 0,
        oriPIN: fromPin,
        desPIN: toPin,
        amt:    500,
        wt:     cw,
        cod:    0,
        typ:    'NonDoc',
      };
      const res = await fetch(`${baseUrl}/apiTrigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const entries: any[] = data?.ResponseBody?.RC || [];
        if (entries.length) {
          return entries.map((e: any) => {
            const base = applyMarkup(parseFloat(e.Total_amount || '0'), cfg.markup_percent || 0, cfg.markup_flat || 0);
            return { carrier: 'dtdc', carrierLabel: 'DTDC', courierName: `DTDC ${e.Product_Name || 'Standard'}`, mode: (e.Product_Name || '').toLowerCase().includes('express') ? 'Air' : 'Surface', estimatedDays: e.Transit_days ? `${e.Transit_days} days` : '4–6 days', ...addGst(base), chargeableWeightKg: cw, available: true, source: 'live' as const };
          });
        }
      }
    } catch { /* fall through */ }
  }

  return zoneFallback('dtdc', 'DTDC', cfg, fromPin, toPin, cw);
}

// ── Zone-based fallback ────────────────────────────────────────────────────
function classifyZone(fromPin: string, toPin: string): 'local' | 'regional' | 'national' | 'remote' {
  if (!fromPin || !toPin) return 'national';
  const fromState = fromPin.substring(0, 2);
  const toState   = toPin.substring(0, 2);
  if (fromState === toState) {
    const fromCity = fromPin.substring(0, 4);
    const toCity   = toPin.substring(0, 4);
    return fromCity === toCity ? 'local' : 'regional';
  }
  // Remote/difficult zones (NE India, J&K, A&N, Lakshadweep)
  const remotePrefixes = ['79', '79', '83', '73', '74', '75', '76', '99', '73'];
  if (remotePrefixes.some(p => toPin.startsWith(p))) return 'remote';
  return 'national';
}

function zoneFallback(
  carrier: string,
  label: string,
  cfg: any,
  fromPin: string,
  toPin: string,
  cw: number,
): ShippingRate[] {
  const zone = classifyZone(fromPin, toPin);
  const zoneRates: Record<string, number> = cfg.zone_rates || {};
  const basePerKg = zoneRates[zone] || zoneRates['national'] || 80;

  const firstKg  = basePerKg;
  const addlRate = Math.round(basePerKg * 0.5);
  const cwCeil   = Math.max(cw, 0.5);
  const base     = cwCeil <= 1 ? firstKg : Math.round(firstKg + (cwCeil - 1) * addlRate);
  const withMarkup = applyMarkup(base, cfg.markup_percent || 0, cfg.markup_flat || 0);

  const etaMap: Record<string, string> = { local: '1–2 days', regional: '2–3 days', national: '4–6 days', remote: '7–10 days' };

  return [{
    carrier,
    carrierLabel: label,
    courierName: `${label} Standard`,
    mode: 'Surface',
    estimatedDays: etaMap[zone],
    ...addGst(withMarkup),
    chargeableWeightKg: cw,
    available: true,
    source: 'fallback',
  }];
}

// ── Main Rate Fetcher ─────────────────────────────────────────────────────────
async function getAllRates(
  fromPin: string,
  toPin: string,
  dims: Dimensions,
  declaredValue: number,
): Promise<{ weights: WeightResult; carriers: ShippingRate[] }> {
  // Load all configs
  const configs  = await db.getCourierConfigs();
  const cfgMap   = Object.fromEntries(configs.map((c: any) => [c.carrier, c]));

  // Default divisor from any enabled carrier (or 5000)
  const defaultDivisor = Number(configs.find((c: any) => c.enabled)?.volumetric_divisor || 5000);
  const weights = calculateWeights(dims, defaultDivisor);
  const cw      = weights.chargeableWeightKg;

  const results: ShippingRate[] = [];

  // ── Process each carrier in parallel ──
  const carriers = ['shiprocket', 'delhivery', 'bluedart', 'dtdc'] as const;

  await Promise.allSettled(carriers.map(async (carrier) => {
    const cfg = cfgMap[carrier];
    if (!cfg?.enabled) return;

    const divisor = Number(cfg.volumetric_divisor || 5000);
    const cwCarrier = calculateWeights(dims, divisor).chargeableWeightKg;
    const cacheKey  = makeCacheKey(carrier, fromPin, toPin, cwCarrier);

    // Check cache first
    const cached = await db.getCachedRates(cacheKey).catch(() => null);
    if (cached) {
      results.push(...cached.map((r: any) => ({ ...r, source: 'cached' as const })));
      return;
    }

    const srcPin = cfg.source_pincode || fromPin;
    let rates: ShippingRate[] = [];

    try {
      switch (carrier) {
        case 'shiprocket': rates = await fetchShiprocketRates(cfg, srcPin, toPin, cwCarrier, dims, declaredValue); break;
        case 'delhivery':  rates = await fetchDelhiveryRates(cfg, srcPin, toPin, cwCarrier, declaredValue); break;
        case 'bluedart':   rates = await fetchBlueDartRates(cfg, srcPin, toPin, cwCarrier); break;
        case 'dtdc':       rates = await fetchDTDCRates(cfg, srcPin, toPin, cwCarrier); break;
      }
      await db.setCachedRates(cacheKey, carrier, rates, 300).catch(() => {});
    } catch (e: any) {
      // If live API fails, fall back to zone-based for non-Shiprocket carriers
      if (carrier !== 'shiprocket') {
        rates = zoneFallback(carrier, { delhivery: 'Delhivery', bluedart: 'Blue Dart', dtdc: 'DTDC' }[carrier] || carrier, cfg, srcPin, toPin, cwCarrier);
      } else {
        rates = [{ carrier, carrierLabel: 'Shiprocket', courierName: 'Shiprocket', mode: 'Surface', estimatedDays: '3–5 days', baseRate: 0, gst: 0, totalRate: 0, chargeableWeightKg: cwCarrier, available: false, source: 'fallback', error: e.message }];
      }
    }

    results.push(...rates);
  }));

  // Sort: available first, then by totalRate ascending
  results.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.totalRate - b.totalRate;
  });

  // Evict expired cache async
  db.evictExpiredRateCache().catch(() => {});

  return { weights, carriers: results };
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/shipping/rates
 * Body: { fromPin, toPin, weightGrams, lengthCm, widthCm, heightCm, declaredValue? }
 * Returns live rates from all enabled carriers + weight breakdown.
 */
router.post('/rates', async (req: Request, res: Response) => {
  try {
    const { fromPin, toPin, weightGrams, lengthCm, widthCm, heightCm, declaredValue } = req.body;

    if (!toPin) return res.status(400).json({ error: 'toPin (destination pincode) is required' });
    if (!weightGrams || weightGrams <= 0) return res.status(400).json({ error: 'weightGrams must be > 0' });

    const dims: Dimensions = {
      weightGrams: Number(weightGrams),
      lengthCm:    Number(lengthCm)  || 10,
      widthCm:     Number(widthCm)   || 10,
      heightCm:    Number(heightCm)  || 5,
    };

    const result = await getAllRates(
      fromPin || process.env.PICKUP_PINCODE || '411001',
      String(toPin),
      dims,
      Number(declaredValue) || 100,
    );

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/shipping/calculate-weights
 * Body: { weightGrams, lengthCm, widthCm, heightCm, divisor? }
 * Returns dead weight / volumetric weight breakdown (no carrier lookup).
 */
router.post('/calculate-weights', (req: Request, res: Response) => {
  try {
    const { weightGrams, lengthCm, widthCm, heightCm, divisor } = req.body;
    const dims: Dimensions = {
      weightGrams: Number(weightGrams) || 0,
      lengthCm:    Number(lengthCm)    || 0,
      widthCm:     Number(widthCm)     || 0,
      heightCm:    Number(heightCm)    || 0,
    };
    const result = calculateWeights(dims, Number(divisor) || 5000);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/shipping/admin/config — list all carrier configs
router.get('/admin/config', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const configs = await db.getCourierConfigs();
    // Redact secrets for response
    res.json(configs.map((c: any) => ({
      ...c,
      api_key:    c.api_key    ? c.api_key.substring(0, 6)    + '…' : '',
      api_secret: c.api_secret ? c.api_secret.substring(0, 4) + '…' : '',
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/shipping/admin/config/:carrier — single carrier (full secrets)
router.get('/admin/config/:carrier', authMiddleware, adminOnly, async (req, res) => {
  try {
    const cfg = await db.getCourierConfig(req.params.carrier as string);
    if (!cfg) return res.status(404).json({ error: 'Carrier not found' });
    res.json(cfg);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/shipping/admin/config/:carrier — update carrier config
router.put('/admin/config/:carrier', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      enabled, apiKey, apiSecret, apiUrl, sourcePincode,
      volumetricDivisor, markupPercent, markupFlat,
      zoneRates, credentials,
    } = req.body;
    const updated = await db.updateCourierConfig(req.params.carrier as string, {
      enabled, apiKey, apiSecret, apiUrl, sourcePincode,
      volumetricDivisor: volumetricDivisor !== undefined ? Number(volumetricDivisor) : undefined,
      markupPercent:     markupPercent     !== undefined ? Number(markupPercent)     : undefined,
      markupFlat:        markupFlat        !== undefined ? Number(markupFlat)        : undefined,
      zoneRates, credentials,
    });
    if (!updated) return res.status(404).json({ error: 'Carrier not found' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/shipping/admin/test-rates — live rate test from admin panel
router.post('/admin/test-rates', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { fromPin, toPin, weightGrams, lengthCm, widthCm, heightCm, declaredValue } = req.body;
    const dims: Dimensions = {
      weightGrams: Number(weightGrams) || 500,
      lengthCm:    Number(lengthCm)    || 20,
      widthCm:     Number(widthCm)     || 15,
      heightCm:    Number(heightCm)    || 5,
    };
    const result = await getAllRates(
      fromPin || process.env.PICKUP_PINCODE || '411001',
      toPin   || '110001',
      dims,
      Number(declaredValue) || 500,
    );
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/shipping/admin/flush-cache — clear rate cache
router.post('/admin/flush-cache', authMiddleware, adminOnly, async (_req, res) => {
  try {
    await db.pool.query('DELETE FROM website_shipping_rate_cache');
    res.json({ success: true, message: 'Rate cache flushed' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
