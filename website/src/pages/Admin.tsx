import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Edit3, Trash2, X, Save, ShoppingCart,
  BarChart3, Users, IndianRupee, TrendingUp, Image, Eye, EyeOff, Database, Palette, Download, Upload, Tag, Copy, Check, ChevronDown, ChevronUp, MapPin, Mail, User, Clock, Hash, LogOut,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Product, Order, DesignOrder } from '../types';
import toast from 'react-hot-toast';

interface Mockup {
  id: string; name: string; category: string;
  frontImage: string; backImage?: string;
  frontShadow?: string; backShadow?: string;
  printArea: any; active: boolean; createdAt: string;
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
  name: '', description: '', price: 0, category: '', image: '', customizable: true,
  featured: false, colors: ['#000000', '#ffffff', '#6366f1'], sizes: ['S', 'M', 'L', 'XL'], rating: 4.5, reviewCount: 0,
};

const defaultMockup: Partial<Mockup> = {
  name: '', category: '', frontImage: '', backImage: '', frontShadow: '', backShadow: '',
  printArea: { layouts: [], allowMultipleLayouts: false, allowBackPrint: true }, active: true,
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

type Tab = 'analytics' | 'products' | 'categories' | 'mockup-categories' | 'orders' | 'mockups' | 'database';

export default function Admin() {
  const { logout } = useAuth();
  const [tab, setTab] = useState<Tab>('analytics');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [designOrders, setDesignOrders] = useState<DesignOrder[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderSubTab, setOrderSubTab] = useState<'normal' | 'custom'>('normal');
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

  // Mockup form
  const [showMockupForm, setShowMockupForm] = useState(false);
  const [editingMockup, setEditingMockup] = useState<Mockup | null>(null);
  const [mockupForm, setMockupForm] = useState(defaultMockup);
  const [savingMockup, setSavingMockup] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Print area editor
  const [paeDraft, setPaeDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [paeIsHoverMove, setPaeIsHoverMove] = useState(false);
  const [showPaeAddForm, setShowPaeAddForm] = useState(false);
  const [paeNewLayoutName, setPaeNewLayoutName] = useState('');
  const [paeNewLayoutSide, setPaeNewLayoutSide] = useState<'FRONT' | 'BACK'>('FRONT');
  const paeDragRef = useRef<{ startX: number; startY: number; dragging: boolean; mode: 'draw' | 'move'; offsetX: number; offsetY: number }>({ startX: 0, startY: 0, dragging: false, mode: 'draw', offsetX: 0, offsetY: 0 });
  const paeContainerRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, o, a, m, d, cats, mockupCats] = await Promise.all([
        api.getProducts(), api.getAllOrders(), api.getAnalytics(), api.getMockups(), api.getAllDesignOrders(), api.getCategories(), api.getMockupCategories(),
      ]);
      setProducts(p); setOrders(o); setAnalytics(a); setMockups(m); setDesignOrders(d); setCategories(cats); setMockupCategories(mockupCats);
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
  const openEditProduct = (p: Product) => { setEditingProduct(p); setProductForm({ ...p }); setShowProductForm(true); };
  const closeProductForm = () => { setShowProductForm(false); setEditingProduct(null); };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price || !productForm.category) { toast.error('Name, price & category are required'); return; }
    setSavingProduct(true);
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, productForm);
        toast.success('Product updated');
      } else {
        await api.createProduct(productForm as Omit<Product, 'id' | 'createdAt'>);
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
          <button className={`tab ${tab === 'database' ? 'active' : ''}`} onClick={() => { setTab('database'); if (!dbData) loadDb(); }}><Database size={16} /> Database</button>
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
            <h2>Orders ({orders.length + designOrders.length})</h2>
            <div className="orders-sub-tabs" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button className={`btn ${orderSubTab === 'normal' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setOrderSubTab('normal'); setExpandedOrder(null); }}>
                <ShoppingCart size={16} /> Normal Orders ({orders.length})
              </button>
              <button className={`btn ${orderSubTab === 'custom' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setOrderSubTab('custom'); setExpandedOrder(null); }}>
                <Palette size={16} /> Customized Orders ({designOrders.length})
              </button>
            </div>

            {/* Normal Orders */}
            {orderSubTab === 'normal' && (
              <>
                {orders.length === 0 ? (
                  <p className="empty-msg">No normal orders yet.</p>
                ) : (
                  <div className="order-cards">
                    {orders.map(o => {
                      const isExpanded = expandedOrder === o.id;
                      return (
                        <motion.div key={o.id} className={`order-card ${isExpanded ? 'expanded' : ''}`}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                          <div className="order-card-header" onClick={() => setExpandedOrder(isExpanded ? null : o.id)}>
                            <div className="order-card-col">
                              <Hash size={14} />
                              <code style={{ fontSize: '0.85rem' }}>{o.id.slice(0, 8)}</code>
                            </div>
                            <div className="order-card-col">
                              <Package size={14} />
                              <span>{o.items.length} item{o.items.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="order-card-col">
                              <IndianRupee size={14} />
                              <strong>₹{o.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                            </div>
                            <div className="order-card-col">
                              <span className={`status-badge status-${o.status}`}>{o.status}</span>
                            </div>
                            <div className="order-card-col">
                              <Clock size={14} />
                              <span>{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
                                  <div className="order-info-grid">
                                    <div className="order-info-block">
                                      <h4><User size={15} /> Customer</h4>
                                      <p>{o.customerName || '—'}</p>
                                      {o.customerEmail && <p className="order-meta"><Mail size={13} /> {o.customerEmail}</p>}
                                      <p className="order-meta">User ID: {o.userId.slice(0, 12)}...</p>
                                    </div>
                                    <div className="order-info-block">
                                      <h4><MapPin size={15} /> Shipping Address</h4>
                                      <p style={{ whiteSpace: 'pre-wrap' }}>{o.shippingAddress || '—'}</p>
                                    </div>
                                    <div className="order-info-block">
                                      <h4><Clock size={15} /> Order Info</h4>
                                      <p>Order ID: <code>{o.id}</code></p>
                                      <p>Placed: {new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                      <div style={{ marginTop: 8 }}>
                                        <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Update Status</label>
                                        <select value={o.status} onChange={e => handleStatusChange(o.id, e.target.value)} onClick={e => e.stopPropagation()}>
                                          {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="order-items-section">
                                    <h4><Package size={15} /> Items ({o.items.length})</h4>
                                    <div className="order-items-list">
                                      {o.items.map((item, idx) => {
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
                                                {item.color && (
                                                  <span className="order-item-tag">
                                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block', border: '1px solid var(--border)' }} />
                                                    {item.color}
                                                  </span>
                                                )}
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
                                      <span>Total</span>
                                      <strong>₹{o.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                    </div>
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
              </>
            )}

            {/* Customized Orders */}
            {orderSubTab === 'custom' && (
              <>
                {designOrders.length === 0 ? (
                  <p className="empty-msg">No customized orders yet.</p>
                ) : (
                  <div className="order-cards">
                    {designOrders.map(o => {
                      const isExpanded = expandedOrder === o.id;
                      const firstImage = Object.values(o.designImages || {}).find(img => img);
                      return (
                        <motion.div key={o.id} className={`order-card ${isExpanded ? 'expanded' : ''}`}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                          <div className="order-card-header" onClick={() => setExpandedOrder(isExpanded ? null : o.id)}>
                            <div className="order-card-col">
                              <Hash size={14} />
                              <code style={{ fontSize: '0.85rem' }}>{o.id.slice(0, 8)}</code>
                            </div>
                            <div className="order-card-col" style={{ gap: 8 }}>
                              {firstImage && <img src={firstImage} alt="Design" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, background: '#1e293b' }} />}
                              <span style={{ textTransform: 'capitalize' }}>{o.productType}</span>
                            </div>
                            <div className="order-card-col">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: o.colorHex, border: o.colorHex === '#ffffff' ? '2px solid #555' : 'none', display: 'inline-block' }} />
                                {o.colorName}
                              </span>
                            </div>
                            <div className="order-card-col">
                              <IndianRupee size={14} />
                              <strong>₹{o.total.toLocaleString()}</strong>
                            </div>
                            <div className="order-card-col">
                              <span className={`status-badge status-${o.status}`}>{o.status}</span>
                            </div>
                            <div className="order-card-col">
                              <Clock size={14} />
                              <span>{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
                                  {/* Customer + Shipping + Order Info */}
                                  <div className="order-info-grid">
                                    <div className="order-info-block">
                                      <h4><User size={15} /> Customer</h4>
                                      <p>{o.customerName || (o.userId ? `User ${o.userId.slice(0, 12)}...` : 'Guest')}</p>
                                      {o.customerEmail && <p className="order-meta"><Mail size={13} /> {o.customerEmail}</p>}
                                      {o.userId && <p className="order-meta">User ID: {o.userId.slice(0, 12)}...</p>}
                                    </div>
                                    <div className="order-info-block">
                                      <h4><MapPin size={15} /> Shipping Address</h4>
                                      <p style={{ whiteSpace: 'pre-wrap' }}>{o.shippingAddress || '—'}</p>
                                    </div>
                                    <div className="order-info-block">
                                      <h4><Clock size={15} /> Order Info</h4>
                                      <p>Order ID: <code>{o.id}</code></p>
                                      <p>Placed: {new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                      <div style={{ marginTop: 8 }}>
                                        <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Update Status</label>
                                        <select value={o.status} onChange={e => handleDesignStatusChange(o.id, e.target.value)} onClick={e => e.stopPropagation()}>
                                          {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Product Details */}
                                  <div className="order-items-section">
                                    <h4><Package size={15} /> Product Details</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, padding: '12px 0' }}>
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Product</strong><p style={{ textTransform: 'capitalize', margin: '4px 0 0' }}>{o.productType}</p></div>
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Color</strong><p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: '50%', background: o.colorHex, border: o.colorHex === '#ffffff' ? '2px solid #555' : 'none', display: 'inline-block' }} />{o.colorName}</p></div>
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Print Size</strong><p style={{ textTransform: 'capitalize', margin: '4px 0 0' }}>{o.printSize}</p></div>
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Sides</strong><p style={{ margin: '4px 0 0' }}>{(o.sides || []).join(', ')}</p></div>
                                      <div><strong style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Quantity</strong><p style={{ margin: '4px 0 0' }}>{o.quantity}</p></div>
                                    </div>
                                    <div className="order-total-row">
                                      <span>Total</span>
                                      <strong>₹{o.total.toLocaleString()}</strong>
                                    </div>
                                  </div>

                                  {/* Design Images — Mockup Previews */}
                                  <div className="order-items-section" style={{ marginTop: 16 }}>
                                    <h4><Image size={15} /> Design Mockups</h4>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '12px 0' }}>
                                      {Object.entries(o.designImages || {}).map(([side, dataUrl]) => {
                                        if (!dataUrl) return null;
                                        return (
                                          <div key={side} style={{ flex: '1 1 250px', background: 'var(--bg-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                              <strong style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{side}</strong>
                                              <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}
                                                onClick={(e) => { e.stopPropagation(); handleDownloadDesign(dataUrl, o.id, side); }}>
                                                <Download size={13} /> Download
                                              </button>
                                            </div>
                                            <img src={dataUrl} alt={`${side} design`}
                                              style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 6, background: '#1e293b' }} />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Customer Uploaded Source Files */}
                                  {hasSourceFiles(o) && (
                                    <div className="order-items-section" style={{ marginTop: 16 }}>
                                      <h4><Upload size={15} /> Customer Uploaded Files (High Quality)</h4>
                                      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 12px' }}>Original images uploaded by the customer — use these for printing.</p>
                                      {Object.entries(o.uploadedImages || {}).map(([side, imgs]) => (
                                        <div key={side} style={{ marginBottom: 16 }}>
                                          <strong style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>
                                            {side} — {imgs.length} file{imgs.length !== 1 ? 's' : ''}
                                          </strong>
                                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            {imgs.map((src, idx) => (
                                              <div key={idx} style={{ position: 'relative', width: 140 }}>
                                                <img src={src} alt={`${side} source ${idx + 1}`}
                                                  style={{ width: '100%', height: 140, objectFit: 'contain', borderRadius: 8, background: '#1e293b', border: '1px solid var(--border)' }} />
                                                <a href={src} download={`source-${o.id.slice(0, 8)}-${side.toLowerCase()}-${idx + 1}.png`}
                                                  className="btn btn-primary" onClick={e => e.stopPropagation()}
                                                  style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>
                                                  <Download size={12} /> Download
                                                </a>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Bulk Download Actions */}
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
                                    <button className="btn btn-primary" onClick={e => { e.stopPropagation(); handleDownloadAllSides(o); }}>
                                      <Download size={14} /> Download All Mockups
                                    </button>
                                    {hasSourceFiles(o) && (
                                      <button className="btn btn-primary" style={{ background: '#0891b2' }} onClick={e => { e.stopPropagation(); handleDownloadSourceFiles(o); }}>
                                        <Upload size={14} /> Download All Source Files
                                      </button>
                                    )}
                                    {hasSourceFiles(o) && (
                                      <button className="btn btn-outline" onClick={e => { e.stopPropagation(); handleDownloadEverything(o); }}>
                                        <Download size={14} /> Download Everything
                                      </button>
                                    )}
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
              </>
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

        {/* Product Form Modal */}
        <AnimatePresence>
          {showProductForm && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeProductForm}>
              <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                  <button className="icon-btn" onClick={closeProductForm}><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveProduct} className="modal-body">
                  <div className="form-row">
                    <div className="form-group"><label>Name</label><input type="text" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} required /></div>
                    <div className="form-group">
                      <label>Category</label>
                      <select
                        value={(productForm as any).categoryId || ''}
                        onChange={e => {
                          const cat = categories.find(c => c.id === e.target.value);
                          setProductForm({ ...productForm, category: cat?.name || '', ...(cat ? { categoryId: cat.id } : { categoryId: '' }) } as any);
                        }}
                        required
                      >
                        <option value="">— Select category —</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group"><label>Description</label><textarea value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} rows={3} /></div>
                  <div className="form-row">
                    <div className="form-group"><label>Price (₹)</label><input type="number" step="0.01" min="0" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: +e.target.value })} required /></div>
                    <div className="form-group">
                      <label>Design Image (your artwork / print)</label>
                      <div className="image-input-group">
                        <input type="text" value={productForm.image} onChange={e => setProductForm({ ...productForm, image: e.target.value })} placeholder="Upload the design artwork →" />
                        <label className="btn btn-ghost upload-btn" title="Upload image">
                          {uploadingField === 'productImage' ? <div className="spinner-sm" /> : <><Upload size={14} /> Upload</>}
                          <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleProductImageUpload(f); e.target.value = ''; }} />
                        </label>
                      </div>
                      {productForm.image && <img src={productForm.image} alt="Design preview" className="form-preview" />}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Display Mockup <span style={{ fontSize: '0.72rem', color: '#666' }}>(your design will be shown on this mockup to customers)</span></label>
                    <select
                      value={(productForm as any).mockupId || ''}
                      onChange={e => setProductForm({ ...productForm, mockupId: e.target.value || undefined } as any)}
                    >
                      <option value="">— No mockup (show flat image) —</option>
                      {mockups.filter(m => m.active).map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.category})</option>
                      ))}
                    </select>
                    {(productForm as any).mockupId && (() => {
                      const selectedMockup = mockups.find(m => m.id === (productForm as any).mockupId);
                      return selectedMockup ? (
                        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'flex-start' }}>
                          <img src={selectedMockup.frontImage} alt="Mockup" style={{ width: 80, height: 100, objectFit: 'contain', borderRadius: 6, background: '#f1f5f9', border: '1px solid var(--border)' }} />
                          <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>Customers will see your design composited onto this mockup template.</p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Stock</label><input type="number" min="0" value={productForm.stock ?? 100} onChange={e => setProductForm({ ...productForm, stock: +e.target.value })} /></div>
                    <div className="form-group"><label>Rating (0-5)</label><input type="number" step="0.1" min="0" max="5" value={productForm.rating ?? 4.5} onChange={e => setProductForm({ ...productForm, rating: +e.target.value })} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Sizes (comma-separated)</label>
                      <input type="text" value={(productForm.sizes || []).join(', ')} onChange={e => setProductForm({ ...productForm, sizes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                    </div>
                    <div className="form-group"><label>Colors (comma-separated hex)</label>
                      <input type="text" value={(productForm.colors || []).join(', ')} onChange={e => setProductForm({ ...productForm, colors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                    </div>
                  </div>
                  <div className="form-row checkboxes">
                    <label className="checkbox-label"><input type="checkbox" checked={productForm.customizable} onChange={e => setProductForm({ ...productForm, customizable: e.target.checked })} /> Customizable</label>
                    <label className="checkbox-label"><input type="checkbox" checked={productForm.featured} onChange={e => setProductForm({ ...productForm, featured: e.target.checked })} /> Featured</label>
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
      </div>
    </div>
  );
}
