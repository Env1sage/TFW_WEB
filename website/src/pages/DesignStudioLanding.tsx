import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Shirt, Coffee, Smartphone, Image, Frame, Sticker,
  ShoppingBag, Star, CheckCircle, Zap, Shield, Search, X,
  ChevronRight, Package,
} from 'lucide-react';
import { api } from '../api';
import { COLORS } from '../mockups';
import type { Product } from '../types';

function colorName(hex: string): string {
  return COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}

/* ─── Category defaults for mockup products ─────────────── */
const CAT_COLORS: Record<string, string[]> = {
  'T-Shirts':       ['#ffffff','#1a1a1a','#1b2a4a','#c0392b','#2d5a3d','#36454f'],
  'Polo T-Shirts':  ['#ffffff','#1a1a1a','#1b2a4a','#c0392b'],
  'Hoodies':        ['#9e9e9e','#1a1a1a','#36454f','#1b2a4a'],
  'Kids Clothing':  ['#ffffff','#1a1a1a','#c0392b','#1b2a4a','#fce4ec','#e3f2fd'],
  'Mugs':           ['#ffffff'],
  'Bottles':        ['#9e9e9e','#1a1a1a','#6b4c3b'],
  'Tote Bags':      ['#f5e6d3'],
  'Stationery':     ['#ffffff','#1a1a1a','#f5e6d3'],
};
const CAT_SIZES: Record<string, string[]> = {
  'T-Shirts':       ['XS','S','M','L','XL','XXL'],
  'Polo T-Shirts':  ['S','M','L','XL','XXL'],
  'Hoodies':        ['S','M','L','XL','XXL'],
  'Kids Clothing':  ['2Y','4Y','6Y','8Y','10Y','12Y','14Y'],
};
function mockupToProduct(m: any) {
  return {
    id: m.id, name: m.name, description: `Custom ${m.name} — fully personalised`,
    price: m.basePrice || 0, category: m.category, subcategory: m.category,
    image: m.frontImage, customizable: true,
    colors: CAT_COLORS[m.category] || ['#ffffff','#1a1a1a'],
    sizes: CAT_SIZES[m.category] || [],
    stock: 999, rating: 5.0, reviewCount: 0, featured: false,
    mockup: { id: m.id, frontImage: m.frontImage, backImage: m.backImage, frontShadow: m.frontShadow, backShadow: m.backShadow, printArea: m.printArea },
  };
}

/* ─── helpers ────────────────────────────────────────────── */
const CAT_ICONS: Record<string, React.ReactNode> = {
  'T-Shirts':    <Shirt size={16} />,
  'Hoodies':     <Shirt size={16} />,
  'Mugs':        <Coffee size={16} />,
  'Phone Cases': <Smartphone size={16} />,
  'Posters':     <Image size={16} />,
  'Canvas':      <Frame size={16} />,
  'Stickers':    <Sticker size={16} />,
  'Tote Bags':   <ShoppingBag size={16} />,
};
function catIcon(name: string) {
  if (CAT_ICONS[name]) return CAT_ICONS[name];
  const l = name.toLowerCase();
  if (l.includes('shirt') || l.includes('hoodie')) return <Shirt size={16} />;
  if (l.includes('mug') || l.includes('cup'))       return <Coffee size={16} />;
  if (l.includes('phone') || l.includes('case'))    return <Smartphone size={16} />;
  if (l.includes('poster'))                         return <Image size={16} />;
  if (l.includes('canvas'))                         return <Frame size={16} />;
  if (l.includes('sticker'))                        return <Sticker size={16} />;
  if (l.includes('bag') || l.includes('tote'))      return <ShoppingBag size={16} />;
  return <Package size={16} />;
}

