import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Star, Sparkles, Palette, Filter, SortAsc } from 'lucide-react';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';
import type { Product } from '../types';
import './CollectionDetail.css';

const SORTS = [
  { label: 'Default', value: 'default' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Rating', value: 'rating' },
];

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();
  const [collection, setCollection] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('default');
  const [selectedColor, setSelectedColor] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getCollection(id), api.getCollectionProducts(id)])
      .then(([col, prods]) => { setCollection(col); setProducts(prods); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="cd-page">
        <div className="container">
          <div className="cd-skeleton-hero" />
          <div className="cd-skeleton-grid">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="cd-skeleton-card" style={{ animationDelay: `${i * 0.07}s` }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="cd-page">
        <div className="container">
          <div className="empty-state" style={{ paddingTop: '6rem' }}>
            <h2>Collection not found</h2>
            <Link to="/collections" className="btn btn-primary" style={{ marginTop: 16 }}>Back to Collections</Link>
          </div>
        </div>
      </div>
    );
  }

  const sorted = [...products].sort((a, b) => {
    if (sort === 'price_asc') return a.price - b.price;
    if (sort === 'price_desc') return b.price - a.price;
    if (sort === 'rating') return b.rating - a.rating;
    return 0;
  });

  const handleAddToCart = (product: Product) => {
    const color = selectedColor[product.id] || product.colors[0] || undefined;
    const size = product.sizes[0] || undefined;
    addItem(product, { color, size });
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div className="cd-page">
      {/* ── Hero banner ── */}
      <div className="cd-hero" style={{ '--cd-gradient': collection.gradient, '--cd-glow': collection.glow } as React.CSSProperties}>
        <div className="cd-hero-orb cd-hero-orb-1" />
        <div className="cd-hero-orb cd-hero-orb-2" />
        <div className="cd-hero-symbol">{collection.symbol}</div>

        <div className="container">
          <motion.div className="cd-hero-content" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Link to="/collections" className="cd-back">
              <ArrowLeft size={16} /> All Collections
            </Link>
            <div className="cd-hero-badge" style={{ background: (collection.badgeColor || '#C6A75E') + '25', color: collection.badgeColor || '#C6A75E', borderColor: (collection.badgeColor || '#C6A75E') + '50' }}>
              {collection.badge}
            </div>
            <h1 className="cd-hero-title">{collection.name}</h1>
            <p className="cd-hero-tagline">{collection.tagline}</p>
            <div className="cd-hero-meta">
              <span className="cd-hero-tag">{collection.tag}</span>
              <span className="cd-hero-count"><Star size={13} fill="currentColor" /> {products.length} products</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Products ── */}
      <div className="container">
        {/* Toolbar */}
        <div className="cd-toolbar">
          <span className="cd-toolbar-count">{sorted.length} product{sorted.length !== 1 ? 's' : ''}</span>
          <div className="cd-sort">
            <SortAsc size={15} />
            <select value={sort} onChange={e => setSort(e.target.value)}>
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {sorted.length === 0 ? (
          <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '5rem 0' }}>
            <Sparkles size={48} strokeWidth={1} style={{ color: 'var(--text-3)' }} />
            <h3>No products yet</h3>
            <p>Products will appear here once added by the admin.</p>
            <Link to="/products" className="btn btn-primary" style={{ marginTop: 16 }}>Browse All Products</Link>
          </motion.div>
        ) : (
          <div className="cd-grid">
            {sorted.map((product, i) => (
              <motion.div
                key={product.id}
                className="cd-product-card"
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: (i % 4) * 0.07 }}
              >
                {/* Image */}
                <Link to={`/products/${product.id}`} className="cd-card-img-wrap">
                  <img src={product.image} alt={product.name} className="cd-card-img" loading="lazy" />
                  {product.featured && <span className="cd-card-badge">Featured</span>}
                  {product.customizable && (
                    <div className="cd-card-customize">
                      <Palette size={13} /> Customizable
                    </div>
                  )}
                </Link>

                {/* Body */}
                <div className="cd-card-body">
                  <span className="cd-card-category">{product.category}</span>
                  <Link to={`/products/${product.id}`}><h3 className="cd-card-name">{product.name}</h3></Link>

                  {/* Color swatches */}
                  {product.colors.length > 0 && (
                    <div className="cd-card-colors">
                      {[...new Set(product.colors)].slice(0, 6).map(c => (
                        <button
                          key={c}
                          className={`cd-color-dot${selectedColor[product.id] === c ? ' active' : ''}`}
                          style={{ background: c, border: c === '#ffffff' ? '1px solid #ddd' : 'none' }}
                          onClick={() => setSelectedColor(prev => ({ ...prev, [product.id]: c }))}
                          title={c}
                        />
                      ))}
                    </div>
                  )}

                  <div className="cd-card-footer">
                    <div className="cd-card-price-row">
                      <span className="cd-card-price">₹{product.price.toLocaleString('en-IN')}</span>
                      <div className="cd-card-rating">
                        <Star size={11} fill="#f59e0b" stroke="#f59e0b" />
                        <span>{product.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="cd-card-actions">
                      <button className="cd-btn-cart" onClick={() => handleAddToCart(product)} disabled={product.stock === 0}>
                        <ShoppingCart size={14} />
                        {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                      {product.customizable && (
                        <Link to={product.mockupId ? `/design-studio/product/${product.id}` : '/design-studio'} className="cd-btn-design" title="Customise">
                          <Palette size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <section style={{ padding: '4rem 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p style={{ color: 'var(--text-2)', marginBottom: '1rem' }}>Want a custom design from this collection?</p>
            <Link to="/design-studio" className="btn btn-primary btn-lg"><Palette size={16} /> Open Design Studio</Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
