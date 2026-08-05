import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Edit3, Trash2, X, Save, ShoppingCart,
  BarChart3, Users, IndianRupee, TrendingUp, Image, Eye, EyeOff, Database, Palette, Download, Upload, Tag, Copy, Check, ChevronDown, ChevronUp, MapPin, Mail, User, Clock, Hash, LogOut, Truck, Percent, DollarSign, Calendar, Sparkles, Settings, ToggleLeft, ToggleRight, UserPlus, Phone, Filter, RefreshCw, Boxes, AlertTriangle, XCircle, PackageCheck, History, Layers, ChevronLeft, ChevronRight, Bell, Send, ExternalLink,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Product, Order, DesignOrder, Coupon, InventoryItem, InventoryMetrics, InventoryLog, ProductVariant } from '../types';
import toast from 'react-hot-toast';
import { BRAND, GRADIENT_PRESETS as BRAND_GRADIENT_PRESETS } from '../utils/palette';

interface Mockup {
  id: string; name: string; category: string;
  frontImage: string; backImage?: string;
  frontShadow?: string; backShadow?: string;
  printArea: any; basePrice?: number; active: boolean;
  colorFilter?: boolean; createdAt: string;
}

interface Analytics {
  totalUsers: number; totalProducts: number; totalOrders: number; totalRevenue: number;
  normalOrders: number; designOrders: number;
  normalRevenue: number; designRevenue: number;
  recentOrders: (Order & { orderType?: 'normal' } | DesignOrder & { orderType?: 'custom' })[];
  topProducts: { name: string; orderCount: number; totalQuantity: number }[];
  ordersByStatus: Record<string, number>;
  dailyRevenue: { date: string; revenue: number; orders: number }[];
}

interface SizeChartData {
  unit: string;
  headers: string[];
  rows: { label: string; values: string[] }[];
}

interface Category {
  id: string; name: string; slug: string; createdAt: string; parentId?: string | null; image?: string;
  sizeChart?: SizeChartData | null;
}

interface MockupCategory {
  id: string; name: string; slug: string; createdAt: string;
}

interface Lead {
  id: string;
  name: string;
  mobile: string;
  email: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  source: string;
  products_viewed: { id: string; name: string; viewed_at: string }[];
  notes: string;
  last_activity: string;
  created_at: string;
}

const STOCK_STATUS: Record<string, { label: string; dot: string; bg: string; color: string }> = {
  in_stock:      { label: 'In Stock',      dot: '#10b981', bg: '#d1fae5', color: '#065f46' },
  low_stock:     { label: 'Low Stock',     dot: '#f59e0b', bg: '#fef3c7', color: '#92400e' },
  out_of_stock:  { label: 'Out of Stock',  dot: '#ef4444', bg: '#fee2e2', color: '#991b1b' },
};

const PRODUCT_LABELS: Record<string, string> = {
  tshirt: 'Custom T-Shirt', hoodie: 'Custom Hoodie', jacket: 'Custom Jacket',
  cap: 'Custom Cap', pant: 'Custom Pants',
};

const LEAD_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  new:        { label: 'New',       bg: '#dbeafe', color: '#1d4ed8' },
  contacted:  { label: 'Contacted', bg: '#fef3c7', color: '#92400e' },
  qualified:  { label: 'Qualified', bg: '#ede9fe', color: '#5b21b6' },
  converted:  { label: 'Converted', bg: '#d1fae5', color: '#065f46' },
  lost:       { label: 'Lost',      bg: '#fee2e2', color: '#991b1b' },
};

const defaultProduct: Partial<Product> = {
  name: '', description: '', price: 0, category: '', image: '', images: [], customizable: false,
  featured: false, collectionOnly: false, colors: [], sizes: [], rating: 4.5, reviewCount: 0,
  weightGrams: 200, lengthCm: 30, breadthCm: 20, heightCm: 5,
  highlights: [], fabricInfo: '', printMethods: [], printAreas: [], careInstructions: [], faqs: [],
  showSizeChart: true,
};

const defaultMockup: Partial<Mockup> = {
  name: '', category: '', frontImage: '', backImage: '', frontShadow: '', backShadow: '',
  printArea: { layouts: [], allowMultipleLayouts: false, allowBackPrint: true }, basePrice: 0, active: true, colorFilter: false,
};

// ── Print Area Editor constants ─────────────────────────────
// Canvas is 800×1000 px — preview is scaled to 280×350 px (scale 0.35)
const PAE_W = 280;
const PAE_H = 350;
const PAE_SCALE = PAE_W / 800;
/** Auto-assigned colors for layout rectangles */
const LAYOUT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#e879f9', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

interface PrintLayout {
  id: string; name: string; side: 'FRONT' | 'BACK';
  x: number; y: number; w: number; h: number;
  shape?: 'rect' | 'ellipse' | 'circle' | 'polygon';
  points?: { x: number; y: number }[];
  price?: number;
  /** IDs of other layouts this can be ordered together with */
  compatibleWith?: string[];
}

function normalizePrintArea(pa: any): { layouts: PrintLayout[]; allowMultipleLayouts: boolean; allowBackPrint: boolean } {
  if (!pa) return { layouts: [], allowMultipleLayouts: false, allowBackPrint: true };
  if (Array.isArray(pa.layouts)) return { layouts: pa.layouts, allowMultipleLayouts: pa.allowMultipleLayouts ?? false, allowBackPrint: pa.allowBackPrint ?? true };
  // Convert legacy {front:{...}, back:{...}} or flat format
  const SIZE_NAMES: Record<string, string> = { full: 'Full Print', medium: 'Medium Print', small: 'Small Print', pocket: 'Pocket Print' };
  const layouts: PrintLayout[] = [];
  const pairs: Array<[any, 'FRONT' | 'BACK']> = [];
  if (pa.front !== undefined || pa.back !== undefined) {
    if (pa.front) pairs.push([pa.front, 'FRONT']);
    if (pa.back) pairs.push([pa.back, 'BACK']);
  } else { pairs.push([pa, 'FRONT']); }
  for (const [data, side] of pairs) {
    for (const [k, v] of Object.entries(data)) {
      const a = v as any;
      if (!a?.w || !a?.h) continue;
      layouts.push({ id: `legacy_${side}_${k}`, name: SIZE_NAMES[k] || k, side, x: a.x, y: a.y, w: a.w, h: a.h, price: a.price });
    }
  }
  return { layouts, allowMultipleLayouts: false, allowBackPrint: layouts.some(l => l.side === 'BACK') };
}

type Tab = 'analytics' | 'products' | 'categories' | 'mockup-categories' | 'orders' | 'mockups' | 'coupons' | 'collections' | 'database' | 'shiprocket' | 'email' | 'colors' | 'settings' | 'leads' | 'inventory' | 'notifications' | 'brands' | 'banners' | 'shipping' | 'abandoned-carts';

