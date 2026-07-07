import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Shield, Menu, X, Search, Package, Palette, Sparkles, Moon, Sun, Tag, Copy, CheckCircle, ChevronDown, Shirt, Layers, HardHat, CreditCard, Sticker, Tags, ShoppingBag, Monitor, Printer, BookOpen, Coffee, Home, type LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import type { Coupon } from '../types';

const MEGA_GROUPS: { heading: string; icon: LucideIcon; items: { label: string; category: string }[] }[] = [
  {
    heading: 'T-Shirts & Polo',
    icon: Shirt,
    items: [
      { label: 'Plain White T-Shirt',          category: 'T-Shirts' },
      { label: 'Plain Black T-Shirt',          category: 'T-Shirts' },
      { label: 'Oversized Drop-Shoulder Tee',  category: 'T-Shirts' },
      { label: 'Acid Wash Oversized Tee',      category: 'T-Shirts' },
      { label: 'Galaxy Print Oversized Tee',   category: 'T-Shirts' },
      { label: 'Dry-Fit Performance T-Shirt',  category: 'T-Shirts' },
      { label: 'Full-Sleeve Printed T-Shirt',  category: 'T-Shirts' },
      { label: 'Classic White Polo',           category: 'Polo T-Shirts' },
      { label: 'Navy Blue Corporate Polo',     category: 'Polo T-Shirts' },
      { label: 'Dry-Fit Sports Polo',          category: 'Polo T-Shirts' },
      { label: 'Premium Pima Cotton Polo',     category: 'Polo T-Shirts' },
      { label: 'Long-Sleeve Polo Shirt',       category: 'Polo T-Shirts' },
    ],
  },
  {
    heading: 'Shirts, Hoodies & Jackets',
    icon: Layers,
    items: [
      { label: 'White Formal Shirt',           category: 'Shirts' },
      { label: 'Embroidered Corporate Shirt',  category: 'Shirts' },
      { label: 'Oxford Weave Shirt',           category: 'Shirts' },
      { label: 'Linen Blend Summer Shirt',     category: 'Shirts' },
      { label: 'Classic Grey Pullover Hoodie', category: 'Hoodies' },
      { label: 'Black Zip-Up Hoodie',          category: 'Hoodies' },
      { label: 'Oversized Pullover Hoodie',    category: 'Hoodies' },
      { label: 'Embroidered Chest Hoodie',     category: 'Hoodies' },
      { label: 'Black Bomber Jacket',          category: 'Jackets' },
      { label: 'Varsity Letterman Jacket',     category: 'Jackets' },
      { label: 'Softshell Outdoor Jacket',     category: 'Jackets' },
      { label: 'Windbreaker Jacket',           category: 'Jackets' },
    ],
  },
  {
    heading: 'Kids, Workwear & Headwear',
    icon: HardHat,
    items: [
      { label: 'Kids Plain White T-Shirt',     category: 'Kids Clothing' },
      { label: 'Kids Cartoon Print Tee',       category: 'Kids Clothing' },
      { label: 'Kids Pullover Hoodie',         category: 'Kids Clothing' },
      { label: 'Kids Sports Jersey',           category: 'Kids Clothing' },
      { label: 'Corporate Uniform Shirt',      category: 'Workwear' },
      { label: 'Safety / Event Vest',          category: 'Workwear' },
      { label: 'Chef Coat / Kitchen Jacket',   category: 'Workwear' },
      { label: 'Classic Baseball Cap',         category: 'Headwear' },
      { label: 'Snapback Cap',                 category: 'Headwear' },
      { label: 'Bucket Hat',                   category: 'Headwear' },
      { label: 'Knit Beanie',                  category: 'Headwear' },
      { label: 'Flat Brim Embroidered Cap',    category: 'Headwear' },
    ],
  },
  {
    heading: 'Visiting Cards',
    icon: CreditCard,
    items: [
      { label: 'Standard Visiting Card',       category: 'Visiting Cards' },
      { label: 'Premium Matte Visiting Card',  category: 'Visiting Cards' },
      { label: 'Spot UV Visiting Card',        category: 'Visiting Cards' },
      { label: 'Raised Gold Foil Card',        category: 'Visiting Cards' },
      { label: 'Transparent PVC Card',         category: 'Visiting Cards' },
      { label: 'NFC Smart Business Card',      category: 'Visiting Cards' },
      { label: 'Rounded Corner Card',          category: 'Visiting Cards' },
      { label: 'Velvet Soft-Touch Card',       category: 'Visiting Cards' },
      { label: 'Eco Kraft Visiting Card',      category: 'Visiting Cards' },
      { label: 'Square Format Card',           category: 'Visiting Cards' },
    ],
  },
  {
    heading: 'Stickers & Phone Cases',
    icon: Sticker,
    items: [
      { label: 'Custom Die-Cut Sticker',       category: 'Stickers' },
      { label: 'Holographic Sticker',          category: 'Stickers' },
      { label: 'QR Code Sticker',              category: 'Stickers' },
      { label: 'Sticker Sheet (A5)',           category: 'Stickers' },
      { label: 'Clear Transparent Sticker',    category: 'Stickers' },
      { label: 'Glow-in-the-Dark Sticker',     category: 'Stickers' },
      { label: 'iPhone Hard Case',             category: 'Phone Cases' },
      { label: 'Samsung Hard Case',            category: 'Phone Cases' },
      { label: 'Tough Dual-Layer Case',        category: 'Phone Cases' },
      { label: 'MagSafe Compatible Case',      category: 'Phone Cases' },
      { label: 'Flip Wallet Phone Case',       category: 'Phone Cases' },
      { label: 'Clear Printed Phone Case',     category: 'Phone Cases' },
    ],
  },
  {
    heading: 'Bags & Totes',
    icon: ShoppingBag,
    items: [
      { label: 'Natural Canvas Tote Bag',      category: 'Tote Bags' },
      { label: 'Zipped Canvas Tote Bag',       category: 'Tote Bags' },
      { label: 'Vegan Leather Tote',           category: 'Tote Bags' },
      { label: 'Jute Tote Bag',               category: 'Tote Bags' },
      { label: 'Black Laptop Backpack',        category: 'Bags' },
      { label: 'Sling / Crossbody Bag',        category: 'Bags' },
      { label: 'Duffel / Gym Bag',             category: 'Bags' },
      { label: 'Premium Gift Bag',             category: 'Bags' },
      { label: 'Kraft Paper Carry Bag',        category: 'Bags' },
      { label: 'Canvas Messenger Bag',         category: 'Bags' },
    ],
  },
  {
    heading: 'Signs & Displays',
    icon: Monitor,
    items: [
      { label: 'Roll-Up Banner Stand',         category: 'Signs & Displays' },
      { label: 'Flex Vinyl Banner',            category: 'Signs & Displays' },
      { label: 'Acrylic Name Sign',            category: 'Signs & Displays' },
      { label: 'LED Acrylic Light Sign',       category: 'Signs & Displays' },
      { label: 'Life-Size Cardboard Standee',  category: 'Signs & Displays' },
      { label: 'Foam Board Cutout',            category: 'Signs & Displays' },
      { label: 'Table Tent / Menu Card',       category: 'Signs & Displays' },
      { label: 'Pavement A-Board Sign',        category: 'Signs & Displays' },
    ],
  },
  {
    heading: 'Stationery & Stamps',
    icon: BookOpen,
    items: [
      { label: 'Custom A5 Notebook',           category: 'Stationery' },
      { label: 'Undated Premium Diary',        category: 'Stationery' },
      { label: 'Custom Metal Pen',             category: 'Stationery' },
      { label: 'Pen + Notebook Gift Set',      category: 'Stationery' },
      { label: 'Custom Desk Calendar',         category: 'Stationery' },
      { label: 'Tri-Fold Brochure',            category: 'Stationery' },
      { label: 'Custom Desk Mousepad',         category: 'Stationery' },
    ],
  },
  {
    heading: 'Drinkware',
    icon: Coffee,
    items: [
      { label: 'Classic White Ceramic Mug',    category: 'Mugs' },
      { label: 'Magic Colour-Changing Mug',    category: 'Mugs' },
      { label: 'Photo Print Mug',              category: 'Mugs' },
      { label: 'Large 450ml Jumbo Mug',        category: 'Mugs' },
      { label: 'Stainless Steel Bottle 750ml', category: 'Bottles' },
      { label: 'Copper Water Bottle',          category: 'Bottles' },
      { label: 'Fruit Infuser Bottle',         category: 'Bottles' },
      { label: 'Insulated Tumbler 400ml',      category: 'Bottles' },
      { label: 'Sipper Water Bottle',          category: 'Bottles' },
    ],
  },
  {
    heading: 'Canvas, Posters & Gifts',
    icon: Home,
    items: [
      { label: 'Canvas Print 12×16"',          category: 'Canvas' },
      { label: 'Canvas Print 18×24"',          category: 'Canvas' },
      { label: '3-Panel Triptych Canvas Set',  category: 'Canvas' },
      { label: 'HD Photo Collage Canvas',      category: 'Canvas' },
      { label: 'A2 Large Format Poster',       category: 'Posters' },
      { label: 'Framed Poster A3',             category: 'Posters' },
      { label: 'Motivational Quote Poster',    category: 'Posters' },
      { label: 'Premium Gift Box',             category: 'Gifts' },
      { label: 'Custom Photo Album',           category: 'Gifts' },
      { label: 'Corporate Gift Hamper',        category: 'Gifts' },
      { label: 'Custom Photo Cushion',         category: 'Gifts' },
      { label: '2-Fold Compact Umbrella',      category: 'Rainwear' },
    ],
  },
];

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
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponIdx, setCouponIdx] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch active coupons
  useEffect(() => {
    const fetchCoupons = () => api.getActiveCoupons().then(c => setCoupons(c)).catch(() => {});
    fetchCoupons();
    const poll = setInterval(fetchCoupons, 30_000); // re-fetch every 30s
    return () => clearInterval(poll);
  }, []);

  // Rotate coupons every 5 seconds
  useEffect(() => {
    if (coupons.length <= 1) return;
    const interval = setInterval(() => {
      setCouponIdx(prev => (prev + 1) % coupons.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [coupons.length]);

  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }, []);

  const currentCoupon = coupons[couponIdx];

  const formatCouponMessage = (coupon: Coupon) => {
    const val = coupon.discountType === 'percentage'
      ? `${coupon.discountValue}%`
      : `₹${coupon.discountValue}`;
    if (coupon.popupMessage) return coupon.popupMessage;
    const minText = coupon.minOrderAmount > 0 ? ` on orders above ₹${coupon.minOrderAmount}` : '';
    return `Get ${val} OFF${minText}`;
  };

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
  const [megaOpen, setMegaOpen] = useState(false);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMega = () => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
    setMegaOpen(true);
  };
  const closeMega = () => {
    megaTimer.current = setTimeout(() => setMegaOpen(false), 120);
  };

  return (
    <>
      {!annClosed && currentCoupon && (
        <div className="announcement-bar">
          <div className="ann-shimmer" />
          <div className="ann-confetti-container">
            <span className="ann-conf ann-conf-1" />
            <span className="ann-conf ann-conf-2" />
            <span className="ann-conf ann-conf-3" />
            <span className="ann-conf ann-conf-4" />
            <span className="ann-conf ann-conf-5" />
            <span className="ann-conf ann-conf-6" />
            <span className="ann-conf ann-conf-7" />
            <span className="ann-conf ann-conf-8" />
          </div>
          <div className="ann-content">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentCoupon.id}
                className="ann-slide"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.4 }}
              >
                <Sparkles size={14} className="ann-sparkle" />
                <span className="ann-text">{formatCouponMessage(currentCoupon)}</span>
                <span className="ann-separator">·</span>
                <span className="ann-use-label">Use code</span>
                <button className="ann-code-btn" onClick={() => copyCode(currentCoupon.code)}>
                  <span className="ann-code">{currentCoupon.code}</span>
                  {copiedCode === currentCoupon.code ? (
                    <CheckCircle size={12} className="ann-copy-icon ann-copied" />
                  ) : (
                    <Copy size={12} className="ann-copy-icon" />
                  )}
                </button>
                <Sparkles size={14} className="ann-sparkle" />
              </motion.div>
            </AnimatePresence>
          </div>
          <button className="ann-close" onClick={() => setAnnClosed(true)} aria-label="Close">×</button>
        </div>
      )}
      <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <img src="/logo.svg" alt="TheFramedWall" className="brand-logo" />
          <span className="brand-name">TheFramedWall</span>
        </Link>

        <div className={`navbar-links ${mobileOpen ? 'open' : ''}`}>
          {/* Products with mega menu */}
          <div
            className={`nav-link nav-link--mega-trigger ${isActive('/products') ? 'active' : ''}`}
            onMouseEnter={openMega}
            onMouseLeave={closeMega}
          >
            <Link to="/products" onClick={() => { setMobileOpen(false); setMegaOpen(false); }}>Products</Link>
            <ChevronDown size={13} className={`mega-chevron${megaOpen ? ' open' : ''}`} />
          </div>

          <Link to="/collections" className={`nav-link nav-link--collections ${isActive('/collections') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
            <Sparkles size={13} /> Collections
          </Link>
          <Link to="/about" className={`nav-link ${isActive('/about') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>About</Link>
          <Link to="/contact" className={`nav-link ${isActive('/contact') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>Contact</Link>
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
            {count > 0 && <span key={count} className="cart-badge cart-badge-pop">{count}</span>}
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
                      <strong>{user.name || user.phone || 'User'}</strong>
                      <span>{user.email ?? (user.phone ? `+91 ${user.phone}` : '')}</span>
                    </div>
                    <Link to="/profile" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                      <User size={16} /> Profile
                    </Link>
                    <Link to="/orders" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                      <Package size={16} /> My Orders
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
            <Link to="/login" className="icon-btn" aria-label="Sign In">
              <User size={20} />
            </Link>
          )}

          <button className="icon-btn mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mega menu — direct child of nav so it can span full width */}
      <AnimatePresence>
        {megaOpen && (
          <motion.div
            className="mega-menu--full"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            onMouseEnter={openMega}
            onMouseLeave={closeMega}
          >
            <div className="mega-full-inner">
              <div className="mega-groups">
                {MEGA_GROUPS.map(group => (
                  <div key={group.heading} className="mega-group">
                    <p className="mega-group-heading"><group.icon size={11} strokeWidth={2.5} />{group.heading}</p>
                    <div className="mega-group-items">
                      {group.items.map(item => (
                        <Link
                          key={item.label}
                          to={`/products?category=${encodeURIComponent(item.category)}`}
                          className="mega-sku-item"
                          onClick={() => { setMegaOpen(false); setMobileOpen(false); }}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mega-sidebar">
                <p className="mega-heading">Quick Links</p>
                <div className="mega-quick-links">
                  <Link to="/products?featured=true" onClick={() => setMegaOpen(false)} className="mega-quick-link">
                    <Sparkles size={14} /> Featured Products
                  </Link>
                  <Link to="/products" onClick={() => setMegaOpen(false)} className="mega-quick-link">
                    <Package size={14} /> All Products
                  </Link>
                  <Link to="/collections" onClick={() => setMegaOpen(false)} className="mega-quick-link">
                    <Sparkles size={14} /> Collections
                  </Link>
                  <Link to="/design-studio" onClick={() => setMegaOpen(false)} className="mega-quick-link mega-quick-link--cta">
                    <Palette size={14} /> Design Your Own
                  </Link>
                  <Link to="/corporate" onClick={() => setMegaOpen(false)} className="mega-quick-link">
                    <Tag size={14} /> Bulk / Corporate Orders
                  </Link>
                </div>
                <div className="mega-promo">🎁 Free shipping over ₹999</div>
                <div className="mega-promo mega-promo--accent">⚡ 150+ products available</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </>
  );
}
