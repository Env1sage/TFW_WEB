import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Eye, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import MockupPreview from './MockupPreview';
import { COLORS } from '../mockups';
import toast from 'react-hot-toast';

function colorName(hex: string): string {
  return COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}

export default function ProductCard({ product, index = 0, wishlisted: initialWishlisted, onWishlistChange }: { product: Product; index?: number; wishlisted?: boolean; onWishlistChange?: (removed: boolean) => void }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wishlisted, setWishlisted] = useState(initialWishlisted ?? false);

  useEffect(() => { if (initialWishlisted !== undefined) setWishlisted(initialWishlisted); }, [initialWishlisted]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) { toast.error('Log in to save items'); navigate('/login'); return; }
    const next = !wishlisted;
    setWishlisted(next);
    try {
      if (next) { await api.addToWishlist(product.id); toast.success('Saved to wishlist'); onWishlistChange?.(false); }
      else { await api.removeFromWishlist(product.id); toast.success('Removed from wishlist'); onWishlistChange?.(true); }
    } catch { setWishlisted(!next); toast.error('Could not update wishlist'); }
  };

  const thumbImage = product.image || product.images?.[0] || product.mockup?.frontImage || '';

  return (
    <motion.div
      className="product-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      onClick={() => navigate(`/products/${product.slug || product.id}`)}
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
        <button
          className={`product-wishlist-btn ${wishlisted ? 'active' : ''}`}
          onClick={toggleWishlist}
          title={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} />
        </button>
        <div className="product-card-overlay">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <button
              className="btn btn-primary"
              disabled={product.stock === 0}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (product.stock > 0) addItem(product, { color: product.colors[0], size: product.sizes[0] }); }}
            >
              <ShoppingCart size={15} /> {product.stock === 0 ? 'Out of Stock' : 'Quick Add'}
            </button>
            <Link to={`/products/${product.slug || product.id}`} className="btn btn-outline-dark" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
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
  );
}
