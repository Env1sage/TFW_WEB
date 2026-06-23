import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Shield, Menu, X, Search, Package, Palette, Sparkles, Moon, Sun, Tag, Copy, CheckCircle, ChevronDown, Shirt, Layers, HardHat, CreditCard, Sticker, Tags, ShoppingBag, Monitor, Printer, BookOpen, Coffee, Home, type LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import type { Coupon } from '../types';

const MEGA_GROUPS: { heading: string; icon: LucideIcon; items: string[] }[] = [
  {
    heading: 'T-Shirts & Polo',
    icon: Shirt,
    items: ["Men's T-Shirts","Women's T-Shirts","Oversized T-Shirts","Oversized Classic T-Shirt","Acid Wash Oversized Tee","Terry Oversized Tee","Full Sleeve T-Shirts","Round Neck T-Shirts","V-Neck T-Shirts","Dry Fit T-Shirts","Printed T-Shirts","Men's Polo T-Shirts","Scott Polo T-Shirts","Branded Polo T-Shirts"],
  },
  {
    heading: 'Shirts, Hoodies & Jackets',
    icon: Layers,
    items: ["Custom Office Shirts","Embroidered Dress Shirts","Corporate Shirts","Unisex Hoodie","Zipper Hoodie","Sweatshirts","Varsity Jacket","Bomber Jacket","Windcheaters","Fleece Jackets","Pullover Hoodies"],
  },
  {
    heading: 'Kids, Workwear & Headwear',
    icon: HardHat,
    items: ["Kids T-Shirts","Kids Hoodies","Reflective Safety Vest","Lab Coats","Aprons","Custom Caps","Baseball Caps","Snapback Caps","Dad Caps","Bucket Hats","Beanies","Balaclava","Headbands","Branded Bands"],
  },
  {
    heading: 'Visiting Cards',
    icon: CreditCard,
    items: ["Standard Visiting Cards","Classic Visiting Cards","Rounded Corner Visiting Cards","Square Visiting Cards","Leaf Visiting Cards","Oval Visiting Cards","Circle Visiting Cards","QR Code Visiting Cards","NFC Visiting Cards","Spot UV Visiting Cards","Raised Foil Visiting Cards","Glossy Visiting Cards","Matte Visiting Cards","Bulk Visiting Cards","Magnetic Visiting Cards","Transparent Visiting Cards","Premium Plus Visiting Cards","Non-Tearable Visiting Cards","Velvet Touch Visiting Cards","Pearl Visiting Cards","Kraft Visiting Cards","Diamond Visiting Cards"],
  },
  {
    heading: 'Stickers',
    icon: Sticker,
    items: ["Sheet Stickers","Custom Shape Stickers","Sticker Singles","UV Ink Transfer Stickers","Window Stickers","Car Stickers","Floor Stickers","QR Code Stickers"],
  },
  {
    heading: 'Labels & Tags',
    icon: Tags,
    items: ["Product Labels","Packaging Labels","Shipping Labels","Return Address Labels","Transparent Labels","Industrial Labels","Iron-on Labels","Hang Tags","Folded Hang Tags","Name Tags","Baggage Tags","Neck Labels","Brand Inserts"],
  },
  {
    heading: 'Bags & Carry',
    icon: ShoppingBag,
    items: ["Tote Bags","Laptop Bags","Office Bags","Harissons Bags","Printed Carry Bags","Paper Bags","Designer Shopping Bags","Premium Gift Bags","Potli Bags"],
  },
  {
    heading: 'Signs & Displays',
    icon: Monitor,
    items: ["Banners","Posters","Bulk Posters","Foam Boards","Acrylic Signs","Standees","Tabletop Standees","Tabletop Signs","Mouse Pads","Bookmarks","Keychains","Pin Badges","Tablecloths","Table Runners","Table Mats","Car Door Decals"],
  },
  {
    heading: 'Print & Marketing',
    icon: Printer,
    items: ["Brochures","Bulk Brochures","Booklets","Bulk Booklets","Postcards","Raised Foil Postcards","Menu Cards","Rate Cards","Loyalty Cards","Gift Certificates","Custom Packaging"],
  },
  {
    heading: 'Stationery & Stamps',
    icon: BookOpen,
    items: ["Letterheads","Diaries","Notebooks","Calendars","Wall Calendars","Pens","Personalised Pens","ID Cards","Office Supplies","Self Inking Stamps","Rubber Stamps","Stamp Ink"],
  },
  {
    heading: 'Drinkware & Gifts',
    icon: Coffee,
    items: ["Personalised Mugs","Ceramic Mugs","Magic Mugs","Water Bottles","Tumbler Bottles","Sipper Bottles","Coffee Tumblers","Steel Bottles","Photo Albums","Canvas Prints","Photo Gifts","Gift Hampers","Magnets"],
  },
  {
    heading: 'Home, Living & Rainwear',
    icon: Home,
    items: ["Framed Posters","Cushion Covers","Pillow Covers","Wall Decor","Acrylic Frames","Umbrellas","Single Fold Umbrellas","Raincoats"],
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
                      {group.items.map(name => (
                        <Link
                          key={name}
                          to={`/products?category=${encodeURIComponent(name)}`}
                          className="mega-sku-item"
                          onClick={() => { setMegaOpen(false); setMobileOpen(false); }}
                        >
                          {name}
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
