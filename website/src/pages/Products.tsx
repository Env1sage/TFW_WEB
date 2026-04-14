import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Filter, SlidersHorizontal, Grid3X3, LayoutList, Shirt, Coffee, Smartphone, Image, Frame, Sticker, ShoppingBag, IndianRupee } from 'lucide-react';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import type { Product } from '../types';

const categoryIcons: Record<string, React.ReactNode> = {
  'T-Shirts': <Shirt size={16} />,
  'Hoodies': <Shirt size={16} />,
  'Mugs': <Coffee size={16} />,
  'Phone Cases': <Smartphone size={16} />,
  'Posters': <Image size={16} />,
  'Canvas': <Frame size={16} />,
  'Stickers': <Sticker size={16} />,
  'Tote Bags': <ShoppingBag size={16} />,
};

function getCategoryIcon(name: string): React.ReactNode {
  if (categoryIcons[name]) return categoryIcons[name];
  const lower = name.toLowerCase();
  if (lower.includes('shirt') || lower.includes('tee') || lower.includes('polo') || lower.includes('hoodie') || lower.includes('jacket') || lower.includes('apparel')) return <Shirt size={16} />;
  if (lower.includes('mug') || lower.includes('cup')) return <Coffee size={16} />;
  if (lower.includes('phone') || lower.includes('case')) return <Smartphone size={16} />;
  if (lower.includes('poster') || lower.includes('print')) return <Image size={16} />;
  if (lower.includes('canvas') || lower.includes('frame')) return <Frame size={16} />;
  if (lower.includes('sticker')) return <Sticker size={16} />;
  if (lower.includes('bag') || lower.includes('tote')) return <ShoppingBag size={16} />;
  return <SlidersHorizontal size={16} />;
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || 'newest';
  const search = searchParams.get('search') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';

  useEffect(() => {
    api.getCategories().then(cats => setCategories(cats.map(c => c.name))).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (category !== 'all') params.category = category;
    if (sort) params.sort = sort;
    if (search) params.search = search;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    api.getProducts(params).then(p => {
      setProducts(p);
      setError(null);
    }).catch((err) => {
      console.error('Failed to load products:', err);
      setError(err.message || 'Failed to load products');
    }).finally(() => setLoading(false));
  }, [category, sort, search, minPrice, maxPrice]);

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value && value !== 'all') p.set(key, value); else p.delete(key);
    setSearchParams(p);
  };

  return (
    <div className="products-page">
      <div className="container">
        <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1>All Products</h1>
          <p>{search ? `Results for "${search}"` : 'Discover and customize your perfect products'}</p>
        </motion.div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter size={14} /> {showFilters ? 'Hide Filters' : 'Filters & Sort'}
          </button>
          <span className="product-count">{products.length} product{products.length !== 1 ? 's' : ''}</span>
        </div>
        {showFilters && <div className="products-toolbar">
          <div className="filter-group">
            <Filter size={16} />
            <select value={category} onChange={e => setParam('category', e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <SlidersHorizontal size={16} />
            <select value={sort} onChange={e => setParam('sort', e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
          <div className="filter-group price-range-filter">
            <IndianRupee size={16} />
            <input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={e => setParam('minPrice', e.target.value)}
              className="price-input"
              min={0}
            />
            <span className="price-separator">–</span>
            <input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={e => setParam('maxPrice', e.target.value)}
              className="price-input"
              min={0}
            />
          </div>
          <div className="view-toggle">
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}><Grid3X3 size={18} /></button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><LayoutList size={18} /></button>
          </div>
        </div>}

        {/* Category pill buttons */}
        {categories.length > 0 && (
          <div className="category-pills">
            <button
              className={`category-pill ${category === 'all' ? 'active' : ''}`}
              onClick={() => setParam('category', 'all')}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c}
                className={`category-pill ${category === c ? 'active' : ''}`}
                onClick={() => setParam('category', c)}
              >
                {categoryIcons[c] || getCategoryIcon(c)}
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="page-spinner"><div className="spinner" /></div>
        ) : error ? (
          <div className="empty-state">
            <h3>Something went wrong</h3>
            <p>{error}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p>Try changing your filters or search term.</p>
          </div>
        ) : (
          <div className={`products-grid ${view === 'list' ? 'list-view' : ''}`}>
            {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
