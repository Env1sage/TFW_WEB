import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Shield, Menu, X, Search, Package, Palette, Truck, Bookmark, Shirt, Coffee, Smartphone, Image, Frame, Sticker, ShoppingBag, Sparkles, ArrowRight, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [annClosed, setAnnClosed] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {!annClosed && (
        <div className="announcement-bar">
          <Truck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.35rem' }} />
          <strong>Free Shipping</strong> on orders above ₹999 · Use code{' '}
          <strong style={{ color: 'var(--accent)' }}>WELCOME10</strong> for 10% off your first order
          <button className="ann-close" onClick={() => setAnnClosed(true)} aria-label="Close">×</button>
        </div>
      )}
      <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <div className="brand-icon">T</div>
          <span>TheFramedWall</span>
        </Link>

        <div className={`navbar-links ${mobileOpen ? 'open' : ''}`}>
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>Home</Link>
          <Link to="/products" className={`nav-link ${isActive('/products') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>Products</Link>
          <Link to="/about" className={`nav-link ${isActive('/about') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>About</Link>
          <Link to="/design-studio" className={`nav-link design-studio-link ${isActive('/design-studio') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
            <Palette size={14} /> Design Studio
          </Link>
          {user && (
            <Link to="/orders" className={`nav-link ${isActive('/orders') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>Orders</Link>
          )}
          {user && ['admin', 'super_admin', 'product_manager', 'order_manager'].includes(user.role) && (
            <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
              <Shield size={14} /> Admin
            </Link>
          )}
        </div>

        <div className="navbar-actions">
          <button className="icon-btn" onClick={() => setSearchOpen(!searchOpen)} aria-label="Search">
            <Search size={20} />
          </button>

          <button className="icon-btn theme-toggle" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <Link to="/cart" className="icon-btn cart-btn">
            <ShoppingCart size={20} />
            {count > 0 && <span className="cart-badge">{count}</span>}
          </Link>

          {user ? (
            <div className="profile-dropdown">
              <button className="icon-btn profile-btn" onClick={() => setProfileOpen(!profileOpen)}>
                <div className="avatar-sm">{user.name.charAt(0).toUpperCase()}</div>
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div className="dropdown-menu" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                    <div className="dropdown-header">
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                    <Link to="/profile" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                      <User size={16} /> Profile
                    </Link>
                    <Link to="/orders" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                      <Package size={16} /> My Orders
                    </Link>
                    <Link to="/saved-designs" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                      <Bookmark size={16} /> Saved Designs
                    </Link>
                    {user.role && ['admin', 'super_admin', 'product_manager', 'order_manager'].includes(user.role) && (
                      <Link to="/admin" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                        <Shield size={16} /> Admin Panel
                      </Link>
                    )}
                    <button className="dropdown-item danger" onClick={handleLogout}>
                      <LogOut size={16} /> Log Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">Sign In</Link>
          )}

          <button className="icon-btn mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div className="search-bar" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <form onSubmit={handleSearch} className="search-form">
              <Search size={18} />
              <input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
              <button type="submit" className="btn btn-primary btn-sm">Search</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
    <div className="category-bar">
      <div className="category-bar-links">
        <Link to="/products?category=T-Shirts" className="cat-bar-link"><Shirt size={14} /> T-Shirts</Link>
        <Link to="/products?category=Hoodies" className="cat-bar-link"><Shirt size={14} /> Hoodies</Link>
        <Link to="/products?category=Mugs" className="cat-bar-link"><Coffee size={14} /> Mugs</Link>
        <Link to="/products?category=Phone+Cases" className="cat-bar-link"><Smartphone size={14} /> Phone Cases</Link>
        <Link to="/products?category=Posters" className="cat-bar-link"><Image size={14} /> Posters</Link>
        <Link to="/products?category=Canvas" className="cat-bar-link"><Frame size={14} /> Canvas</Link>
        <Link to="/products?category=Stickers" className="cat-bar-link"><Sticker size={14} /> Stickers</Link>
        <Link to="/products?category=Tote+Bags" className="cat-bar-link"><ShoppingBag size={14} /> Tote Bags</Link>
        <Link to="/products" className="cat-bar-link">All Products <ArrowRight size={13} /></Link>
        <Link to="/design-studio" className="cat-bar-link cat-bar-cta"><Sparkles size={14} /> Design Studio</Link>
      </div>
    </div>
    </>
  );
}
