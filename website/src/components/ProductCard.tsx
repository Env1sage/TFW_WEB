import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Eye, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import MockupPreview from './MockupPreview';
import { COLORS } from '../mockups';

function colorName(hex: string): string {
  return COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hovered, setHovered] = useState(false);
  const [addedColor, setAddedColor] = useState<string | null>(null);

  const open = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setHovered(true);
  };

  const close = () => {
    hideTimer.current = setTimeout(() => setHovered(false), 150);
  };

  const keep = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  const quickAdd = (e: React.MouseEvent, color: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (product.stock === 0) return;
    addItem(product, { color, size: product.sizes[0] });
    setAddedColor(color);
    setTimeout(() => setAddedColor(null), 1800);
  };

  const thumbImage = product.image || product.images?.[0] || product.mockup?.frontImage || '';
  const colors = product.colors.slice(0, 6);

  return (
    <div
      ref={wrapRef}
      className="pc-wrap"
      onMouseEnter={open}
      onMouseLeave={close}
    >
      <motion.div
        className="product-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.05 }}
        onClick={() => navigate(`/products/${product.id}`)}
        style={{ cursor: 'pointer' }}
      >
        <div className="product-card-image">
          <MockupPreview
            category={product.category}
            designImage={thumbImage}
            color={product.colors?.[0]}
            mockup={product.mockup}
          />
          {product.featured && <span className="badge badge-featured">Featured</span>}
          {product.stock === 0 && <span className="badge badge-oos">Out of Stock</span>}
          <div className="product-card-overlay">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
              <button
                className="btn btn-primary"
                disabled={product.stock === 0}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (product.stock > 0) addItem(product, { color: product.colors[0], size: product.sizes[0] }); }}
              >
                <ShoppingCart size={15} /> {product.stock === 0 ? 'Out of Stock' : 'Quick Add'}
              </button>
              <Link to={`/products/${product.id}`} className="btn btn-outline-dark" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                <Eye size={15} /> View Details
              </Link>
            </div>
          </div>
        </div>
        <div className="product-card-body">
          <span className="product-category">{product.category}</span>
          <h3 className="product-name">{product.name}</h3>
          <div className="product-meta">
            <div className="product-rating">
              <Star size={14} fill="#f59e0b" stroke="#f59e0b" />
              <span>{product.rating.toFixed(1)}</span>
              <span className="review-count">({product.reviewCount})</span>
            </div>
            <span className="product-price">₹{product.price.toFixed(0)}</span>
          </div>
          {product.colors.length > 0 && (
            <div className="product-colors">
              {product.colors.slice(0, 3).map(c => (
                <span key={c} className="color-name-chip">
                  <span className="color-name-dot" style={{ background: c, border: c === '#ffffff' ? '1px solid #ccc' : 'none' }} />
                  {colorName(c)}
                </span>
              ))}
              {product.colors.length > 3 && <span className="color-more">+{product.colors.length - 3}</span>}
            </div>
          )}
        </div>
      </motion.div>

      {/* Hover preview popup */}
      {hovered && (
        <div
          className="pc-hover-popup"
          onMouseEnter={keep}
          onMouseLeave={close}
          onClick={() => navigate(`/products/${product.id}`)}
        >
          <div className="pc-hover-img">
            <MockupPreview
              category={product.category}
              designImage={thumbImage}
              color={product.colors?.[0]}
              mockup={product.mockup}
            />
          </div>
          <div className="pc-hover-body">
            <span className="pc-hover-cat">{product.category}</span>
            <h4 className="pc-hover-name">{product.name}</h4>
            <div className="pc-hover-rating">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={12} fill={i < Math.round(product.rating) ? '#f59e0b' : 'none'} stroke="#f59e0b" />
              ))}
              <span>{product.rating.toFixed(1)}</span>
              <span className="pc-hover-rc">({product.reviewCount})</span>
            </div>
            <div className="pc-hover-price">₹{product.price.toFixed(0)}</div>
            {product.description && (
              <p className="pc-hover-desc">{product.description.slice(0, 100)}{product.description.length > 100 ? '…' : ''}</p>
            )}
            {colors.length > 0 && (
              <div className="pc-hover-colors">
                {colors.map(c => (
                  <button
                    key={c}
                    className={`pc-hover-swatch ${addedColor === c ? 'added' : ''}`}
                    style={{ background: c, border: c === '#ffffff' ? '1.5px solid #d1d5db' : '1.5px solid transparent' }}
                    title={colorName(c)}
                    onClick={(e) => quickAdd(e, c)}
                  >
                    {addedColor === c && <Check size={9} color={c === '#ffffff' ? '#333' : '#fff'} />}
                  </button>
                ))}
                {product.colors.length > 6 && <span className="pc-hover-more">+{product.colors.length - 6}</span>}
              </div>
            )}
            <div className="pc-hover-actions" onClick={e => e.stopPropagation()}>
              <button
                className="btn btn-primary"
                disabled={product.stock === 0}
                style={{ flex: 1, fontSize: '0.82rem' }}
                onClick={(e) => quickAdd(e, product.colors[0] || '')}
              >
                <ShoppingCart size={13} /> {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
              <Link
                to={`/products/${product.id}`}
                className="btn btn-ghost"
                style={{ fontSize: '0.82rem' }}
                onClick={e => e.stopPropagation()}
              >
                <Eye size={13} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
