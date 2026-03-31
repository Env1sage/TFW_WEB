import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import MockupPreview from './MockupPreview';

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { addItem } = useCart();

  return (
    <motion.div
      className="product-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div className="product-card-image">
        <MockupPreview
          category={product.category}
          designImage={product.image}
          color={product.colors?.[0]}
          mockup={product.mockup}
        />
        {product.customizable && <span className="badge badge-custom">Customizable</span>}
        {product.featured && <span className="badge badge-featured">Featured</span>}
        {/* Hover quick-action overlay */}
        <div className="product-card-overlay">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <button
              className="btn btn-primary"
              onClick={(e) => { e.preventDefault(); addItem(product, { color: product.colors[0], size: product.sizes[0] }); }}
            >
              <ShoppingCart size={15} /> Quick Add
            </button>
            <Link to={`/products/${product.id}`} className="btn btn-outline-dark" style={{ textAlign: 'center' }}>
              <Eye size={15} /> View Details
            </Link>
          </div>
        </div>
      </div>
      <div className="product-card-body">
        <span className="product-category">{product.category}</span>
        <Link to={`/products/${product.id}`}><h3 className="product-name">{product.name}</h3></Link>
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
            {product.colors.slice(0, 5).map(c => (
              <span key={c} className="color-dot" style={{ background: c, border: c === '#ffffff' ? '1px solid #ddd' : 'none' }} />
            ))}
            {product.colors.length > 5 && <span className="color-more">+{product.colors.length - 5}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
