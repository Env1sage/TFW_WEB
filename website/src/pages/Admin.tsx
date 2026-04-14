import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Edit3, Trash2, X, Save, ShoppingCart,
  BarChart3, Users, IndianRupee, TrendingUp, Image, Eye, EyeOff, Database, Palette, Download, Upload, Tag, Copy, Check, ChevronDown, ChevronUp, MapPin, Mail, User, Clock, Hash, LogOut, Truck, Percent, DollarSign, Calendar, Sparkles,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Product, Order, DesignOrder, Coupon } from '../types';
import toast from 'react-hot-toast';

interface Mockup {
  id: string; name: string; category: string;
  frontImage: string; backImage?: string;
  frontShadow?: string; backShadow?: string;
  printArea: any; basePrice?: number; active: boolean; createdAt: string;
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

interface Category {
  id: string; name: string; slug: string; createdAt: string;
}

interface MockupCategory {
  id: string; name: string; slug: string; createdAt: string;
}

const defaultProduct: Partial<Product> = {
  name: '', description: '', price: 0, category: '', image: '', images: [], customizable: true,
  featured: false, colors: ['#000000', '#ffffff', '#6366f1'], sizes: ['S', 'M', 'L', 'XL'], rating: 4.5, reviewCount: 0,
  weightGrams: 200, lengthCm: 30, breadthCm: 20, heightCm: 5,
};

const defaultMockup: Partial<Mockup> = {
  name: '', category: '', frontImage: '', backImage: '', frontShadow: '', backShadow: '',
  printArea: { layouts: [], allowMultipleLayouts: false, allowBackPrint: true }, basePrice: 0, active: true,
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

type Tab = 'analytics' | 'products' | 'categories' | 'mockup-categories' | 'orders' | 'mockups' | 'coupons' | 'database' | 'shiprocket' | 'email' | 'colors';

const defaultCoupon: Partial<Coupon> = {
  code: '', description: '', discountType: 'percentage', discountValue: 0,
  minOrderAmount: 0, maxUses: null, validFrom: null, validUntil: null,
  active: true, popupEnabled: false, popupMessage: '',
};

export default function Admin() {
  const { logout } = useAuth();
  const [tab, setTab] = useState<Tab>('analytics');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [designOrders, setDesignOrders] = useState<DesignOrder[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [dbData, setDbData] = useState<Record<string, { count: number; columns: string[]; rows: any[] }> | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbTable, setDbTable] = useState('website_products');
  const [loading, setLoading] = useState(true);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormName, setCategoryFormName] = useState('');
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
  interface ShippingZone { id: string; name: string; label: string; pinPatterns: string[]; shippingCharge: number; freeAbove: number; sortOrder: number; active: boolean; createdAt: string; }
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
  const [colorPickerValue, setColorPickerValue] = useState('#ff0000');
  // Global colour palette (persisted in localStorage)
  const [globalColors, setGlobalColors] = useState<{name: string, hex: string}[]>(() => {
    try { return JSON.parse(localStorage.getItem('tfw_global_colors') || '[]'); } catch { return []; }
  });
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');

  // Print area editor
  const [paeDraft, setPaeDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [paeIsHoverMove, setPaeIsHoverMove] = useState(false);
  const [showPaeAddForm, setShowPaeAddForm] = useState(false);
  const [paeNewLayoutName, setPaeNewLayoutName] = useState('');
  const [paeNewLayoutSide, setPaeNewLayoutSide] = useState<'FRONT' | 'BACK'>('FRONT');
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
      const [p, o, a, m, d, cats, mockupCats, coup, zones] = await Promise.all([
        api.getProducts(), api.getAllOrders(), api.getAnalytics(), api.getMockups(), api.getAllDesignOrders(), api.getCategories(), api.getMockupCategories(), api.getCoupons(), api.getShippingZones(),
      ]);
      setProducts(p); setOrders(o); setAnalytics(a); setMockups(m); setDesignOrders(d); setCategories(cats); setMockupCategories(mockupCats); setCoupons(coup); setShippingZones(zones);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const loadDb = async () => {
    setDbLoading(true);
    try {
      const data = await api.getDbViewer();
      setDbData(data);
    } catch { toast.error('Failed to load database'); }
    finally { setDbLoading(false); }
  };

  // Product CRUD
  const openNewProduct = () => { setEditingProduct(null); setProductForm({ ...defaultProduct }); setShowProductForm(true); };
  const openEditProduct = (p: Product) => { setEditingProduct(p); setProductForm({ ...p, colors: [...new Set(p.colors || [])] }); setShowProductForm(true); };
  const closeProductForm = () => { setShowProductForm(false); setEditingProduct(null); };
  const saveGlobalColors = (cols: {name: string, hex: string}[]) => {
    setGlobalColors(cols); localStorage.setItem('tfw_global_colors', JSON.stringify(cols));
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
    // Deduplicate colors before saving
    const cleanForm = { ...productForm, colors: [...new Set((productForm.colors || []).map(c => c.trim().toLowerCase()))] };
    setSavingProduct(true);
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, cleanForm);
        toast.success('Product updated');
      } else {
        await api.createProduct(cleanForm as Omit<Product, 'id' | 'createdAt'>);
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
  const openNewCategory = () => { setEditingCategory(null); setCategoryFormName(''); setShowCategoryForm(true); };
  const openEditCategory = (c: Category) => { setEditingCategory(c); setCategoryFormName(c.name); setShowCategoryForm(true); };
  const closeCategoryForm = () => { setShowCategoryForm(false); setEditingCategory(null); setCategoryFormName(''); };
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryFormName.trim()) { toast.error('Category name is required'); return; }
    setSavingCategory(true);
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, { name: categoryFormName.trim() });
        toast.success('Category updated');
      } else {
        await api.createCategory({ name: categoryFormName.trim() });
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
  const openNewShippingZone = () => { setEditingShippingZone(null); setShippingZoneForm({ label: '', pinPatterns: [], shippingCharge: 49, freeAbove: 999, sortOrder: 0, active: true }); setShowShippingZoneForm(true); };
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
  const openNewMockup = () => { setEditingMockup(null); setMockupForm({ ...defaultMockup }); setPaeDraft(null); setActiveLayoutId(null); setShowPaeAddForm(false); setPaeNewLayoutName(''); setShowMockupForm(true); };
  const openEditMockup = (m: Mockup) => {
    const normalized = normalizePrintArea(m.printArea);
    setEditingMockup(m); setMockupForm({ ...m, printArea: normalized }); setPaeDraft(null);
    setActiveLayoutId(normalized.layouts[0]?.id || null); setShowPaeAddForm(false); setPaeNewLayoutName(''); setShowMockupForm(true);
  };
  const closeMockupForm = () => { setShowMockupForm(false); setEditingMockup(null); setPaeDraft(null); setActiveLayoutId(null); setShowPaeAddForm(false); setPaeNewLayoutName(''); };

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
    const newLayout: PrintLayout = { id: crypto.randomUUID(), name: paeNewLayoutName.trim(), side: paeNewLayoutSide, x: 0, y: 0, w: 0, h: 0, price: 499 };
    setMockupForm(prev => ({ ...prev, printArea: { ...prev.printArea, layouts: [...(prev.printArea as any).layouts, newLayout] } }));
    setActiveLayoutId(newLayout.id); setShowPaeAddForm(false); setPaeNewLayoutName('');
    toast.success(`Layout "${newLayout.name}" added — draw its print area on the canvas`);
  };
  const handlePaeDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!paeCurrentImage || !activeLayout) return;
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
      setPaeDraft({
        x: Math.round(Math.min(x, startX) / PAE_SCALE), y: Math.round(Math.min(y, startY) / PAE_SCALE),
        w: Math.round(Math.abs(x - startX) / PAE_SCALE), h: Math.round(Math.abs(y - startY) / PAE_SCALE),
      });
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
        <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Admin Dashboard</h1>
          <button className="btn btn-outline" onClick={() => { logout(); window.location.href = '/'; }} style={{ gap: 6 }}><LogOut size={16} /> Logout</button>
        </motion.div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button className={`tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}><BarChart3 size={16} /> Analytics</button>
          <button className={`tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}><Package size={16} /> Products</button>
          <button className={`tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}><Tag size={16} /> Categories</button>
          <button className={`tab ${tab === 'mockup-categories' ? 'active' : ''}`} onClick={() => setTab('mockup-categories')}><Tag size={16} /> Mockup Categories</button>
          <button className={`tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}><ShoppingCart size={16} /> Orders</button>
          <button className={`tab ${tab === 'mockups' ? 'active' : ''}`} onClick={() => setTab('mockups')}><Image size={16} /> Mockups</button>
          <button className={`tab ${tab === 'coupons' ? 'active' : ''}`} onClick={() => setTab('coupons')}><Percent size={16} /> Coupons ({coupons.length})</button>
          <button className={`tab ${tab === 'database' ? 'active' : ''}`} onClick={() => { setTab('database'); if (!dbData) loadDb(); }}><Database size={16} /> Database</button>
          <button className={`tab ${tab === 'shiprocket' ? 'active' : ''}`} onClick={() => setTab('shiprocket')}><Truck size={16} /> Shiprocket</button>
          <button className={`tab ${tab === 'email' ? 'active' : ''}`} onClick={() => setTab('email')}><Mail size={16} /> Email</button>
          <button className={`tab ${tab === 'colors' ? 'active' : ''}`} onClick={() => setTab('colors')}><Palette size={16} /> Colors</button>
        </div>

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
              <button className="btn btn-primary" onClick={openNewProduct}><Plus size={16} /> Add Product</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Featured</th><th>Actions</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td><img src={p.image} alt={p.name} className="table-thumb" /></td>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.category}</td>
                      <td>₹{p.price.toFixed(2)}</td>
                      <td>{p.stock}</td>
                      <td>{p.featured ? '⭐' : '—'}</td>
                      <td>
                        <button className="icon-btn" onClick={() => openEditProduct(p)}><Edit3 size={16} /></button>
                        <button className="icon-btn danger" onClick={() => handleDeleteProduct(p.id)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
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
                              <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{dOrders[0]?.productType}</span>
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
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Product</strong><p style={{ textTransform: 'capitalize', margin: '4px 0 0' }}>{o.productType}</p></div>
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

        {/* Database Tab */}
        {tab === 'database' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="section-toolbar">
              <h2>Database Viewer</h2>
              <button className="btn btn-primary" onClick={loadDb} disabled={dbLoading}>
                {dbLoading ? <div className="spinner-sm" /> : 'Refresh'}
              </button>
            </div>
            {dbLoading && !dbData ? (
              <div className="page-loader"><div className="spinner" /></div>
            ) : dbData ? (
              <>
                <div className="db-table-selector">
                  {Object.entries(dbData).map(([table, info]) => (
                    <button key={table} className={`tab ${dbTable === table ? 'active' : ''}`}
                      onClick={() => setDbTable(table)}>
                      {table.replace('website_', '')} ({info.count})
                    </button>
                  ))}
                </div>
                {dbData[dbTable] && (
                  <div className="admin-table-wrap">
                    <table className="admin-table db-table">
                      <thead>
                        <tr>{dbData[dbTable].columns.map(col => <th key={col}>{col}</th>)}</tr>
                      </thead>
                      <tbody>
                        {dbData[dbTable].rows.map((row, i) => (
                          <tr key={i}>
                            {dbData[dbTable].columns.map(col => (
                              <td key={col} className="db-cell">
                                {typeof row[col] === 'object' && row[col] !== null
                                  ? JSON.stringify(row[col]).slice(0, 80)
                                  : String(row[col] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {dbData[dbTable].rows.length === 0 && (
                          <tr><td colSpan={dbData[dbTable].columns.length} className="empty-msg">No rows</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <p className="empty-msg">Click to load database data.</p>
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

            {/* Shipping Zones Section */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IndianRupee size={16} /> Shipping Zones &amp; Charges
                </h3>
                <button className="btn btn-primary btn-sm" onClick={openNewShippingZone} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={14} /> Add Zone
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: '0 0 14px' }}>
                Zones are matched by pin code prefix. Specific zones (with pin patterns) are checked first; the catch-all zone handles the rest.
              </p>
              {shippingZones.length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>No zones configured yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {shippingZones.map(z => (
                    <div key={z.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 8, border: `1px solid ${z.active ? 'var(--border)' : '#fca5a5'}` }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{z.label}</span>
                        {z.pinPatterns.length > 0 && <span style={{ marginLeft: 8, fontSize: '0.78rem', color: 'var(--text-2)' }}>Pin prefixes: {z.pinPatterns.join(', ')}</span>}
                        {z.pinPatterns.length === 0 && <span style={{ marginLeft: 8, fontSize: '0.78rem', color: 'var(--text-3)' }}>(catch-all)</span>}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: 2 }}>
                          ₹{z.shippingCharge} shipping · Free above ₹{z.freeAbove} · {z.active ? '✅ Active' : '❌ Inactive'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditShippingZone(z)}><Edit3 size={14} /></button>
                        <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDeleteShippingZone(z.id)}><Trash2 size={14} /></button>
                      </div>
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
            <h2 style={{ marginBottom: 6 }}>Email / SMTP Diagnostics</h2>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 24 }}>
              Test your SMTP configuration. A test email will be sent to your admin address.
            </p>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 28 }}>
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
                        Fix: add <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>, <code>SMTP_FROM</code>, and <code>ADMIN_EMAIL</code> to{' '}
                        <code>/opt/tfw/.env.production</code>, then rebuild.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Colors Tab */}
        {tab === 'colors' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: 640 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 6px' }}>Colour Palette</h2>
              <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', margin: 0 }}>Define available colours. These appear as one-click swatches when adding or editing a product.</p>
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
            {globalColors.length === 0 ? (
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

        {/* Product Form Modal */}
        <AnimatePresence>
          {showProductForm && (            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeProductForm}>
              <motion.div className="modal" style={{ maxWidth: 720 }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                  <button className="icon-btn" onClick={closeProductForm}><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveProduct} className="modal-body">

                  {/* ── Basic Info ── */}
                  <div className="pf-section">
                    <div className="pf-section-title">Basic Info</div>
                    <div className="form-row">
                      <div className="form-group"><label>Product Name *</label><input type="text" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="e.g. Classic Polo T-Shirt" required /></div>
                      <div className="form-group">
                        <label>Category *</label>
                        <select value={(productForm as any).categoryId || ''} onChange={e => { const cat = categories.find(c => c.id === e.target.value); setProductForm({ ...productForm, category: cat?.name || '', ...(cat ? { categoryId: cat.id } : { categoryId: '' }) } as any); }} required>
                          <option value="">— Select category —</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Price (₹) *</label><input type="number" step="0.01" min="0" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: +e.target.value })} required /></div>
                      <div className="form-group">
                        <label className="pf-row-label">
                          <span>Flags</span>
                        </label>
                        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                          <label className="checkbox-label"><input type="checkbox" checked={productForm.customizable} onChange={e => setProductForm({ ...productForm, customizable: e.target.checked })} /> Customizable</label>
                          <label className="checkbox-label"><input type="checkbox" checked={productForm.featured} onChange={e => setProductForm({ ...productForm, featured: e.target.checked })} /> Featured</label>
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
                    <div className="pf-section-title">Stock &amp; Shipping</div>
                    <div className="form-row">
                      <div className="form-group"><label>Stock</label><input type="number" min="0" value={productForm.stock ?? 100} onChange={e => setProductForm({ ...productForm, stock: +e.target.value })} /></div>
                      <div className="form-group"><label>Rating (0–5)</label><input type="number" step="0.1" min="0" max="5" value={productForm.rating ?? 4.5} onChange={e => setProductForm({ ...productForm, rating: +e.target.value })} /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Weight <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>grams</span></label>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {(productForm.colors || []).map((hex, i) => (
                            <span key={i} title={`${hex} — click to remove`} style={{ width: 24, height: 24, borderRadius: '50%', background: hex, border: '1.5px solid rgba(0,0,0,.18)', cursor: 'pointer', display: 'inline-block', flexShrink: 0 }}
                              onClick={() => setProductForm(f => ({ ...f, colors: (f.colors||[]).filter((_,idx)=>idx!==i) }))} />
                          ))}
                          <input type="color" value={colorPickerValue} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--border)', cursor: 'pointer', padding: 2 }} title="Custom colour" onChange={e => setColorPickerValue(e.target.value)} />
                          <button type="button" className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: '.76rem', minHeight: 'unset', borderRadius: 20 }}
                            onClick={() => { if (colorPickerValue && !(productForm.colors||[]).includes(colorPickerValue)) setProductForm(f => ({ ...f, colors: [...(f.colors||[]), colorPickerValue] })); }}>
                            + Custom
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={closeProductForm}>Cancel</button>
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
                  <div className="form-group">
                    <label>Front Image * (PNG/JPG/WebP, max 10MB)</label>
                    <div className="image-input-group">
                      <input type="text" value={mockupForm.frontImage} onChange={e => setMockupForm({ ...mockupForm, frontImage: e.target.value })} placeholder="https://... or upload a file →" required />
                      <label className="btn btn-ghost upload-btn" title="Upload PNG image">
                        {uploadingField === 'frontImage' ? <div className="spinner-sm" /> : <><Upload size={14} /> Upload</>}
                        <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleMockupImageUpload('frontImage', f); e.target.value = ''; }} />
                      </label>
                    </div>
                    {mockupForm.frontImage && <img src={mockupForm.frontImage} alt="Front preview" className="form-preview" />}
                  </div>
                  {/* ── Back Image ── */}
                  <div className="form-group">
                    <label>Back Image (optional)</label>
                    <div className="image-input-group">
                      <input type="text" value={mockupForm.backImage || ''} onChange={e => setMockupForm({ ...mockupForm, backImage: e.target.value })} placeholder="https://... or upload a file →" />
                      <label className="btn btn-ghost upload-btn" title="Upload PNG image">
                        {uploadingField === 'backImage' ? <div className="spinner-sm" /> : <><Upload size={14} /> Upload</>}
                        <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleMockupImageUpload('backImage', f); e.target.value = ''; }} />
                      </label>
                    </div>
                    {mockupForm.backImage && <img src={mockupForm.backImage} alt="Back preview" className="form-preview" />}
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
                          style={{ cursor: !paeCurrentImage || !activeLayout ? 'default' : paeIsHoverMove && !paeDraft ? 'move' : 'crosshair' }}
                          onMouseDown={e => { e.preventDefault(); handlePaeDragStart(e); }}
                          onMouseMove={handlePaeDragMove}
                          onMouseUp={handlePaeDragEnd}
                          onMouseLeave={() => { if (paeDragRef.current.dragging) handlePaeDragEnd(); setPaeIsHoverMove(false); }}
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
                              return (
                                <div key={l.id} className="pae-rect pae-rect-other"
                                  style={{ left: l.x * PAE_SCALE, top: l.y * PAE_SCALE, width: l.w * PAE_SCALE, height: l.h * PAE_SCALE, borderColor: c }}>
                                  <span className="pae-rect-label" style={{ color: c }}>{l.name}</span>
                                </div>
                              );
                            })}
                          {/* Active layout rect */}
                          {!paeDraft && activeLayout && activeLayout.w > 0 && (() => {
                            const activeIdx = paeLayouts.findIndex(l => l.id === activeLayoutId);
                            const c = LAYOUT_COLORS[activeIdx % LAYOUT_COLORS.length];
                            return (
                              <div className="pae-rect pae-rect-active"
                                style={{ left: activeLayout.x * PAE_SCALE, top: activeLayout.y * PAE_SCALE, width: activeLayout.w * PAE_SCALE, height: activeLayout.h * PAE_SCALE, borderColor: c, background: c + '28' }}>
                                <span className="pae-rect-label" style={{ color: c }}>{activeLayout.name}</span>
                                {paeIsHoverMove && <span className="pae-move-hint">drag to move</span>}
                              </div>
                            );
                          })()}
                          {/* Draft rect */}
                          {paeDraft && (() => {
                            const activeIdx = paeLayouts.findIndex(l => l.id === activeLayoutId);
                            const c = LAYOUT_COLORS[activeIdx % LAYOUT_COLORS.length];
                            return (
                              <div className="pae-rect pae-rect-live"
                                style={{ left: paeDraft.x * PAE_SCALE, top: paeDraft.y * PAE_SCALE, width: Math.max(2, paeDraft.w * PAE_SCALE), height: Math.max(2, paeDraft.h * PAE_SCALE), borderColor: c, background: c + '22' }} />
                            );
                          })()}
                        </div>
                        <p className="pae-canvas-hint">{activeLayout ? 'Drag to draw print area · drag existing rect to reposition' : 'Select a layout first'} · Canvas: 800×1000 px</p>
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
                            <div className="pae-button-stack">
                              {activeLayout.w > 0 && (
                                <button type="button" className="btn btn-sm btn-ghost pae-clear-btn"
                                  onClick={() => updateActiveLayout({ x: 0, y: 0, w: 0, h: 0 })}>
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
                    <input type="text" value={shippingZoneForm.label || ''} onChange={e => setShippingZoneForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Pune &amp; PCMC" required />
                  </div>
                  <div className="form-group">
                    <label>Pin Code Prefixes <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '.8rem' }}>— comma-separated (leave empty for catch-all)</span></label>
                    <input type="text" value={(shippingZoneForm.pinPatterns || []).join(', ')}
                      onChange={e => setShippingZoneForm(f => ({ ...f, pinPatterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                      placeholder="e.g. 411, 412, 413" />
                    <p style={{ fontSize: '.78rem', color: 'var(--text-3)', margin: '4px 0 0' }}>Pune city: 411 · PCMC/Pimpri: 411018, 411019 · Leave blank to match all other pins.</p>
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
        </AnimatePresence>
      </div>
    </div>
  );
}
