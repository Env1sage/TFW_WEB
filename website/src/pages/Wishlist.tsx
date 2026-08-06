import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import type { Product } from '../types';
import toast from 'react-hot-toast';

export default function Wishlist() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.getWishlist()
      .then(data => setProducts(data as Product[]))
      .catch(() => toast.error('Could not load wishlist'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleRemove = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
    api.removeFromWishlist(productId).catch(() => {
      toast.error('Could not remove from wishlist');
      // Re-fetch to restore accurate state
      api.getWishlist().then(d => setProducts(d as Product[])).catch(() => {});
    });
  };

  return (
    <div className="wishlist-page">
      <div className="container">
        <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Heart size={28} style={{ color: '#ef4444' }} fill="#ef4444" /> Wishlist
          </h1>
          {products.length > 0 && (
            <p style={{ color: 'var(--text-3)', margin: '4px 0 0' }}>{products.length} saved item{products.length !== 1 ? 's' : ''}</p>
          )}
        </motion.div>

        {!user ? (
          <div className="wishlist-empty">
            <Heart size={48} style={{ opacity: 0.15 }} />
            <h2>Log in to see your wishlist</h2>
            <p>Save products you love and come back to them anytime.</p>
            <Link to="/login?redirect=/wishlist" className="btn btn-primary btn-lg">Log In</Link>
          </div>
        ) : loading ? (
          <div className="wishlist-loading">
            {[1,2,3,4].map(i => <div key={i} className="wishlist-skeleton" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="wishlist-empty">
            <Heart size={48} style={{ opacity: 0.15 }} />
            <h2>Your wishlist is empty</h2>
            <p>Tap the <Heart size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> on any product to save it here.</p>
            <Link to="/products" className="btn btn-primary btn-lg btn-shimmer">
              <ShoppingBag size={18} /> Browse Products
            </Link>
          </div>
        ) : (
          <div className="products-grid">
            {products.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                index={i}
                wishlisted
                onWishlistChange={(removed) => { if (removed) handleRemove(product.id); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
