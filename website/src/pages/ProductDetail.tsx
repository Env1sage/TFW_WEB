import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ShoppingCart, Minus, Plus, ArrowLeft, Check, Palette, Ruler, Truck, Info, Shirt, Image as ImageIcon, Bell, X, Loader, Package, MapPin, ChevronDown } from 'lucide-react';
import { api, getSessionId } from '../api';
import { useCart } from '../context/CartContext';
import type { Product } from '../types';
import MockupPreview from '../components/MockupPreview';
import toast from 'react-hot-toast';

const SIZE_CHART: Record<string, { sizes: string[]; chest: string[]; length: string[]; sleeve: string[] }> = {
  'T-Shirts': {
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    chest: ['34"', '36"', '38"', '40"', '42"', '44"'],
    length: ['26"', '27"', '28"', '29"', '30"', '31"'],
    sleeve: ['7"', '7.5"', '8"', '8.5"', '9"', '9.5"'],
  },
  'Hoodies': {
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    chest: ['38"', '40"', '42"', '44"', '46"'],
    length: ['26"', '27"', '28"', '29"', '30"'],
    sleeve: ['24"', '25"', '26"', '27"', '28"'],
  },
};

const FABRIC_INFO: Record<string, string> = {
  'T-Shirts': '100% Combed Cotton (180 GSM), Bio-washed, Pre-shrunk. Soft hand feel with excellent color retention.',
  'Hoodies': '80% Cotton / 20% Polyester Fleece (320 GSM), Brushed interior for warmth. Reinforced hood and kangaroo pocket.',
  'Mugs': 'Premium AAA-grade ceramic, Dishwasher & microwave safe. Vibrant sublimation print that never fades.',
  'Phone Cases': 'Polycarbonate hard shell with TPU bumper. Impact-resistant, scratch-proof coating. Precise cutouts.',
  'Posters': 'Museum-quality 250 GSM matte paper. Archival inks rated for 100+ years. Rich color reproduction.',
  'Canvas': 'Gallery-grade 380 GSM poly-cotton canvas, Archival pigment inks. Hand-stretched on kiln-dried wood frame.',
  'Stickers': 'Premium vinyl, waterproof & UV-resistant. Dishwasher safe, outdoor rated for 3+ years.',
  'Tote Bags': '12oz natural cotton canvas (340 GSM). Reinforced handles. Machine washable.',
};

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [galleryView, setGalleryView] = useState<'mockup' | 'design'>('mockup');
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyForm, setNotifyForm] = useState({ name: '', mobile: '', email: '' });
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);

  // Shipping estimate widget
  const [pinInput, setPinInput] = useState('');
  const [shippingEst, setShippingEst] = useState<{ cost: number; zone: string | null; estimatedDays: string } | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  const { addItem } = useCart();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.getProduct(id).then(p => {
      if (!p) throw new Error('Product not found');
      setProduct(p);
      if (p.colors?.length) setSelectedColor(p.colors[0]);
      if (p.sizes?.length) setSelectedSize(p.sizes[0]);
      // Track product view
      api.trackEvent({ type: 'view', productId: p.id, productName: p.name, category: p.category, brandId: p.brandId, price: p.price, sessionId: getSessionId() });
    }).catch((err) => {
      console.error('Failed to load product:', err);
      setError(err.message || 'Failed to load product');
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-spinner"><div className="spinner" /></div>;
  if (error || !product) return <div className="container"><div className="empty-state"><h3>{error || 'Product not found'}</h3><Link to="/products" className="btn btn-primary">Back to Products</Link></div></div>;

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(product, { color: selectedColor, size: selectedSize });
    }
    // Track add to cart
    api.trackEvent({ type: 'add_to_cart', productId: product!.id, productName: product!.name, category: product!.category, brandId: (product as any).brandId, size: selectedSize || undefined, color: selectedColor || undefined, price: product!.price, quantity, sessionId: getSessionId() });
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyForm.name && !notifyForm.mobile && !notifyForm.email) {
      toast.error('Please fill in at least one contact field');
      return;
    }
    if (notifyForm.mobile && !/^[6-9]\d{9}$/.test(notifyForm.mobile)) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    setNotifySubmitting(true);
    try {
      await api.submitBackInStock({ productId: product!.id, ...notifyForm });
      setNotifyDone(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not register notification');
    } finally {
      setNotifySubmitting(false);
    }
  };

  const checkShipping = async () => {
    if (!/^\d{6}$/.test(pinInput)) { toast.error('Enter a valid 6-digit pincode'); pinRef.current?.focus(); return; }
    setShippingLoading(true);
    setShippingEst(null);
    try {
      const result = await api.getShippingClassRate({
        pinCode: pinInput,
        subtotal: product!.price * quantity,
        weightGrams: product!.weightGrams || 200,
      });
      setShippingEst(result);
    } catch { toast.error('Could not check shipping'); }
    finally { setShippingLoading(false); }
  };

  // Volumetric & chargeable weight
  const deadWeightKg     = ((product.weightGrams || 200) / 1000);
  const volWeightKg      = ((product.lengthCm || 30) * (product.breadthCm || 20) * (product.heightCm || 5)) / 5000;
  const chargeableWeightKg = Math.max(deadWeightKg, volWeightKg);

  const isOutOfStock = product.stock !== undefined && product.stock <= 0;

  return (
    <div className="product-detail-page">
      <div className="container">
        <Link to="/products" className="back-link"><ArrowLeft size={16} /> Back to Products</Link>

        <div className="product-detail-grid">
          <motion.div className="product-gallery" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div className="main-image">
              {galleryView === 'mockup' ? (
                <MockupPreview
                  category={product.category}
                  designImage={product.image}
                  color={selectedColor || product.colors?.[0]}
                  mockup={product.mockup}
                />
              ) : (
                <img src={product.image} alt={product.name} className="design-only-img" />
              )}
              {product.customizable && (
                <Link to={`/design-studio/product/${product.id}`} className="customize-badge">
                  <Palette size={16} /> Open Design Studio
                </Link>
              )}
            </div>
            {/* Thumbnail strip: mockup view + design-only view */}
            <div className="gallery-thumbs">
              <button
                className={`gallery-thumb ${galleryView === 'mockup' ? 'active' : ''}`}
                onClick={() => setGalleryView('mockup')}
                title="Mockup view"
              >
                <Shirt size={20} />
                <span>Mockup</span>
              </button>
              <button
                className={`gallery-thumb ${galleryView === 'design' ? 'active' : ''}`}
                onClick={() => setGalleryView('design')}
                title="Design artwork"
              >
                <ImageIcon size={20} />
                <span>Design</span>
              </button>
            </div>
          </motion.div>

          <motion.div className="product-info" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <span className="product-category-tag">{product.category}</span>
            <h1>{product.name}</h1>

            <div className="product-rating-large">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={18} fill={i < Math.round(product.rating) ? '#f59e0b' : 'none'} stroke="#f59e0b" />
              ))}
              <span>{product.rating.toFixed(1)} ({product.reviewCount} reviews)</span>
            </div>

            <p className="product-price-large">₹{product.price.toFixed(0)}</p>
            <p className="product-description">{product.description}</p>

            {product.colors.length > 0 && (
              <div className="option-group">
                <label>Color</label>
                <div className="color-options">
                  {[...new Set(product.colors)].map(c => (
                    <button
                      key={c}
                      className={`color-option ${selectedColor === c ? 'active' : ''}`}
                      style={{ background: c, border: c === '#ffffff' ? '2px solid var(--border)' : '2px solid transparent' }}
                      onClick={() => setSelectedColor(c)}
                    >
                      {selectedColor === c && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes.length > 0 && (
              <div className="option-group">
                <label>Size</label>
                <div className="size-options">
                  {product.sizes.map(s => (
                    <button
                      key={s}
                      className={`size-option ${selectedSize === s ? 'active' : ''}`}
                      onClick={() => setSelectedSize(s)}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="option-group">
              <label>Quantity</label>
              <div className="quantity-selector">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(Math.min(99, quantity + 1))}><Plus size={16} /></button>
              </div>
            </div>

            {isOutOfStock ? (
              <div className="product-actions">
                <div className="out-of-stock-banner">
                  <span className="oos-badge">Out of Stock</span>
                  <p>This product is currently unavailable. Get notified when it's back!</p>
                </div>
                <button className="btn btn-notify btn-lg btn-block" onClick={() => { setShowNotifyModal(true); setNotifyDone(false); }}>
                  <Bell size={18} /> Notify Me When Available
                </button>
              </div>
            ) : (
              <div className="product-actions">
                <button className="btn btn-primary btn-lg btn-block btn-add-cart btn-shimmer" onClick={handleAdd}>
                  <ShoppingCart size={18} /> Add to Cart — ₹{(product.price * quantity).toFixed(0)}
                </button>
                {product.customizable && (
                  <Link to={`/design-studio/product/${product.id}`} className="btn btn-outline btn-lg btn-block" style={{ marginTop: 10 }}>
                    <Palette size={18} /> Customize in Design Studio
                  </Link>
                )}
              </div>
            )}

            <div className="product-badges">
              <span>Free shipping over ₹999</span>
              <span>7-day returns</span>
              <span>Secure checkout</span>
            </div>

            {/* Size Chart */}
            {SIZE_CHART[product.category] && (
              <div className="product-extra-section">
                <button className="extra-section-toggle" onClick={() => setShowSizeChart(!showSizeChart)}>
                  <Ruler size={16} />
                  <span>Size Chart</span>
                  <span className="toggle-arrow">{showSizeChart ? '▲' : '▼'}</span>
                </button>
                {showSizeChart && (
                  <div className="size-chart-table-wrap">
                    <table className="size-chart-table">
                      <thead>
                        <tr>
                          <th>Size</th>
                          {SIZE_CHART[product.category].sizes.map(s => <th key={s}>{s}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td>Chest</td>{SIZE_CHART[product.category].chest.map((v, i) => <td key={i}>{v}</td>)}</tr>
                        <tr><td>Length</td>{SIZE_CHART[product.category].length.map((v, i) => <td key={i}>{v}</td>)}</tr>
                        <tr><td>Sleeve</td>{SIZE_CHART[product.category].sleeve.map((v, i) => <td key={i}>{v}</td>)}</tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Fabric & Material Info */}
            {FABRIC_INFO[product.category] && (
              <div className="product-extra-section">
                <div className="extra-section-header">
                  <Info size={16} />
                  <span>Fabric &amp; Material</span>
                </div>
                <p className="fabric-info-text">{FABRIC_INFO[product.category]}</p>
              </div>
            )}

            {/* Shipping Estimate Widget */}
            <div className="product-extra-section shipping-estimate-widget">
              <div className="shipping-estimate-header">
                <Truck size={16} />
                <strong>Check Delivery</strong>
              </div>
              <div className="shipping-pin-row">
                <input
                  ref={pinRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setShippingEst(null); }}
                  onKeyDown={e => e.key === 'Enter' && checkShipping()}
                  placeholder="Enter 6-digit pincode"
                  className="shipping-pin-input"
                />
                <button
                  className="btn btn-outline btn-sm shipping-check-btn"
                  onClick={checkShipping}
                  disabled={shippingLoading || pinInput.length !== 6}
                >
                  {shippingLoading ? <Loader size={14} className="spin" /> : <><MapPin size={14} /> Check</>}
                </button>
              </div>

              {shippingEst && (
                <motion.div
                  className={`shipping-result ${shippingEst.cost === 0 ? 'shipping-result--free' : ''}`}
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                >
                  <div className="shipping-result-cost">
                    {shippingEst.cost === 0
                      ? <><Check size={14} /> <strong>Free Delivery</strong></>
                      : <><Truck size={14} /> <strong>₹{shippingEst.cost}</strong> shipping</>
                    }
                  </div>
                  <div className="shipping-result-meta">
                    {shippingEst.zone && <span>{shippingEst.zone}</span>}
                    <span>{shippingEst.estimatedDays}</span>
                  </div>
                </motion.div>
              )}

              {/* Weight & Dimensions Collapsible */}
              <button
                className="shipping-dims-toggle"
                onClick={() => setShowDimensions(v => !v)}
              >
                <Package size={13} />
                <span>Package details</span>
                <ChevronDown size={13} style={{ transform: showDimensions ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              <AnimatePresence>
                {showDimensions && (
                  <motion.div
                    className="shipping-dims-panel"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="shipping-dims-grid">
                      <div className="shipping-dim-item">
                        <span className="dim-label">Dead weight</span>
                        <span className="dim-value">{deadWeightKg.toFixed(3)} kg</span>
                      </div>
                      <div className="shipping-dim-item">
                        <span className="dim-label">Dimensions (L×B×H)</span>
                        <span className="dim-value">{product.lengthCm || 30} × {product.breadthCm || 20} × {product.heightCm || 5} cm</span>
                      </div>
                      <div className="shipping-dim-item">
                        <span className="dim-label">Volumetric weight</span>
                        <span className="dim-value">{volWeightKg.toFixed(3)} kg</span>
                      </div>
                      <div className="shipping-dim-item highlight">
                        <span className="dim-label">Chargeable weight</span>
                        <span className="dim-value">{chargeableWeightKg.toFixed(3)} kg</span>
                      </div>
                    </div>
                    <p className="dims-formula-note">Volumetric = L × B × H ÷ 5000. Chargeable = max(dead, volumetric).</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Notify Me Modal ─────────────────────────────── */}
      <AnimatePresence>
        {showNotifyModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowNotifyModal(false); }}
          >
            <motion.div
              className="notify-modal"
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <button className="modal-close-btn" onClick={() => setShowNotifyModal(false)}><X size={18} /></button>

              {notifyDone ? (
                <div className="notify-success">
                  <div className="notify-success-icon"><Check size={32} /></div>
                  <h3>You're on the list!</h3>
                  <p>We'll notify you as soon as <strong>{product.name}</strong> is back in stock.</p>
                  <button className="btn btn-primary" onClick={() => setShowNotifyModal(false)}>Done</button>
                </div>
              ) : (
                <>
                  <div className="notify-modal-header">
                    <div className="notify-bell-icon"><Bell size={24} /></div>
                    <h3>Notify Me When Available</h3>
                    <p>Enter your details and we'll alert you the moment <strong>{product.name}</strong> is back in stock.</p>
                  </div>

                  <form className="notify-form" onSubmit={handleNotifySubmit}>
                    <div className="form-group">
                      <label>Your Name</label>
                      <input
                        type="text"
                        placeholder="Enter your name"
                        value={notifyForm.name}
                        onChange={e => setNotifyForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Mobile Number <span className="field-hint">(for SMS alert)</span></label>
                      <div className="phone-input-wrap">
                        <span className="phone-prefix">+91</span>
                        <input
                          type="tel"
                          placeholder="10-digit mobile number"
                          maxLength={10}
                          value={notifyForm.mobile}
                          onChange={e => setNotifyForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Email Address <span className="field-hint">(for email alert)</span></label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={notifyForm.email}
                        onChange={e => setNotifyForm(f => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <p className="notify-privacy">We'll only contact you about this product. No spam.</p>
                    <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={notifySubmitting}>
                      {notifySubmitting ? <><Loader size={16} className="spin" /> Registering...</> : <><Bell size={16} /> Notify Me</>}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