const defaultCoupon: Partial<Coupon> = {
  code: '', description: '', discountType: 'percentage', discountValue: 0,
  minOrderAmount: 0, maxUses: null, validFrom: null, validUntil: null,
  active: true, popupEnabled: false, popupMessage: '',
};

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('analytics');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [colLoading, setColLoading] = useState(false);
  // Brands & Models
  const [brands, setBrands] = useState<any[]>([]);
  const [brandModels, setBrandModels] = useState<Record<string, any[]>>({});
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandForm, setBrandForm] = useState({ name: '', logo: '', categoryId: '', active: true, sortOrder: 0 });
  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [modelForm, setModelForm] = useState({ name: '', displayName: '', active: true, inStock: true, sortOrder: 0 });
  const [editingModel, setEditingModel] = useState<any | null>(null);
  const [modelBrandId, setModelBrandId] = useState<string | null>(null);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  // Banners
  const [bannerList, setBannerList] = useState<any[]>([]);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any | null>(null);
  const defaultBannerForm = {
    title: '', subtitle: '', badgeText: '', badgeType: 'featured',
    imageUrl: '', ctaLabel: 'Shop Now', ctaUrl: '/products',
    ctaLabel2: '', ctaUrl2: '',
    bgGradient: `linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.primaryDark} 100%)`,
    accentColor: BRAND.accent, textColor: BRAND.white, textAlign: 'left',
    imagePosition: '50% 50%',
    textLeft: 5, textTop: 50,
    active: true, sortOrder: 0, startDate: '', endDate: '',
  };
  const [bannerForm, setBannerForm] = useState({ ...defaultBannerForm });
  const bannerPreviewRef = useRef<HTMLDivElement>(null);
  const bannerDragRef = useRef<{ active: boolean; type: 'bg' | 'text'; startMouseX: number; startMouseY: number; startValX: number; startValY: number }>({ active: false, type: 'bg', startMouseX: 0, startMouseY: 0, startValX: 0, startValY: 0 });
  const parseBgPos = (pos: string): [number, number] => {
    const kw: Record<string, [number, number]> = {
      'top left': [0,0], 'top center': [50,0], 'top right': [100,0],
      'center left': [0,50], 'center': [50,50], 'center right': [100,50],
      'bottom left': [0,100], 'bottom center': [50,100], 'bottom right': [100,100],
      'left': [0,50], 'right': [100,50], 'top': [50,0], 'bottom': [50,100],
    };
    if (kw[pos]) return kw[pos];
    const m = pos.match(/([\d.]+)%\s+([\d.]+)%/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50,50];
  };
  const [bgMode, setBgMode] = useState<'solid' | 'gradient'>('gradient');
  const [gradColor1, setGradColor1] = useState(BRAND.primary);
  const [gradColor2, setGradColor2] = useState(BRAND.primaryDark);
  const [gradAngle, setGradAngle] = useState(135);
  const parseBgGradient = (css: string) => {
    const m = css.match(/linear-gradient\(\s*(-?\d+)deg,\s*(#[\da-fA-F]{3,8})[^,]*,\s*(#[\da-fA-F]{3,8})/);
    return m ? { angle: parseInt(m[1]), color1: m[2], color2: m[3] } : null;
  };
  const buildBgGradient = (c1: string, c2: string, angle: number) =>
    `linear-gradient(${angle}deg,${c1} 0%,${c2} 100%)`;
  const initGradientFromBg = (bg: string) => {
    const parsed = parseBgGradient(bg);
    if (parsed) { setBgMode('gradient'); setGradColor1(parsed.color1); setGradColor2(parsed.color2); setGradAngle(parsed.angle); }
    else { setBgMode('solid'); setGradColor1(bg.startsWith('#') ? bg : '#0E7C61'); }
  };
  const [colForm, setColForm] = useState({ name: '', tagline: '', tag: 'Custom', gradient: 'linear-gradient(135deg,#0E7C61 0%,#0A5C49 100%)', glow: '#0E7C61', shimmer: 'rgba(255,255,255,0.15)', symbol: '✨', badge: 'New', badgeColor: '#C6A75E', featured: false, active: true });
  const [editingCol, setEditingCol] = useState<any | null>(null);
  const [colProducts, setColProducts] = useState<Record<string, any[]>>({});
  const [addProductId, setAddProductId] = useState<Record<string, string>>({});
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [designOrders, setDesignOrders] = useState<DesignOrder[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [dbData, setDbData] = useState<Record<string, { count: number; columns: string[]; rows: any[] }> | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbTable, setDbTable] = useState('website_products');
  const [loading, setLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [dbColVisible, setDbColVisible] = useState<Record<string, boolean>>({});
  const [dbRowSearch, setDbRowSearch] = useState('');

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormImage, setCategoryFormImage] = useState('');
  const [categoryFormSizeChart, setCategoryFormSizeChart] = useState<SizeChartData | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Mockup Categories
  const [mockupCategories, setMockupCategories] = useState<MockupCategory[]>([]);
  const [showMockupCategoryForm, setShowMockupCategoryForm] = useState(false);
  const [editingMockupCategory, setEditingMockupCategory] = useState<MockupCategory | null>(null);
  const [mockupCategoryFormName, setMockupCategoryFormName] = useState('');
  const [savingMockupCategory, setSavingMockupCategory] = useState(false);
  const [copiedMockupCatId, setCopiedMockupCatId] = useState<string | null>(null);

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(defaultProduct);
  const [savingProduct, setSavingProduct] = useState(false);

  // Shipping zones
  interface ShippingZone { id: string; name: string; label: string; pinPatterns: string[]; shippingCharge: number; freeAbove: number; sortOrder: number; active: boolean; createdAt: string; weightFromGrams: number; weightToGrams: number; deliveryType: string; estimatedDays: string; }
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [showShippingZoneForm, setShowShippingZoneForm] = useState(false);
  const [editingShippingZone, setEditingShippingZone] = useState<ShippingZone | null>(null);
  const [shippingZoneForm, setShippingZoneForm] = useState<Partial<ShippingZone>>({});
  const [savingShippingZone, setSavingShippingZone] = useState(false);

  // Mockup form
  const [showMockupForm, setShowMockupForm] = useState(false);
  const [editingMockup, setEditingMockup] = useState<Mockup | null>(null);
  const [mockupForm, setMockupForm] = useState(defaultMockup);
  const [savingMockup, setSavingMockup] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [removingBgField, setRemovingBgField] = useState<string | null>(null);
  // Global colour palette (backed by DB via /api/settings/color_palette)
  const [globalColors, setGlobalColors] = useState<{name: string, hex: string}[]>([]);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');

  // Site settings
  const [uploadEnabled, setUploadEnabled] = useState<boolean | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Leads CRM
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadStats, setLeadStats] = useState({ total: 0, new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 });
  const [leadTotal, setLeadTotal] = useState(0);
  const [leadPage, setLeadPage] = useState(1);
  const [leadPages, setLeadPages] = useState(1);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState('');
  const [leadDateFilter, setLeadDateFilter] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadEditForm, setLeadEditForm] = useState({ status: 'new', notes: '', name: '', mobile: '', email: '' });
  const [savingLead, setSavingLead] = useState(false);
  const [showNewLeadForm, setShowNewLeadForm] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ name: '', mobile: '', email: '', source: 'direct', notes: '' });
  const [savingNewLead, setSavingNewLead] = useState(false);
  const leadSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inventory Management
  const [invItems, setInvItems] = useState<InventoryItem[]>([]);
  const [invMetrics, setInvMetrics] = useState<InventoryMetrics | null>(null);
  const [invTotal, setInvTotal] = useState(0);
  const [invPage, setInvPage] = useState(1);
  const [invPages, setInvPages] = useState(1);
  const [invSearch, setInvSearch] = useState('');
  const [invStatusFilter, setInvStatusFilter] = useState('');
  const [invCategoryFilter, setInvCategoryFilter] = useState('');
  const [invSort, setInvSort] = useState('stock_asc');
  const [invLoading, setInvLoading] = useState(false);
  const [invMetricsLoading, setInvMetricsLoading] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState(0);
  const [savingStockId, setSavingStockId] = useState<string | null>(null);
  const [invSelected, setInvSelected] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'set' | 'add' | 'subtract'>('set');
  const [bulkValue, setBulkValue] = useState(0);
  const [bulkNote, setBulkNote] = useState('');
  const [savingBulk, setSavingBulk] = useState(false);
  const [logProduct, setLogProduct] = useState<InventoryItem | null>(null);
  const [invLogs, setInvLogs] = useState<InventoryLog[]>([]);
  const [invLogsLoading, setInvLogsLoading] = useState(false);
  const [variantProduct, setVariantProduct] = useState<InventoryItem | null>(null);
  const [variantDraft, setVariantDraft] = useState<ProductVariant[]>([]);
  const [savingVariants, setSavingVariants] = useState(false);
  const invSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Back-In-Stock Notifications
  const [bisRequests, setBisRequests] = useState<any[]>([]);
  const [bisStats, setBisStats] = useState({ total: 0, pending: 0, notified: 0, products: 0 });
  const [bisTopProducts, setBisTopProducts] = useState<{ id: string; name: string; request_count: number }[]>([]);
  const [bisTotal, setBisTotal] = useState(0);
  const [bisPage, setBisPage] = useState(1);
  const [bisPages, setBisPages] = useState(1);
  const [bisSearch, setBisSearch] = useState('');
  const [bisStatusFilter, setBisStatusFilter] = useState('');
  const [bisProductFilter, setBisProductFilter] = useState('');
  const [bisLoading, setBisLoading] = useState(false);
  const [bisNotifying, setBisNotifying] = useState<string | null>(null);
  const bisSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Abandoned Carts
  const [abandonedCarts, setAbandonedCarts] = useState<any[]>([]);
  const [abandonedStats, setAbandonedStats] = useState({ total: 0, active: 0, converted: 0, activeValue: 0 });
  const [abandonedPage, setAbandonedPage] = useState(1);
  const [abandonedPages, setAbandonedPages] = useState(1);
  const [abandonedLoading, setAbandonedLoading] = useState(false);
  const [abandonedFilter, setAbandonedFilter] = useState<'all' | 'active' | 'converted'>('active');
  const [dripTemplates, setDripTemplates] = useState<any[]>([]);
  const [dripLoading, setDripLoading] = useState(false);
  const [showDripForm, setShowDripForm] = useState(false);
  const [editingDrip, setEditingDrip] = useState<any | null>(null);
  const defaultDripForm = { name: '', step: 1, delay_hours: 1, subject: '', email_body: '', sms_body: '', active: true };
  const [dripForm, setDripForm] = useState({ ...defaultDripForm });

  // Print area editor
  const [paeDraft, setPaeDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [paeIsHoverMove, setPaeIsHoverMove] = useState(false);
  const [showPaeAddForm, setShowPaeAddForm] = useState(false);
  const [paeNewLayoutName, setPaeNewLayoutName] = useState('');
  const [paeNewLayoutSide, setPaeNewLayoutSide] = useState<'FRONT' | 'BACK'>('FRONT');
  const [paePolygonPoints, setPaePolygonPoints] = useState<{ x: number; y: number }[]>([]);
  const paeDragRef = useRef<{ startX: number; startY: number; dragging: boolean; mode: 'draw' | 'move'; offsetX: number; offsetY: number }>({ startX: 0, startY: 0, dragging: false, mode: 'draw', offsetX: 0, offsetY: 0 });
  const paeContainerRef = useRef<HTMLDivElement | null>(null);

  // Coupons
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponForm, setCouponForm] = useState<Partial<Coupon>>({ ...defaultCoupon });
  const [savingCoupon, setSavingCoupon] = useState(false);

  // Shipment creation
  const [creatingShipmentFor, setCreatingShipmentFor] = useState<string | null>(null);
  // Tracking modal
  const [trackingModal, setTrackingModal] = useState<string | null>(null);
  const [trackingManualForm, setTrackingManualForm] = useState({ courierName: '', awbCode: '', estimatedDelivery: '' });
  const [trackingEventForm, setTrackingEventForm] = useState({ status: '', message: '', location: '' });
  const [savingTracking, setSavingTracking] = useState(false);
  // Shiprocket debug
  const [srTesting, setSrTesting] = useState(false);
  const [srTestResult, setSrTestResult] = useState<{ ok: boolean; error?: string; email?: string; tokenPreview?: string; pickupLocations?: any[]; envVars?: any } | null>(null);
  const [srPushingFor, setSrPushingFor] = useState<string | null>(null);
  // Email test
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ ok: boolean; smtpConfigured: boolean; error?: string } | null>(null);
  // SMS test
  const [smsTestPhone, setSmsTestPhone] = useState('');
  const [smsTesting, setSmsTesting] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<{ ok: boolean; configured: boolean; provider: string; message?: string } | null>(null);
  const [smsConfig, setSmsConfig] = useState<{ provider: string; msg91Configured: boolean; fast2smsConfigured: boolean; senderId: string } | null>(null);

  type AdminOrderEntry = { key: string; productOrder?: Order; designOrders: DesignOrder[]; createdAt: string; };
  const adminOrderEntries = useMemo((): AdminOrderEntry[] => {
    const grouped: Record<string, AdminOrderEntry> = {};
    for (const o of orders) {
      const gid = (o as any).groupOrderId;
      if (gid) {
        if (!grouped[gid]) grouped[gid] = { key: gid, designOrders: [], createdAt: o.createdAt };
        grouped[gid].productOrder = o;
      } else {
        grouped[`p_${o.id}`] = { key: `p_${o.id}`, productOrder: o, designOrders: [], createdAt: o.createdAt };
      }
    }
    for (const d of designOrders) {
      const gid = (d as any).groupOrderId;
      if (gid) {
        if (!grouped[gid]) grouped[gid] = { key: gid, designOrders: [], createdAt: d.createdAt };
        grouped[gid].designOrders.push(d);
      } else {
        grouped[`d_${d.id}`] = { key: `d_${d.id}`, designOrders: [d], createdAt: d.createdAt };
      }
    }
    return Object.values(grouped).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, designOrders]);

  const load = async () => {
    setLoading(true);
    try {
      const [p, o, a, m, d, cats, mockupCats, coup, zones] = await Promise.allSettled([
        api.getProducts({ all: '1' }), api.getAllOrders(), api.getAnalytics(), api.getMockups(), api.getAllDesignOrders(), api.getCategories(), api.getMockupCategories(), api.getCoupons(), api.getShippingZones(),
      ]);
      if (p.status === 'fulfilled') setProducts(p.value);
      if (o.status === 'fulfilled') setOrders(o.value);
      if (a.status === 'fulfilled') setAnalytics(a.value);
      if (m.status === 'fulfilled') setMockups(m.value);
      if (d.status === 'fulfilled') setDesignOrders(d.value);
      if (cats.status === 'fulfilled') setCategories(cats.value);
      if (mockupCats.status === 'fulfilled') setMockupCategories(mockupCats.value);
      if (coup.status === 'fulfilled') setCoupons(coup.value);
      if (zones.status === 'fulfilled') setShippingZones(zones.value);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  // ── Real-time polling: refresh active tab every 30s ───────────────────────
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshActiveTab = useCallback(() => {
    setLastRefresh(new Date());
    if (tab === 'leads')           loadLeads(leadPage, leadSearch, leadStatusFilter, leadDateFilter);
    else if (tab === 'notifications') loadBisRequests(bisPage, bisSearch, bisStatusFilter, bisProductFilter);
    else if (tab === 'inventory')  { loadInvMetrics(); loadInventory(invPage, invSearch, invStatusFilter, invCategoryFilter, invSort); }
    else if (tab === 'abandoned-carts') { loadAbandonedCarts(abandonedPage, abandonedFilter); }
    else if (tab === 'analytics')  api.getAnalytics().then(setAnalytics).catch(() => {});
    else if (tab === 'orders')     Promise.all([api.getAllOrders(), api.getAllDesignOrders()]).then(([o, d]) => { setOrders(o); setDesignOrders(d); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, leadPage, leadSearch, leadStatusFilter, leadDateFilter, bisPage, bisSearch, bisStatusFilter, bisProductFilter, invPage, invSearch, invStatusFilter, invCategoryFilter, invSort, abandonedPage, abandonedFilter]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(refreshActiveTab, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [refreshActiveTab]);

  useEffect(() => {
    load();
    setPaletteLoading(true);
    api.getPalette().then(setGlobalColors).catch(() => {}).finally(() => setPaletteLoading(false));
  }, []);

  const loadCollections = async () => {
    setColLoading(true);
    try {
      const cols = await api.getCollections();
      setCollections(cols);
      // Load products for each collection
      const map: Record<string, any[]> = {};
      await Promise.all(cols.map(async (c: any) => {
        map[c.id] = await api.getCollectionProducts(c.id).catch(() => []);
      }));
      setColProducts(map);
    } catch { toast.error('Failed to load collections'); }
    finally { setColLoading(false); }
  };

  const loadBrands = async () => {
    setBrandLoading(true);
    try {
      const [allBrands, allModels] = await Promise.all([
        api.adminGetAllBrands(),
        api.adminGetAllModels(),
      ]);
      setBrands(allBrands);
      const map: Record<string, any[]> = {};
      for (const m of allModels) {
        if (!map[m.brandId]) map[m.brandId] = [];
        map[m.brandId].push(m);
      }
      setBrandModels(map);
    } catch { toast.error('Failed to load brands'); }
    finally { setBrandLoading(false); }
  };

  const loadBanners = async () => {
    setBannerLoading(true);
    try { setBannerList(await api.adminGetAllBanners()); }
    catch { toast.error('Failed to load banners'); }
    finally { setBannerLoading(false); }
  };

  const BADGE_TYPES = [
    { value: 'new-arrivals', label: 'New Arrivals' },
    { value: 'best-sellers', label: 'Best Sellers' },
    { value: 'featured',     label: 'Featured'     },
    { value: 'seasonal',     label: 'Seasonal Offer'},
  ];

  const GRADIENT_PRESETS = BRAND_GRADIENT_PRESETS;

  const loadDb = async () => {
    setDbLoading(true);
    try {
      const data = await api.getDbViewer();
      setDbData(data);
    } catch { toast.error('Failed to load database'); }
    finally { setDbLoading(false); }
  };

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      const row = data.find((r: any) => r.key === 'upload_enabled');
      setUploadEnabled(row?.value !== 'false');
    } catch { toast.error('Failed to load settings'); }
  };

  const toggleUpload = async (enabled: boolean) => {
    setSettingsSaving(true);
    try {
      await api.updateSetting('upload_enabled', enabled ? 'true' : 'false');
      setUploadEnabled(enabled);
      toast.success(`Upload ${enabled ? 'enabled' : 'disabled'}`);
    } catch { toast.error('Failed to save setting'); }
    finally { setSettingsSaving(false); }
  };

  // Inventory Management
  const loadInvMetrics = async () => {
    setInvMetricsLoading(true);
    try { setInvMetrics(await api.getInventoryMetrics()); }
    catch { toast.error('Failed to load inventory metrics'); }
    finally { setInvMetricsLoading(false); }
  };

  const loadInventory = async (pg: number, search: string, status: string, category: string, sort: string) => {
    setInvLoading(true);
    try {
      const data = await api.getInventory({ search, status, category, sort, page: pg, limit: 30 });
      setInvItems(data.items);
      setInvTotal(data.total);
      setInvPage(data.page);
      setInvPages(data.pages);
    } catch { toast.error('Failed to load inventory'); }
    finally { setInvLoading(false); }
  };

  const saveStock = async (item: InventoryItem, newStock: number) => {
    if (newStock === item.stock) { setEditingStockId(null); return; }
    setSavingStockId(item.id);
    try {
      const updated = await api.updateInventory(item.id, {
        stock: newStock,
        change_type: 'adjustment',
        note: 'Admin manual adjustment',
      });
      setInvItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updated } : i));
      setEditingStockId(null);
      loadInvMetrics();
      toast.success('Stock updated');
    } catch { toast.error('Failed to update stock'); }
    finally { setSavingStockId(null); }
  };

  const executeBulkUpdate = async () => {
    if (!invSelected.size) return;
    setSavingBulk(true);
    try {
      const result = await api.bulkUpdateInventory([...invSelected], bulkMode, bulkValue, bulkNote || 'Bulk update');
      toast.success(`Updated ${result.updated} products`);
      setShowBulkModal(false);
      setInvSelected(new Set());
      setBulkValue(0);
      setBulkNote('');
      loadInventory(invPage, invSearch, invStatusFilter, invCategoryFilter, invSort);
      loadInvMetrics();
    } catch { toast.error('Bulk update failed'); }
    finally { setSavingBulk(false); }
  };

  const openLogs = async (item: InventoryItem) => {
    setLogProduct(item);
    setInvLogsLoading(true);
    try { setInvLogs(await api.getInventoryLogs(item.id)); }
    catch { toast.error('Failed to load stock history'); }
    finally { setInvLogsLoading(false); }
  };

  const openVariants = (item: InventoryItem) => {
    setVariantProduct(item);
    setVariantDraft(JSON.parse(JSON.stringify(item.variants ?? [])));
  };

  const addVariant = () => {
    setVariantDraft(prev => [...prev, {
      id: crypto.randomUUID(), label: '', size: '', color: '#000000', colorName: 'Black', skuSuffix: '', stock: 0,
    }]);
  };

  const saveVariants = async () => {
    if (!variantProduct) return;
    setSavingVariants(true);
    try {
      await api.updateInventory(variantProduct.id, { variants: variantDraft });
      setInvItems(prev => prev.map(i => i.id === variantProduct.id ? { ...i, variants: variantDraft } : i));
      setVariantProduct(null);
      toast.success('Variants saved');
    } catch { toast.error('Failed to save variants'); }
    finally { setSavingVariants(false); }
  };

  // Back-In-Stock
  const loadBisRequests = async (pg: number, search: string, status: string, product_id: string) => {
    setBisLoading(true);
    try {
      const data = await api.getBackInStockRequests({ search, status, product_id, page: pg, limit: 50 });
      setBisRequests(data.requests);
      setBisStats(data.stats);
      setBisTopProducts(data.topProducts);
      setBisTotal(data.total);
      setBisPage(data.page);
      setBisPages(data.pages);
    } catch { toast.error('Failed to load notifications'); }
    finally { setBisLoading(false); }
  };

  const triggerBisNotify = async (productId: string, productName: string) => {
    if (!confirm(`Send notifications to all pending subscribers for "${productName}"?`)) return;
    setBisNotifying(productId);
    try {
      const res = await api.triggerBackInStockNotify(productId);
      toast.success(`Notified ${res.notified} subscriber${res.notified !== 1 ? 's' : ''}`);
      loadBisRequests(bisPage, bisSearch, bisStatusFilter, bisProductFilter);
    } catch { toast.error('Failed to send notifications'); }
    finally { setBisNotifying(null); }
  };

  const deleteBisRequest = async (id: string) => {
    try {
      await api.deleteBackInStockRequest(id);
      setBisRequests(prev => prev.filter(r => r.id !== id));
      setBisTotal(t => t - 1);
    } catch { toast.error('Failed to delete request'); }
  };

  // Abandoned Carts
  const loadAbandonedCarts = async (pg: number, filter: 'all' | 'active' | 'converted') => {
    setAbandonedLoading(true);
    try {
      const converted = filter === 'all' ? undefined : filter === 'converted';
      const data = await api.getAbandonedCarts({ page: pg, limit: 50, converted });
      setAbandonedCarts(data.carts);
      setAbandonedStats(data.stats);
      setAbandonedPage(data.page);
      setAbandonedPages(data.pages);
    } catch { toast.error('Failed to load abandoned carts'); }
    finally { setAbandonedLoading(false); }
  };

  const loadDripTemplates = async () => {
    setDripLoading(true);
    try {
      setDripTemplates(await api.getDripTemplates());
    } catch { toast.error('Failed to load drip templates'); }
    finally { setDripLoading(false); }
  };

  const openDripForm = (tmpl?: any) => {
    if (tmpl) {
      setEditingDrip(tmpl);
      setDripForm({ name: tmpl.name, step: tmpl.step, delay_hours: tmpl.delay_hours, subject: tmpl.subject, email_body: tmpl.email_body, sms_body: tmpl.sms_body, active: tmpl.active });
    } else {
      setEditingDrip(null);
      setDripForm({ ...defaultDripForm });
    }
    setShowDripForm(true);
  };

  const saveDripTemplate = async () => {
    try {
      if (editingDrip) {
        const updated = await api.updateDripTemplate(editingDrip.id, dripForm);
        setDripTemplates(prev => prev.map(t => t.id === editingDrip.id ? updated : t));
        toast.success('Template updated');
      } else {
        const created = await api.createDripTemplate(dripForm as any);
        setDripTemplates(prev => [...prev, created]);
        toast.success('Template created');
      }
      setShowDripForm(false);
    } catch (e: any) { toast.error(e.message || 'Failed to save template'); }
  };

  const deleteDripTemplate = async (id: string) => {
    if (!confirm('Delete this drip template?')) return;
    try {
      await api.deleteDripTemplate(id);
      setDripTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template deleted');
    } catch { toast.error('Failed to delete'); }
  };

  // Leads CRM
  const loadLeads = async (pg: number, search: string, status: string, date: string) => {
    setLeadLoading(true);
    try {
      const data = await api.getLeads({ search, status, date, page: pg, limit: 25 });
      setLeads(data.leads);
      setLeadTotal(data.total);
      setLeadPage(data.page);
      setLeadPages(data.pages);
      setLeadStats(data.stats);
    } catch { toast.error('Failed to load leads'); }
    finally { setLeadLoading(false); }
  };

  const exportLeadsCSV = async () => {
    try {
      const blob = await api.exportLeadsCSV({ search: leadSearch, status: leadStatusFilter, date: leadDateFilter });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast.error('CSV export failed'); }
  };

  const saveLeadEdit = async () => {
    if (!editingLead) return;
    setSavingLead(true);
    try {
      await api.updateLead(editingLead.id, leadEditForm);
      toast.success('Lead updated');
      setEditingLead(null);
      loadLeads(leadPage, leadSearch, leadStatusFilter, leadDateFilter);
    } catch { toast.error('Failed to update lead'); }
    finally { setSavingLead(false); }
  };

  const deleteLead = async (id: string) => {
    try {
      await api.deleteLead(id);
      toast.success('Lead deleted');
      loadLeads(leadPage, leadSearch, leadStatusFilter, leadDateFilter);
    } catch { toast.error('Failed to delete lead'); }
  };

  const createNewLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.name && !newLeadForm.mobile && !newLeadForm.email) {
      toast.error('Enter at least a name, mobile, or email');
      return;
    }
    setSavingNewLead(true);
    try {
      await api.createLead(newLeadForm);
      toast.success('Lead created');
      setShowNewLeadForm(false);
      setNewLeadForm({ name: '', mobile: '', email: '', source: 'direct', notes: '' });
      loadLeads(1, leadSearch, leadStatusFilter, leadDateFilter);
    } catch { toast.error('Failed to create lead'); }
    finally { setSavingNewLead(false); }
  };

  // Product CRUD
  const openNewProduct = () => { setEditingProduct(null); setProductForm({ ...defaultProduct }); setShowProductForm(true); };
  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      ...defaultProduct,
      ...p,
      colors: [...new Set(p.colors || [])],
      highlights: p.highlights || [],
      fabricInfo: p.fabricInfo || '',
      printMethods: p.printMethods || [],
      printAreas: p.printAreas || [],
      careInstructions: p.careInstructions || [],
      faqs: p.faqs || [],
    });
    setShowProductForm(true);
  };
  const closeProductForm = () => { setShowProductForm(false); setEditingProduct(null); };
  const saveGlobalColors = async (cols: {name: string, hex: string}[]) => {
    setGlobalColors(cols);
    try { await api.savePalette(cols); } catch { toast.error('Failed to save palette'); }
  };
  const addGlobalColor = () => {
    if (!newColorName.trim()) return;
    if (globalColors.some(c => c.hex.toLowerCase() === newColorHex.toLowerCase())) { toast.error('Colour already in palette'); return; }
    saveGlobalColors([...globalColors, { name: newColorName.trim(), hex: newColorHex }]);
    setNewColorName('');
  };
  const removeGlobalColor = (hex: string) => saveGlobalColors(globalColors.filter(c => c.hex !== hex));

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price || !productForm.category) { toast.error('Name, price & category are required'); return; }
    const skuField = (productForm as any).id;
    if (!editingProduct) {
      if (!skuField?.trim()) { toast.error('SKU / Product ID is required'); return; }
      if (products.some(p => p.id === skuField.trim())) { toast.error(`SKU "${skuField}" already exists`); return; }
    }
    const cleanForm = { ...productForm, colors: [...new Set((productForm.colors || []).map((c: string) => c.trim().toLowerCase()))] };
    setSavingProduct(true);
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, cleanForm);
        toast.success('Product updated');
      } else {
        await api.createProduct({ ...cleanForm, id: skuField.trim() } as any);
        toast.success('Product created');
      }
      closeProductForm(); load();
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSavingProduct(false); }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try { await api.deleteProduct(id); toast.success('Product deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };

  // Category CRUD
  const openNewCategory = () => { setEditingCategory(null); setCategoryFormName(''); setCategoryFormImage(''); setCategoryFormSizeChart(null); setShowCategoryForm(true); };
  const openEditCategory = (c: Category) => { setEditingCategory(c); setCategoryFormName(c.name); setCategoryFormImage(c.image || ''); setCategoryFormSizeChart(c.sizeChart || null); setShowCategoryForm(true); };
  const closeCategoryForm = () => { setShowCategoryForm(false); setEditingCategory(null); setCategoryFormName(''); setCategoryFormImage(''); setCategoryFormSizeChart(null); };
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryFormName.trim()) { toast.error('Category name is required'); return; }
    setSavingCategory(true);
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, { name: categoryFormName.trim(), image: categoryFormImage.trim(), sizeChart: categoryFormSizeChart });
        toast.success('Category updated');
      } else {
        await api.createCategory({ name: categoryFormName.trim(), sizeChart: categoryFormSizeChart });
        toast.success('Category created');
      }
      closeCategoryForm(); load();
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSavingCategory(false); }
  };
  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Products in this category will lose their category link.')) return;
    try { await api.deleteCategory(id); toast.success('Category deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Mockup Category CRUD
  const openNewMockupCategory = () => { setEditingMockupCategory(null); setMockupCategoryFormName(''); setShowMockupCategoryForm(true); };
  const openEditMockupCategory = (c: MockupCategory) => { setEditingMockupCategory(c); setMockupCategoryFormName(c.name); setShowMockupCategoryForm(true); };
  const closeMockupCategoryForm = () => { setShowMockupCategoryForm(false); setEditingMockupCategory(null); setMockupCategoryFormName(''); };
  const handleSaveMockupCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockupCategoryFormName.trim()) { toast.error('Category name is required'); return; }
    setSavingMockupCategory(true);
    try {
      if (editingMockupCategory) {
        await api.updateMockupCategory(editingMockupCategory.id, { name: mockupCategoryFormName.trim() });
        toast.success('Mockup category updated');
      } else {
        await api.createMockupCategory({ name: mockupCategoryFormName.trim() });
        toast.success('Mockup category created');
      }
      closeMockupCategoryForm(); load();
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSavingMockupCategory(false); }
  };
  const handleDeleteMockupCategory = async (id: string) => {
    if (!confirm('Delete this mockup category?')) return;
    try { await api.deleteMockupCategory(id); toast.success('Mockup category deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };
  const handleCopyMockupCatId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedMockupCatId(id);
      setTimeout(() => setCopiedMockupCatId(null), 2000);
    });
  };

  // Mockup image upload
  const handleMockupImageUpload = async (field: string, file: File) => {
    setUploadingField(field);
    try {
      const { url } = await api.uploadMockupImage(file);
      setMockupForm(prev => ({ ...prev, [field]: url }));
      toast.success('Image uploaded!');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploadingField(null);
    }
  };

  const handleRemoveBg = async (field: 'frontImage' | 'backImage') => {
    const url = (mockupForm as any)[field];
    if (!url) return;
    setRemovingBgField(field);
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to fetch image');
      const blob = await resp.blob();
      const resultBlob = await removeBackground(blob, {
        publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
      });
      const file = new File([resultBlob], 'nobg.png', { type: 'image/png' });
      const { url: newUrl } = await api.uploadMockupImage(file);
      setMockupForm(prev => ({ ...prev, [field]: newUrl }));
      toast.success('Background removed!');
    } catch (e: any) {
      toast.error(e.message || 'Background removal failed');
    } finally {
      setRemovingBgField(null);
    }
  };

  // Product image upload
  const handleProductImageUpload = async (file: File) => {
    setUploadingField('productImage');
    try {
      const { url } = await api.uploadProductImage(file);
      setProductForm(prev => ({ ...prev, image: url }));
      toast.success('Image uploaded!');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploadingField(null);
    }
  };

  // Extra product image upload (appends to images[])
  const handleProductExtraImageUpload = async (file: File) => {
    setUploadingField('productExtraImage');
    try {
      const { url } = await api.uploadProductImage(file);
      setProductForm(prev => ({ ...prev, images: [...(prev.images || []), url] }));
      toast.success('Image added!');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploadingField(null);
    }
  };

  // Shipping zone handlers
  const openNewShippingZone = () => { setEditingShippingZone(null); setShippingZoneForm({ label: '', pinPatterns: [], shippingCharge: 49, freeAbove: 999, sortOrder: 0, active: true, weightFromGrams: 0, weightToGrams: 99999, deliveryType: 'standard', estimatedDays: '5-7 days' }); setShowShippingZoneForm(true); };
  const openEditShippingZone = (z: ShippingZone) => { setEditingShippingZone(z); setShippingZoneForm({ ...z, pinPatterns: [...z.pinPatterns] }); setShowShippingZoneForm(true); };
  const handleSaveShippingZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingZoneForm.label?.trim()) return toast.error('Label is required');
    setSavingShippingZone(true);
    try {
      if (editingShippingZone) {
        const updated = await api.updateShippingZone(editingShippingZone.id, shippingZoneForm);
        setShippingZones(prev => prev.map(z => z.id === editingShippingZone.id ? updated : z));
        toast.success('Zone updated');
      } else {
        const created = await api.createShippingZone(shippingZoneForm);
        setShippingZones(prev => [...prev, created]);
        toast.success('Zone created');
      }
      setShowShippingZoneForm(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingShippingZone(false); }
  };
  const handleDeleteShippingZone = async (id: string) => {
    if (!confirm('Delete this shipping zone?')) return;
    try { await api.deleteShippingZone(id); setShippingZones(prev => prev.filter(z => z.id !== id)); toast.success('Zone deleted'); }
    catch (e: any) { toast.error(e.message); }
  };

  // Mockup CRUD
  const openNewMockup = () => { setEditingMockup(null); setMockupForm({ ...defaultMockup }); setPaeDraft(null); setPaePolygonPoints([]); setActiveLayoutId(null); setShowPaeAddForm(false); setPaeNewLayoutName(''); setShowMockupForm(true); };
  const openEditMockup = (m: Mockup) => {
    const normalized = normalizePrintArea(m.printArea);
    setEditingMockup(m); setMockupForm({ ...m, printArea: normalized }); setPaeDraft(null); setPaePolygonPoints([]);
    setActiveLayoutId(normalized.layouts[0]?.id || null); setShowPaeAddForm(false); setPaeNewLayoutName(''); setShowMockupForm(true);
  };
  const closeMockupForm = () => { setShowMockupForm(false); setEditingMockup(null); setPaeDraft(null); setPaePolygonPoints([]); setActiveLayoutId(null); setShowPaeAddForm(false); setPaeNewLayoutName(''); };

  // Print area editor handlers
  const paeLayouts: PrintLayout[] = (mockupForm.printArea as any)?.layouts || [];
  const activeLayout = paeLayouts.find(l => l.id === activeLayoutId) || null;
  const paeCurrentImage = activeLayout?.side === 'BACK' ? (mockupForm.backImage || '') : (mockupForm.frontImage || '');
  const getRelativePaePos = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = paeContainerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(PAE_W, e.clientX - rect.left)),
      y: Math.max(0, Math.min(PAE_H, e.clientY - rect.top)),
    };
  };
  const updateActiveLayout = (updates: Partial<PrintLayout>) => {
    setMockupForm(prev => ({
      ...prev,
      printArea: {
        ...prev.printArea,
        layouts: (prev.printArea as any).layouts.map((l: PrintLayout) => l.id === activeLayoutId ? { ...l, ...updates } : l),
      },
    }));
  };
  const deleteLayout = (id: string) => {
    setMockupForm(prev => ({
      ...prev,
      printArea: { ...prev.printArea, layouts: (prev.printArea as any).layouts.filter((l: PrintLayout) => l.id !== id) },
    }));
    if (activeLayoutId === id) setActiveLayoutId(null);
    setPaeDraft(null);
  };
  const addNewLayout = () => {
    if (!paeNewLayoutName.trim()) { toast.error('Layout name is required'); return; }
    const newLayout: PrintLayout = { id: crypto.randomUUID(), name: paeNewLayoutName.trim(), side: paeNewLayoutSide, x: 0, y: 0, w: 0, h: 0, shape: 'rect', price: 499 };
    setMockupForm(prev => ({ ...prev, printArea: { ...prev.printArea, layouts: [...(prev.printArea as any).layouts, newLayout] } }));
    setActiveLayoutId(newLayout.id); setShowPaeAddForm(false); setPaeNewLayoutName('');
    toast.success(`Layout "${newLayout.name}" added — draw its print area on the canvas`);
  };
  const handlePaeDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!paeCurrentImage || !activeLayout) return;
    if (activeLayout.shape === 'polygon') return;
    const { x, y } = getRelativePaePos(e);
    if (activeLayout.w > 0) {
      const rx = activeLayout.x * PAE_SCALE, ry = activeLayout.y * PAE_SCALE;
      const rw = activeLayout.w * PAE_SCALE, rh = activeLayout.h * PAE_SCALE;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
        paeDragRef.current = { startX: x, startY: y, dragging: true, mode: 'move', offsetX: x - rx, offsetY: y - ry };
        return;
      }
    }
    paeDragRef.current = { startX: x, startY: y, dragging: true, mode: 'draw', offsetX: 0, offsetY: 0 };
    setPaeDraft({ x: Math.round(x / PAE_SCALE), y: Math.round(y / PAE_SCALE), w: 0, h: 0 });
  };
  const handlePaeDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = getRelativePaePos(e);
    if (!paeDragRef.current.dragging) {
      if (activeLayout && activeLayout.w > 0) {
        const rx = activeLayout.x * PAE_SCALE, ry = activeLayout.y * PAE_SCALE;
        const rw = activeLayout.w * PAE_SCALE, rh = activeLayout.h * PAE_SCALE;
        setPaeIsHoverMove(x >= rx && x <= rx + rw && y >= ry && y <= ry + rh);
      } else { setPaeIsHoverMove(false); }
      return;
    }
    const { startX, startY, mode, offsetX, offsetY } = paeDragRef.current;
    if (mode === 'move' && activeLayout) {
      updateActiveLayout({
        x: Math.round(Math.max(0, Math.min(800 - activeLayout.w, (x - offsetX) / PAE_SCALE))),
        y: Math.round(Math.max(0, Math.min(1000 - activeLayout.h, (y - offsetY) / PAE_SCALE))),
      });
    } else {
      const rawW = Math.abs(x - startX);
      const rawH = Math.abs(y - startY);
      if (activeLayout?.shape === 'circle') {
        const size = Math.round(Math.max(rawW, rawH) / PAE_SCALE);
        setPaeDraft({
          x: Math.round((x < startX ? startX - Math.max(rawW, rawH) : startX) / PAE_SCALE),
          y: Math.round((y < startY ? startY - Math.max(rawW, rawH) : startY) / PAE_SCALE),
          w: size, h: size,
        });
      } else {
        setPaeDraft({
          x: Math.round(Math.min(x, startX) / PAE_SCALE), y: Math.round(Math.min(y, startY) / PAE_SCALE),
          w: Math.round(rawW / PAE_SCALE), h: Math.round(rawH / PAE_SCALE),
        });
      }
    }
  };
  const handlePaeDragEnd = () => {
    paeDragRef.current.dragging = false;
    setPaeIsHoverMove(false);
    // Auto-apply on mouse-up if a valid area was drawn
    setPaeDraft(prev => {
      if (!prev || prev.w < 10 || prev.h < 10) return null;
      setMockupForm(form => ({
        ...form,
        printArea: {
          ...form.printArea,
          layouts: (form.printArea as any).layouts.map((l: PrintLayout) =>
            l.id === activeLayoutId ? { ...l, ...prev } : l
          ),
        },
      }));
      return null; // clear draft
    });
  };
  const updatePaeSetting = (key: string, value: any) => {
    setMockupForm(prev => ({ ...prev, printArea: { ...prev.printArea, [key]: value } }));
  };

  /** Polygon dot-marking click handler */
  const handlePaePolygonClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeLayout || activeLayout.shape !== 'polygon' || !paeCurrentImage) return;
    e.stopPropagation();
    const { x, y } = getRelativePaePos(e);
    const cx = Math.round(x / PAE_SCALE);
    const cy = Math.round(y / PAE_SCALE);
    // If ≥3 points and click is near the first point, close polygon
    if (paePolygonPoints.length >= 3) {
      const first = paePolygonPoints[0];
      const dist = Math.sqrt((cx - first.x) ** 2 + (cy - first.y) ** 2);
      if (dist < Math.round(12 / PAE_SCALE)) {
        finalizePaePolygon();
        return;
      }
    }
    setPaePolygonPoints(prev => [...prev, { x: cx, y: cy }]);
  };
  const finalizePaePolygon = () => {
    if (paePolygonPoints.length < 3) return;
    const xs = paePolygonPoints.map(p => p.x);
    const ys = paePolygonPoints.map(p => p.y);
    const bx = Math.min(...xs), by = Math.min(...ys);
    const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
    updateActiveLayout({ x: bx, y: by, w: bw, h: bh, points: [...paePolygonPoints] });
    setPaePolygonPoints([]);
  };
  const handlePaePolygonDblClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeLayout || activeLayout.shape !== 'polygon') return;
    e.stopPropagation();
    if (paePolygonPoints.length >= 3) finalizePaePolygon();
  };

  /** Toggle compatibility between two layouts — kept bidirectional */
  const toggleCompatibility = (layoutId: string, withId: string) => {
    setMockupForm(prev => {
      const layouts: PrintLayout[] = (prev.printArea as any).layouts;
      const updated = layouts.map(l => {
        if (l.id === layoutId) {
          const cur = l.compatibleWith ?? [];
          const next = cur.includes(withId) ? cur.filter(x => x !== withId) : [...cur, withId];
          return { ...l, compatibleWith: next };
        }
        if (l.id === withId) {
          const cur = l.compatibleWith ?? [];
          const next = cur.includes(layoutId) ? cur.filter(x => x !== layoutId) : [...cur, layoutId];
          return { ...l, compatibleWith: next };
        }
        return l;
      });
      return { ...prev, printArea: { ...prev.printArea, layouts: updated } };
    });
  };

  const handleSaveMockup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockupForm.name || !mockupForm.frontImage) { toast.error('Name and front image URL are required'); return; }
    setSavingMockup(true);
    try {
      if (editingMockup) {
        await api.updateMockup(editingMockup.id, mockupForm);
        toast.success('Mockup updated');
      } else {
        await api.createMockup(mockupForm);
        toast.success('Mockup created');
      }
      closeMockupForm(); load();
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSavingMockup(false); }
  };

  const handleDeleteMockup = async (id: string) => {
    if (!confirm('Delete this mockup?')) return;
    try { await api.deleteMockup(id); toast.success('Mockup deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };

  const handleToggleMockup = async (m: Mockup) => {
    try {
      await api.updateMockup(m.id, { active: !m.active });
      toast.success(m.active ? 'Mockup disabled' : 'Mockup enabled');
      load();
    } catch { toast.error('Update failed'); }
  };

  // IST timezone helpers (UTC+5:30)
  const utcToIST = (utc: string | null | undefined): string => {
    if (!utc) return '';
    const d = new Date(utc);
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 16);
  };
  const istToUTC = (local: string | null | undefined): string | null => {
    if (!local) return null;
    const d = new Date(local + ':00.000Z');
    return new Date(d.getTime() - 5.5 * 60 * 60 * 1000).toISOString();
  };
  const istNow = (): string => {
    const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  };
  const istPreset = (daysFromNow: number, endOfDay = false): string => {
    const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    d.setDate(d.getDate() + daysFromNow);
    if (endOfDay) { d.setHours(23, 59, 0, 0); }
    return d.toISOString().slice(0, 16);
  };

  // Coupon CRUD
  const openNewCoupon = () => { setEditingCoupon(null); setCouponForm({ ...defaultCoupon }); setShowCouponForm(true); };
  const openEditCoupon = (c: Coupon) => {
    setEditingCoupon(c);
    setCouponForm({ ...c,
      validFrom: c.validFrom ? utcToIST(c.validFrom) : null,
      validUntil: c.validUntil ? utcToIST(c.validUntil) : null,
    });
    setShowCouponForm(true);
  };
  const closeCouponForm = () => { setShowCouponForm(false); setEditingCoupon(null); };
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCoupon(true);
    const payload = { ...couponForm,
      validFrom: istToUTC(couponForm.validFrom),
      validUntil: istToUTC(couponForm.validUntil),
    };
    try {
      if (editingCoupon) {
        await api.updateCoupon(editingCoupon.id, payload);
        toast.success('Coupon updated');
      } else {
        await api.createCoupon(payload);
        toast.success('Coupon created');
      }
      closeCouponForm();
      load();
    } catch { toast.error('Save failed'); }
    finally { setSavingCoupon(false); }
  };
  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    try { await api.deleteCoupon(id); toast.success('Coupon deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };

  // Shipment
  const handleCreateShipment = async (orderId: string) => {
    setCreatingShipmentFor(orderId);
    try { await api.createShipment(orderId); toast.success('Shipment created!'); load(); }
    catch (err: any) { toast.error(err?.message || 'Shipment creation failed'); }
    finally { setCreatingShipmentFor(null); }
  };

  const handleCreateDesignShipment = async (orderId: string) => {
    setCreatingShipmentFor(orderId);
    try { await api.createDesignShipment(orderId); toast.success('Shipment created!'); load(); }
    catch (err: any) { toast.error(err?.message || 'Shipment creation failed'); }
    finally { setCreatingShipmentFor(null); }
  };

  const handleTestShiprocket = async () => {
    setSrTesting(true); setSrTestResult(null);
    try {
      const res = await fetch('/api/products/shiprocket/test', { headers: { Authorization: `Bearer ${localStorage.getItem('tfw_token')}` } });
      const data = await res.json();
      setSrTestResult(data);
    } catch (e: any) {
      setSrTestResult({ ok: false, error: e.message });
    } finally { setSrTesting(false); }
  };

  const handleTestEmail = async () => {
    setEmailTesting(true); setEmailTestResult(null);
    try {
      const res = await fetch('/api/products/test-email', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('tfw_token')}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      setEmailTestResult(data);
    } catch (e: any) {
      setEmailTestResult({ ok: false, smtpConfigured: false, error: e.message });
    } finally { setEmailTesting(false); }
  };

  const handleTestSMS = async () => {
    if (!smsTestPhone || !/^[6-9]\d{9}$/.test(smsTestPhone)) { toast.error('Enter a valid 10-digit mobile number'); return; }
    setSmsTesting(true); setSmsTestResult(null);
    try {
      const res = await fetch('/api/products/test-sms', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('tfw_token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: smsTestPhone }),
      });
      setSmsTestResult(await res.json());
    } catch (e: any) {
      setSmsTestResult({ ok: false, configured: false, provider: 'error', message: e.message });
    } finally { setSmsTesting(false); }
  };

  const loadSmsConfig = async () => {
    try {
      const res = await fetch('/api/products/sms-config', { headers: { Authorization: `Bearer ${localStorage.getItem('tfw_token')}` } });
      setSmsConfig(await res.json());
    } catch { /* non-fatal */ }
  };

  const handlePushToShiprocket = async (orderId: string, isDesign: boolean) => {
    setSrPushingFor(orderId);
    try {
      const endpoint = isDesign ? `/api/products/design-orders/${orderId}/push-shiprocket` : `/api/products/orders/${orderId}/push-shiprocket`;
      const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('tfw_token')}` } });
      const data = await res.json();
      if (data.ok) { toast.success('Order pushed to Shiprocket!'); load(); }
      else toast.error(data.error || 'Push failed');
    } catch (e: any) {
      toast.error(e.message || 'Push failed');
    } finally { setSrPushingFor(null); }
  };

  const openTrackingModal = (order: Order) => {
    setTrackingManualForm({
      courierName: order.shipment?.courierName || '',
      awbCode: order.shipment?.awbCode || '',
      estimatedDelivery: (order.shipment?.trackingData as any)?.estimatedDelivery || '',
    });
    setTrackingEventForm({ status: '', message: '', location: '' });
    setTrackingModal(order.id);
  };

  const handleSaveManualTracking = async () => {
    if (!trackingModal) return;
    setSavingTracking(true);
    try {
      await api.updateManualTracking(trackingModal, trackingManualForm);
      toast.success('Tracking info saved');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save tracking');
    } finally {
      setSavingTracking(false);
    }
  };

  const handleAddTrackingEvent = async () => {
    if (!trackingModal) return;
    if (!trackingEventForm.status.trim() || !trackingEventForm.message.trim()) {
      return toast.error('Status and message are required');
    }
    setSavingTracking(true);
    try {
      await api.addTrackingEvent(trackingModal, trackingEventForm);
      toast.success('Tracking event added');
      setTrackingEventForm({ status: '', message: '', location: '' });
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add event');
    } finally {
      setSavingTracking(false);
    }
  };

  // Order
  const handleStatusChange = async (id: string, status: string) => {
    try { await api.updateOrderStatus(id, status); toast.success('Status updated'); load(); }
    catch { toast.error('Update failed'); }
  };

  const handleDesignStatusChange = async (id: string, status: string) => {
    try { await api.updateDesignOrderStatus(id, status); toast.success('Status updated'); load(); }
    catch { toast.error('Update failed'); }
  };

  // Design preview modal

  const handleDownloadDesign = (dataUrl: string, orderId: string, side: string) => {
    const link = document.createElement('a');
    link.download = `design-${orderId.slice(0, 8)}-${side}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleDownloadAllSides = (order: DesignOrder) => {
    const images = order.designImages || {};
    for (const [side, dataUrl] of Object.entries(images)) {
      if (dataUrl) handleDownloadDesign(dataUrl, order.id, side);
    }
  };

  const handleDownloadSourceFiles = (order: DesignOrder) => {
    const uploaded = order.uploadedImages || {};
    for (const [side, imgs] of Object.entries(uploaded)) {
      (imgs || []).forEach((src, idx) => {
        const link = document.createElement('a');
        link.download = `source-${order.id.slice(0, 8)}-${side.toLowerCase()}-${idx + 1}.png`;
        link.href = src;
        link.click();
      });
    }
  };

  const handleDownloadEverything = (order: DesignOrder) => {
    handleDownloadAllSides(order);
    setTimeout(() => handleDownloadSourceFiles(order), 500);
  };

  const hasSourceFiles = (order: DesignOrder) => {
    const uploaded = order.uploadedImages || {};
    return Object.values(uploaded).some(imgs => imgs && imgs.length > 0);
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="admin-page">
      <div className="container">
        <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 2px #d1fae5', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Live · refreshes every 30s · last updated {lastRefresh.toLocaleTimeString()}</span>
              <button className="btn btn-outline btn-sm" onClick={refreshActiveTab} style={{ gap: 4, padding: '3px 10px', fontSize: '0.75rem' }}><RefreshCw size={12} /> Now</button>
            </div>
          </div>
          <button className="btn btn-outline" onClick={() => { logout(); window.location.href = '/'; }} style={{ gap: 6 }}><LogOut size={16} /> Logout</button>
        </motion.div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button className={`tab`} onClick={() => navigate('/admin/analytics')}><BarChart3 size={16} /> Analytics ↗</button>
          <button className={`tab ${tab === 'leads' ? 'active' : ''}`} onClick={() => { setTab('leads'); loadLeads(1, leadSearch, leadStatusFilter, leadDateFilter); }}><UserPlus size={16} /> Leads</button>
          <button className={`tab ${tab === 'inventory' ? 'active' : ''}`} onClick={() => { setTab('inventory'); loadInvMetrics(); loadInventory(1, invSearch, invStatusFilter, invCategoryFilter, invSort); }}><Boxes size={16} /> Inventory</button>
          <button className={`tab ${tab === 'notifications' ? 'active' : ''}`} onClick={() => { setTab('notifications'); loadBisRequests(1, bisSearch, bisStatusFilter, bisProductFilter); }}><Bell size={16} /> Back In Stock {bisStats.pending > 0 && <span className="tab-badge">{bisStats.pending}</span>}</button>
          <button className={`tab ${tab === 'abandoned-carts' ? 'active' : ''}`} onClick={() => { setTab('abandoned-carts'); loadAbandonedCarts(1, abandonedFilter); loadDripTemplates(); }}><ShoppingCart size={16} /> Abandoned Carts {abandonedStats.active > 0 && <span className="tab-badge">{abandonedStats.active}</span>}</button>
          <button className={`tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}><Package size={16} /> Products</button>
          <button className={`tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}><Tag size={16} /> Categories</button>
          <button className={`tab ${tab === 'mockup-categories' ? 'active' : ''}`} onClick={() => setTab('mockup-categories')}><Tag size={16} /> Mockup Categories</button>
          <button className={`tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}><ShoppingCart size={16} /> Orders</button>
          <button className={`tab ${tab === 'mockups' ? 'active' : ''}`} onClick={() => setTab('mockups')}><Image size={16} /> Mockups</button>
          <button className={`tab ${tab === 'coupons' ? 'active' : ''}`} onClick={() => setTab('coupons')}><Percent size={16} /> Coupons ({coupons.length})</button>
          <button className={`tab ${tab === 'collections' ? 'active' : ''}`} onClick={() => { setTab('collections'); if (!collections.length) loadCollections(); }}><Sparkles size={16} /> Collections</button>
          <button className={`tab ${tab === 'brands' ? 'active' : ''}`} onClick={() => { setTab('brands'); if (!brands.length) loadBrands(); }}><Tag size={16} /> Brands &amp; Models</button>
          <button className={`tab ${tab === 'banners' ? 'active' : ''}`} onClick={() => { setTab('banners'); if (!bannerList.length) loadBanners(); }}><Image size={16} /> Banners</button>
          <button className={`tab ${tab === 'shipping' ? 'active' : ''}`} onClick={() => setTab('shipping')}><Truck size={16} /> Shipping Rates</button>
          <button className={`tab ${tab === 'database' ? 'active' : ''}`} onClick={() => { setTab('database'); if (!dbData) loadDb(); }}><Database size={16} /> Database</button>
          <button className={`tab ${tab === 'shiprocket' ? 'active' : ''}`} onClick={() => setTab('shiprocket')}><Truck size={16} /> Shiprocket</button>
          <button className={`tab ${tab === 'email' ? 'active' : ''}`} onClick={() => { setTab('email'); loadSmsConfig(); }}><Mail size={16} /> Email</button>
          <button className={`tab ${tab === 'colors' ? 'active' : ''}`} onClick={() => setTab('colors')}><Palette size={16} /> Colors</button>
          <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => { setTab('settings'); if (uploadEnabled === null) loadSettings(); }}><Settings size={16} /> Settings</button>
        </div>

        {/* Inventory Tab */}
        {tab === 'inventory' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: '0 0 4px' }}>Inventory Management</h2>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', margin: 0 }}>{invTotal} products tracked</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {invSelected.size > 0 && (
                  <button className="btn btn-primary" onClick={() => setShowBulkModal(true)} style={{ gap: 6 }}>
                    <Layers size={15} /> Bulk Update ({invSelected.size})
                  </button>
                )}
                <button className="icon-btn" title="Refresh" onClick={() => { loadInvMetrics(); loadInventory(invPage, invSearch, invStatusFilter, invCategoryFilter, invSort); }}>
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Total Products',  value: invMetrics?.totalProducts  ?? '—', icon: <Boxes size={18} />,         color: '#6366f1', bg: '#ede9fe' },
                { label: 'Total Stock',     value: invMetrics?.totalStock      ?? '—', icon: <PackageCheck size={18} />,   color: '#3b82f6', bg: '#dbeafe' },
                { label: 'Low Stock',       value: invMetrics?.lowStockCount   ?? '—', icon: <AlertTriangle size={18} />,  color: '#f59e0b', bg: '#fef3c7' },
                { label: 'Out of Stock',    value: invMetrics?.outOfStockCount ?? '—', icon: <XCircle size={18} />,        color: '#ef4444', bg: '#fee2e2' },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color, flexShrink: 0 }}>
                    {m.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 3 }}>{m.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <input
                  placeholder="Search name or SKU…"
                  value={invSearch}
                  onChange={e => {
                    const v = e.target.value;
                    setInvSearch(v);
                    if (invSearchTimer.current) clearTimeout(invSearchTimer.current);
                    invSearchTimer.current = setTimeout(() => loadInventory(1, v, invStatusFilter, invCategoryFilter, invSort), 350);
                  }}
                  style={{ width: '100%', paddingLeft: 32, boxSizing: 'border-box' }}
                />
                <Filter size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
              </div>
              <select value={invStatusFilter} onChange={e => { setInvStatusFilter(e.target.value); loadInventory(1, invSearch, e.target.value, invCategoryFilter, invSort); }} style={{ minWidth: 150 }}>
                <option value="">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
              <select value={invCategoryFilter} onChange={e => { setInvCategoryFilter(e.target.value); loadInventory(1, invSearch, invStatusFilter, e.target.value, invSort); }} style={{ minWidth: 140 }}>
                <option value="">All Categories</option>
                {[...new Set(invItems.map(i => i.category).filter(Boolean))].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select value={invSort} onChange={e => { setInvSort(e.target.value); loadInventory(1, invSearch, invStatusFilter, invCategoryFilter, e.target.value); }} style={{ minWidth: 150 }}>
                <option value="stock_asc">Stock: Low → High</option>
                <option value="stock_desc">Stock: High → Low</option>
                <option value="name_asc">Name: A → Z</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="created_desc">Newest First</option>
              </select>
            </div>

            {/* Table */}
            {invLoading ? (
              <div style={{ textAlign: 'center', padding: 56 }}><div className="spinner" /></div>
            ) : invItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-3)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <Boxes size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                <div style={{ fontWeight: 600 }}>No products found</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: 36 }}>
                        <input type="checkbox"
                          checked={invSelected.size === invItems.length && invItems.length > 0}
                          onChange={e => setInvSelected(e.target.checked ? new Set(invItems.map(i => i.id)) : new Set())}
                        />
                      </th>
                      {['Product', 'SKU', 'Category', 'Variants', 'Stock', 'Price', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-3)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invItems.map((item, idx) => {
                      const ss = STOCK_STATUS[item.stock_status] ?? STOCK_STATUS.in_stock;
                      const isEditingStock = editingStockId === item.id;
                      return (
                        <tr key={item.id} style={{ borderBottom: idx < invItems.length - 1 ? '1px solid var(--border)' : 'none', background: invSelected.has(item.id) ? 'color-mix(in srgb, var(--primary) 4%, transparent)' : undefined }}>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={invSelected.has(item.id)}
                              onChange={e => setInvSelected(prev => { const s = new Set(prev); e.target.checked ? s.add(item.id) : s.delete(item.id); return s; })}
                            />
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {(item.image || ((item as any).images?.[0]))
                                ? <img src={item.image || (item as any).images?.[0]} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />
                                : <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Boxes size={14} style={{ opacity: 0.3 }} /></div>
                              }
                              <span style={{ fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>{item.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-2)' }}>{(item as any).slug || item.sku || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{item.category || '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button className="icon-btn" title={`${(item.variants ?? []).length} variants`} onClick={() => openVariants(item)} style={{ position: 'relative' }}>
                              <Layers size={14} />
                              {(item.variants ?? []).length > 0 && (
                                <span style={{ position: 'absolute', top: -4, right: -4, fontSize: '0.6rem', fontWeight: 700, background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {item.variants.length}
                                </span>
                              )}
                            </button>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {isEditingStock ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  type="number" min={0} autoFocus
                                  value={editingStockVal}
                                  onChange={e => setEditingStockVal(Math.max(0, parseInt(e.target.value) || 0))}
                                  onKeyDown={e => { if (e.key === 'Enter') saveStock(item, editingStockVal); if (e.key === 'Escape') setEditingStockId(null); }}
                                  style={{ width: 72, padding: '3px 8px', textAlign: 'center', fontWeight: 600 }}
                                />
                                <button onClick={() => saveStock(item, editingStockVal)} disabled={savingStockId === item.id} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', display: 'flex' }}>
                                  {savingStockId === item.id ? <div className="spinner-sm" /> : <Check size={12} />}
                                </button>
                                <button onClick={() => setEditingStockId(null)} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', display: 'flex' }}>
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <span
                                onClick={() => { setEditingStockId(item.id); setEditingStockVal(item.stock); }}
                                title="Click to edit stock"
                                style={{ cursor: 'pointer', fontWeight: 700, fontFamily: 'monospace', fontSize: '1rem', padding: '2px 8px', borderRadius: 5, display: 'inline-block', transition: 'background .15s', userSelect: 'none' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                {item.stock}
                              </span>
                            )}
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 1 }}>threshold: {item.low_stock_threshold}</div>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>₹{Number(item.price).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 7, height: 7, borderRadius: '50%', background: ss.dot, flexShrink: 0 }} />
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: ss.color }}>{ss.label}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 2 }}>
                              <button className="icon-btn" title="Stock History" onClick={() => openLogs(item)}><History size={14} /></button>
                              <button className="icon-btn" title="Edit Variants" onClick={() => openVariants(item)}><Layers size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {invPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>{invTotal} products · Page {invPage} of {invPages}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline" style={{ padding: '5px 12px' }} disabled={invPage <= 1}
                    onClick={() => loadInventory(invPage - 1, invSearch, invStatusFilter, invCategoryFilter, invSort)}>
                    <ChevronLeft size={15} />
                  </button>
                  <button className="btn btn-outline" style={{ padding: '5px 12px' }} disabled={invPage >= invPages}
                    onClick={() => loadInventory(invPage + 1, invSearch, invStatusFilter, invCategoryFilter, invSort)}>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Back-In-Stock Notifications Tab */}
        {tab === 'notifications' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Back-In-Stock Notifications</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>{bisTotal} total requests</p>
              </div>
              <button className="icon-btn" onClick={() => loadBisRequests(bisPage, bisSearch, bisStatusFilter, bisProductFilter)} title="Refresh">
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total', value: bisStats.total, color: '#6366f1', bg: '#eef2ff' },
                { label: 'Pending', value: bisStats.pending, color: '#f59e0b', bg: '#fef3c7' },
                { label: 'Notified', value: bisStats.notified, color: '#10b981', bg: '#d1fae5' },
                { label: 'Products', value: bisStats.products, color: '#3b82f6', bg: '#dbeafe' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Top Products with Pending Requests */}
            {bisTopProducts.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Products Awaiting Restock</h3>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {bisTopProducts.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                      <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{p.request_count} pending</span>
                      <button
                        style={{ background: '#0E7C61', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        disabled={bisNotifying === p.id}
                        onClick={() => triggerBisNotify(p.id, p.name)}
                      >
                        {bisNotifying === p.id ? '...' : <><Send size={11} /> Notify</>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Filter size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 38, border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                  placeholder="Search name, email, mobile, product..."
                  value={bisSearch}
                  onChange={e => {
                    setBisSearch(e.target.value);
                    clearTimeout(bisSearchTimer.current!);
                    bisSearchTimer.current = setTimeout(() => loadBisRequests(1, e.target.value, bisStatusFilter, bisProductFilter), 350);
                  }}
                />
              </div>
              <select
                style={{ height: 38, border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontSize: 14, minWidth: 140 }}
                value={bisStatusFilter}
                onChange={e => { setBisStatusFilter(e.target.value); loadBisRequests(1, bisSearch, e.target.value, bisProductFilter); }}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="notified">Notified</option>
              </select>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {bisLoading ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
              ) : bisRequests.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Bell size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
                  <p>No notification requests yet</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Customer</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Product</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Stock</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Requested</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bisRequests.map((r, idx) => (
                      <tr key={r.id} style={{ borderBottom: idx < bisRequests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{r.name || '—'}</div>
                          {r.email && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.email}</div>}
                          {r.mobile && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>+91 {r.mobile}</div>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 500 }}>{r.product_name}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: r.product_stock > 0 ? '#d1fae5' : '#fee2e2',
                            color: r.product_stock > 0 ? '#065f46' : '#991b1b',
                          }}>
                            {r.product_stock > 0 ? `${r.product_stock} in stock` : 'Out of stock'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: r.status === 'notified' ? '#d1fae5' : '#fef3c7',
                            color: r.status === 'notified' ? '#065f46' : '#92400e',
                          }}>
                            {r.status === 'notified' ? '✓ Notified' : '⏳ Pending'}
                          </span>
                          {r.notified_at && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {new Date(r.notified_at).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                          {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {r.status === 'pending' && (
                              <button
                                title="Send notification now"
                                style={{ background: '#0E7C61', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                disabled={bisNotifying === r.product_id}
                                onClick={() => triggerBisNotify(r.product_id, r.product_name)}
                              >
                                <Send size={11} /> Notify
                              </button>
                            )}
                            <button
                              title="Delete"
                              style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}
                              onClick={() => deleteBisRequest(r.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {bisPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {bisPage} of {bisPages} ({bisTotal} total)</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" disabled={bisPage <= 1}
                    onClick={() => loadBisRequests(bisPage - 1, bisSearch, bisStatusFilter, bisProductFilter)}>← Prev</button>
                  <button className="btn btn-outline btn-sm" disabled={bisPage >= bisPages}
                    onClick={() => loadBisRequests(bisPage + 1, bisSearch, bisStatusFilter, bisProductFilter)}>Next →</button>
                </div>
              </div>
            )}

          </motion.div>
        )}

        {/* Abandoned Carts Tab */}
        {tab === 'abandoned-carts' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: '0 0 4px' }}>Abandoned Carts</h2>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', margin: 0 }}>Automated drip messages for users who left items in cart</p>
              </div>
              <button className="btn btn-outline" onClick={() => loadAbandonedCarts(abandonedPage, abandonedFilter)} style={{ gap: 6 }}><RefreshCw size={15} /> Refresh</button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
              {[
                { label: 'Total Carts', value: abandonedStats.total, color: '#6366f1', bg: '#eef2ff' },
                { label: 'Active', value: abandonedStats.active, color: '#f59e0b', bg: '#fef3c7' },
                { label: 'Converted', value: abandonedStats.converted, color: '#10b981', bg: '#d1fae5' },
                { label: 'Active Value', value: `₹${Math.round(abandonedStats.activeValue).toLocaleString()}`, color: '#3b82f6', bg: '#dbeafe' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.78rem', color: s.color, opacity: 0.8, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['active', 'all', 'converted'] as const).map(f => (
                <button key={f} className={`btn btn-sm ${abandonedFilter === f ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => { setAbandonedFilter(f); loadAbandonedCarts(1, f); }}>
                  {f === 'active' ? 'Active' : f === 'converted' ? 'Converted' : 'All'}
                </button>
              ))}
            </div>

            {/* Carts table */}
            {abandonedLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>Loading...</div>
            ) : abandonedCarts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', background: 'var(--surface)', borderRadius: 12 }}>No abandoned carts</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Drip Step</th>
                    <th>Status</th>
                    <th>Abandoned</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {abandonedCarts.map((c: any) => {
                      const items = Array.isArray(c.items) ? c.items : [];
                      const ago = Math.round((Date.now() - new Date(c.created_at).getTime()) / 60000);
                      const agoStr = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
                      return (
                        <tr key={c.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.name || '—'}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{c.phone || c.email || '—'}</div>
                          </td>
                          <td style={{ maxWidth: 200 }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {items.map((i: any) => i.product?.name).filter(Boolean).join(', ') || '—'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{items.length} item{items.length !== 1 ? 's' : ''}</div>
                          </td>
                          <td style={{ fontWeight: 600 }}>₹{Math.round(parseFloat(c.total)).toLocaleString()}</td>
                          <td>
                            <span style={{ background: c.drip_step > 0 ? '#dbeafe' : '#f1f5f9', color: c.drip_step > 0 ? '#1d4ed8' : '#64748b', padding: '3px 9px', borderRadius: 20, fontSize: '0.78rem' }}>
                              {c.drip_step > 0 ? `Step ${c.drip_step} sent` : 'Not started'}
                            </span>
                          </td>
                          <td>
                            <span style={{ background: c.converted ? '#d1fae5' : '#fef3c7', color: c.converted ? '#065f46' : '#92400e', padding: '3px 9px', borderRadius: 20, fontSize: '0.78rem' }}>
                              {c.converted ? 'Converted' : 'Abandoned'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>{agoStr}</td>
                          <td>
                            <button className="icon-btn danger" onClick={async () => { await api.deleteAbandonedCart(c.id); setAbandonedCarts(prev => prev.filter(x => x.id !== c.id)); }} title="Delete"><Trash2 size={15} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {abandonedPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    <button className="btn btn-outline btn-sm" disabled={abandonedPage <= 1} onClick={() => loadAbandonedCarts(abandonedPage - 1, abandonedFilter)}>← Prev</button>
                    <span style={{ color: 'var(--text-3)', padding: '6px 12px', fontSize: '0.85rem' }}>Page {abandonedPage} of {abandonedPages}</span>
                    <button className="btn btn-outline btn-sm" disabled={abandonedPage >= abandonedPages} onClick={() => loadAbandonedCarts(abandonedPage + 1, abandonedFilter)}>Next →</button>
                  </div>
                )}
              </div>
            )}

            {/* Drip Templates */}
            <div style={{ marginTop: 40 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px' }}>Drip Message Templates</h3>
                  <p style={{ color: 'var(--text-2)', fontSize: '0.82rem', margin: 0 }}>
                    Variables: <code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>{'{{firstName}}'}</code>{' '}
                    <code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>{'{{items}}'}</code>{' '}
                    <code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>{'{{totalAmount}}'}</code>{' '}
                    <code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>{'{{cartLink}}'}</code>
                  </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => openDripForm()} style={{ gap: 6 }}><Plus size={14} /> New Template</button>
              </div>

              {dripLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-3)' }}>Loading...</div>
              ) : dripTemplates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', background: 'var(--surface)', borderRadius: 12, color: 'var(--text-3)' }}>No drip templates yet</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {dripTemplates.map(t => (
                    <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{ fontWeight: 700 }}>{t.name}</span>
                            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: '0.73rem' }}>Step {t.step}</span>
                            <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 20, fontSize: '0.73rem' }}>{t.delay_hours}h delay</span>
                            <span style={{ background: t.active ? '#d1fae5' : '#fee2e2', color: t.active ? '#065f46' : '#991b1b', padding: '2px 8px', borderRadius: 20, fontSize: '0.73rem' }}>{t.active ? 'Active' : 'Inactive'}</span>
                          </div>
                          {t.subject && <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 4 }}><strong>Subject:</strong> {t.subject}</div>}
                          {t.sms_body && <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}><strong>SMS:</strong> {t.sms_body}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="icon-btn" onClick={() => openDripForm(t)} title="Edit"><Edit3 size={15} /></button>
                          <button className="icon-btn danger" onClick={() => deleteDripTemplate(t.id)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Drip Template Form Modal */}
            <AnimatePresence>
              {showDripForm && (
                <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => { if (e.target === e.currentTarget) setShowDripForm(false); }}>
                  <motion.div className="modal" style={{ maxWidth: 600 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
                    <div className="modal-header">
                      <h3>{editingDrip ? 'Edit Drip Template' : 'New Drip Template'}</h3>
                      <button className="modal-close-btn" onClick={() => setShowDripForm(false)}><X size={18} /></button>
                    </div>
                    <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
                      <div className="form-group"><label>Template Name</label><input value={dripForm.name} onChange={e => setDripForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Abandoned Cart — 1 Hour" /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group"><label>Step #</label><input type="number" min={1} value={dripForm.step} onChange={e => setDripForm(f => ({ ...f, step: parseInt(e.target.value) || 1 }))} /></div>
                        <div className="form-group"><label>Delay (hours after cart creation)</label><input type="number" min={1} value={dripForm.delay_hours} onChange={e => setDripForm(f => ({ ...f, delay_hours: parseInt(e.target.value) || 1 }))} /></div>
                      </div>
                      <div className="form-group"><label>Email Subject</label><input value={dripForm.subject} onChange={e => setDripForm(f => ({ ...f, subject: e.target.value }))} placeholder="You left something behind..." /></div>
                      <div className="form-group">
                        <label>Email Body</label>
                        <textarea rows={6} value={dripForm.email_body} onChange={e => setDripForm(f => ({ ...f, email_body: e.target.value }))} placeholder="Hi {{firstName}}, your cart is waiting..." style={{ fontFamily: 'monospace', fontSize: '0.83rem', resize: 'vertical' }} />
                      </div>
                      <div className="form-group">
                        <label>SMS Body</label>
                        <textarea rows={3} value={dripForm.sms_body} onChange={e => setDripForm(f => ({ ...f, sms_body: e.target.value }))} placeholder="Hi {{firstName}}, your cart (₹{{totalAmount}}) is waiting: {{cartLink}}" style={{ fontFamily: 'monospace', fontSize: '0.83rem', resize: 'vertical' }} />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" id="drip-active" checked={dripForm.active} onChange={e => setDripForm(f => ({ ...f, active: e.target.checked }))} style={{ width: 16, height: 16 }} />
                        <label htmlFor="drip-active" style={{ margin: 0, cursor: 'pointer' }}>Active (will be sent by the automated cron)</label>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-outline" onClick={() => setShowDripForm(false)}>Cancel</button>
                      <button className="btn btn-primary" onClick={saveDripTemplate} style={{ gap: 6 }}><Save size={15} /> Save Template</button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}

        {/* Leads Tab */}
        {tab === 'leads' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: '0 0 4px' }}>Lead Dashboard</h2>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', margin: 0 }}>{leadStats.total} leads total</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setShowNewLeadForm(true)} style={{ gap: 6 }}>
                  <Plus size={15} /> New Lead
                </button>
                <button className="btn btn-outline" onClick={exportLeadsCSV} style={{ gap: 6 }}>
                  <Download size={15} /> Export CSV
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 22 }}>
              {([
                { label: 'Total',     value: leadStats.total,     color: 'var(--text-1)' },
                { label: 'New',       value: leadStats.new,       color: '#3b82f6' },
                { label: 'Contacted', value: leadStats.contacted, color: '#f59e0b' },
                { label: 'Qualified', value: leadStats.qualified, color: '#8b5cf6' },
                { label: 'Converted', value: leadStats.converted, color: '#10b981' },
                { label: 'Lost',      value: leadStats.lost,      color: '#ef4444' },
              ] as const).map(s => (
                <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: '1.7rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <input
                  placeholder="Search name, email, mobile…"
                  value={leadSearch}
                  onChange={e => {
                    const v = e.target.value;
                    setLeadSearch(v);
                    if (leadSearchTimer.current) clearTimeout(leadSearchTimer.current);
                    leadSearchTimer.current = setTimeout(() => loadLeads(1, v, leadStatusFilter, leadDateFilter), 350);
                  }}
                  style={{ width: '100%', paddingLeft: 32, boxSizing: 'border-box' }}
                />
                <Filter size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
              </div>
              <select value={leadStatusFilter} onChange={e => { setLeadStatusFilter(e.target.value); loadLeads(1, leadSearch, e.target.value, leadDateFilter); }} style={{ minWidth: 140 }}>
                <option value="">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>
              <select value={leadDateFilter} onChange={e => { setLeadDateFilter(e.target.value); loadLeads(1, leadSearch, leadStatusFilter, e.target.value); }} style={{ minWidth: 130 }}>
                <option value="">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <button className="icon-btn" onClick={() => loadLeads(1, leadSearch, leadStatusFilter, leadDateFilter)} title="Refresh">
                <RefreshCw size={15} />
              </button>
            </div>

            {/* Table */}
            {leadLoading ? (
              <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" /></div>
            ) : leads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-3)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <UserPlus size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
                <div style={{ fontWeight: 600 }}>No leads found</div>
                <div style={{ fontSize: '0.82rem', marginTop: 4 }}>Leads captured from the site will appear here.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Name', 'Mobile', 'Email', 'Status', 'Products Viewed', 'Last Activity', 'Source', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead, idx) => (
                      <tr key={lead.id} style={{ borderBottom: idx < leads.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{lead.name || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {lead.mobile ? <><Phone size={11} style={{ marginRight: 4, verticalAlign: 'middle', opacity: 0.5 }} />{lead.mobile}</> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '0.85rem' }}>{lead.email || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 9px', borderRadius: 20,
                            fontSize: '0.73rem', fontWeight: 600, whiteSpace: 'nowrap',
                            background: LEAD_STATUS[lead.status]?.bg ?? '#f3f4f6',
                            color: LEAD_STATUS[lead.status]?.color ?? '#374151',
                          }}>
                            {LEAD_STATUS[lead.status]?.label ?? lead.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 180 }}>
                            {(lead.products_viewed ?? []).slice(0, 2).map((p, i) => (
                              <span key={i} title={p.name} style={{ fontSize: '0.72rem', padding: '1px 6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.name || p.id}
                              </span>
                            ))}
                            {(lead.products_viewed ?? []).length > 2 && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>+{lead.products_viewed.length - 2}</span>
                            )}
                            {!(lead.products_viewed?.length) && <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>—</span>}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                          {new Date(lead.last_activity).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-3)' }}>{lead.source}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="icon-btn" title="Edit" onClick={() => { setEditingLead(lead); setLeadEditForm({ status: lead.status, notes: lead.notes ?? '', name: lead.name, mobile: lead.mobile, email: lead.email }); }}>
                              <Edit3 size={14} />
                            </button>
                            <button className="icon-btn" title="Delete" style={{ color: 'var(--error, #ef4444)' }}
                              onClick={() => { if (window.confirm(`Delete lead "${lead.name || lead.email || lead.mobile}"?`)) deleteLead(lead.id); }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {leadPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>{leadTotal} leads · Page {leadPage} of {leadPages}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline" style={{ padding: '5px 14px', fontSize: '0.85rem' }} disabled={leadPage <= 1}
                    onClick={() => loadLeads(leadPage - 1, leadSearch, leadStatusFilter, leadDateFilter)}>← Prev</button>
                  <button className="btn btn-outline" style={{ padding: '5px 14px', fontSize: '0.85rem' }} disabled={leadPage >= leadPages}
                    onClick={() => loadLeads(leadPage + 1, leadSearch, leadStatusFilter, leadDateFilter)}>Next →</button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Analytics Tab */}
        {tab === 'analytics' && analytics && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="stats-grid">
              {[
                { label: 'Total Revenue', value: `₹${analytics.totalRevenue.toFixed(0)}`, icon: <IndianRupee size={24} />, color: '#10b981', sub: `Products: ₹${analytics.normalRevenue.toFixed(0)} · Custom: ₹${analytics.designRevenue.toFixed(0)}` },
                { label: 'Total Orders', value: analytics.totalOrders, icon: <ShoppingCart size={24} />, color: '#6366f1', sub: `Products: ${analytics.normalOrders} · Custom: ${analytics.designOrders}` },
                { label: 'Total Products', value: analytics.totalProducts, icon: <Package size={24} />, color: '#8b5cf6' },
                { label: 'Total Users', value: analytics.totalUsers, icon: <Users size={24} />, color: '#f59e0b' },
              ].map((s, i) => (
                <motion.div key={s.label} className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  style={{ '--stat-color': s.color } as React.CSSProperties}>
                  <div className="stat-icon">{s.icon}</div>
                  <div>
                    <p className="stat-value">{s.value}</p>
                    <p className="stat-label">{s.label}</p>
                    {'sub' in s && s.sub && <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{s.sub}</p>}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Revenue Chart */}
            <div className="analytics-section">
              <h2><TrendingUp size={20} /> Revenue (Last 30 Days)</h2>
              {analytics.dailyRevenue.length > 0 ? (
                <div className="revenue-chart">
                  {analytics.dailyRevenue.map(d => {
                    const maxRev = Math.max(...analytics.dailyRevenue.map(x => x.revenue), 1);
                    const pct = (d.revenue / maxRev) * 100;
                    return (
                      <div key={d.date} className="chart-bar-wrapper" title={`${new Date(d.date).toLocaleDateString('en-IN')}: ₹${d.revenue.toFixed(0)} (${d.orders} orders)`}>
                        <div className="chart-bar" style={{ height: `${Math.max(pct, 4)}%` }} />
                        <span className="chart-label">{new Date(d.date).getDate()}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-msg">No revenue data in the last 30 days.</p>
              )}
            </div>

            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>Order Status</h3>
                <div className="status-breakdown">
                  {Object.entries(analytics.ordersByStatus).map(([status, count]) => (
                    <div key={status} className="status-row">
                      <span className={`status-badge status-${status}`}>{status}</span>
                      <span className="status-count">{count}</span>
                    </div>
                  ))}
                  {Object.keys(analytics.ordersByStatus).length === 0 && <p className="empty-msg">No orders yet.</p>}
                </div>
              </div>

              <div className="analytics-card">
                <h3>Top Products</h3>
                <div className="top-products-list">
                  {analytics.topProducts.map((p, i) => (
                    <div key={p.name} className="top-product-row">
                      <span className="rank">#{i + 1}</span>
                      <span className="product-name">{p.name}</span>
                      <span className="product-qty">{p.totalQuantity} sold</span>
                    </div>
                  ))}
                  {analytics.topProducts.length === 0 && <p className="empty-msg">No sales data yet.</p>}
                </div>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="analytics-section">
              <h2>Recent Orders (All Types)</h2>
              {analytics.recentOrders.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ID</th><th>Type</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {analytics.recentOrders.map((o: any) => (
                        <tr key={o.id}>
                          <td><code>{o.id.slice(0, 8)}</code></td>
                          <td>
                            <span style={{
                              fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4,
                              background: o.orderType === 'custom' ? '#6366f120' : '#10b98120',
                              color: o.orderType === 'custom' ? '#6366f1' : '#10b981',
                              fontWeight: 600,
                            }}>
                              {o.orderType === 'custom' ? 'Custom' : 'Product'}
                            </span>
                          </td>
                          <td>{o.customerName || (o.userId ? o.userId.slice(0, 8) + '…' : '—')}</td>
                          <td>₹{o.total.toFixed(2)}</td>
                          <td><span className={`status-badge status-${o.status}`}>{o.status}</span></td>
                          <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-msg">No orders yet.</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Products Tab */}
        {tab === 'products' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="section-toolbar">
              <h2>Products ({products.length})</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" style={{ background: 'var(--primary-50)', color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 700 }} onClick={async () => {
                  if (!confirm(`Seed ~150 products from the full catalog. Existing products will have their images & details updated. Continue?`)) return;
                  try {
                    toast.loading('Seeding catalog…', { id: 'seed' });
                    const r = await api.seedProductCatalog();
                    toast.success(`Updated ${r.added + r.skipped} products`, { id: 'seed' });
                    const fresh = await api.getProducts();
                    setProducts(fresh);
                  } catch (e: any) { toast.error(e.message || 'Seed failed', { id: 'seed' }); }
                }}>
                  <Download size={14} /> Seed / Sync Catalog
                </button>
                <button className="btn btn-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 700 }} onClick={async () => {
                  if (!confirm('⚠️ DELETE ALL products and categories? This cannot be undone.')) return;
                  if (!confirm('Are you absolutely sure? Type OK in the next prompt to confirm.')) return;
                  try {
                    toast.loading('Deleting all products…', { id: 'delall' });
                    await api.deleteAllProducts();
                    toast.success('All products deleted', { id: 'delall' });
                    setProducts([]);
                  } catch (e: any) { toast.error(e.message || 'Delete failed', { id: 'delall' }); }
                }}>
                  <Trash2 size={14} /> Delete All
                </button>
                <button className="btn btn-primary" onClick={openNewProduct}><Plus size={16} /> Add Product</button>
              </div>
            </div>

            {/* Search bar */}
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Search by name, SKU, or category…"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                style={{ width: '100%', maxWidth: 400, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem' }}
              />
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>SKU / Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Featured</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products
                    .filter(p => {
                      if (!productSearch) return true;
                      const q = productSearch.toLowerCase();
                      return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
                    })
                    .map(p => {
                      const outOfStock = (p.stock ?? 0) === 0;
                      const lowStock = !outOfStock && (p.stock ?? 0) <= 10;
                      return (
                        <tr key={p.id}>
                          <td>
                            <img src={p.image || (p.images && p.images[0]) || ''} alt={p.name} className="table-thumb"
                              onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/56x56/e2e8f0/94a3b8?text=No+Img'; }} />
                          </td>
                          <td>
                            <strong style={{ display: 'block' }}>
                              {p.name}
                              {p.collectionOnly && <span style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 6px', background: '#ede9fe', color: '#5b21b6', borderRadius: 10, verticalAlign: 'middle', fontWeight: 600 }}>Collection</span>}
                            </strong>
                            <code style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{(p as any).slug || p.id}</code>
                          </td>
                          <td>{p.category}</td>
                          <td>₹{p.price.toFixed(0)}</td>
                          <td>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                              background: outOfStock ? '#fef2f2' : lowStock ? '#fffbeb' : '#f0fdf4',
                              color: outOfStock ? '#ef4444' : lowStock ? '#d97706' : '#16a34a',
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                              {outOfStock ? 'Out of Stock' : lowStock ? `Low (${p.stock})` : p.stock}
                            </span>
                          </td>
                          <td>{p.featured ? <span style={{ color: 'var(--primary)', fontWeight: 700 }}>★</span> : '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button
                              className="icon-btn"
                              title={outOfStock ? 'Mark In Stock (100)' : 'Mark Out of Stock'}
                              style={{ color: outOfStock ? '#16a34a' : '#ef4444' }}
                              onClick={async () => {
                                const newStock = outOfStock ? 100 : 0;
                                try {
                                  await api.patchProductStock(p.id, newStock);
                                  setProducts(prev => prev.map(x => x.id === p.id ? { ...x, stock: newStock } : x));
                                  toast.success(newStock === 0 ? 'Marked out of stock' : 'Marked in stock');
                                } catch { toast.error('Failed to update stock'); }
                              }}
                            >
                              {outOfStock ? <Eye size={15} /> : <EyeOff size={15} />}
                            </button>
                            <button className="icon-btn" title="Preview product page" onClick={() => window.open(`/products/${p.slug || p.id}`, '_blank')}><ExternalLink size={15} /></button>
                            <button className="icon-btn" title="Edit product" onClick={() => openEditProduct(p)}><Edit3 size={16} /></button>
                            <button className="icon-btn danger" title="Delete product" onClick={() => handleDeleteProduct(p.id)}><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Categories Tab */}
        {tab === 'categories' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="section-header">
              <h2>Categories ({categories.length})</h2>
              <button className="btn btn-primary" onClick={openNewCategory}><Plus size={16} /> Add Category</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>SLUG</th>
                    <th>TOKEN ID</th>
                    <th>PRODUCTS</th>
                    <th>CREATED</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => {
                    const productCount = products.filter(p => (p as any).categoryId === cat.id || p.category === cat.name).length;
                    return (
                      <tr key={cat.id}>
                        <td><strong>{cat.name}</strong></td>
                        <td><code className="cat-slug">{cat.slug}</code></td>
                        <td>
                          <div className="cat-token-cell">
                            <code className="cat-token">{cat.id}</code>
                            <button
                              className="icon-btn cat-copy-btn"
                              title="Copy token ID"
                              onClick={() => handleCopyId(cat.id)}
                            >
                              {copiedId === cat.id ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </td>
                        <td>{productCount}</td>
                        <td>{new Date(cat.createdAt).toLocaleDateString()}</td>
                        <td>
                          <button className="icon-btn" onClick={() => openEditCategory(cat)}><Edit3 size={16} /></button>
                          <button className="icon-btn danger" onClick={() => handleDeleteCategory(cat.id)}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {categories.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>No categories yet. Create one to get started.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Category Form Modal */}
            <AnimatePresence>
              {showCategoryForm && (
                <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeCategoryForm}>
                  <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h2>{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
                      <button className="icon-btn" onClick={closeCategoryForm}><X size={20} /></button>
                    </div>
                    <form onSubmit={handleSaveCategory} className="modal-body">
                      {editingCategory && (
                        <div className="form-group">
                          <label>Token ID <span style={{ fontSize: '0.72rem', color: '#666' }}>(unique identifier — read only)</span></label>
                          <div className="cat-token-display">
                            <code>{editingCategory.id}</code>
                            <button type="button" className="icon-btn cat-copy-btn" title="Copy" onClick={() => handleCopyId(editingCategory.id)}>
                              {copiedId === editingCategory.id ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="form-group">
                        <label>Category Name *</label>
                        <input
                          type="text"
                          value={categoryFormName}
                          onChange={e => setCategoryFormName(e.target.value)}
                          placeholder="e.g. T-Shirts"
                          required
                          autoFocus
                        />
                        {categoryFormName && (
                          <p className="cat-slug-preview">
                            Slug: <code>{categoryFormName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}</code>
                          </p>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Default Product Image <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.78rem' }}>— auto-fills new product image when this category is selected</span></label>
                        <div className="image-input-group">
                          <input
                            type="text"
                            value={categoryFormImage}
                            onChange={e => setCategoryFormImage(e.target.value)}
                            placeholder="Paste image URL…"
                          />
                          <label className="btn btn-ghost upload-btn" title="Upload image">
                            {uploadingField === 'categoryImage' ? <div className="spinner-sm" /> : <><Upload size={14} /> Upload</>}
                            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async e => {
                              const f = e.target.files?.[0]; if (!f) return;
                              setUploadingField('categoryImage');
                              try {
                                const { url } = await api.uploadProductImage(f);
                                setCategoryFormImage(url);
                              } catch (err: any) { toast.error(err.message || 'Upload failed'); }
                              finally { setUploadingField(null); e.target.value = ''; }
                            }} />
                          </label>
                        </div>
                        {categoryFormImage && (
                          <img src={categoryFormImage} alt="Category preview" style={{ marginTop: 8, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                      </div>

                      {/* ── Size Chart Editor ── */}
                      <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!categoryFormSizeChart} onChange={e => {
                            if (e.target.checked) {
                              setCategoryFormSizeChart({ unit: 'inches', headers: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'], rows: [{ label: 'Chest', values: ['', '', '', '', '', '', ''] }, { label: 'Length', values: ['', '', '', '', '', '', ''] }] });
                            } else {
                              setCategoryFormSizeChart(null);
                            }
                          }} />
                          Include Size Chart <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.78rem' }}>— auto-shown on product pages in this category</span>
                        </label>

                        {categoryFormSizeChart && (
                          <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                            {/* Unit */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                              <span style={{ fontSize: '.82rem', fontWeight: 600 }}>Unit:</span>
                              {['inches', 'cm'].map(u => (
                                <label key={u} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '.82rem' }}>
                                  <input type="radio" name="catChartUnit" value={u} checked={categoryFormSizeChart.unit === u}
                                    onChange={() => setCategoryFormSizeChart(c => c ? { ...c, unit: u } : c)} />
                                  {u}
                                </label>
                              ))}
                            </div>

                            {/* Column headers */}
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: '.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>SIZE COLUMNS</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                {categoryFormSizeChart.headers.map((h, hi) => (
                                  <div key={hi} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <input type="text" value={h}
                                      onChange={e => {
                                        const nh = [...categoryFormSizeChart.headers]; nh[hi] = e.target.value;
                                        setCategoryFormSizeChart(c => c ? { ...c, headers: nh } : c);
                                      }}
                                      style={{ width: 48, fontSize: '0.8rem', padding: '3px 5px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                                    />
                                    <button type="button" onClick={() => {
                                      const nh = categoryFormSizeChart.headers.filter((_, i) => i !== hi);
                                      const nr = categoryFormSizeChart.rows.map(r => ({ ...r, values: r.values.filter((_, i) => i !== hi) }));
                                      setCategoryFormSizeChart(c => c ? { ...c, headers: nh, rows: nr } : c);
                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 2px', lineHeight: 1 }}>×</button>
                                  </div>
                                ))}
                                <button type="button" className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                                  onClick={() => {
                                    const nh = [...categoryFormSizeChart.headers, ''];
                                    const nr = categoryFormSizeChart.rows.map(r => ({ ...r, values: [...r.values, ''] }));
                                    setCategoryFormSizeChart(c => c ? { ...c, headers: nh, rows: nr } : c);
                                  }}>+ Column</button>
                              </div>
                            </div>

                            {/* Rows */}
                            <div>
                              <div style={{ fontSize: '.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>MEASUREMENTS</div>
                              {categoryFormSizeChart.rows.map((row, ri) => (
                                <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                                  <input type="text" value={row.label} placeholder="e.g. Chest"
                                    onChange={e => {
                                      const nr = [...categoryFormSizeChart.rows];
                                      nr[ri] = { ...nr[ri], label: e.target.value };
                                      setCategoryFormSizeChart(c => c ? { ...c, rows: nr } : c);
                                    }}
                                    style={{ width: 80, fontSize: '0.8rem', padding: '3px 5px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 500 }}
                                  />
                                  {row.values.map((val, vi) => (
                                    <input key={vi} type="text" value={val}
                                      onChange={e => {
                                        const nr = [...categoryFormSizeChart.rows];
                                        const nv = [...nr[ri].values]; nv[vi] = e.target.value;
                                        nr[ri] = { ...nr[ri], values: nv };
                                        setCategoryFormSizeChart(c => c ? { ...c, rows: nr } : c);
                                      }}
                                      style={{ width: 40, fontSize: '0.8rem', padding: '3px 4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textAlign: 'center' }}
                                    />
                                  ))}
                                  <button type="button" onClick={() => {
                                    const nr = categoryFormSizeChart.rows.filter((_, i) => i !== ri);
                                    setCategoryFormSizeChart(c => c ? { ...c, rows: nr } : c);
                                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}
                              <button type="button" className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: '0.78rem', marginTop: 4 }}
                                onClick={() => {
                                  const nr = [...categoryFormSizeChart.rows, { label: '', values: categoryFormSizeChart.headers.map(() => '') }];
                                  setCategoryFormSizeChart(c => c ? { ...c, rows: nr } : c);
                                }}>+ Row</button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={closeCategoryForm}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={savingCategory}>
                          {savingCategory ? <div className="spinner-sm" /> : <><Save size={16} /> {editingCategory ? 'Update' : 'Create'}</>}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Mockup Categories Tab */}
        {tab === 'mockup-categories' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="section-header">
              <h2>Mockup Categories ({mockupCategories.length})</h2>
              <button className="btn btn-primary" onClick={openNewMockupCategory}><Plus size={16} /> Add Category</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>SLUG</th>
                    <th>TOKEN ID</th>
                    <th>MOCKUPS</th>
                    <th>CREATED</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {mockupCategories.map(cat => {
                    const mockupCount = mockups.filter(m => m.category === cat.name).length;
                    return (
                      <tr key={cat.id}>
                        <td><strong>{cat.name}</strong></td>
                        <td><code className="cat-slug">{cat.slug}</code></td>
                        <td>
                          <div className="cat-token-cell">
                            <code className="cat-token">{cat.id}</code>
                            <button className="icon-btn cat-copy-btn" title="Copy token ID" onClick={() => handleCopyMockupCatId(cat.id)}>
                              {copiedMockupCatId === cat.id ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </td>
                        <td>{mockupCount}</td>
                        <td>{new Date(cat.createdAt).toLocaleDateString()}</td>
                        <td>
                          <button className="icon-btn" onClick={() => openEditMockupCategory(cat)}><Edit3 size={16} /></button>
                          <button className="icon-btn danger" onClick={() => handleDeleteMockupCategory(cat.id)}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {mockupCategories.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>No mockup categories yet. Create one to get started.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mockup Category Form Modal */}
            <AnimatePresence>
              {showMockupCategoryForm && (
                <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeMockupCategoryForm}>
                  <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h2>{editingMockupCategory ? 'Edit Mockup Category' : 'Add Mockup Category'}</h2>
                      <button className="icon-btn" onClick={closeMockupCategoryForm}><X size={20} /></button>
                    </div>
                    <form onSubmit={handleSaveMockupCategory} className="modal-body">
                      {editingMockupCategory && (
                        <div className="form-group">
                          <label>Token ID <span style={{ fontSize: '0.72rem', color: '#666' }}>(read only)</span></label>
                          <div className="cat-token-display">
                            <code>{editingMockupCategory.id}</code>
                            <button type="button" className="icon-btn cat-copy-btn" title="Copy" onClick={() => handleCopyMockupCatId(editingMockupCategory.id)}>
                              {copiedMockupCatId === editingMockupCategory.id ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="form-group">
                        <label>Category Name *</label>
                        <input
                          type="text"
                          value={mockupCategoryFormName}
                          onChange={e => setMockupCategoryFormName(e.target.value)}
                          placeholder="e.g. T-Shirts"
                          required
                          autoFocus
                        />
                        {mockupCategoryFormName && (
                          <p className="cat-slug-preview">
                            Slug: <code>{mockupCategoryFormName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}</code>
                          </p>
                        )}
                      </div>
                      <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={closeMockupCategoryForm}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={savingMockupCategory}>
                          {savingMockupCategory ? <div className="spinner-sm" /> : <><Save size={16} /> {editingMockupCategory ? 'Update' : 'Create'}</>}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Orders Tab */}
        {tab === 'orders' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2>Orders ({adminOrderEntries.length})</h2>
            {adminOrderEntries.length === 0 ? (
              <p className="empty-msg">No orders yet.</p>
            ) : (
              <div className="order-cards">
                {adminOrderEntries.map(entry => {
                  const { productOrder: po, designOrders: dOrders } = entry;
                  const isCombined = !!po && dOrders.length > 0;
                  const entryKey = entry.key;
                  const isExpanded = expandedOrder === entryKey;
                  const overallTotal = (po?.total ?? 0) + dOrders.reduce((s, d) => s + d.total, 0);
                  const primaryStatus = po?.status ?? dOrders[0]?.status;
                  const firstDesignImage = dOrders[0] ? Object.values(dOrders[0].designImages || {}).find(img => img) : undefined;
                  return (
                    <motion.div key={entryKey} className={`order-card ${isExpanded ? 'expanded' : ''}`}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="order-card-header" onClick={() => setExpandedOrder(isExpanded ? null : entryKey)}>
                        <div className="order-card-col">
                          <Hash size={14} />
                          <code style={{ fontSize: '0.85rem' }}>
                            {(po?.id ?? dOrders[0]?.id ?? '').slice(0, 8)}
                          </code>
                        </div>
                        <div className="order-card-col">
                          {isCombined ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Package size={13} /><Palette size={13} />
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>Product + Design</span>
                            </span>
                          ) : po ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                              <Package size={13} />
                              {po.items[0]?.productName || po.items[0]?.productId?.slice(0, 8) || '—'}
                              {po.items.length > 1 && <span style={{ color: 'var(--text-3)' }}>+{po.items.length - 1}</span>}
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {firstDesignImage && <img src={firstDesignImage} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, background: '#1e293b' }} />}
                              <span style={{ fontSize: '0.85rem' }}>{dOrders[0]?.productName || PRODUCT_LABELS[dOrders[0]?.productType || ''] || dOrders[0]?.productType}</span>
                            </span>
                          )}
                        </div>
                        <div className="order-card-col">
                          <IndianRupee size={14} />
                          <strong>₹{overallTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div className="order-card-col">
                          <span className={`status-badge status-${primaryStatus}`}>{primaryStatus}</span>
                        </div>
                        <div className="order-card-col">
                          <Clock size={14} />
                          <span>{new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="order-card-col" style={{ marginLeft: 'auto' }}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div className="order-card-detail"
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                            <div className="order-detail-inner">
                              {/* Customer + Address info */}
                              <div className="order-info-grid">
                                <div className="order-info-block">
                                  <h4><User size={15} /> Customer</h4>
                                  <p>{po?.customerName ?? dOrders[0]?.customerName ?? '—'}</p>
                                  {(po?.customerEmail ?? dOrders[0]?.customerEmail) && (
                                    <p className="order-meta"><Mail size={13} /> {po?.customerEmail ?? dOrders[0]?.customerEmail}</p>
                                  )}
                                  <p className="order-meta">User ID: {(po?.userId ?? dOrders[0]?.userId ?? '').slice(0, 12)}...</p>
                                </div>
                                <div className="order-info-block">
                                  <h4><MapPin size={15} /> Shipping Address</h4>
                                  <p style={{ whiteSpace: 'pre-wrap' }}>{po?.shippingAddress ?? dOrders[0]?.shippingAddress ?? '—'}</p>
                                </div>
                                <div className="order-info-block">
                                  <h4><Clock size={15} /> Order Info</h4>
                                  <p>Placed: {new Date(entry.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                  {isCombined && <p style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: 4 }}>Single order — product + custom design</p>}
                                </div>
                              </div>

                              {/* ── Normal Product Items ── */}
                              {po && (
                                <div className="order-section-block">
                                  <div className="order-section-divider">
                                    <Package size={14} />
                                    <span>Products</span>
                                  </div>
                                  <div className="order-items-list">
                                    {po.items.map((item, idx) => {
                                      const product = products.find(p => p.id === item.productId);
                                      const imgSrc = item.productImage || product?.image || '';
                                      const name = item.productName || product?.name || item.productId.slice(0, 8);
                                      return (
                                        <div key={idx} className="order-item-row">
                                          <div className="order-item-img">
                                            {imgSrc ? <img src={imgSrc} alt={name} /> : <div className="order-item-no-img"><Image size={24} /></div>}
                                          </div>
                                          <div className="order-item-info">
                                            <p className="order-item-name">{name}</p>
                                            <div className="order-item-meta">
                                              {item.color && (<span className="order-item-tag"><span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block', border: '1px solid var(--border)' }} />{item.color}</span>)}
                                              {item.size && <span className="order-item-tag">Size: {item.size}</span>}
                                              <span className="order-item-tag">Qty: {item.quantity}</span>
                                              {item.customText && <span className="order-item-tag">Custom: &quot;{item.customText}&quot;</span>}
                                            </div>
                                          </div>
                                          <div className="order-item-price">₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="order-total-row">
                                    <span>Products Total</span>
                                    <strong>₹{po.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                  </div>
                                  {po.discountAmount != null && po.discountAmount > 0 && (
                                    <div className="order-total-row" style={{ color: '#10b981', fontSize: '0.82rem' }}>
                                      <span>Coupon {po.couponCode ? `(${po.couponCode})` : ''} Discount</span>
                                      <span>−₹{Number(po.discountAmount).toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── Custom Design Items ── */}
                              {dOrders.map(o => {
                                const hasSourceFiles = (ord: DesignOrder) => Object.values(ord.uploadedImages || {}).some(imgs => imgs.length > 0);
                                return (
                                  <div key={o.id} className="order-section-block">
                                    <div className="order-section-divider">
                                      <Palette size={14} />
                                      <span>Custom Design</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, padding: '10px 0' }}>
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Product</strong><p style={{ margin: '4px 0 0' }}>{o.productName || PRODUCT_LABELS[o.productType] || o.productType}</p></div>
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Color</strong><p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: '50%', background: o.colorHex, border: o.colorHex === '#ffffff' ? '2px solid #555' : 'none', display: 'inline-block' }} />{o.colorName}</p></div>
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Print Size</strong><p style={{ textTransform: 'capitalize', margin: '4px 0 0' }}>{o.printSize}</p></div>
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Sides</strong><p style={{ margin: '4px 0 0' }}>{(o.sides || []).join(', ')}</p></div>
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Quantity</strong><p style={{ margin: '4px 0 0' }}>{o.quantity}</p></div>
                                    </div>
                                    <div className="order-total-row"><span>Design Total</span><strong>₹{o.total.toLocaleString()}</strong></div>

                                    {/* Design mockup images */}
                                    {Object.values(o.designImages || {}).some(img => img) && (
                                      <div style={{ marginTop: 14 }}>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Image size={14} /> Design Mockups</p>
                                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                          {Object.entries(o.designImages || {}).map(([side, dataUrl]) => {
                                            if (!dataUrl) return null;
                                            return (
                                              <div key={side} style={{ flex: '1 1 220px', background: 'var(--bg-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                  <strong style={{ textTransform: 'uppercase', fontSize: '0.78rem' }}>{side}</strong>
                                                  <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); handleDownloadDesign(dataUrl, o.id, side); }}>
                                                    <Download size={13} /> Download
                                                  </button>
                                                </div>
                                                <img src={dataUrl} alt={`${side} design`} style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 6, background: '#1e293b' }} />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Source files */}
                                    {hasSourceFiles(o) && (
                                      <div style={{ marginTop: 14 }}>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={14} /> Customer Uploaded Files</p>
                                        {Object.entries(o.uploadedImages || {}).map(([side, imgs]) => (
                                          <div key={side} style={{ marginBottom: 12 }}>
                                            <strong style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>{side} — {imgs.length} file{imgs.length !== 1 ? 's' : ''}</strong>
                                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                              {imgs.map((src, idx) => (
                                                <div key={idx} style={{ position: 'relative', width: 130 }}>
                                                  <img src={src} alt={`${side} source ${idx + 1}`} style={{ width: '100%', height: 130, objectFit: 'contain', borderRadius: 8, background: '#1e293b', border: '1px solid var(--border)' }} />
                                                  <a href={src} download={`source-${o.id.slice(0, 8)}-${side.toLowerCase()}-${idx + 1}.png`} className="btn btn-primary" onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>
                                                    <Download size={12} /> Download
                                                  </a>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Bulk download actions */}
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--border)' }}>
                                      <button className="btn btn-primary" onClick={e => { e.stopPropagation(); handleDownloadAllSides(o); }}>
                                        <Download size={14} /> Download All Mockups
                                      </button>
                                      {hasSourceFiles(o) && (<>
                                        <button className="btn btn-primary" style={{ background: '#0891b2' }} onClick={e => { e.stopPropagation(); handleDownloadSourceFiles(o); }}>
                                          <Upload size={14} /> Download All Source Files
                                        </button>
                                        <button className="btn btn-outline" onClick={e => { e.stopPropagation(); handleDownloadEverything(o); }}>
                                          <Download size={14} /> Download Everything
                                        </button>
                                      </>)}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* ── Actions (status + shipment) at the bottom ── */}
                              <div className="order-actions-footer">
                                {/* Product order actions */}
                                {po && (
                                  <div className="order-action-group">
                                    {isCombined && <p className="order-action-label"><Package size={13} /> Normal Order Actions</p>}
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                      <div>
                                        <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Update Status</label>
                                        <select value={po.status} onChange={e => handleStatusChange(po.id, e.target.value)} onClick={e => e.stopPropagation()}>
                                          {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                      </div>
                                      {po.shipment ? (
                                        <div className="order-tracking">
                                          <Truck size={14} /> {po.shipment.courierName || 'Shipment created'}
                                          {po.shipment.awbCode && <span className="track-status"> AWB: {po.shipment.awbCode}</span>}
                                          <button className="btn btn-sm btn-outline" style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); openTrackingModal(po); }}>
                                            <MapPin size={12} /> Manage Tracking
                                          </button>
                                        </div>
                                      ) : po.status !== 'cancelled' && (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                          <button className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); handleCreateShipment(po.id); }} disabled={creatingShipmentFor === po.id}>
                                            <Truck size={14} />{creatingShipmentFor === po.id ? 'Creating...' : 'Create Shipment'}
                                          </button>
                                          <button className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); openTrackingModal(po); }}>
                                            <MapPin size={14} /> Add Tracking
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Design order actions */}
                                {dOrders.map(o => (
                                  <div key={o.id} className="order-action-group">
                                    {isCombined && <p className="order-action-label"><Palette size={13} /> Custom Design Actions</p>}
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                      <div>
                                        <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Update Status</label>
                                        <select value={o.status} onChange={e => handleDesignStatusChange(o.id, e.target.value)} onClick={e => e.stopPropagation()}>
                                          {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                      </div>
                                      {o.shipment ? (
                                        <div className="order-tracking">
                                          <Truck size={14} /> {o.shipment.courierName || 'Shipment created'}
                                          {o.shipment.awbCode && <span className="track-status"> AWB: {o.shipment.awbCode}</span>}
                                          <button className="btn btn-sm btn-outline" style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); openTrackingModal({ ...o, items: [{ productId: o.productType, productName: `Custom ${o.productType}`, quantity: o.quantity, price: o.unitPrice }] } as any); }}>
                                            <MapPin size={12} /> Manage Tracking
                                          </button>
                                        </div>
                                      ) : o.status !== 'cancelled' && (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                          <button className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); handleCreateDesignShipment(o.id); }} disabled={creatingShipmentFor === o.id}>
                                            <Truck size={14} />{creatingShipmentFor === o.id ? 'Creating...' : 'Create Shipment'}
                                          </button>
                                          <button className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); openTrackingModal({ ...o, items: [{ productId: o.productType, productName: `Custom ${o.productType}`, quantity: o.quantity, price: o.unitPrice }] } as any); }}>
                                            <MapPin size={14} /> Add Tracking
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Mockups Tab */}
        {tab === 'mockups' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="section-toolbar">
              <h2>Mockup Templates ({mockups.length})</h2>
              <button className="btn btn-primary" onClick={openNewMockup}><Plus size={16} /> Add Mockup</button>
            </div>
            <p className="section-desc">Manage mockup templates used in the Design Studio. Upload front/back images and shadow overlays.</p>
            <div className="mockup-grid">
              {mockups.map(m => (
                <motion.div key={m.id} className={`mockup-card ${m.active ? '' : 'inactive'}`}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="mockup-thumb">
                    <img src={m.frontImage} alt={m.name} />
                    {!m.active && <div className="mockup-inactive-badge">Disabled</div>}
                  </div>
                  <div className="mockup-info">
                    <h3>{m.name}</h3>
                    <span className="mockup-category">{m.category}</span>
                    <div className="mockup-meta">
                      {m.backImage && <span title="Has back image">↔ Back</span>}
                      {m.frontShadow && <span title="Has shadow">Shadow</span>}
                    </div>
                  </div>
                  <div className="mockup-actions">
                    <button className="icon-btn" onClick={() => handleToggleMockup(m)} title={m.active ? 'Disable' : 'Enable'}>
                      {m.active ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button className="icon-btn" onClick={() => openEditMockup(m)}><Edit3 size={16} /></button>
                    <button className="icon-btn danger" onClick={() => handleDeleteMockup(m.id)}><Trash2 size={16} /></button>
                  </div>
                </motion.div>
              ))}
              {mockups.length === 0 && <p className="empty-msg">No mockups yet. Add your first mockup template!</p>}
            </div>
          </motion.div>
        )}

        {/* Coupons Tab */}
        {tab === 'coupons' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="section-toolbar">
              <h2>Coupon Codes</h2>
              <button className="btn btn-primary" onClick={openNewCoupon}><Plus size={16} /> New Coupon</button>
            </div>
            {coupons.length === 0 ? (
              <p className="empty-msg">No coupons yet. Create your first coupon code above.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Discount</th>
                      <th>Min Order</th>
                      <th>Uses</th>
                      <th>Valid Until</th>
                      <th>Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map(c => (
                      <tr key={c.id}>
                        <td><code style={{ fontWeight: 700, color: '#6366f1' }}>{c.code}</code></td>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{c.description || '—'}</td>
                        <td>
                          {c.discountType === 'percentage'
                            ? <span style={{ color: '#f59e0b' }}>{c.discountValue}%</span>
                            : <span style={{ color: '#10b981' }}>₹{c.discountValue}</span>}
                        </td>
                        <td>{c.minOrderAmount ? `₹${c.minOrderAmount}` : '—'}</td>
                        <td>{c.useCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}</td>
                        <td style={{ fontSize: '0.82rem' }}>{c.validUntil ? new Date(c.validUntil).toLocaleDateString('en-IN') : '—'}</td>
                        <td>
                          <span style={{ color: c.active ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.82rem' }}>
                            {c.active ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="icon-btn" onClick={() => openEditCoupon(c)} title="Edit"><Edit3 size={15} /></button>
                            <button className="icon-btn danger" onClick={() => handleDeleteCoupon(c.id)} title="Delete"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* Coupon Form Modal */}
        <AnimatePresence>
          {showCouponForm && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeCouponForm}>
              <motion.div className="modal cpn-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}>
                <div className="modal-header cpn-header">
                  <div className="cpn-header-left">
                    <div className="cpn-header-icon"><Tag size={18} /></div>
                    <div>
                      <h2>{editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}</h2>
                      <p className="cpn-header-sub">Set up a discount code for your customers</p>
                    </div>
                  </div>
                  <button className="icon-btn" onClick={closeCouponForm}><X size={18} /></button>
                </div>
                <form onSubmit={handleSaveCoupon} className="modal-body">

                  {/* Section: Basic Info */}
                  <div className="cpn-section">
                    <h4 className="cpn-section-title"><Hash size={14} /> Coupon Details</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Coupon Code *</label>
                        <input type="text" value={couponForm.code || ''} onChange={e => setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                          placeholder="e.g. SAVE20" required style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }} />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <input type="text" value={couponForm.description || ''} onChange={e => setCouponForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Internal note (not shown to customers)" />
                      </div>
                    </div>
                  </div>

                  {/* Section: Discount */}
                  <div className="cpn-section">
                    <h4 className="cpn-section-title"><Percent size={14} /> Discount</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Type *</label>
                        <select value={couponForm.discountType || 'percentage'} onChange={e => setCouponForm(f => ({ ...f, discountType: e.target.value as 'percentage' | 'fixed' }))}>
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (₹)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Value *</label>
                        <input type="number" min="0" step="0.01" value={couponForm.discountValue ?? ''} onChange={e => setCouponForm(f => ({ ...f, discountValue: parseFloat(e.target.value) }))}
                          placeholder={couponForm.discountType === 'percentage' ? 'e.g. 20' : 'e.g. 200'} required />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Min Order Amount (₹)</label>
                        <input type="number" min="0" step="0.01" value={couponForm.minOrderAmount ?? ''} onChange={e => setCouponForm(f => ({ ...f, minOrderAmount: e.target.value ? parseFloat(e.target.value) : undefined }))}
                          placeholder="0 = no minimum" />
                      </div>
                      <div className="form-group">
                        <label>Max Uses</label>
                        <input type="number" min="1" step="1" value={couponForm.maxUses ?? ''} onChange={e => setCouponForm(f => ({ ...f, maxUses: e.target.value ? parseInt(e.target.value) : null }))}
                          placeholder="Blank = unlimited" />
                      </div>
                    </div>
                  </div>

                  {/* Section: Validity */}
                  <div className="cpn-section">
                    <h4 className="cpn-section-title"><Calendar size={14} /> Validity Period <span className="cpn-tz-badge">IST (UTC+5:30)</span></h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Start Date</label>
                        <input type="datetime-local" value={couponForm.validFrom || ''} onChange={e => setCouponForm(f => ({ ...f, validFrom: e.target.value || null }))} />
                        <div className="cpn-presets">
                          <button type="button" onClick={() => setCouponForm(f => ({ ...f, validFrom: istNow() }))}>Now</button>
                          <button type="button" onClick={() => setCouponForm(f => ({ ...f, validFrom: istPreset(0) }))}>Today</button>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>End Date</label>
                        <input type="datetime-local" value={couponForm.validUntil || ''} onChange={e => setCouponForm(f => ({ ...f, validUntil: e.target.value || null }))} />
                        <div className="cpn-presets">
                          <button type="button" onClick={() => setCouponForm(f => ({ ...f, validUntil: istPreset(0, true) }))}>Tonight</button>
                          <button type="button" onClick={() => setCouponForm(f => ({ ...f, validUntil: istPreset(7, true) }))}>+7 Days</button>
                          <button type="button" onClick={() => setCouponForm(f => ({ ...f, validUntil: istPreset(30, true) }))}>+30 Days</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Status & Popup */}
                  <div className="cpn-section cpn-section-toggles">
                    <label className="cpn-toggle-row">
                      <span className="cpn-toggle-info">
                        <strong>Active</strong>
                        <span>Coupon can be used by customers at checkout</span>
                      </span>
                      <input type="checkbox" className="cpn-switch" checked={couponForm.active ?? true} onChange={e => setCouponForm(f => ({ ...f, active: e.target.checked }))} />
                    </label>

                    <div className="cpn-toggle-divider" />

                    <label className="cpn-toggle-row">
                      <span className="cpn-toggle-info">
                        <strong>Show on Banner</strong>
                        <span>Display this coupon in the site announcement bar</span>
                      </span>
                      <input type="checkbox" className="cpn-switch" checked={couponForm.popupEnabled ?? false}
                        onChange={e => setCouponForm(f => ({ ...f, popupEnabled: e.target.checked }))} />
                    </label>

                    {couponForm.popupEnabled && (
                      <div className="form-group cpn-popup-msg">
                        <label>Banner Message</label>
                        <div className="cpn-msg-row">
                          <input type="text" value={couponForm.popupMessage || ''}
                            onChange={e => setCouponForm(f => ({ ...f, popupMessage: e.target.value }))}
                            placeholder="Leave empty for auto-generated message" />
                          <button type="button" className="btn btn-sm btn-outline cpn-autogen-btn" onClick={() => {
                            const val = couponForm.discountType === 'percentage'
                              ? `${couponForm.discountValue}%` : `₹${couponForm.discountValue}`;
                            const code = couponForm.code || 'CODE';
                            const min = couponForm.minOrderAmount && couponForm.minOrderAmount > 0
                              ? ` on orders above ₹${couponForm.minOrderAmount}` : '';
                            const msgs = [
                              `🎉 Get ${val} OFF${min} — use code ${code} at checkout!`,
                              `🔥 Flash Deal! Save ${val}${min} with code ${code}`,
                              `✨ Exclusive ${val} discount${min}! Apply ${code} now`,
                              `🎁 Special offer: ${val} OFF${min} — Code: ${code}`,
                              `💸 Don't miss out! ${val} OFF${min} with ${code}`,
                            ];
                            setCouponForm(f => ({ ...f, popupMessage: msgs[Math.floor(Math.random() * msgs.length)] }));
                          }}>
                            <Sparkles size={13} /> Generate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={closeCouponForm}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={savingCoupon}>
                      {savingCoupon ? <div className="spinner-sm" /> : (editingCoupon ? 'Update Coupon' : 'Create Coupon')}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collections Tab */}
        {tab === 'collections' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="section-header" style={{ marginBottom: 20 }}>
              <h3>Collections</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setEditingCol({})}>
                <Plus size={14} /> New Collection
              </button>
            </div>

            {/* Create / Edit form */}
            {editingCol !== null && (
              <div className="section-card" style={{ marginBottom: 24, padding: 20 }}>
                <h4 style={{ marginBottom: 16 }}>{editingCol.id ? `Edit: ${editingCol.name}` : 'Create Collection'}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
                  {/* Fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                    {[
                      { label: 'Name *', key: 'name', type: 'text', placeholder: 'Marvel Universe' },
                      { label: 'Tagline', key: 'tagline', type: 'text', placeholder: 'With great power...' },
                      { label: 'Tag / Category', key: 'tag', type: 'text', placeholder: 'Comics' },
                      { label: 'Symbol (emoji)', key: 'symbol', type: 'text', placeholder: '⚡' },
                      { label: 'Badge text', key: 'badge', type: 'text', placeholder: 'New' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}</label>
                        <input
                          type={f.type}
                          placeholder={f.placeholder}
                          value={(editingCol[f.key] ?? colForm[f.key as keyof typeof colForm] ?? '') as string}
                          onChange={e => setEditingCol((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                    {/* Color row */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Badge colour</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={(editingCol.badgeColor ?? colForm.badgeColor) as string} onChange={e => setEditingCol((p: any) => ({ ...p, badgeColor: e.target.value }))} style={{ width: 36, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg)' }} />
                          <input type="text" value={(editingCol.badgeColor ?? colForm.badgeColor) as string} onChange={e => setEditingCol((p: any) => ({ ...p, badgeColor: e.target.value }))} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.8rem' }} />
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Glow colour</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="color" value={(editingCol.glow ?? colForm.glow) as string} onChange={e => setEditingCol((p: any) => ({ ...p, glow: e.target.value }))} style={{ width: 36, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg)' }} />
                          <input type="text" value={(editingCol.glow ?? colForm.glow) as string} onChange={e => setEditingCol((p: any) => ({ ...p, glow: e.target.value }))} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.8rem' }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>CSS Gradient <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(collection card background)</span></label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ width: 40, height: 36, borderRadius: 8, background: editingCol.gradient ?? colForm.gradient, flexShrink: 0, border: '1px solid var(--border)' }} />
                        <input
                          type="text"
                          placeholder="linear-gradient(135deg, #E23636 0%, #7B0000 100%)"
                          value={editingCol.gradient ?? colForm.gradient}
                          onChange={e => setEditingCol((prev: any) => ({ ...prev, gradient: e.target.value }))}
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}
                        />
                      </div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Cover Image URL <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(banner shown on Collections page)</span></label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <input
                          type="text"
                          placeholder="https://example.com/image.jpg  or  /products/banner.jpg"
                          value={editingCol.coverImage ?? ''}
                          onChange={e => setEditingCol((prev: any) => ({ ...prev, coverImage: e.target.value }))}
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}
                        />
                        {editingCol.coverImage && (
                          <img src={editingCol.coverImage} alt="cover preview" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{ height: 36, width: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editingCol.featured ?? false} onChange={e => setEditingCol((p: any) => ({ ...p, featured: e.target.checked }))} />
                        Featured
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editingCol.active ?? true} onChange={e => setEditingCol((p: any) => ({ ...p, active: e.target.checked }))} />
                        Active
                      </label>
                    </div>
                    <div />
                  </div>

                  {/* Live preview card */}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</div>
                    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: `0 0 24px 0 ${(editingCol.glow ?? colForm.glow)}44` }}>
                      <div style={{ background: editingCol.gradient ?? colForm.gradient, padding: '24px 20px 20px', position: 'relative', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        {editingCol.coverImage && (
                          <img src={editingCol.coverImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div style={{ position: 'relative', zIndex: 1 }}>
                          <div style={{ fontSize: '2rem', marginBottom: 4 }}>{editingCol.symbol ?? colForm.symbol}</div>
                          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>{editingCol.name || 'Collection Name'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,.75)', marginTop: 2 }}>{editingCol.tagline || 'Tagline goes here'}</div>
                        </div>
                      </div>
                      <div style={{ background: 'var(--surface)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{editingCol.tag ?? colForm.tag}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: editingCol.badgeColor ?? colForm.badgeColor, color: '#fff', borderRadius: 20, padding: '2px 10px' }}>{editingCol.badge ?? colForm.badge}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button className="btn btn-primary btn-sm" onClick={async () => {
                    if (!editingCol.name) { toast.error('Name required'); return; }
                    try {
                      if (editingCol.id) {
                        await api.updateCollection(editingCol.id, editingCol);
                        toast.success('Collection updated');
                      } else {
                        await api.createCollection(editingCol);
                        toast.success('Collection created');
                      }
                      setEditingCol(null);
                      loadCollections();
                    } catch (e: any) { toast.error(e.message); }
                  }}>
                    <Save size={14} /> Save Collection
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditingCol(null)}>Cancel</button>
                </div>
              </div>
            )}

            {colLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>Loading collections…</div>
            ) : collections.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 0' }}><h3>No collections yet</h3><p>Create one above to get started.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {collections.map(col => (
                  <div key={col.id} className="section-card" style={{ padding: 18 }}>
                    {/* Collection header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      {col.coverImage ? (
                        <img src={col.coverImage} alt={col.name} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ width: 56, height: 56, borderRadius: 10, background: col.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
                          {col.symbol}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '1rem' }}>{col.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'block' }}>{col.tag} · {col.tagline}</span>
                        {col.coverImage && <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Cover: {col.coverImage.slice(0, 50)}{col.coverImage.length > 50 ? '…' : ''}</span>}
                      </div>
                      <span className={`badge ${col.active ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.7rem' }}>{col.active ? 'Active' : 'Hidden'}</span>
                      <button className="btn btn-sm" onClick={() => setEditingCol({ ...col })}><Edit3 size={13} /></button>
                      <button className="btn btn-sm btn-danger" onClick={async () => {
                        if (!confirm(`Delete "${col.name}"?`)) return;
                        await api.deleteCollection(col.id);
                        toast.success('Deleted');
                        loadCollections();
                      }}><Trash2 size={13} /></button>
                    </div>

                    {/* Products in this collection */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-2)' }}>
                          Products ({(colProducts[col.id] || []).length})
                        </span>
                      </div>

                      {/* Add product dropdown */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <select
                          value={addProductId[col.id] || ''}
                          onChange={e => setAddProductId(p => ({ ...p, [col.id]: e.target.value }))}
                          style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.85rem' }}
                        >
                          <option value="">— Select a product to add —</option>
                          {products.filter(p => p.collectionOnly && !(colProducts[col.id] || []).some((cp: any) => cp.id === p.id)).length === 0 && (
                            <option disabled value="">— No collection-exclusive products yet. Create one in Products tab with "Collection Exclusive" checked —</option>
                          )}
                          {products.filter(p => p.collectionOnly && !(colProducts[col.id] || []).some((cp: any) => cp.id === p.id)).map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.category}) — ₹{p.price}</option>
                          ))}
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={async () => {
                          const pid = addProductId[col.id]?.trim();
                          if (!pid) { toast.error('Select a product first'); return; }
                          try {
                            await api.addProductToCollection(col.id, pid);
                            toast.success('Product added');
                            setAddProductId(p => ({ ...p, [col.id]: '' }));
                            loadCollections();
                          } catch (err: any) { toast.error(err.message || 'Failed'); }
                        }}>
                          <Plus size={14} /> Add
                        </button>
                      </div>

                      {/* Product list */}
                      {(colProducts[col.id] || []).length === 0 ? (
                        <p style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>No products. Enter a Product ID above to add.</p>
                      ) : (
                        <div className="admin-table-wrap">
                          <table className="admin-table">
                            <thead><tr><th>Image</th><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th></th></tr></thead>
                            <tbody>
                              {(colProducts[col.id] || []).map((p: any) => (
                                <tr key={p.id}>
                                  <td><img src={p.image || (p.images && p.images[0]) || ''} alt={p.name} className="table-thumb" /></td>
                                  <td><code style={{ fontSize: '0.75rem' }}>{p.slug || p.id}</code></td>
                                  <td>{p.name}</td>
                                  <td>{p.category}</td>
                                  <td>₹{parseFloat(p.price).toFixed(0)}</td>
                                  <td>
                                    <button className="btn btn-sm btn-danger" onClick={async () => {
                                      await api.removeProductFromCollection(col.id, p.id);
                                      toast.success('Removed');
                                      loadCollections();
                                    }}><Trash2 size={12} /></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Database Tab */}
        {tab === 'database' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="section-toolbar" style={{ marginBottom: 16 }}>
              <h2>Database Viewer</h2>
              <button className="btn btn-primary" onClick={loadDb} disabled={dbLoading}>
                {dbLoading ? <div className="spinner-sm" /> : 'Refresh'}
              </button>
            </div>
            {dbLoading && !dbData ? (
              <div className="page-loader"><div className="spinner" /></div>
            ) : dbData ? (
              <>
                <div className="db-table-selector" style={{ marginBottom: 16 }}>
                  {Object.entries(dbData).map(([table, info]: [string, any]) => (
                    <button key={table} className={`tab ${dbTable === table ? 'active' : ''}`}
                      onClick={() => { setDbTable(table); setDbColVisible({}); setDbRowSearch(''); }}>
                      {table.replace('website_', '')} ({info.count})
                    </button>
                  ))}
                </div>
                {dbData[dbTable] && (() => {
                  const allCols: string[] = dbData[dbTable].columns;
                  const visibleCols = allCols.filter(c => dbColVisible[c] !== false);
                  const filteredRows = dbData[dbTable].rows.filter((row: any) =>
                    !dbRowSearch.trim() || visibleCols.some(c => String(row[c] ?? '').toLowerCase().includes(dbRowSearch.toLowerCase()))
                  );
                  const exportCsv = () => {
                    const header = visibleCols.join(',');
                    const lines = filteredRows.map((row: any) =>
                      visibleCols.map(c => {
                        const val = typeof row[c] === 'object' && row[c] !== null ? JSON.stringify(row[c]) : String(row[c] ?? '');
                        return `"${val.replace(/"/g, '""')}"`;
                      }).join(',')
                    );
                    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `${dbTable}_export.csv`;
                    a.click();
                  };
                  return (
                    <>
                      {/* Toolbar: search + column filter + export */}
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="Search rows…"
                          value={dbRowSearch}
                          onChange={e => setDbRowSearch(e.target.value)}
                          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.875rem', minWidth: 200 }}
                        />
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-2)', marginRight: 4 }}>Columns:</span>
                          {allCols.map(c => (
                            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', cursor: 'pointer', userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                checked={dbColVisible[c] !== false}
                                onChange={e => setDbColVisible(prev => ({ ...prev, [c]: e.target.checked }))}
                              />
                              {c}
                            </label>
                          ))}
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Download size={14} /> Export CSV ({filteredRows.length} rows)
                        </button>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 8 }}>
                        Showing {filteredRows.length} of {dbData[dbTable].rows.length} rows · {visibleCols.length} of {allCols.length} columns
                      </div>
                      <div className="admin-table-wrap">
                        <table className="admin-table db-table">
                          <thead>
                            <tr>{visibleCols.map(col => <th key={col}>{col}</th>)}</tr>
                          </thead>
                          <tbody>
                            {filteredRows.map((row: any, i: number) => (
                              <tr key={i}>
                                {visibleCols.map(col => (
                                  <td key={col} className="db-cell">
                                    {typeof row[col] === 'object' && row[col] !== null
                                      ? JSON.stringify(row[col]).slice(0, 80)
                                      : String(row[col] ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {filteredRows.length === 0 && (
                              <tr><td colSpan={visibleCols.length} className="empty-msg">No rows match filter</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="empty-msg">Click Refresh to load database data.</p>
            )}
          </motion.div>
        )}

        {/* Shiprocket Tab */}
        {tab === 'shiprocket' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: 720 }}>
            <h2 style={{ marginBottom: 6 }}>Shiprocket Integration</h2>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 24 }}>
              Test your Shiprocket credentials and manually push orders that failed auto-synchronisation.
            </p>

            {/* Connection test card */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 28 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}><Truck size={16} /> Test Connection</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: '0 0 14px' }}>
                Checks that <code>SHIPROCKET_EMAIL</code> and <code>SHIPROCKET_PASSWORD</code> are set on the server and that login succeeds.
              </p>
              <button className="btn btn-primary" onClick={handleTestShiprocket} disabled={srTesting} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Truck size={15} /> {srTesting ? 'Testing…' : 'Test Shiprocket Connection'}
              </button>
              {srTestResult && (
                <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 8, background: srTestResult.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${srTestResult.ok ? '#86efac' : '#fca5a5'}` }}>
                  {srTestResult.ok ? (
                    <>
                      <p style={{ margin: 0, color: '#15803d', fontWeight: 700 }}>✅ Connected successfully</p>
                      <p style={{ margin: '6px 0 0', fontSize: '0.83rem', color: '#166534' }}>Account: <strong>{srTestResult.email}</strong></p>
                      {srTestResult.pickupLocations && srTestResult.pickupLocations.length > 0 && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: '#166534' }}>
                          Pickup locations: {srTestResult.pickupLocations.map((l: any) => `${l.name}${l.active ? ' ✓' : ''}`).join(', ')}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>❌ Connection failed</p>
                      <p style={{ margin: '6px 0 0', fontSize: '0.83rem', color: '#991b1b' }}>{srTestResult.error}</p>
                      {srTestResult.envVars && (
                        <p style={{ margin: '6px 0 0', fontSize: '0.83rem', color: '#991b1b' }}>
                          Env vars: SHIPROCKET_EMAIL={String(srTestResult.envVars.SHIPROCKET_EMAIL)} · SHIPROCKET_PASSWORD={String(srTestResult.envVars.SHIPROCKET_PASSWORD)}
                        </p>
                      )}
                      <p style={{ margin: '8px 0 0', fontSize: '0.83rem', color: '#7f1d1d' }}>
                        Fix: add <code>SHIPROCKET_EMAIL</code> and <code>SHIPROCKET_PASSWORD</code> to <code>/opt/tfw/.env.production</code> on the server, then rebuild.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Orders without Shiprocket push */}            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Orders missing Shiprocket push</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: '0 0 14px' }}>
                Orders below have no Shiprocket order ID (auto-push failed or wasn't triggered). Click "Push" to retry.
              </p>
              {/* Product orders without shiprocket */}
              {orders.filter(o => !o.shipment?.shiprocketOrderId && o.status !== 'cancelled').length === 0 &&
               designOrders.filter(o => !(o as any).shipment?.shiprocketOrderId && o.status !== 'cancelled').length === 0 ? (
                <p style={{ color: 'var(--success, #16a34a)', fontSize: '0.9rem' }}>✅ All active orders have been pushed to Shiprocket.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {orders.filter(o => !o.shipment?.shiprocketOrderId && o.status !== 'cancelled').map(o => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}><Package size={13} style={{ marginRight: 4 }} />#{o.id.slice(0, 8).toUpperCase()}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginLeft: 10 }}>{o.customerName} · ₹{o.total}</span>
                      </div>
                      <button className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handlePushToShiprocket(o.id, false)} disabled={srPushingFor === o.id}>
                        <Truck size={13} /> {srPushingFor === o.id ? 'Pushing…' : 'Push'}
                      </button>
                    </div>
                  ))}
                  {designOrders.filter(o => !(o as any).shipment?.shiprocketOrderId && o.status !== 'cancelled').map(o => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}><Palette size={13} style={{ marginRight: 4 }} />#{o.id.slice(0, 8).toUpperCase()}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginLeft: 10 }}>{o.customerName} · ₹{o.total}</span>
                      </div>
                      <button className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handlePushToShiprocket(o.id, true)} disabled={srPushingFor === o.id}>
                        <Truck size={13} /> {srPushingFor === o.id ? 'Pushing…' : 'Push'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </motion.div>
        )}

        {/* Email Tab */}
        {tab === 'email' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: 720 }}>
            <h2 style={{ marginBottom: 6 }}>Email &amp; SMS Diagnostics</h2>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 24 }}>
              Test your SMTP and MSG91 configuration.
            </p>

            {/* SMTP Test */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={16} /> Test SMTP Connection</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: '0 0 14px' }}>
                Checks that <code>SMTP_HOST</code>, <code>SMTP_USER</code>, and <code>SMTP_PASS</code> are set and that sending succeeds.
                A real test email will be sent to your admin address.
              </p>
              <button className="btn btn-primary" onClick={handleTestEmail} disabled={emailTesting} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Mail size={15} /> {emailTesting ? 'Sending…' : 'Send Test Email'}
              </button>
              {emailTestResult && (
                <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 8, background: emailTestResult.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${emailTestResult.ok ? '#86efac' : '#fca5a5'}` }}>
                  {emailTestResult.ok ? (
                    <p style={{ margin: 0, color: '#15803d', fontWeight: 700 }}>✅ Email sent successfully — check your inbox!</p>
                  ) : (
                    <>
                      <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>
                        {emailTestResult.smtpConfigured ? '❌ SMTP configured but send failed' : '❌ SMTP not configured'}
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: '0.83rem', color: '#991b1b' }}>{emailTestResult.error}</p>
                      <p style={{ margin: '8px 0 0', fontSize: '0.83rem', color: '#7f1d1d' }}>
                        Fix: set <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>, <code>SMTP_FROM</code>, <code>ADMIN_EMAIL</code> in <code>.env</code>
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* MSG91 / SMS Test */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={16} /> Test MSG91 OTP SMS
              </h3>

              {/* Config status */}
              {smsConfig && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: smsConfig.provider === 'msg91' ? '#dbeafe' : '#f3f4f6', color: smsConfig.provider === 'msg91' ? '#1d4ed8' : '#6b7280' }}>
                    Provider: {smsConfig.provider === 'none' ? 'Not set' : smsConfig.provider}
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: smsConfig.msg91Configured ? '#d1fae5' : '#fee2e2', color: smsConfig.msg91Configured ? '#065f46' : '#991b1b' }}>
                    MSG91: {smsConfig.msg91Configured ? '✓ Configured' : '✗ Not configured'}
                  </span>
                  {smsConfig.senderId && (
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
                      Sender ID: {smsConfig.senderId}
                    </span>
                  )}
                </div>
              )}

              <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: '0 0 12px' }}>
                Sends a test OTP (123456) to the number below. Requires <code>SMS_PROVIDER=msg91</code>,{' '}
                <code>MSG91_AUTH_KEY</code>, and <code>MSG91_OTP_TEMPLATE_ID</code> in <code>.env</code>.
              </p>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', height: 38 }}>
                  <span style={{ padding: '0 10px', background: '#f9fafb', borderRight: '1px solid var(--border)', fontSize: 14, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', lineHeight: '38px' }}>+91</span>
                  <input
                    type="tel" maxLength={10} placeholder="9876543210"
                    value={smsTestPhone}
                    onChange={e => setSmsTestPhone(e.target.value.replace(/\D/g, ''))}
                    style={{ border: 'none', outline: 'none', padding: '0 12px', fontSize: 14, width: 150, height: '100%' }}
                  />
                </div>
                <button className="btn btn-primary" onClick={handleTestSMS} disabled={smsTesting} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38 }}>
                  <Phone size={15} /> {smsTesting ? 'Sending…' : 'Send Test OTP'}
                </button>
              </div>

              {smsTestResult && (
                <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 8, background: smsTestResult.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${smsTestResult.ok ? '#86efac' : '#fca5a5'}` }}>
                  {smsTestResult.ok ? (
                    <p style={{ margin: 0, color: '#15803d', fontWeight: 700 }}>✅ OTP sent via {smsTestResult.provider} — check your phone!</p>
                  ) : (
                    <>
                      <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>
                        {smsTestResult.configured ? `❌ ${smsTestResult.provider} configured but send failed` : `❌ ${smsTestResult.provider} not configured`}
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: '0.83rem', color: '#991b1b' }}>{smsTestResult.message}</p>
                      {!smsTestResult.configured && (
                        <div style={{ marginTop: 10, padding: '10px 12px', background: '#fff7ed', borderRadius: 6, border: '1px solid #fed7aa' }}>
                          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>Setup required in <code>.env</code>:</p>
                          <pre style={{ margin: 0, fontSize: 12, color: '#78350f', background: 'transparent' }}>
{`SMS_PROVIDER=msg91
MSG91_AUTH_KEY=your_24_char_key
MSG91_OTP_TEMPLATE_ID=your_template_id
MSG91_SENDER_ID=TFWALL`}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* MSG91 Setup Guide */}
            <div style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700 }}>MSG91 Setup Guide</h3>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--text-2)', lineHeight: 2 }}>
                <li>Go to <strong>msg91.com</strong> → create an account → get your <strong>Auth Key</strong> from API → Auth Key</li>
                <li>Register a <strong>Sender ID</strong> (e.g. <code>TFWALL</code>) under SMS → Sender ID</li>
                <li>Create a <strong>DLT-approved OTP template</strong> — content must include <code>##OTP##</code>:<br />
                  <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>
                    Your TheFramedWall OTP is ##OTP##. Valid for 5 minutes. Do not share.
                  </code>
                </li>
                <li>Copy the <strong>Template ID</strong> from MSG91 dashboard</li>
                <li>Add to your <code>.env</code>:
                  <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '10px 14px', borderRadius: 8, marginTop: 8, fontSize: 13, overflowX: 'auto' }}>
{`SMS_PROVIDER=msg91
MSG91_AUTH_KEY=YOUR_AUTH_KEY_HERE
MSG91_OTP_TEMPLATE_ID=YOUR_TEMPLATE_ID_HERE
MSG91_SENDER_ID=TFWALL`}
                  </pre>
                </li>
                <li>Restart the server and click <strong>Send Test OTP</strong> above</li>
              </ol>
            </div>
          </motion.div>
        )}

        {/* Colors Tab */}
        {tab === 'colors' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: 640 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 6px' }}>Colour Palette</h2>
              <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', margin: 0 }}>Define the global colour palette. Only these colours will appear on product pages and in the Design Studio.</p>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 28 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <input type="color" value={newColorHex} onChange={e => setNewColorHex(e.target.value)}
                    style={{ width: 52, height: 52, padding: 3, border: '2px solid var(--border)', borderRadius: '50%', cursor: 'pointer', display: 'block' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>HEX</span>
                  <input type="text" value={newColorHex} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setNewColorHex(e.target.value); }}
                    style={{ width: 90, fontFamily: 'monospace', fontSize: '0.88rem' }} placeholder="#000000" />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>NAME</span>
                  <input type="text" value={newColorName} onChange={e => setNewColorName(e.target.value)} placeholder="e.g. Jet Black"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGlobalColor(); } }} />
                </div>
                <button className="btn btn-primary" style={{ whiteSpace: 'nowrap', alignSelf: 'flex-end', marginBottom: 0 }} onClick={addGlobalColor} type="button">+ Add</button>
              </div>
            </div>
            {paletteLoading ? (
              <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>Loading palette…</p>
            ) : globalColors.length === 0 ? (
              <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>No colours added yet. Use the form above to build your palette.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {globalColors.map(c => (
                  <div key={c.hex} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 40, boxShadow: 'var(--clay-shadow-sm)' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: c.hex, border: '1.5px solid rgba(0,0,0,.15)', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{c.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>{c.hex}</span>
                    <button type="button" onClick={() => removeGlobalColor(c.hex)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex', alignItems: 'center' }} title="Remove"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: 560 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 6px' }}>Site Settings</h2>
              <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', margin: 0 }}>Control site-wide features and permissions.</p>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Upload setting row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 3 }}>User Uploads</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>Allow customers to upload their own designs in the Design Studio.</div>
                </div>
                <button
                  disabled={settingsSaving || uploadEnabled === null}
                  onClick={() => toggleUpload(!uploadEnabled)}
                  style={{
                    background: 'none', border: 'none', cursor: settingsSaving ? 'not-allowed' : 'pointer',
                    color: uploadEnabled ? 'var(--primary)' : 'var(--text-3)',
                    opacity: settingsSaving ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                    flexShrink: 0, marginLeft: 24,
                  }}
                  title={uploadEnabled ? 'Click to disable' : 'Click to enable'}
                >
                  {uploadEnabled
                    ? <><ToggleRight size={38} strokeWidth={1.5} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>On</span></>
                    : <><ToggleLeft size={38} strokeWidth={1.5} /><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Off</span></>
                  }
                </button>
              </div>

              {uploadEnabled === null && (
                <div style={{ padding: '12px 20px', fontSize: '0.82rem', color: 'var(--text-3)' }}>Loading…</div>
              )}
            </div>
          </motion.div>
        )}

        {/* Banners Tab */}
        {tab === 'banners' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: '0 0 4px' }}>Promotional Banners</h2>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', margin: 0 }}>
                  Manage homepage slider banners — New Arrivals, Best Sellers, Featured &amp; Seasonal.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => {
                  setEditingBanner(null);
                  setBannerForm({ ...defaultBannerForm });
                  initGradientFromBg(defaultBannerForm.bgGradient);
                  setShowBannerModal(true);
                }}>
                  <Plus size={15} /> New Banner
                </button>
                <button className="icon-btn" title="Refresh" onClick={loadBanners}><RefreshCw size={15} /></button>
              </div>
            </div>

            {bannerLoading && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-2)' }}>Loading banners…</div>}

            {!bannerLoading && bannerList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-2)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <p style={{ marginBottom: 12 }}>No banners yet. Create your first promotional banner.</p>
                <button className="btn btn-primary" onClick={() => { setEditingBanner(null); setBannerForm({ ...defaultBannerForm }); initGradientFromBg(defaultBannerForm.bgGradient); setShowBannerModal(true); }}>
                  <Plus size={15} /> Create First Banner
                </button>
              </div>
            )}

            {!bannerLoading && bannerList.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bannerList.map((b: any) => (
                  <div key={b.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                      {/* Preview swatch */}
                      <div style={{ width: 48, height: 48, borderRadius: 10, background: b.bgGradient, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                        {b.imageUrl && <img src={b.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{b.title}</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, background: b.accentColor, color: '#fff', borderRadius: 100, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {BADGE_TYPES.find(t => t.value === b.badgeType)?.label || b.badgeType}
                          </span>
                          {!b.active && <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>INACTIVE</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.subtitle || <em style={{ opacity: 0.5 }}>No subtitle</em>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 3 }}>
                          CTA: {b.ctaLabel} → {b.ctaUrl}
                          {b.ctaLabel2 && <> &nbsp;|&nbsp; {b.ctaLabel2} → {b.ctaUrl2}</>}
                          &nbsp;·&nbsp; Order: {b.sortOrder}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {/* Toggle active */}
                        <button
                          className="icon-btn"
                          title={b.active ? 'Deactivate' : 'Activate'}
                          style={{ color: b.active ? 'var(--primary)' : 'var(--text-3)' }}
                          onClick={async () => {
                            try {
                              await api.updateBanner(b.id, { active: !b.active });
                              await loadBanners();
                              toast.success(b.active ? 'Banner deactivated' : 'Banner activated');
                            } catch (e: any) { toast.error(e.message); }
                          }}
                        >
                          {b.active ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button className="icon-btn" title="Edit banner" onClick={() => {
                          setEditingBanner(b);
                          setBannerForm({
                            title: b.title, subtitle: b.subtitle, badgeText: b.badgeText,
                            badgeType: b.badgeType, imageUrl: b.imageUrl,
                            ctaLabel: b.ctaLabel, ctaUrl: b.ctaUrl,
                            ctaLabel2: b.ctaLabel2, ctaUrl2: b.ctaUrl2,
                            bgGradient: b.bgGradient, accentColor: b.accentColor,
                            textColor: b.textColor, textAlign: b.textAlign || 'left',
                            imagePosition: b.imagePosition || '50% 50%',
                            textLeft: b.textLeft ?? 5, textTop: b.textTop ?? 50,
                            active: b.active, sortOrder: b.sortOrder,
                            startDate: b.startDate ? b.startDate.substring(0, 10) : '',
                            endDate: b.endDate ? b.endDate.substring(0, 10) : '',
                          });
                          initGradientFromBg(b.bgGradient);
                          setShowBannerModal(true);
                        }}>
                          <Edit3 size={15} />
                        </button>
                        <button className="icon-btn" title="Delete" style={{ color: '#ef4444' }} onClick={async () => {
                          if (!confirm(`Delete banner "${b.title}"?`)) return;
                          try { await api.deleteBanner(b.id); await loadBanners(); toast.success('Banner deleted'); }
                          catch (e: any) { toast.error(e.message); }
                        }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Banner Modal */}
            <AnimatePresence>
              {showBannerModal && (
                <motion.div
                  className="modal-overlay"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setShowBannerModal(false)}
                >
                  <motion.div
                    className="modal"
                    style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}
                    initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="modal-header">
                      <h2>{editingBanner ? 'Edit Banner' : 'New Promotional Banner'}</h2>
                      <button className="icon-btn" onClick={() => setShowBannerModal(false)}><X size={20} /></button>
                    </div>

                    <div className="modal-body">
                      {/* Interactive canvas preview — drag text to reposition, drag image to shift focal */}
                      <div
                        ref={bannerPreviewRef}
                        style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 4, position: 'relative', minHeight: 200, userSelect: 'none',
                          cursor: bannerForm.imageUrl ? 'crosshair' : 'default',
                          ...(bannerForm.imageUrl
                            ? { backgroundImage: `url(${bannerForm.imageUrl})`, backgroundSize: 'cover', backgroundPosition: bannerForm.imagePosition || '50% 50%', backgroundRepeat: 'no-repeat' }
                            : { background: bannerForm.bgGradient })
                        }}
                        onMouseDown={e => {
                          if (!bannerForm.imageUrl) return;
                          const rect = bannerPreviewRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          const [sx, sy] = parseBgPos(bannerForm.imagePosition);
                          bannerDragRef.current = { active: true, type: 'bg', startMouseX: e.clientX, startMouseY: e.clientY, startValX: sx, startValY: sy };
                        }}
                        onMouseMove={e => {
                          const drag = bannerDragRef.current;
                          if (!drag.active) return;
                          const rect = bannerPreviewRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          const dx = (e.clientX - drag.startMouseX) / rect.width * 100;
                          const dy = (e.clientY - drag.startMouseY) / rect.height * 100;
                          if (drag.type === 'bg') {
                            const nx = Math.max(0, Math.min(100, drag.startValX + dx));
                            const ny = Math.max(0, Math.min(100, drag.startValY + dy));
                            setBannerForm(f => ({ ...f, imagePosition: `${Math.round(nx)}% ${Math.round(ny)}%` }));
                          } else {
                            const nx = Math.max(2, Math.min(88, drag.startValX + dx));
                            const ny = Math.max(8, Math.min(92, drag.startValY + dy));
                            setBannerForm(f => ({ ...f, textLeft: Math.round(nx), textTop: Math.round(ny) }));
                          }
                        }}
                        onMouseUp={() => { bannerDragRef.current.active = false; }}
                        onMouseLeave={() => { bannerDragRef.current.active = false; }}
                      >
                        {bannerForm.imageUrl && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.38) 50%, rgba(0,0,0,0.1) 100%)', zIndex: 1, pointerEvents: 'none' }} />}
                        {/* Draggable text block */}
                        <div
                          style={{ position: 'absolute', zIndex: 2,
                            left: `${bannerForm.textLeft}%`, top: `${bannerForm.textTop}%`,
                            transform: 'translateY(-50%)', maxWidth: '55%',
                            cursor: 'move', padding: '6px 4px',
                            display: 'flex', flexDirection: 'column',
                            alignItems: bannerForm.textAlign === 'center' ? 'center' : bannerForm.textAlign === 'right' ? 'flex-end' : 'flex-start',
                            textAlign: bannerForm.textAlign as any,
                          }}
                          onMouseDown={e => {
                            e.stopPropagation();
                            const rect = bannerPreviewRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            bannerDragRef.current = { active: true, type: 'text', startMouseX: e.clientX, startMouseY: e.clientY, startValX: bannerForm.textLeft, startValY: bannerForm.textTop };
                          }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bannerForm.accentColor, color: '#fff', borderRadius: 100, padding: '3px 10px', fontSize: '0.7rem', fontWeight: 700, marginBottom: 8 }}>
                            {bannerForm.badgeText || BADGE_TYPES.find(t => t.value === bannerForm.badgeType)?.label}
                          </div>
                          {(bannerForm.title || !bannerForm.imageUrl) && (
                            <div style={{ color: bannerForm.imageUrl ? '#fff' : bannerForm.textColor, fontWeight: 800, fontSize: '1.3rem', lineHeight: 1.2, marginBottom: 4 }}>
                              {bannerForm.title || 'Banner Title'}
                            </div>
                          )}
                          {bannerForm.subtitle && <div style={{ color: bannerForm.imageUrl ? 'rgba(255,255,255,0.85)' : bannerForm.textColor, fontSize: '0.82rem', marginBottom: 12 }}>{bannerForm.subtitle}</div>}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: bannerForm.textAlign === 'center' ? 'center' : bannerForm.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
                            {bannerForm.ctaLabel && <div style={{ display: 'inline-block', background: bannerForm.accentColor, color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600 }}>{bannerForm.ctaLabel} →</div>}
                            {bannerForm.ctaLabel2 && <div style={{ display: 'inline-block', border: `1.5px solid ${bannerForm.imageUrl ? '#fff' : bannerForm.textColor}`, color: bannerForm.imageUrl ? '#fff' : bannerForm.textColor, borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600 }}>{bannerForm.ctaLabel2}</div>}
                          </div>
                        </div>
                        {/* Drag hints */}
                        {bannerForm.imageUrl && <div style={{ position: 'absolute', bottom: 6, right: 8, zIndex: 10, fontSize: '0.62rem', color: 'rgba(255,255,255,0.75)', background: 'rgba(0,0,0,0.38)', borderRadius: 4, padding: '2px 7px', pointerEvents: 'none' }}>drag background to reposition</div>}
                        <div style={{ position: 'absolute', bottom: 6, left: 8, zIndex: 10, fontSize: '0.62rem', color: 'rgba(255,255,255,0.75)', background: 'rgba(0,0,0,0.38)', borderRadius: 4, padding: '2px 7px', pointerEvents: 'none' }}>drag text to move</div>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 16, marginTop: 2 }}>↕ Drag the text block · {bannerForm.imageUrl ? 'Drag background to shift focal point' : 'Add an image to enable focal drag'}</p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <label>Title</label>
                          <input value={bannerForm.title} onChange={e => setBannerForm({ ...bannerForm, title: e.target.value })} placeholder="Summer Sale — Up to 40% Off!" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <label>Subtitle</label>
                          <input value={bannerForm.subtitle} onChange={e => setBannerForm({ ...bannerForm, subtitle: e.target.value })} placeholder="Shop our exclusive seasonal collection" />
                        </div>
                        {/* Text alignment (within the text block) */}
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <label>Text Alignment <small style={{ color: 'var(--text-3)', fontWeight: 400 }}>— alignment within the text block</small></label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {(['left', 'center', 'right'] as const).map(align => (
                              <button key={align} type="button"
                                onClick={() => setBannerForm({ ...bannerForm, textAlign: align })}
                                style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `2px solid ${bannerForm.textAlign === align ? 'var(--primary)' : 'var(--border)'}`, background: bannerForm.textAlign === align ? 'var(--primary)' : 'var(--surface)', color: bannerForm.textAlign === align ? '#fff' : 'var(--text-2)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', textTransform: 'capitalize', transition: 'all .15s' }}>
                                {align === 'left' ? '⬅' : align === 'center' ? '↔' : '➡'}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* CTA buttons */}
                        <div className="form-group" style={{ gridColumn: '1/-1', background: 'var(--surface-2,rgba(0,0,0,0.03))', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                          <label style={{ marginBottom: 10, fontWeight: 600 }}>Button (CTA)</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ fontSize: '0.78rem' }}>Button Label</label>
                              <input value={bannerForm.ctaLabel} onChange={e => setBannerForm({ ...bannerForm, ctaLabel: e.target.value })} placeholder="Shop Now" />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ fontSize: '0.78rem' }}>Link to Page</label>
                              <input value={bannerForm.ctaUrl} onChange={e => setBannerForm({ ...bannerForm, ctaUrl: e.target.value })} placeholder="/products" />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ fontSize: '0.78rem' }}>Second Button <small style={{ color: 'var(--text-3)' }}>(optional)</small></label>
                              <input value={bannerForm.ctaLabel2} onChange={e => setBannerForm({ ...bannerForm, ctaLabel2: e.target.value })} placeholder="View All" />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ fontSize: '0.78rem' }}>Second Button Link</label>
                              <input value={bannerForm.ctaUrl2} onChange={e => setBannerForm({ ...bannerForm, ctaUrl2: e.target.value })} placeholder="/collections" />
                            </div>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Banner Type</label>
                          <select value={bannerForm.badgeType} onChange={e => setBannerForm({ ...bannerForm, badgeType: e.target.value })}>
                            {BADGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Badge Text <small style={{ color: 'var(--text-3)' }}>(overrides type label)</small></label>
                          <input value={bannerForm.badgeText} onChange={e => setBannerForm({ ...bannerForm, badgeText: e.target.value })} placeholder="Upto 40% Off" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <label style={{ margin: 0 }}>Banner Image</label>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', background: 'var(--surface-2,rgba(0,0,0,0.06))', borderRadius: 6, padding: '2px 8px' }}>
                              Recommended: <strong>1920 × 600 px</strong> (16:5 ratio) · PNG / JPG / WebP · max 10 MB
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              <Upload size={14} />
                              Upload Image
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                style={{ display: 'none' }}
                                onChange={async e => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const { url } = await api.uploadBannerImage(file);
                                    setBannerForm(f => ({ ...f, imageUrl: url }));
                                    toast.success('Image uploaded');
                                  } catch (err: any) {
                                    toast.error(err.message || 'Upload failed');
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            <input
                              value={bannerForm.imageUrl}
                              onChange={e => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                              placeholder="or paste image URL…"
                              style={{ flex: 1 }}
                            />
                          </div>
                          {bannerForm.imageUrl && (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img
                                src={bannerForm.imageUrl}
                                alt="Banner preview"
                                style={{ height: 90, width: 'auto', maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', objectFit: 'cover', display: 'block' }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              <button
                                onClick={() => setBannerForm({ ...bannerForm, imageUrl: '' })}
                                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                                title="Remove image"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>


                        {/* Background designer */}
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <label style={{ marginBottom: 8, display: 'block' }}>Background <small style={{ color: 'var(--text-3)', fontWeight: 400 }}>(used when no image, or as fallback)</small></label>
                          {/* Solid / Gradient tabs */}
                          <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--surface-2,rgba(0,0,0,0.06))', borderRadius: 8, padding: 3, width: 'fit-content' }}>
                            {(['solid','gradient'] as const).map(mode => (
                              <button key={mode} type="button" onClick={() => {
                                setBgMode(mode);
                                if (mode === 'solid') setBannerForm(f => ({ ...f, bgGradient: gradColor1 }));
                                else setBannerForm(f => ({ ...f, bgGradient: buildBgGradient(gradColor1, gradColor2, gradAngle) }));
                              }}
                                style={{ padding: '5px 16px', borderRadius: 6, border: 'none', background: bgMode === mode ? 'var(--surface)' : 'transparent', color: bgMode === mode ? 'var(--text)' : 'var(--text-3)', fontWeight: bgMode === mode ? 600 : 400, cursor: 'pointer', fontSize: '0.82rem', boxShadow: bgMode === mode ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all .15s', textTransform: 'capitalize' }}>
                                {mode === 'solid' ? '■ Solid' : '▥ Gradient'}
                              </button>
                            ))}
                          </div>

                          {bgMode === 'solid' ? (
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 10, background: gradColor1, cursor: 'pointer', border: '2px solid var(--border)' }}
                                     onClick={() => (document.getElementById('bg-solid-picker') as HTMLInputElement)?.click()} />
                                <input id="bg-solid-picker" type="color" value={gradColor1.startsWith('#') ? gradColor1 : '#0E7C61'}
                                       onChange={e => { setGradColor1(e.target.value); setBannerForm(f => ({ ...f, bgGradient: e.target.value })); }}
                                       style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
                              </div>
                              <input value={gradColor1} onChange={e => { setGradColor1(e.target.value); setBannerForm(f => ({ ...f, bgGradient: e.target.value })); }} placeholder="#0E7C61" style={{ flex: 1 }} />
                            </div>
                          ) : (
                            <div>
                              {/* Gradient preview bar */}
                              <div style={{ height: 32, borderRadius: 8, background: bannerForm.bgGradient, marginBottom: 12, border: '1px solid var(--border)' }} />
                              {/* Color stops */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                {([
                                  { id: 'gc1', label: 'Start color', color: gradColor1, setter: (v: string) => { setGradColor1(v); setBannerForm(f => ({ ...f, bgGradient: buildBgGradient(v, gradColor2, gradAngle) })); }},
                                  { id: 'gc2', label: 'End color',   color: gradColor2, setter: (v: string) => { setGradColor2(v); setBannerForm(f => ({ ...f, bgGradient: buildBgGradient(gradColor1, v, gradAngle) })); }},
                                ] as const).map(({ id, label, color, setter }) => (
                                  <div key={id}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{ width: 34, height: 34, borderRadius: 8, background: color, cursor: 'pointer', border: '2px solid var(--border)' }}
                                             onClick={() => (document.getElementById(id) as HTMLInputElement)?.click()} />
                                        <input id={id} type="color" value={color.startsWith('#') ? color : '#000000'}
                                               onChange={e => setter(e.target.value)}
                                               style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
                                      </div>
                                      <input value={color} onChange={e => setter(e.target.value)} style={{ flex: 1, fontSize: '0.82rem' }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {/* Direction */}
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 6 }}>Direction</div>
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                                {[{ a: 0,'l':'↓' },{ a: 45,'l':'↙' },{ a: 90,'l':'→' },{ a: 135,'l':'↘' },{ a: 180,'l':'↑' },{ a: 225,'l':'↗' },{ a: 270,'l':'←' },{ a: 315,'l':'↖' }].map(({ a, l }) => (
                                  <button key={a} type="button" onClick={() => { setGradAngle(a); setBannerForm(f => ({ ...f, bgGradient: buildBgGradient(gradColor1, gradColor2, a) })); }}
                                    style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${gradAngle === a ? 'var(--primary)' : 'var(--border)'}`, background: gradAngle === a ? 'var(--primary)' : 'var(--surface)', color: gradAngle === a ? '#fff' : 'var(--text-2)', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}>
                                    {l}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Quick presets */}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 6 }}>Quick presets</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {GRADIENT_PRESETS.filter(p => p.value).map(p => (
                              <button key={p.label} type="button" onClick={() => {
                                const parsed = parseBgGradient(p.value);
                                if (parsed) { setGradColor1(parsed.color1); setGradColor2(parsed.color2); setGradAngle(parsed.angle); setBgMode('gradient'); }
                                setBannerForm(f => ({ ...f, bgGradient: p.value }));
                              }}
                                style={{ width: 32, height: 32, borderRadius: 8, background: p.value, border: `3px solid ${bannerForm.bgGradient === p.value ? 'var(--primary)' : 'transparent'}`, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'border-color .12s' }}
                                title={p.label}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Accent Color */}
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <label>Badge & Button Color</label>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <div style={{ width: 48, height: 48, borderRadius: 10, background: bannerForm.accentColor, cursor: 'pointer', border: '2px solid var(--border)' }}
                                   onClick={() => (document.getElementById('accent-picker') as HTMLInputElement)?.click()} />
                              <input id="accent-picker" type="color" value={bannerForm.accentColor.startsWith('#') ? bannerForm.accentColor : '#C6A75E'}
                                     onChange={e => setBannerForm(f => ({ ...f, accentColor: e.target.value }))}
                                     style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <input value={bannerForm.accentColor} onChange={e => setBannerForm(f => ({ ...f, accentColor: e.target.value }))} placeholder="#C6A75E" style={{ marginBottom: 6 }} />
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {(globalColors.length > 0 ? globalColors : [
                                  { hex: BRAND.accent }, { hex: BRAND.primary }, { hex: BRAND.danger },
                                  { hex: BRAND.info }, { hex: BRAND.purple }, { hex: BRAND.warning },
                                  { hex: BRAND.white },
                                ]).map(c => (
                                  <div key={c.hex} onClick={() => setBannerForm(f => ({ ...f, accentColor: c.hex }))}
                                       title={'name' in c ? c.name : c.hex}
                                       style={{ width: 22, height: 22, borderRadius: 5, background: c.hex, cursor: 'pointer', border: `2px solid ${bannerForm.accentColor === c.hex ? 'var(--primary)' : 'var(--border)'}`, transition: 'border-color .1s' }} />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Text Color */}
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <label>Text Color <small style={{ color: 'var(--text-3)', fontWeight: 400 }}>(used on gradient background)</small></label>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <div style={{ width: 48, height: 48, borderRadius: 10, background: bannerForm.textColor, cursor: 'pointer', border: '2px solid var(--border)' }}
                                   onClick={() => (document.getElementById('text-color-picker') as HTMLInputElement)?.click()} />
                              <input id="text-color-picker" type="color" value={bannerForm.textColor.startsWith('#') ? bannerForm.textColor : '#ffffff'}
                                     onChange={e => setBannerForm(f => ({ ...f, textColor: e.target.value }))}
                                     style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <input value={bannerForm.textColor} onChange={e => setBannerForm(f => ({ ...f, textColor: e.target.value }))} placeholder="#ffffff" style={{ marginBottom: 6 }} />
                              <div style={{ display: 'flex', gap: 5 }}>
                                {[BRAND.white, BRAND.black, BRAND.slateDark, BRAND.accent].map(c => (
                                  <div key={c} onClick={() => setBannerForm(f => ({ ...f, textColor: c }))}
                                       style={{ width: 22, height: 22, borderRadius: 5, background: c, cursor: 'pointer', border: `2px solid ${bannerForm.textColor === c ? 'var(--primary)' : 'var(--border)'}`, transition: 'border-color .1s' }} />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Sort Order <small style={{ color: 'var(--text-3)' }}>(lower = first)</small></label>
                          <input type="number" min={0} value={bannerForm.sortOrder} onChange={e => setBannerForm({ ...bannerForm, sortOrder: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                            <input type="checkbox" checked={bannerForm.active} onChange={e => setBannerForm({ ...bannerForm, active: e.target.checked })} />
                            Active (visible on homepage)
                          </label>
                        </div>

                        <div className="form-group">
                          <label>Start Date <small style={{ color: 'var(--text-3)' }}>(optional)</small></label>
                          <input type="date" value={bannerForm.startDate} onChange={e => setBannerForm({ ...bannerForm, startDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>End Date <small style={{ color: 'var(--text-3)' }}>(optional)</small></label>
                          <input type="date" value={bannerForm.endDate} onChange={e => setBannerForm({ ...bannerForm, endDate: e.target.value })} />
                        </div>
                      </div>
                    </div>

                    <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
                      <button className="btn btn-secondary" onClick={() => setShowBannerModal(false)}>Cancel</button>
                      <button className="btn btn-primary" onClick={async () => {
                        if (!bannerForm.title.trim() && !bannerForm.imageUrl) return toast.error('Add a title or an image');
                        try {
                          const payload = {
                            ...bannerForm,
                            sortOrder: Number(bannerForm.sortOrder) || 0,
                            startDate: bannerForm.startDate || null,
                            endDate: bannerForm.endDate || null,
                          };
                          if (editingBanner) {
                            await api.updateBanner(editingBanner.id, payload);
                            toast.success('Banner updated');
                          } else {
                            await api.createBanner(payload);
                            toast.success('Banner created');
                          }
                          setShowBannerModal(false);
                          await loadBanners();
                        } catch (e: any) { toast.error(e.message); }
                      }}>
                        {editingBanner ? 'Save Changes' : 'Create Banner'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Brands & Models Tab */}
        {tab === 'brands' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: '0 0 4px' }}>Brands &amp; Models</h2>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', margin: 0 }}>
                  Manage the Category → Brand → Model hierarchy for the shop.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => { setEditingBrand(null); setBrandForm({ name: '', logo: '', categoryId: categories[0]?.id || '', active: true, sortOrder: 0 }); setModelBrandId(null); (document.getElementById('brand-modal') as HTMLDialogElement)?.showModal?.(); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={15} /> Add Brand
                </button>
                <button className="icon-btn" title="Refresh" onClick={loadBrands}><RefreshCw size={15} /></button>
              </div>
            </div>

            {brandLoading && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-2)' }}>Loading brands…</div>}

            {!brandLoading && brands.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-2)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <p style={{ marginBottom: 12 }}>No brands yet. Create your first brand to enable the Category → Brand → Model workflow.</p>
                <button className="btn btn-primary" onClick={() => { setEditingBrand(null); setBrandForm({ name: '', logo: '', categoryId: categories[0]?.id || '', active: true, sortOrder: 0 }); (document.getElementById('brand-modal') as HTMLDialogElement)?.showModal?.(); }}>
                  <Plus size={15} /> Add First Brand
                </button>
              </div>
            )}

            {!brandLoading && brands.map((brand: any) => (
              <div key={brand.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                {/* Brand Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
                  {/* Logo */}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-2, rgba(255,255,255,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {brand.logo
                      ? <img src={brand.logo} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                      : <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>{brand.name.charAt(0)}</span>
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.97rem' }}>{brand.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                      {brand.categoryName || 'No category'} &middot; {brand.modelCount} model{brand.modelCount !== 1 ? 's' : ''}
                      {!brand.active && <span style={{ marginLeft: 8, color: '#ef4444' }}>Inactive</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      className="icon-btn"
                      title={expandedBrand === brand.id ? 'Collapse models' : 'Expand models'}
                      onClick={() => setExpandedBrand(expandedBrand === brand.id ? null : brand.id)}
                    >
                      {expandedBrand === brand.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button className="icon-btn" title="Add model" onClick={() => {
                      setModelBrandId(brand.id);
                      setEditingModel(null);
                      setModelForm({ name: '', displayName: '', active: true, inStock: true, sortOrder: 0 });
                      (document.getElementById('model-modal') as HTMLDialogElement)?.showModal?.();
                    }}>
                      <Plus size={15} />
                    </button>
                    <button className="icon-btn" title="Edit brand" onClick={() => {
                      setEditingBrand(brand);
                      setBrandForm({ name: brand.name, logo: brand.logo || '', categoryId: brand.categoryId || '', active: brand.active, sortOrder: brand.sortOrder });
                      (document.getElementById('brand-modal') as HTMLDialogElement)?.showModal?.();
                    }}>
                      <Edit3 size={15} />
                    </button>
                    <button className="icon-btn" title="Delete brand" style={{ color: '#ef4444' }} onClick={async () => {
                      if (!confirm(`Delete brand "${brand.name}" and all its models?`)) return;
                      try { await api.deleteBrand(brand.id); await loadBrands(); toast.success('Brand deleted'); }
                      catch (e: any) { toast.error(e.message); }
                    }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Models sub-list */}
                {expandedBrand === brand.id && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '0 18px 14px' }}>
                    {!(brandModels[brand.id] || []).length && (
                      <p style={{ color: 'var(--text-2)', fontSize: '0.85rem', padding: '12px 0 0' }}>No models yet. Click + to add one.</p>
                    )}
                    {(brandModels[brand.id] || []).map((model: any) => (
                      <div key={model.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{model.displayName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>/{model.slug}{!model.active && <span style={{ marginLeft: 6, color: '#ef4444' }}>Inactive</span>}{!model.inStock && <span style={{ marginLeft: 6, color: '#f59e0b' }}>Out of Stock</span>}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="icon-btn" title="Edit model" onClick={() => {
                            setEditingModel(model);
                            setModelBrandId(brand.id);
                            setModelForm({ name: model.name, displayName: model.displayName, active: model.active, inStock: model.inStock ?? true, sortOrder: model.sortOrder });
                            (document.getElementById('model-modal') as HTMLDialogElement)?.showModal?.();
                          }}>
                            <Edit3 size={13} />
                          </button>
                          <button className="icon-btn" style={{ color: '#ef4444' }} title="Delete model" onClick={async () => {
                            if (!confirm(`Delete model "${model.displayName}"?`)) return;
                            try { await api.deleteModel(model.id); await loadBrands(); toast.success('Model deleted'); }
                            catch (e: any) { toast.error(e.message); }
                          }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Brand Modal */}
            <dialog id="brand-modal" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 16, padding: 0, minWidth: 360, maxWidth: 480 }}>
              <form method="dialog" onSubmit={e => e.preventDefault()}>
                <div className="modal-header" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>{editingBrand ? 'Edit Brand' : 'Add Brand'}</h3>
                  <button type="button" className="icon-btn" onClick={() => (document.getElementById('brand-modal') as HTMLDialogElement)?.close()}><X size={18} /></button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Brand Name *</label>
                    <input type="text" value={brandForm.name} onChange={e => setBrandForm({ ...brandForm, name: e.target.value })} placeholder="e.g. Apple" required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Logo URL</label>
                    <input type="url" value={brandForm.logo} onChange={e => setBrandForm({ ...brandForm, logo: e.target.value })} placeholder="https://…/apple-logo.png" />
                    {brandForm.logo && <img src={brandForm.logo} alt="preview" style={{ width: 48, height: 48, objectFit: 'contain', marginTop: 8, borderRadius: 8, background: 'rgba(255,255,255,0.05)' }} />}
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Category</label>
                    <select value={brandForm.categoryId} onChange={e => setBrandForm({ ...brandForm, categoryId: e.target.value })}>
                      <option value="">— None —</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Sort Order</label>
                    <input type="number" min={0} value={brandForm.sortOrder} onChange={e => setBrandForm({ ...brandForm, sortOrder: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                      <input type="checkbox" checked={brandForm.active} onChange={e => setBrandForm({ ...brandForm, active: e.target.checked })} />
                      Active
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => (document.getElementById('brand-modal') as HTMLDialogElement)?.close()}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={async () => {
                      if (!brandForm.name) return toast.error('Name is required');
                      try {
                        if (editingBrand) {
                          await api.updateBrand(editingBrand.id, { name: brandForm.name, logo: brandForm.logo, categoryId: brandForm.categoryId || null, active: brandForm.active, sortOrder: brandForm.sortOrder });
                          toast.success('Brand updated');
                        } else {
                          await api.createBrand({ name: brandForm.name, logo: brandForm.logo, categoryId: brandForm.categoryId || undefined, active: brandForm.active, sortOrder: brandForm.sortOrder });
                          toast.success('Brand created');
                        }
                        (document.getElementById('brand-modal') as HTMLDialogElement)?.close();
                        await loadBrands();
                      } catch (e: any) { toast.error(e.message); }
                    }}>
                      {editingBrand ? 'Save Changes' : 'Create Brand'}
                    </button>
                  </div>
                </div>
              </form>
            </dialog>

            {/* Model Modal */}
            <dialog id="model-modal" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 16, padding: 0, minWidth: 360, maxWidth: 480 }}>
              <form method="dialog" onSubmit={e => e.preventDefault()}>
                <div className="modal-header" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>{editingModel ? 'Edit Model' : 'Add Model'}</h3>
                  <button type="button" className="icon-btn" onClick={() => (document.getElementById('model-modal') as HTMLDialogElement)?.close()}><X size={18} /></button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Model Name *</label>
                    <input type="text" value={modelForm.name} onChange={e => setModelForm({ ...modelForm, name: e.target.value, displayName: modelForm.displayName || e.target.value })} placeholder="e.g. iphone-15-pro" required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Display Name</label>
                    <input type="text" value={modelForm.displayName} onChange={e => setModelForm({ ...modelForm, displayName: e.target.value })} placeholder="e.g. iPhone 15 Pro" />
                    <small style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>Shown to customers. Defaults to Model Name.</small>
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Sort Order</label>
                    <input type="number" min={0} value={modelForm.sortOrder} onChange={e => setModelForm({ ...modelForm, sortOrder: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                      <input type="checkbox" checked={modelForm.active} onChange={e => setModelForm({ ...modelForm, active: e.target.checked })} />
                      Active
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                      <input type="checkbox" checked={modelForm.inStock} onChange={e => setModelForm({ ...modelForm, inStock: e.target.checked })} />
                      In Stock
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => (document.getElementById('model-modal') as HTMLDialogElement)?.close()}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={async () => {
                      if (!modelForm.name || !modelBrandId) return toast.error('Name is required');
                      try {
                        if (editingModel) {
                          await api.updateModel(editingModel.id, { name: modelForm.name, displayName: modelForm.displayName || modelForm.name, active: modelForm.active, inStock: modelForm.inStock, sortOrder: modelForm.sortOrder });
                          toast.success('Model updated');
                        } else {
                          await api.createModel(modelBrandId, { name: modelForm.name, displayName: modelForm.displayName || modelForm.name, active: modelForm.active, inStock: modelForm.inStock, sortOrder: modelForm.sortOrder });
                          toast.success('Model created');
                        }
                        (document.getElementById('model-modal') as HTMLDialogElement)?.close();
                        await loadBrands();
                        setExpandedBrand(modelBrandId);
                      } catch (e: any) { toast.error(e.message); }
                    }}>
                      {editingModel ? 'Save Changes' : 'Create Model'}
                    </button>
                  </div>
                </div>
              </form>
            </dialog>
          </motion.div>
        )}

        {/* Inventory: Bulk Update Modal */}
        <AnimatePresence>
          {showBulkModal && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBulkModal(false)}>
              <motion.div className="modal" style={{ maxWidth: 440 }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Bulk Stock Update</h2>
                  <button className="icon-btn" onClick={() => setShowBulkModal(false)}><X size={20} /></button>
                </div>
                <div className="modal-body">
                  <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', marginBottom: 18 }}>
                    Updating <strong>{invSelected.size}</strong> product{invSelected.size !== 1 ? 's' : ''}.
                  </p>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Update Mode</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {([['set', 'Set to'], ['add', '+ Add'], ['subtract', '− Subtract']] as const).map(([m, l]) => (
                        <button key={m} onClick={() => setBulkMode(m)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${bulkMode === m ? 'var(--primary)' : 'var(--border)'}`, background: bulkMode === m ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent', fontWeight: bulkMode === m ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Stock Value</label>
                    <input type="number" min={0} value={bulkValue} onChange={e => setBulkValue(Math.max(0, parseInt(e.target.value) || 0))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label>Note (optional)</label>
                    <input value={bulkNote} onChange={e => setBulkNote(e.target.value)} placeholder="e.g. Restocked from supplier" />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" onClick={() => setShowBulkModal(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={executeBulkUpdate} disabled={savingBulk} style={{ gap: 6 }}>
                      {savingBulk ? <><div className="spinner-sm" /> Updating…</> : <><Layers size={14} /> Apply</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inventory: Stock Log Modal */}
        <AnimatePresence>
          {logProduct && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLogProduct(null)}>
              <motion.div className="modal" style={{ maxWidth: 600 }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <h2 style={{ marginBottom: 2 }}>Stock History</h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-2)' }}>{logProduct.name} · {logProduct.sku || 'No SKU'}</p>
                  </div>
                  <button className="icon-btn" onClick={() => setLogProduct(null)}><X size={20} /></button>
                </div>
                <div className="modal-body">
                  {invLogsLoading ? (
                    <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" /></div>
                  ) : invLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>No stock changes recorded yet.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                            {['Date', 'Type', 'Before', 'Change', 'After', 'Note'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {invLogs.map((log, idx) => (
                            <tr key={log.id} style={{ borderBottom: idx < invLogs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                                {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: 20, background: 'var(--bg-2)', border: '1px solid var(--border)', fontWeight: 600 }}>
                                  {log.change_type.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right' }}>{log.quantity_before}</td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: log.quantity_change > 0 ? '#10b981' : '#ef4444' }}>
                                {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                              </td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700 }}>{log.quantity_after}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-2)', fontSize: '0.82rem' }}>{log.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inventory: Variants Modal */}
        <AnimatePresence>
          {variantProduct && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVariantProduct(null)}>
              <motion.div className="modal" style={{ maxWidth: 680 }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <h2 style={{ marginBottom: 2 }}>Variant Stock</h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-2)' }}>{variantProduct.name}</p>
                  </div>
                  <button className="icon-btn" onClick={() => setVariantProduct(null)}><X size={20} /></button>
                </div>
                <div className="modal-body">
                  {variantDraft.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', marginBottom: 16 }}>
                      <Layers size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                      <div>No variants yet. Add size/colour combinations below.</div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                            {['Label', 'Size', 'Colour', 'SKU Suffix', 'Stock', ''].map(h => (
                              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.73rem', color: 'var(--text-3)', fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {variantDraft.map((v, i) => (
                            <tr key={v.id} style={{ borderBottom: i < variantDraft.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <td style={{ padding: '6px 8px' }}>
                                <input value={v.label} onChange={e => setVariantDraft(d => d.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Black / M" style={{ minWidth: 110 }} />
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <input value={v.size ?? ''} onChange={e => setVariantDraft(d => d.map((x, j) => j === i ? { ...x, size: e.target.value } : x))} placeholder="M" style={{ width: 52 }} />
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input type="color" value={v.color ?? '#000000'} onChange={e => setVariantDraft(d => d.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} style={{ width: 32, height: 28, padding: 2, borderRadius: 5 }} />
                                  <input value={v.colorName ?? ''} onChange={e => setVariantDraft(d => d.map((x, j) => j === i ? { ...x, colorName: e.target.value } : x))} placeholder="Black" style={{ width: 80 }} />
                                </div>
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <input value={v.skuSuffix ?? ''} onChange={e => setVariantDraft(d => d.map((x, j) => j === i ? { ...x, skuSuffix: e.target.value } : x))} placeholder="_BLK_M" style={{ width: 80, fontFamily: 'monospace' }} />
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <input type="number" min={0} value={v.stock} onChange={e => setVariantDraft(d => d.map((x, j) => j === i ? { ...x, stock: Math.max(0, parseInt(e.target.value) || 0) } : x))} style={{ width: 64, textAlign: 'right' }} />
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                <button className="icon-btn" style={{ color: 'var(--error, #ef4444)' }} onClick={() => setVariantDraft(d => d.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <button className="btn btn-outline" onClick={addVariant} style={{ gap: 6 }}>
                      <Plus size={14} /> Add Variant
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-outline" onClick={() => setVariantProduct(null)}>Cancel</button>
                      <button className="btn btn-primary" onClick={saveVariants} disabled={savingVariants} style={{ gap: 6 }}>
                        {savingVariants ? <><div className="spinner-sm" /> Saving…</> : <><Save size={14} /> Save Variants</>}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lead Edit Modal */}
        <AnimatePresence>
          {editingLead && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingLead(null)}>
              <motion.div className="modal" style={{ maxWidth: 520 }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Edit Lead</h2>
                  <button className="icon-btn" onClick={() => setEditingLead(null)}><X size={20} /></button>
                </div>
                <div className="modal-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div className="form-group">
                      <label>Name</label>
                      <input value={leadEditForm.name} onChange={e => setLeadEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                    </div>
                    <div className="form-group">
                      <label>Mobile</label>
                      <input value={leadEditForm.mobile} onChange={e => setLeadEditForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+91 …" />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Email</label>
                    <input type="email" value={leadEditForm.email} onChange={e => setLeadEditForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Status</label>
                    <select value={leadEditForm.status} onChange={e => setLeadEditForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="converted">Converted</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label>Notes</label>
                    <textarea value={leadEditForm.notes} onChange={e => setLeadEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Internal notes…" style={{ resize: 'vertical' }} />
                  </div>

                  {/* Products viewed (read-only) */}
                  {(editingLead.products_viewed ?? []).length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Products Viewed</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {editingLead.products_viewed.map((p, i) => (
                          <span key={i} style={{ fontSize: '0.78rem', padding: '3px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6 }}>{p.name || p.id}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 20 }}>
                    <span>Created: {new Date(editingLead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>Last activity: {new Date(editingLead.last_activity).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" type="button" onClick={() => setEditingLead(null)}>Cancel</button>
                    <button className="btn btn-primary" type="button" onClick={saveLeadEdit} disabled={savingLead} style={{ gap: 6 }}>
                      {savingLead ? <><div className="spinner-sm" /> Saving…</> : <><Save size={14} /> Save</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Lead Modal */}
        <AnimatePresence>
          {showNewLeadForm && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNewLeadForm(false)}>
              <motion.div className="modal" style={{ maxWidth: 480 }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>New Lead</h2>
                  <button className="icon-btn" onClick={() => setShowNewLeadForm(false)}><X size={20} /></button>
                </div>
                <form className="modal-body" onSubmit={createNewLead}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div className="form-group">
                      <label>Name</label>
                      <input value={newLeadForm.name} onChange={e => setNewLeadForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                    </div>
                    <div className="form-group">
                      <label>Mobile</label>
                      <input value={newLeadForm.mobile} onChange={e => setNewLeadForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+91 …" />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Email</label>
                    <input type="email" value={newLeadForm.email} onChange={e => setNewLeadForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label>Source</label>
                    <select value={newLeadForm.source} onChange={e => setNewLeadForm(f => ({ ...f, source: e.target.value }))}>
                      <option value="direct">Direct</option>
                      <option value="organic">Organic</option>
                      <option value="social">Social</option>
                      <option value="referral">Referral</option>
                      <option value="corporate_inquiry">Corporate Inquiry</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label>Notes</label>
                    <textarea value={newLeadForm.notes} onChange={e => setNewLeadForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes…" style={{ resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" type="button" onClick={() => setShowNewLeadForm(false)}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={savingNewLead} style={{ gap: 6 }}>
                      {savingNewLead ? <><div className="spinner-sm" /> Creating…</> : <><UserPlus size={14} /> Create Lead</>}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product Form Modal */}
        <AnimatePresence>
          {showProductForm && (            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeProductForm}>
              <motion.div className="modal" style={{ maxWidth: 720 }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {editingProduct && (
                      <a href={`/products/${editingProduct.slug || editingProduct.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', padding: '6px 12px' }}>
                        <ExternalLink size={14} /> Preview
                      </a>
                    )}
                    <button className="icon-btn" onClick={closeProductForm}><X size={20} /></button>
                  </div>
                </div>
                <form onSubmit={handleSaveProduct} className="modal-body">

                  {/* ── Basic Info ── */}
                  <div className="pf-section">
                    <div className="pf-section-title">Basic Info</div>
                    {/* SKU row */}
                    <div className="form-row" style={{ marginBottom: 8 }}>
                      <div className="form-group">
                        <label>
                          SKU / Product ID *
                          {!editingProduct && <span style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 400, marginLeft: 6 }}>unique, no spaces (e.g. ts_oversized)</span>}
                          {editingProduct && <span style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 400, marginLeft: 6 }}>read-only after creation</span>}
                        </label>
                        <input
                          type="text"
                          value={(productForm as any).id || ''}
                          readOnly={!!editingProduct}
                          onChange={e => !editingProduct && setProductForm({ ...productForm, id: e.target.value.replace(/\s+/g, '_').toLowerCase() } as any)}
                          placeholder="e.g. ts_oversized_v2"
                          style={editingProduct ? { background: 'var(--bg-2)', color: 'var(--text-3)', cursor: 'not-allowed' } : {}}
                          required={!editingProduct}
                        />
                        {!editingProduct && (productForm as any).id && products.some(p => p.id === (productForm as any).id) && (
                          <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>⚠ SKU already exists — choose a unique ID</p>
                        )}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Product Name *</label><input type="text" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="e.g. Classic Polo T-Shirt" required /></div>
                      <div className="form-group">
                        <label>Category *</label>
                        <select value={(productForm as any).categoryId || ''} onChange={e => { const cat = categories.find(c => c.id === e.target.value); setProductForm(f => ({ ...f, category: cat?.name || '', ...(cat ? { categoryId: cat.id } : { categoryId: '' }) } as any)); }} required>
                          <option value="">— Select category —</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {/* Size chart toggle — only shown if the selected category has a chart */}
                        {(() => {
                          const selCat = categories.find(c => c.id === (productForm as any).categoryId);
                          if (!selCat?.sizeChart) return null;
                          const chart = selCat.sizeChart;
                          const show = (productForm as any).showSizeChart !== false;
                          return (
                            <div style={{ marginTop: 10 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.85rem' }}>
                                <input type="checkbox" checked={show} onChange={e => setProductForm(f => ({ ...f, showSizeChart: e.target.checked } as any))} />
                                Show size chart on product page
                              </label>
                              {show && (
                                <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-2)' }}>
                                  <strong style={{ color: 'var(--text)' }}>Chart preview ({chart.unit}):</strong> {chart.headers.join(' · ')} — {chart.rows.map((r: { label: string }) => r.label).join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Price (₹) *</label><input type="number" step="0.01" min="0" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: +e.target.value })} required /></div>
                      <div className="form-group">
                        <label className="pf-row-label">
                          <span>Flags</span>
                        </label>
                        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                          <label className="checkbox-label"><input type="checkbox" checked={productForm.featured} onChange={e => setProductForm({ ...productForm, featured: e.target.checked })} /> Featured</label>
                          <label className="checkbox-label" title="Collection-only products are hidden from general browsing and only appear in specific collections"><input type="checkbox" checked={(productForm as any).collectionOnly ?? false} onChange={e => setProductForm({ ...productForm, collectionOnly: e.target.checked } as any)} /> Collection Exclusive</label>
                        </div>
                      </div>
                    </div>
                    <div className="form-group"><label>Description</label><textarea value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} rows={2} placeholder="Short product description shown to customers…" /></div>
                  </div>

                  {/* ── Images ── */}
                  <div className="pf-section">
                    <div className="pf-section-title">Images</div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Design Artwork *</label>
                        <div className="image-input-group">
                          <input type="text" value={productForm.image} onChange={e => setProductForm({ ...productForm, image: e.target.value })} placeholder="Paste URL or upload →" />
                          <label className="btn btn-ghost upload-btn" title="Upload image">
                            {uploadingField === 'productImage' ? <div className="spinner-sm" /> : <><Upload size={14} /> Upload</>}
                            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleProductImageUpload(f); e.target.value = ''; }} />
                          </label>
                        </div>
                        {productForm.image && <img src={productForm.image} alt="Design preview" className="form-preview" />}
                      </div>
                      <div className="form-group">
                        <label>Gallery Photos <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>— optional extra shots</span></label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {(productForm.images || []).map((url, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                              <img src={url} alt={`Shot ${i + 1}`} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                              <button type="button" onClick={() => setProductForm(f => ({ ...f, images: (f.images || []).filter((_, idx) => idx !== i) }))}
                                style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', border: 'none', borderRadius: '50%', width: 16, height: 16, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, padding: 0 }}>×</button>
                            </div>
                          ))}
                          <label className="btn btn-ghost upload-btn" style={{ height: 56, width: 56, flexDirection: 'column', gap: 2, fontSize: '.7rem', borderStyle: 'dashed' }} title="Add photo">
                            {uploadingField === 'productExtraImage' ? <div className="spinner-sm" /> : <><Upload size={14} /><span>Add</span></>}
                            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleProductExtraImageUpload(f); e.target.value = ''; }} />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Stock & Shipping (hidden mockup field kept) ── */}
                  <div style={{ display: 'none' }}>
                    <select value={(productForm as any).mockupId || ''} onChange={e => setProductForm({ ...productForm, mockupId: e.target.value || undefined } as any)}>
                      <option value="">— No mockup —</option>
                      {mockups.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="pf-section">
                    <div className="pf-section-title">Stock &amp; Rating</div>
                    <div className="form-row">
                      <div className="form-group"><label>Stock</label><input type="number" min="0" value={productForm.stock ?? 100} onChange={e => setProductForm({ ...productForm, stock: +e.target.value })} /></div>
                      <div className="form-group"><label>Rating (0–5)</label><input type="number" step="0.1" min="0" max="5" value={productForm.rating ?? 4.5} onChange={e => setProductForm({ ...productForm, rating: +e.target.value })} /></div>
                    </div>
                  </div>

                  {/* ── Weight & Dimensions ── */}
                  <div className="pf-section">
                    <div className="pf-section-title">Weight &amp; Dimensions</div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Dead Weight <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>grams</span></label>
                        <input type="number" min="1" value={(productForm as any).weightGrams ?? 200} onChange={e => setProductForm({ ...productForm, weightGrams: +e.target.value } as any)} placeholder="200" />
                      </div>
                      <div className="form-group">
                        <label>Dimensions L × B × H <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>cm</span></label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input type="number" min="1" value={(productForm as any).lengthCm ?? 30} onChange={e => setProductForm({ ...productForm, lengthCm: +e.target.value } as any)} placeholder="L" style={{ flex: 1 }} />
                          <input type="number" min="1" value={(productForm as any).breadthCm ?? 20} onChange={e => setProductForm({ ...productForm, breadthCm: +e.target.value } as any)} placeholder="B" style={{ flex: 1 }} />
                          <input type="number" min="1" value={(productForm as any).heightCm ?? 5} onChange={e => setProductForm({ ...productForm, heightCm: +e.target.value } as any)} placeholder="H" style={{ flex: 1 }} />
                        </div>
                      </div>
                    </div>
                    {/* Live weight calculation preview */}
                    {(() => {
                      const wg  = (productForm as any).weightGrams ?? 200;
                      const l   = (productForm as any).lengthCm   ?? 30;
                      const b   = (productForm as any).breadthCm  ?? 20;
                      const h   = (productForm as any).heightCm   ?? 5;
                      const dead = wg / 1000;
                      const vol  = (l * b * h) / 5000;
                      const chargeable = Math.max(dead, vol);
                      const isVol = vol > dead;
                      return (
                        <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--bg-3, #f8fafc)', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.82rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Dead weight</div>
                              <div style={{ fontWeight: 600 }}>{dead.toFixed(3)} kg</div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Volumetric <span style={{ fontWeight: 400 }}>(÷5000)</span></div>
                              <div style={{ fontWeight: 600 }}>{vol.toFixed(3)} kg</div>
                            </div>
                            <div style={{ background: isVol ? '#fef9c3' : '#f0fdf4', borderRadius: 6, padding: '4px 8px' }}>
                              <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Chargeable ✓</div>
                              <div style={{ fontWeight: 700, color: isVol ? '#854d0e' : '#166534' }}>{chargeable.toFixed(3)} kg</div>
                            </div>
                          </div>
                          <div style={{ marginTop: 6, color: 'var(--text-3)', fontSize: '0.75rem' }}>
                            {isVol ? 'Volumetric weight exceeds dead weight — couriers will charge the volumetric rate.' : 'Dead weight exceeds volumetric — couriers will charge the dead weight rate.'}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ── Options ── */}
                  <div className="pf-section">
                    <div className="pf-section-title">Options</div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Sizes</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                          {['XS','S','M','L','XL','XXL'].map(sz => (
                            <button key={sz} type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: '.8rem', minHeight: 'unset', background: (productForm.sizes||[]).includes(sz) ? 'var(--primary)' : undefined, color: (productForm.sizes||[]).includes(sz) ? '#fff' : undefined, borderRadius: 20 }}
                              onClick={() => setProductForm(f => ({ ...f, sizes: (f.sizes||[]).includes(sz) ? (f.sizes||[]).filter(s=>s!==sz) : [...(f.sizes||[]), sz] }))}>
                              {sz}
                            </button>
                          ))}
                        </div>
                        <input type="text" value={(productForm.sizes || []).join(', ')} onChange={e => setProductForm({ ...productForm, sizes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="or type custom sizes…" style={{ marginTop: 8 }} />
                      </div>
                      <div className="form-group">
                        <label>Colors</label>
                        {globalColors.length > 0 ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2, marginBottom: 6 }}>
                            {globalColors.map(gc => {
                              const selected = (productForm.colors||[]).includes(gc.hex);
                              return (
                                <button key={gc.hex} type="button" title={`${gc.name} (${gc.hex})`}
                                  style={{ width: 32, height: 32, borderRadius: '50%', background: gc.hex, border: selected ? '3px solid var(--primary)' : '2px solid rgba(0,0,0,.18)', cursor: 'pointer', outline: selected ? '2px solid var(--primary)' : 'none', outlineOffset: 2, transition: 'all .15s', flexShrink: 0 }}
                                  onClick={() => setProductForm(f => ({ ...f, colors: selected ? (f.colors||[]).filter(c => c !== gc.hex) : [...(f.colors||[]), gc.hex] }))}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', margin: '4px 0 6px' }}>
                            No palette yet. <button type="button" onClick={() => { closeProductForm(); setTab('colors'); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: '0.8rem' }}>Build palette →</button>
                          </p>
                        )}
                        {/* Show any legacy colours on the product that aren't in the current palette so admin can remove them */}
                        {(productForm.colors || []).filter(hex => !globalColors.some(gc => gc.hex === hex)).length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Not in palette (click to remove):</span>
                            {(productForm.colors || []).filter(hex => !globalColors.some(gc => gc.hex === hex)).map((hex, i) => (
                              <span key={i} title={`${hex} — click to remove`} style={{ width: 24, height: 24, borderRadius: '50%', background: hex, border: '2px solid #f97316', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
                                onClick={() => setProductForm(f => ({ ...f, colors: (f.colors||[]).filter(c => c !== hex) }))} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* ── Product Page Content ── */}
                  <div className="pf-section">
                    <div className="pf-section-title">
                      Product Page Content
                      <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.78rem', marginLeft: 8 }}>— optional; falls back to category defaults if empty</span>
                    </div>

                    <div className="form-group">
                      <label>Feature Chips <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.78rem' }}>— one per line (e.g. "180 GSM", "100% Cotton")</span></label>
                      <textarea
                        value={((productForm as any).highlights || []).join('\n')}
                        onChange={e => setProductForm({ ...productForm, highlights: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean) } as any)}
                        rows={3}
                        placeholder={'180 GSM\n100% Combed Cotton\nPre-Shrunk'}
                      />
                    </div>

                    <div className="form-group">
                      <label>Fabric &amp; Material Info</label>
                      <textarea
                        value={(productForm as any).fabricInfo || ''}
                        onChange={e => setProductForm({ ...productForm, fabricInfo: e.target.value } as any)}
                        rows={3}
                        placeholder="Describe the fabric, material quality, and key properties…"
                      />
                    </div>

                    <div className="form-group">
                      <label>Print Methods <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.78rem' }}>— comma-separated</span></label>
                      <input
                        type="text"
                        value={((productForm as any).printMethods || []).join(', ')}
                        onChange={e => setProductForm({ ...productForm, printMethods: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) } as any)}
                        placeholder="DTG Printing, DTF Transfer, Screen Printing"
                      />
                    </div>

                    <div className="form-group">
                      <label>Print Areas</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {((productForm as any).printAreas || []).map((area: any, i: number) => (
                          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="text" value={area.name} placeholder="Area name" style={{ flex: 2 }}
                              onChange={e => { const arr = [...(productForm as any).printAreas]; arr[i] = { ...arr[i], name: e.target.value }; setProductForm({ ...productForm, printAreas: arr } as any); }} />
                            <input type="text" value={area.w} placeholder='W e.g. 12"' style={{ flex: 1 }}
                              onChange={e => { const arr = [...(productForm as any).printAreas]; arr[i] = { ...arr[i], w: e.target.value }; setProductForm({ ...productForm, printAreas: arr } as any); }} />
                            <input type="text" value={area.h} placeholder='H e.g. 16"' style={{ flex: 1 }}
                              onChange={e => { const arr = [...(productForm as any).printAreas]; arr[i] = { ...arr[i], h: e.target.value }; setProductForm({ ...productForm, printAreas: arr } as any); }} />
                            <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', color: '#ef4444', minHeight: 'unset' }}
                              onClick={() => setProductForm({ ...productForm, printAreas: (productForm as any).printAreas.filter((_: any, idx: number) => idx !== i) } as any)}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: '.8rem', minHeight: 'unset' }}
                          onClick={() => setProductForm({ ...productForm, printAreas: [...((productForm as any).printAreas || []), { name: '', w: '', h: '' }] } as any)}>
                          + Add Print Area
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Care Instructions <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.78rem' }}>— one per line</span></label>
                      <textarea
                        value={((productForm as any).careInstructions || []).map((c: any) => c.text || c).join('\n')}
                        onChange={e => setProductForm({ ...productForm, careInstructions: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean).map(text => ({ text })) } as any)}
                        rows={4}
                        placeholder={'Machine wash cold (30°C)\nDo not bleach\nTumble dry low\nIron on reverse side only'}
                      />
                    </div>

                    <div className="form-group">
                      <label>FAQs</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {((productForm as any).faqs || []).map((faq: any, i: number) => (
                          <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', position: 'relative' }}>
                            <input type="text" value={faq.q} placeholder="Question" style={{ marginBottom: 6, fontWeight: 500 }}
                              onChange={e => { const arr = [...(productForm as any).faqs]; arr[i] = { ...arr[i], q: e.target.value }; setProductForm({ ...productForm, faqs: arr } as any); }} />
                            <textarea value={faq.a} placeholder="Answer" rows={2}
                              onChange={e => { const arr = [...(productForm as any).faqs]; arr[i] = { ...arr[i], a: e.target.value }; setProductForm({ ...productForm, faqs: arr } as any); }} />
                            <button type="button" className="btn btn-ghost" style={{ position: 'absolute', top: 8, right: 8, padding: '2px 6px', minHeight: 'unset', color: '#ef4444' }}
                              onClick={() => setProductForm({ ...productForm, faqs: (productForm as any).faqs.filter((_: any, idx: number) => idx !== i) } as any)}>
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: '.8rem', minHeight: 'unset' }}
                          onClick={() => setProductForm({ ...productForm, faqs: [...((productForm as any).faqs || []), { q: '', a: '' }] } as any)}>
                          + Add FAQ
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={closeProductForm}>Cancel</button>
                    {editingProduct && (
                      <button type="button" className="btn btn-ghost" onClick={() => window.open(`/products/${editingProduct.slug || editingProduct.id}`, '_blank')}>
                        <ExternalLink size={14} /> Preview Page
                      </button>
                    )}
                    <button type="submit" className="btn btn-primary" disabled={savingProduct}>
                      {savingProduct ? <div className="spinner-sm" /> : <><Save size={16} /> {editingProduct ? 'Update' : 'Create'}</>}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mockup Form Modal */}
        <AnimatePresence>
          {showMockupForm && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeMockupForm}>
              <motion.div className="modal modal-wide" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{editingMockup ? 'Edit Mockup' : 'Add New Mockup'}</h2>
                  <button className="icon-btn" onClick={closeMockupForm}><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveMockup} className="modal-body">
                  <div className="form-row">
                    <div className="form-group"><label>Name</label><input type="text" value={mockupForm.name} onChange={e => setMockupForm({ ...mockupForm, name: e.target.value })} placeholder="e.g. Classic T-Shirt" required /></div>
                    <div className="form-group">
                      <label>Category</label>
                      <select value={mockupForm.category} onChange={e => setMockupForm({ ...mockupForm, category: e.target.value })}>
                        <option value="">— Select category —</option>
                        {mockupCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Base Product Price (₹) <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>— cost of the physical item, added to design fee in cart</span></label>
                    <input type="number" min="0" step="1" value={mockupForm.basePrice ?? 0} onChange={e => setMockupForm({ ...mockupForm, basePrice: parseFloat(e.target.value) || 0 })} placeholder="e.g. 499" />
                    {(mockupForm.basePrice === 0 || !mockupForm.basePrice) && (
                      <p style={{ color: 'var(--warning, #d97706)', fontSize: '0.8rem', marginTop: 4 }}>⚠️ Base price is 0 — customers will only pay the design fee, not the product cost</p>
                    )}
                  </div>
                  {/* ── Transparency warning ── */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
                    <div style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: 1.5 }}>
                      <strong>Use transparent background (PNG only).</strong> Mockup images must have a transparent background so the selected product colour shows through correctly. Do <em>not</em> upload images with a white, grey, or any solid background.
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Front Image * <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>— transparent PNG required</span></label>
                    <div className="image-input-group">
                      <input type="text" value={mockupForm.frontImage} onChange={e => setMockupForm({ ...mockupForm, frontImage: e.target.value })} placeholder="https://... or upload a transparent PNG →" required />
                      <label className="btn btn-ghost upload-btn" title="Upload transparent PNG">
                        {uploadingField === 'frontImage' ? <div className="spinner-sm" /> : <><Upload size={14} /> Upload</>}
                        <input type="file" accept="image/png" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleMockupImageUpload('frontImage', f); e.target.value = ''; }} />
                      </label>
                    </div>
                    {mockupForm.frontImage && (
                      <>
                        <img src={mockupForm.frontImage} alt="Front preview" className="form-preview" style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' }} />
                        <button type="button" className="btn btn-ghost" style={{ marginTop: 6, fontSize: '0.8rem' }}
                          onClick={() => handleRemoveBg('frontImage')} disabled={removingBgField === 'frontImage'}>
                          {removingBgField === 'frontImage' ? <><div className="spinner-sm" /> Removing background…</> : <>✂ Remove Background</>}
                        </button>
                      </>
                    )}
                  </div>
                  {/* ── Back Image ── */}
                  <div className="form-group">
                    <label>Back Image (optional) <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>— transparent PNG required</span></label>
                    <div className="image-input-group">
                      <input type="text" value={mockupForm.backImage || ''} onChange={e => setMockupForm({ ...mockupForm, backImage: e.target.value })} placeholder="https://... or upload a transparent PNG →" />
                      <label className="btn btn-ghost upload-btn" title="Upload transparent PNG">
                        {uploadingField === 'backImage' ? <div className="spinner-sm" /> : <><Upload size={14} /> Upload</>}
                        <input type="file" accept="image/png" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleMockupImageUpload('backImage', f); e.target.value = ''; }} />
                      </label>
                    </div>
                    {mockupForm.backImage && (
                      <>
                        <img src={mockupForm.backImage} alt="Back preview" className="form-preview" style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' }} />
                        <button type="button" className="btn btn-ghost" style={{ marginTop: 6, fontSize: '0.8rem' }}
                          onClick={() => handleRemoveBg('backImage')} disabled={removingBgField === 'backImage'}>
                          {removingBgField === 'backImage' ? <><div className="spinner-sm" /> Removing background…</> : <>✂ Remove Background</>}
                        </button>
                      </>
                    )}
                  </div>
                  {/* ── Print Layouts & Pricing ── */}
                  <div className="form-group pae-section">
                    <label className="pae-main-label">
                      Print Layouts
                      <span className="pae-label-hint"> — define named printable zones, set dimensions and price per layout</span>
                    </label>

                    {/* Settings */}
                    <div className="pae-settings-row">
                      <label className="checkbox-label">
                        <input type="checkbox"
                          checked={(mockupForm.printArea as any)?.allowBackPrint ?? true}
                          onChange={e => updatePaeSetting('allowBackPrint', e.target.checked)} />
                        Allow back-side printing
                      </label>
                      <span className="pae-settings-hint">Set which layouts can be combined below ↓</span>
                    </div>

                    {/* Layout list */}
                    <div className="pae-layout-list">
                      {paeLayouts.map((layout, idx) => {
                        const color = LAYOUT_COLORS[idx % LAYOUT_COLORS.length];
                        return (
                          <div key={layout.id}
                            className={['pae-layout-item', activeLayoutId === layout.id ? 'active' : ''].join(' ')}
                            onClick={() => { setActiveLayoutId(layout.id); setPaeDraft(null); setPaeIsHoverMove(false); }}
                          >
                            <span className="pae-layout-dot" style={{ background: color }} />
                            <span className="pae-layout-name">{layout.name}</span>
                            <span className={`pae-side-badge pae-side-${layout.side.toLowerCase()}`}>{layout.side}</span>
                            {layout.price != null && <span className="pae-layout-price">₹{layout.price}</span>}
                            {layout.w > 0 && <span className="pae-tab-check">✓</span>}
                            <button type="button" className="pae-layout-delete" title="Remove layout"
                              onClick={e => { e.stopPropagation(); deleteLayout(layout.id); }}>×</button>
                          </div>
                        );
                      })}
                      {!showPaeAddForm ? (
                        <button type="button" className="btn btn-sm btn-ghost pae-add-btn" onClick={() => setShowPaeAddForm(true)}>
                          <Plus size={13} /> Add Layout
                        </button>
                      ) : (
                        <div className="pae-add-form">
                          <input type="text" placeholder="Layout name (e.g. Full Chest, Left Sleeve…)"
                            value={paeNewLayoutName} onChange={e => setPaeNewLayoutName(e.target.value)}
                            autoFocus onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewLayout(); } }} />
                          <select value={paeNewLayoutSide} onChange={e => setPaeNewLayoutSide(e.target.value as 'FRONT' | 'BACK')}>
                            <option value="FRONT">FRONT</option>
                            <option value="BACK">BACK</option>
                          </select>
                          <button type="button" className="btn btn-sm btn-primary" onClick={addNewLayout}>Add</button>
                          <button type="button" className="btn btn-sm btn-ghost"
                            onClick={() => { setShowPaeAddForm(false); setPaeNewLayoutName(''); }}>Cancel</button>
                        </div>
                      )}
                    </div>

                    <div className="pae-tab-body">
                      <div className="pae-canvas-col">
                        <div
                          ref={paeContainerRef}
                          className={'pae-canvas' + (!paeCurrentImage ? ' pae-canvas-empty' : '')}
                          style={{ cursor: !paeCurrentImage || !activeLayout ? 'default' : activeLayout.shape === 'polygon' ? 'crosshair' : paeIsHoverMove && !paeDraft ? 'move' : 'crosshair' }}
                          onMouseDown={e => { e.preventDefault(); handlePaeDragStart(e); }}
                          onMouseMove={handlePaeDragMove}
                          onMouseUp={handlePaeDragEnd}
                          onMouseLeave={() => { if (paeDragRef.current.dragging) handlePaeDragEnd(); setPaeIsHoverMove(false); }}
                          onClick={handlePaePolygonClick}
                          onDoubleClick={handlePaePolygonDblClick}
                        >
                          {paeCurrentImage
                            ? <img src={paeCurrentImage} alt="Mockup" className="pae-image" />
                            : <div className="pae-empty-hint">
                                {!activeLayout
                                  ? 'Add a layout first, then draw its print area'
                                  : activeLayout.side === 'BACK' ? 'Upload a back image to draw this area' : 'Upload a front image to draw this area'}
                              </div>
                          }
                          {/* Other layouts on same side, dimmed */}
                          {activeLayout && paeLayouts
                            .filter(l => l.id !== activeLayoutId && l.side === activeLayout.side && l.w > 0)
                            .map(l => {
                              const realIdx = paeLayouts.findIndex(x => x.id === l.id);
                              const c = LAYOUT_COLORS[realIdx % LAYOUT_COLORS.length];
                              return l.shape === 'polygon' && l.points && l.points.length >= 3 ? (
                                <svg key={l.id} style={{ position: 'absolute', inset: 0, width: PAE_W, height: PAE_H, pointerEvents: 'none', overflow: 'visible' }}>
                                  <polygon points={l.points.map(p => `${p.x * PAE_SCALE},${p.y * PAE_SCALE}`).join(' ')}
                                    fill={c + '18'} stroke={c} strokeWidth="1" strokeDasharray="3 2" />
                                  <text x={l.points[0].x * PAE_SCALE} y={Math.max(0, l.points[0].y * PAE_SCALE - 4)} fill={c} fontSize="9" fontFamily="sans-serif">{l.name}</text>
                                </svg>
                              ) : (
                                <div key={l.id} className="pae-rect pae-rect-other"
                                  style={{ left: l.x * PAE_SCALE, top: l.y * PAE_SCALE, width: l.w * PAE_SCALE, height: l.h * PAE_SCALE, borderColor: c, borderRadius: (l.shape === 'ellipse' || l.shape === 'circle') ? '50%' : undefined }}>
                                  <span className="pae-rect-label" style={{ color: c }}>{l.name}</span>
                                </div>
                              );
                            })}
                          {/* Active layout rect */}
                          {!paeDraft && paePolygonPoints.length === 0 && activeLayout && activeLayout.w > 0 && (() => {
                            const activeIdx = paeLayouts.findIndex(l => l.id === activeLayoutId);
                            const c = LAYOUT_COLORS[activeIdx % LAYOUT_COLORS.length];
                            return activeLayout.shape === 'polygon' && activeLayout.points && activeLayout.points.length >= 3 ? (
                              <svg style={{ position: 'absolute', inset: 0, width: PAE_W, height: PAE_H, pointerEvents: 'none', overflow: 'visible' }}>
                                <polygon points={activeLayout.points.map(p => `${p.x * PAE_SCALE},${p.y * PAE_SCALE}`).join(' ')}
                                  fill={c + '28'} stroke={c} strokeWidth="1.5" strokeDasharray="6 3" />
                                {activeLayout.points.map((pt, i) => (
                                  <circle key={i} cx={pt.x * PAE_SCALE} cy={pt.y * PAE_SCALE} r={i === 0 ? 4 : 3} fill={c} />
                                ))}
                                <text x={activeLayout.points[0].x * PAE_SCALE} y={Math.max(8, activeLayout.points[0].y * PAE_SCALE - 4)} fill={c} fontSize="9" fontFamily="sans-serif" fontWeight="600">{activeLayout.name}</text>
                              </svg>
                            ) : (
                              <div className="pae-rect pae-rect-active"
                                style={{ left: activeLayout.x * PAE_SCALE, top: activeLayout.y * PAE_SCALE, width: activeLayout.w * PAE_SCALE, height: activeLayout.h * PAE_SCALE, borderColor: c, background: c + '28', borderRadius: (activeLayout.shape === 'ellipse' || activeLayout.shape === 'circle') ? '50%' : undefined }}>
                                <span className="pae-rect-label" style={{ color: c }}>{activeLayout.name}</span>
                                {paeIsHoverMove && <span className="pae-move-hint">drag to move</span>}
                              </div>
                            );
                          })()}
                          {/* Draft rect */}
                          {paeDraft && (() => {
                            const activeIdx = paeLayouts.findIndex(l => l.id === activeLayoutId);
                            const c = LAYOUT_COLORS[activeIdx % LAYOUT_COLORS.length];
                            const isRound = activeLayout?.shape === 'ellipse' || activeLayout?.shape === 'circle';
                            return (
                              <div className="pae-rect pae-rect-live"
                                style={{ left: paeDraft.x * PAE_SCALE, top: paeDraft.y * PAE_SCALE, width: Math.max(2, paeDraft.w * PAE_SCALE), height: Math.max(2, paeDraft.h * PAE_SCALE), borderColor: c, background: c + '22', borderRadius: isRound ? '50%' : undefined }} />
                            );
                          })()}
                          {/* In-progress polygon points */}
                          {activeLayout?.shape === 'polygon' && paePolygonPoints.length > 0 && (() => {
                            const activeIdx = paeLayouts.findIndex(l => l.id === activeLayoutId);
                            const c = LAYOUT_COLORS[activeIdx % LAYOUT_COLORS.length];
                            return (
                              <svg style={{ position: 'absolute', inset: 0, width: PAE_W, height: PAE_H, pointerEvents: 'none', overflow: 'visible' }}>
                                {paePolygonPoints.length >= 2 && (
                                  <polyline points={paePolygonPoints.map(p => `${p.x * PAE_SCALE},${p.y * PAE_SCALE}`).join(' ')}
                                    fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="5 2" />
                                )}
                                {paePolygonPoints.map((pt, i) => (
                                  <circle key={i} cx={pt.x * PAE_SCALE} cy={pt.y * PAE_SCALE} r={i === 0 ? 6 : 4}
                                    fill={i === 0 ? c : '#fff'} stroke={c} strokeWidth="1.5" style={{ cursor: 'pointer' }} />
                                ))}
                                {paePolygonPoints.length >= 3 && (
                                  <text x={paePolygonPoints[0].x * PAE_SCALE + 8} y={paePolygonPoints[0].y * PAE_SCALE - 4} fill={c} fontSize="8" fontFamily="sans-serif">close</text>
                                )}
                              </svg>
                            );
                          })()}
                        </div>
                        <p className="pae-canvas-hint">{activeLayout ? (activeLayout.shape === 'polygon' ? 'Click to place dots · double-click or click first dot to close polygon' : 'Drag to draw print area · drag existing rect to reposition') : 'Select a layout first'} · Canvas: 800×1000 px</p>
                      </div>
                      <div className="pae-controls-col">
                        {activeLayout ? (
                          <>
                            <div className="pae-control-section">
                              <div className="pae-control-label">
                                <span className="pae-layout-dot" style={{ background: LAYOUT_COLORS[paeLayouts.findIndex(l => l.id === activeLayoutId) % LAYOUT_COLORS.length] }} />
                                Price — {activeLayout.name}
                              </div>
                              <div className="pae-price-row">
                                <span className="pae-rupee">₹</span>
                                <input type="number" min={0} className="pae-price-input"
                                  value={activeLayout.price ?? 499}
                                  onChange={e => updateActiveLayout({ price: +e.target.value })} />
                              </div>
                            </div>
                            <div className="pae-control-section">
                              <div className="pae-control-label">Coordinates (px on 800×1000 canvas)</div>
                              <div className="pae-coord-grid">
                                {(['x', 'y', 'w', 'h'] as const).map(field => (
                                  <label key={field} className="pae-coord-field">
                                    <span>{field.toUpperCase()}</span>
                                    <input type="number" min={0}
                                      max={field === 'x' || field === 'w' ? 800 : 1000}
                                      value={(activeLayout as any)[field] ?? ''}
                                      onChange={e => updateActiveLayout({ [field]: +e.target.value })} />
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="pae-control-section">
                              <div className="pae-control-label">Shape</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {(['rect','ellipse','circle','polygon'] as const).map(s => (
                                  <button key={s} type="button"
                                    className={`btn btn-sm ${(activeLayout.shape ?? 'rect') === s ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}
                                    onClick={() => { updateActiveLayout({ shape: s, ...(s !== 'polygon' ? { points: undefined } : {}) }); setPaePolygonPoints([]); }}>
                                    {s === 'rect'
                                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                                      : s === 'ellipse'
                                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="7"/></svg>
                                      : s === 'circle'
                                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>
                                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,3 21,9 18,20 6,20 3,9"/></svg>
                                    }
                                    {s === 'rect' ? 'Rect' : s === 'ellipse' ? 'Ellipse' : s === 'circle' ? 'Circle' : 'Polygon'}
                                  </button>
                                ))}
                              </div>
                              {activeLayout.shape === 'polygon' && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginTop: 6 }}>
                                  Click on the canvas to place dots · double-click or click the first dot to close polygon
                                  {paePolygonPoints.length > 0 && <button type="button" className="btn btn-sm btn-ghost" style={{ marginLeft: 8, padding: '0 6px', height: 20, fontSize: '0.68rem' }} onClick={() => setPaePolygonPoints([])}>✕ Reset</button>}
                                </p>
                              )}
                            </div>
                            <div className="pae-button-stack">
                              {activeLayout.w > 0 && (
                                <button type="button" className="btn btn-sm btn-ghost pae-clear-btn"
                                  onClick={() => { updateActiveLayout({ x: 0, y: 0, w: 0, h: 0, points: undefined }); setPaePolygonPoints([]); }}>
                                  ✕ Clear area for "{activeLayout.name}"
                                </button>
                              )}
                            </div>
                            {/* ── Compatibility: which layouts can be ordered together ── */}
                            {paeLayouts.length > 1 && (
                              <div className="pae-compat-section">
                                <div className="pae-control-label">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                                  Can combine with
                                </div>
                                <p className="pae-compat-hint">Client can add these layouts to the same order</p>
                                <div className="pae-compat-list">
                                  {paeLayouts.filter(l => l.id !== activeLayoutId).map((l, idx) => {
                                    const isChecked = (activeLayout.compatibleWith ?? []).includes(l.id);
                                    const lColor = LAYOUT_COLORS[paeLayouts.findIndex(x => x.id === l.id) % LAYOUT_COLORS.length];
                                    return (
                                      <label key={l.id} className={`pae-compat-item ${isChecked ? 'checked' : ''}`}>
                                        <input type="checkbox" checked={isChecked}
                                          onChange={() => toggleCompatibility(activeLayoutId!, l.id)} />
                                        <span className="pae-layout-dot" style={{ background: lColor }} />
                                        <span className="pae-compat-name">{l.name}</span>
                                        <span className={`pae-side-badge pae-side-${l.side.toLowerCase()}`}>{l.side}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="pae-no-layout">
                            <p>Select a layout from the list to edit its print area and price.</p>
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 6 }}>Use "+ Add Layout" to create named printable zones for this mockup.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Front Shadow (optional)</label>
                      <div className="image-input-group">
                        <input type="text" value={mockupForm.frontShadow || ''} onChange={e => setMockupForm({ ...mockupForm, frontShadow: e.target.value })} placeholder="URL or upload" />
                        <label className="btn btn-ghost upload-btn" title="Upload shadow PNG">
                          {uploadingField === 'frontShadow' ? <div className="spinner-sm" /> : <><Upload size={14} /> Upload</>}
                          <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleMockupImageUpload('frontShadow', f); e.target.value = ''; }} />
                        </label>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Back Shadow (optional)</label>
                      <div className="image-input-group">
                        <input type="text" value={mockupForm.backShadow || ''} onChange={e => setMockupForm({ ...mockupForm, backShadow: e.target.value })} placeholder="URL or upload" />
                        <label className="btn btn-ghost upload-btn" title="Upload shadow PNG">
                          {uploadingField === 'backShadow' ? <div className="spinner-sm" /> : <><Upload size={14} /> Upload</>}
                          <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleMockupImageUpload('backShadow', f); e.target.value = ''; }} />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="form-row checkboxes">
                    <label className="checkbox-label"><input type="checkbox" checked={mockupForm.active ?? true} onChange={e => setMockupForm({ ...mockupForm, active: e.target.checked })} /> Active</label>
                    <label className="checkbox-label" style={{ marginLeft: 16 }}>
                      <input type="checkbox" checked={(mockupForm as any).colorFilter ?? false} onChange={e => setMockupForm({ ...mockupForm, colorFilter: e.target.checked } as any)} />
                      Apply Color Filter
                      <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-3)' }}>(tints mockup to selected color — enable for apparel, disable for stickers/badges)</span>
                    </label>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={closeMockupForm}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={savingMockup}>
                      {savingMockup ? <div className="spinner-sm" /> : <><Save size={16} /> {editingMockup ? 'Update' : 'Create'}</>}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shipping Zone Form Modal */}
        <AnimatePresence>
          {showShippingZoneForm && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShippingZoneForm(false)}>
              <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{editingShippingZone ? 'Edit Shipping Zone' : 'Add Shipping Zone'}</h2>
                  <button className="icon-btn" onClick={() => setShowShippingZoneForm(false)}><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveShippingZone} className="modal-body">
                  <div className="form-group">
                    <label>Zone Label *</label>
                    <input type="text" value={shippingZoneForm.label || ''} onChange={e => setShippingZoneForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Pune & PCMC" required />
                  </div>
                  <div className="form-group">
                    <label>Pin Code Prefixes <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>— comma-separated (leave empty for catch-all)</span></label>
                    <input type="text" value={(shippingZoneForm.pinPatterns || []).join(', ')}
                      onChange={e => setShippingZoneForm(f => ({ ...f, pinPatterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                      placeholder="e.g. 411, 412, 413" />
                    <p style={{ fontSize: '.78rem', color: 'var(--text-3)', margin: '4px 0 0' }}>Pune city: 411 · Maharashtra: 4 · Leave blank to match all other pins.</p>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Delivery Type</label>
                      <select value={shippingZoneForm.deliveryType || 'standard'} onChange={e => setShippingZoneForm(f => ({ ...f, deliveryType: e.target.value }))}>
                        <option value="standard">Standard</option>
                        <option value="express">Express</option>
                        <option value="economy">Economy</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Estimated Delivery</label>
                      <input type="text" value={shippingZoneForm.estimatedDays || '5-7 days'} onChange={e => setShippingZoneForm(f => ({ ...f, estimatedDays: e.target.value }))} placeholder="e.g. 2-3 days" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Min Weight (grams) <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>0 = any</span></label>
                      <input type="number" min="0" step="1" value={shippingZoneForm.weightFromGrams ?? 0} onChange={e => setShippingZoneForm(f => ({ ...f, weightFromGrams: +e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Max Weight (grams) <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>99999 = unlimited</span></label>
                      <input type="number" min="0" step="1" value={shippingZoneForm.weightToGrams ?? 99999} onChange={e => setShippingZoneForm(f => ({ ...f, weightToGrams: +e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Shipping Charge (₹)</label>
                      <input type="number" min="0" step="1" value={shippingZoneForm.shippingCharge ?? 49} onChange={e => setShippingZoneForm(f => ({ ...f, shippingCharge: +e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Free Shipping Above (₹)</label>
                      <input type="number" min="0" step="1" value={shippingZoneForm.freeAbove ?? 999} onChange={e => setShippingZoneForm(f => ({ ...f, freeAbove: +e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Sort Order</label>
                      <input type="number" min="0" value={shippingZoneForm.sortOrder ?? 0} onChange={e => setShippingZoneForm(f => ({ ...f, sortOrder: +e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
                      <label className="checkbox-label"><input type="checkbox" checked={shippingZoneForm.active ?? true} onChange={e => setShippingZoneForm(f => ({ ...f, active: e.target.checked }))} /> Active</label>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setShowShippingZoneForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={savingShippingZone}>
                      {savingShippingZone ? <div className="spinner-sm" /> : <><Save size={16} /> {editingShippingZone ? 'Update' : 'Create'}</>}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tracking Management Modal */}
        <AnimatePresence>
          {trackingModal && (() => {
            const tOrder = orders.find(o => o.id === trackingModal);
            const manualEvents: any[] = (tOrder?.shipment?.trackingData as any)?.manual_events || [];
            return (
              <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTrackingModal(null)}>
                <motion.div className="modal tracking-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2><Truck size={18} /> Manage Tracking — #{trackingModal.slice(0, 8).toUpperCase()}</h2>
                    <button className="icon-btn" onClick={() => setTrackingModal(null)}><X size={20} /></button>
                  </div>
                  <div className="modal-body tracking-modal-body">
                    {/* Section 1: Shipment Info */}
                    <div className="tracking-modal-section">
                      <h4>Shipment Info</h4>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Courier Name</label>
                          <input type="text" placeholder="e.g. Delhivery, BlueDart" value={trackingManualForm.courierName}
                            onChange={e => setTrackingManualForm(f => ({ ...f, courierName: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label>AWB / Tracking Number</label>
                          <input type="text" placeholder="e.g. 1234567890" value={trackingManualForm.awbCode}
                            onChange={e => setTrackingManualForm(f => ({ ...f, awbCode: e.target.value }))} />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Estimated Delivery Date</label>
                          <input type="date" value={trackingManualForm.estimatedDelivery}
                            onChange={e => setTrackingManualForm(f => ({ ...f, estimatedDelivery: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label>Shipment Status</label>
                          <select value="" onChange={e => {
                            if (e.target.value) handleSaveManualTracking();
                          }}>
                            <option value="">Select to update status…</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                          </select>
                        </div>
                      </div>
                      <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={handleSaveManualTracking} disabled={savingTracking}>
                        {savingTracking ? <div className="spinner-sm" /> : <><Save size={14} /> Save Shipment Info</>}
                      </button>
                    </div>

                    {/* Section 2: Add Tracking Event */}
                    <div className="tracking-modal-section">
                      <h4>Add Tracking Checkpoint</h4>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Status / Title</label>
                          <input type="text" placeholder="e.g. Out for Delivery" value={trackingEventForm.status}
                            onChange={e => setTrackingEventForm(f => ({ ...f, status: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label>Location (optional)</label>
                          <input type="text" placeholder="e.g. Mumbai Hub" value={trackingEventForm.location}
                            onChange={e => setTrackingEventForm(f => ({ ...f, location: e.target.value }))} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Message / Description</label>
                        <input type="text" placeholder="Short description of this checkpoint" value={trackingEventForm.message}
                          onChange={e => setTrackingEventForm(f => ({ ...f, message: e.target.value }))} />
                      </div>
                      <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={handleAddTrackingEvent} disabled={savingTracking}>
                        {savingTracking ? <div className="spinner-sm" /> : <><Plus size={14} /> Add Checkpoint</>}
                      </button>
                    </div>

                    {/* Section 3: Existing Events */}
                    {manualEvents.length > 0 && (
                      <div className="tracking-modal-section">
                        <h4>Tracking History</h4>
                        <div className="tracking-modal-events">
                          {manualEvents.map((ev: any, i: number) => (
                            <div key={ev.id || i} className="tracking-modal-event">
                              <div className="tme-dot" />
                              <div className="tme-body">
                                <p className="tme-status">{ev.status}</p>
                                <p className="tme-message">{ev.message}</p>
                                {ev.location && <p className="tme-location"><MapPin size={10} /> {ev.location}</p>}
                                <p className="tme-time">{new Date(ev.timestamp).toLocaleString('en-IN')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        {/* ── Shipping Calculator Tab ───────────────────────────────────── */}
        {tab === 'shipping' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: '0 0 4px' }}>Shipping Zones &amp; Charges</h2>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', margin: 0 }}>
                  Zones are matched by pincode prefix at checkout. Specific zones are checked first; the catch-all handles the rest.
                </p>
              </div>
              <button className="icon-btn" title="Refresh" onClick={() => api.getShippingZones().then(setShippingZones).catch(() => {})}><RefreshCw size={15} /></button>
            </div>

            {/* Shipping Zones Section */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IndianRupee size={16} /> Shipping Zones &amp; Charges
                </h3>
                <button className="btn btn-primary btn-sm" onClick={openNewShippingZone} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={14} /> Add Zone
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: '0 0 14px' }}>
                Zones are matched by pincode prefix, weight range, and delivery type. Specific pin-pattern zones are checked first; the catch-all handles the rest.
              </p>
              {shippingZones.length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>No zones configured yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {shippingZones.map(z => {
                    const typeLabel: Record<string, string> = { standard: 'Standard', express: 'Express', economy: 'Economy' };
                    const weightLabel = (z.weightFromGrams === 0 && z.weightToGrams >= 99999)
                      ? 'Any weight'
                      : `${z.weightFromGrams}g – ${z.weightToGrams >= 99999 ? '∞' : z.weightToGrams + 'g'}`;
                    return (
                      <div key={z.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 8, border: `1px solid ${z.active ? 'var(--border)' : '#fca5a5'}` }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{z.label}</span>
                            <span style={{ fontSize: '0.72rem', padding: '1px 7px', borderRadius: 10, background: z.deliveryType === 'express' ? '#fef9c3' : z.deliveryType === 'economy' ? '#f0fdf4' : '#eff6ff', color: z.deliveryType === 'express' ? '#854d0e' : z.deliveryType === 'economy' ? '#166534' : '#1e40af' }}>{typeLabel[z.deliveryType] || z.deliveryType}</span>
                            {z.pinPatterns.length > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>Pins: {z.pinPatterns.join(', ')}</span>}
                            {z.pinPatterns.length === 0 && <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>(catch-all)</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: 3 }}>
                            ₹{z.shippingCharge} · Free above ₹{z.freeAbove} · {weightLabel} · {z.estimatedDays} · {z.active ? '✅ Active' : '❌ Inactive'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditShippingZone(z)}><Edit3 size={14} /></button>
                          <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDeleteShippingZone(z.id)}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        </AnimatePresence>
      </div>
    </div>
  );
}