/* ─── Step bar ───────────────────────────────────────────── */
function StepBar({ step }: { step: number }) {
  const steps = ['Choose Product', 'Configure', 'Design & Add to Cart'];
  return (
    <div className="dsw-steps">
      {steps.map((label, i) => (
        <div key={i} className={`dsw-step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
          <div className="dsw-step__bubble">
            {i < step ? <CheckCircle size={13} /> : i + 1}
          </div>
          <span className="dsw-step__label">{label}</span>
          {i < steps.length - 1 && <div className="dsw-step__line" />}
        </div>
      ))}
    </div>
  );
}

/* ─── Product card ───────────────────────────────────────── */
function DSCard({ product, index }: { product: Product; index: number }) {
  const navigate = useNavigate();
  const uniqueColors = [...new Set<string>(product.colors || [])];

  return (
    <motion.div
      className="dsw-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      onClick={() => navigate(`/design-studio/product/${product.id}`)}
    >
      <div className="dsw-card__img">
        <img src={product.image} alt={product.name} className="dsw-card__photo" />
        {product.featured && <span className="badge badge-featured">Featured</span>}
        {product.stock === 0 && <span className="badge badge-oos">Out of Stock</span>}
        <div className="dsw-card__overlay">
          <button className="btn btn-primary dsw-card__cta">
            <Palette size={14} /> Design This <ChevronRight size={13} />
          </button>
        </div>
      </div>
      <div className="dsw-card__body">
        <span className="dsw-card__cat">{product.category}</span>
        <h3 className="dsw-card__name">{product.name}</h3>
        <div className="dsw-card__meta">
          <span className="dsw-card__rating">
            <Star size={12} fill="#f59e0b" stroke="#f59e0b" />
            {product.rating.toFixed(1)}
          </span>
          <span className="dsw-card__price">from ₹{product.price.toFixed(0)}</span>
        </div>
        {uniqueColors.length > 0 && (
          <div className="dsw-card__colors">
            {uniqueColors.slice(0, 4).map(c => (
              <span key={c} className="color-name-chip">
                <span className="color-name-dot" style={{ background: c, border: c === '#ffffff' ? '1px solid #ccc' : 'none' }} />
                {colorName(c)}
              </span>
            ))}
            {uniqueColors.length > 4 && <span className="color-more">+{uniqueColors.length - 4} more</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function DesignStudioLanding() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allProducts, setAllProducts]   = useState<Product[]>([]);
  const [categories, setCategories]     = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');

  const activeCategory = searchParams.get('category') || 'all';

  /* load once — show only admin-configured mockup products */
  useEffect(() => {
    api.getActiveMockups().then((mockups: any[]) => {
      const mapped = mockups.map(mockupToProduct);
      setAllProducts(mapped as any);
      setCategories([...new Set(mockups.map((m: any) => m.category))]);
    }).finally(() => setLoading(false));
  }, []);

  /* counts per category */
  const catCounts = useMemo(() => {
    const map: Record<string, number> = { all: allProducts.length };
    allProducts.forEach(p => { map[p.category] = (map[p.category] || 0) + 1; });
    return map;
  }, [allProducts]);

  /* filtered products */
  const products = useMemo(() => {
    let list = activeCategory === 'all' ? allProducts : allProducts.filter(p => p.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    return list;
  }, [allProducts, activeCategory, search]);

  const setCategory = (cat: string) => {
    const p = new URLSearchParams(searchParams);
    if (cat === 'all') p.delete('category'); else p.set('category', cat);
    setSearchParams(p);
    setSearch('');
  };

  return (
    <div className="dsw-page">
      <div className="container">
        <StepBar step={0} />

        {/* Page header */}
        <motion.div className="dsw-header" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="dsw-title">What would you like to design?</h1>
          <p className="dsw-subtitle">
            Choose a product below — you'll add your artwork in the next step.
          </p>
          <div className="dsw-trust">
            <span><Zap size={13} /> Live preview</span>
            <span><Shield size={13} /> 300 DPI print</span>
            <span><CheckCircle size={13} /> 7-day returns</span>
          </div>
        </motion.div>

        {/* Layout: sidebar + main */}
        <div className="dsw-layout">

          {/* ── Sidebar ── */}
          <aside className="dsw-sidebar">
            <p className="dsw-sidebar__title">Categories</p>
            <div className="dsw-sidebar__list">
              <button
                className={`dsw-sidebar__item ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setCategory('all')}
              >
                <span className="dsw-sidebar__icon"><Package size={15} /></span>
                <span className="dsw-sidebar__name">All Products</span>
                <span className="dsw-sidebar__count">{catCounts.all || 0}</span>
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`dsw-sidebar__item ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  <span className="dsw-sidebar__icon">{catIcon(cat)}</span>
                  <span className="dsw-sidebar__name">{cat}</span>
                  <span className="dsw-sidebar__count">{catCounts[cat] || 0}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="dsw-main">

            {/* Mobile category pills */}
            <div className="dsw-mobile-cats">
              <button className={`dsw-pill ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>All</button>
              {categories.map(cat => (
                <button key={cat} className={`dsw-pill ${activeCategory === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>
                  {catIcon(cat)} {cat}
                </button>
              ))}
            </div>

            {/* Search + count toolbar */}
            <div className="dsw-toolbar">
              <div className="dsw-search">
                <Search size={15} className="dsw-search__icon" />
                <input
                  type="text"
                  placeholder="Search products…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="dsw-search__input"
                />
                {search && (
                  <button className="dsw-search__clear" onClick={() => setSearch('')}>
                    <X size={13} />
                  </button>
                )}
              </div>
              {!loading && (
                <span className="dsw-count">
                  {products.length} product{products.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="dsw-skeleton-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="dsw-skeleton-card">
                    <div className="dsw-skeleton-img" />
                    <div className="dsw-skeleton-body">
                      <div className="dsw-skeleton-line dsw-skeleton-line--sm" />
                      <div className="dsw-skeleton-line" />
                      <div className="dsw-skeleton-line dsw-skeleton-line--md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 0' }}>
                <h3>No products found</h3>
                <p>{search ? `No results for "${search}"` : 'No products in this category yet.'}</p>
                {search && <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setSearch('')}>Clear Search</button>}
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory + search}
                  className="dsw-grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {products.map((p, i) => <DSCard key={p.id} product={p} index={i} />)}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
