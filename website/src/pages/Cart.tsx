import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, Minus, Plus, ShoppingBag, ArrowLeft, CreditCard, Palette, Tag, X,
  CheckCircle, Lock, Truck, Phone, ArrowRight, RotateCcw, Shield, Store,
  Zap, MapPin, Clock, ChevronRight, Package,
} from 'lucide-react';
import { EmptyCartAnim } from '../components/EmptyCartAnim';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api, getSessionId } from '../api';
import { useState, useEffect, useRef, useCallback } from 'react';
import ProductCard from '../components/ProductCard';
import type { Product, DeliveryOption } from '../types';
import toast from 'react-hot-toast';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
  'Chandigarh','Puducherry','Lakshadweep','Andaman & Nicobar Islands','Dadra & Nagar Haveli',
];

const PRODUCT_LABELS: Record<string, string> = {
  tshirt: 'Custom T-Shirt', hoodie: 'Custom Hoodie', jacket: 'Custom Jacket',
  cap: 'Custom Cap', pant: 'Custom Pants',
};

const METHOD_ICONS = {
  store_pickup: Store,
  hyperlocal:   Zap,
  standard:     Truck,
};

/* ── Inline phone OTP login gate ─────────────────────────────────────────── */
function CartLoginGate() {
  const { sendOtp, verifyOtp } = useAuth();
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [bypassOtp, setBypassOtp] = useState<string | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleaned)) { toast.error('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);
    try {
      const res = await sendOtp(cleaned);
      setSessionId(res.sessionId); setPhone(cleaned);
      setOtpStep('otp'); setCooldown(30);
      if (res.bypassOtp) {
        setBypassOtp(res.bypassOtp);
        setOtp(res.bypassOtp.split(''));
        toast.success('Use OTP: ' + res.bypassOtp + ' (test mode)');
      } else {
        toast.success('OTP sent to +91 ' + cleaned);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch (err: any) { toast.error(err.message || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = d; setOtp(next);
    if (d && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      await verifyOtp(sessionId, code);
      toast.success('Logged in successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Incorrect OTP');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  return (
    <div className="cart-login-gate">
      <div className="cart-login-gate-box">
        <div className="cart-login-gate-icon">
          {otpStep === 'phone' ? <Phone size={28} /> : <Shield size={28} />}
        </div>
        {otpStep === 'phone' ? (
          <>
            <h2>Login to view your cart</h2>
            <p>Your items are saved. Enter your mobile number to continue.</p>
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-wrapper">
                <span className="input-prefix">+91</span>
                <input type="tel" inputMode="numeric" maxLength={10} autoFocus
                  value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98765 43210" className="phone-input" />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading || phone.replace(/\D/g, '').length !== 10}>
                {loading ? <div className="spinner-sm" /> : <>Get OTP <ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2>Enter OTP</h2>
            <p>Sent to <strong>+91 {phone}</strong> <button className="change-phone-btn" onClick={() => { setOtpStep('phone'); setOtp(['', '', '', '', '', '']); }}>Change</button></p>
            {bypassOtp && (
              <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#854d0e' }}>
                Test mode — OTP auto-filled: <strong>{bypassOtp}</strong>
              </div>
            )}
            <form onSubmit={handleVerify}>
              <div className="otp-boxes">
                {otp.map((d, i) => (
                  <input key={i} ref={el => { otpRefs.current[i] = el; }} type="text" inputMode="numeric"
                    maxLength={1} value={d} onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => e.key === 'Backspace' && !d && i > 0 && otpRefs.current[i - 1]?.focus()}
                    className="otp-box" />
                ))}
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading || otp.join('').length !== 6} style={{ marginBottom: 12 }}>
                {loading ? <div className="spinner-sm" /> : <>Verify &amp; Continue <ArrowRight size={16} /></>}
              </button>
            </form>
            <div className="resend-row">
              {cooldown > 0 ? <span className="resend-timer">Resend in {cooldown}s</span> : (
                <button className="resend-btn" onClick={() => handleSend()} disabled={loading}><RotateCcw size={13} /> Resend OTP</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Progress stepper ─────────────────────────────────────────────────────── */
function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Cart', 'Delivery', 'Payment'];
  return (
    <div className="cart-step-bar">
      {steps.map((label, i) => {
        const idx = i + 1 as 1 | 2 | 3;
        const done = step > idx;
        const active = step === idx;
        return (
          <div key={label} className="cart-step-bar-item">
            <div className={`cart-step-dot ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              {done ? <CheckCircle size={14} /> : idx}
            </div>
            <span className={`cart-step-label ${active ? 'active' : ''}`}>{label}</span>
            {i < steps.length - 1 && <div className={`cart-step-line ${done ? 'done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Delivery option card ─────────────────────────────────────────────────── */
function DeliveryCard({
  option, selected, onSelect, selectedProvider, onProviderChange,
}: {
  option: DeliveryOption;
  selected: boolean;
  onSelect: () => void;
  selectedProvider?: 'dunzo' | 'porter';
  onProviderChange?: (p: 'dunzo' | 'porter') => void;
}) {
  const Icon = METHOD_ICONS[option.type];
  return (
    <div
      className={`delivery-card ${selected ? 'delivery-card--selected' : ''}`}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect()}
    >
      <div className="delivery-card-radio">
        <div className={`delivery-radio-dot ${selected ? 'selected' : ''}`} />
      </div>

      <div className="delivery-card-icon">
        <Icon size={22} />
      </div>

      <div className="delivery-card-body">
        <div className="delivery-card-top">
          <span className="delivery-card-label">{option.label}</span>
          <span className={`delivery-card-fee ${option.fee === 0 ? 'free' : ''}`}>
            {option.fee === 0 ? 'FREE' : `₹${option.fee}`}
          </span>
        </div>
        <p className="delivery-card-desc">{option.description}</p>
        <div className="delivery-card-meta">
          <Clock size={11} />
          <span>{option.eta}</span>
          {option.type === 'standard' && option.freeAbove && option.fee > 0 && (
            <span className="delivery-card-hint"> · Free above ₹{option.freeAbove}</span>
          )}
        </div>

        {/* Store Pickup: show address */}
        {option.type === 'store_pickup' && option.storeInfo && selected && (
          <div className="delivery-store-info">
            <MapPin size={12} />
            <span>
              {option.storeInfo.name} — {option.storeInfo.address}, {option.storeInfo.city}
              {option.storeInfo.landmark ? ` (${option.storeInfo.landmark})` : ''}
              <br />
              <span style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>
                {option.storeInfo.hours}
                {option.storeInfo.phone ? ` · ${option.storeInfo.phone}` : ''}
              </span>
            </span>
          </div>
        )}

        {/* Hyperlocal: provider selector */}
        {option.type === 'hyperlocal' && option.providers && option.providers.length > 1 && selected && (
          <div className="delivery-provider-row">
            {option.providers.map(p => (
              <button
                key={p.name}
                className={`delivery-provider-btn ${selectedProvider === p.name ? 'active' : ''}`}
                onClick={e => { e.stopPropagation(); onProviderChange?.(p.name); }}
              >
                {p.label} · ₹{p.fee} · {p.eta}
              </button>
            ))}
          </div>
        )}
        {option.type === 'hyperlocal' && option.providers && option.providers.length === 1 && selected && (
          <span className="delivery-card-hint" style={{ marginTop: 4, display: 'block' }}>
            via {option.providers[0].label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Main Cart Component ──────────────────────────────────────────────────── */
export default function Cart() {
  const { items, designItems, removeItem, updateQuantity, removeDesignItem, updateDesignQuantity, clearCart, total, count } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Steps: 1 = cart, 2 = delivery, 3 = details + payment
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Address form
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '' });

  // Coupon
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number; description: string } | null>(null);

  // Delivery options
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryOption | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'dunzo' | 'porter'>('dunzo');

  // Misc
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    api.getProducts().then((all: Product[]) => {
      const cartIds = new Set(items.map(i => i.product.id));
      const eligible = all.filter((p: Product) => !cartIds.has(p.id) && p.stock > 0);
      setSuggestedProducts(eligible.sort(() => Math.random() - 0.5).slice(0, 4));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Total order weight across all cart items
  const cartWeightGrams = items.reduce((sum, i) => sum + ((i.product.weightGrams || 200) * i.quantity), 0);

  const loadDeliveryOptions = useCallback(async () => {
    setDeliveryLoading(true);
    try {
      const opts = await api.getDeliveryOptions({ subtotal: total, weightGrams: cartWeightGrams });
      setDeliveryOptions(opts);
      // Auto-select standard if nothing selected yet
      if (!selectedDelivery) {
        const std = opts.find(o => o.type === 'standard') ?? opts[0];
        if (std) setSelectedDelivery(std);
      }
    } catch { /* keep empty list, fall back to standard */ }
    finally { setDeliveryLoading(false); }
  }, [total, cartWeightGrams, selectedDelivery]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // For store_pickup: no address required
  const isStorePickup = selectedDelivery?.type === 'store_pickup';
  const isHyperlocal  = selectedDelivery?.type === 'hyperlocal';

  const buildAddress = () =>
    isStorePickup
      ? `STORE PICKUP: ${selectedDelivery?.storeInfo?.name || 'Store'}, ${selectedDelivery?.storeInfo?.address || ''}, ${selectedDelivery?.storeInfo?.city || ''} - ${selectedDelivery?.storeInfo?.pincode || ''}`
      : `${form.fullName}, ${form.phone}\n${form.addressLine1}${form.addressLine2 ? ', ' + form.addressLine2 : ''}\n${form.city}, ${form.state} - ${form.pincode}`;

  const formValid = isStorePickup
    ? !!(form.fullName && form.email && form.phone)
    : !!(form.fullName && form.email && form.phone && form.addressLine1 && form.city && form.state && form.pincode.length === 6);

  // Shipping cost comes from the selected delivery option
  const shippingCost = selectedDelivery?.fee ?? (total >= 999 ? 0 : 49);
  const discount    = appliedCoupon?.discountAmount || 0;
  const finalTotal  = Math.max(0, total + shippingCost - discount);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    if (!user) { toast.error('Please log in to apply coupons'); return; }
    setCouponLoading(true);
    try {
      const result = await api.validateCoupon(couponInput.trim(), finalTotal);
      setAppliedCoupon({ code: couponInput.trim().toUpperCase(), discountAmount: result.discountAmount, description: result.coupon.description });
      toast.success(`Coupon applied! You save ₹${result.discountAmount.toFixed(0)}`);
    } catch (e: any) {
      toast.error(e.message || 'Invalid coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponInput(''); };

  const handleProceedToDelivery = () => {
    if (!user) { navigate('/login?redirect=/cart'); return; }
    loadDeliveryOptions();
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToCheckout = () => {
    if (!selectedDelivery) { toast.error('Please select a delivery method'); return; }
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Track checkout start
    api.trackEvent({ type: 'checkout_start', sessionId: getSessionId() });
  };

  // Build the delivery config to store with the order
  const buildDeliveryConfig = (): any => {
    if (!selectedDelivery) return {};
    if (selectedDelivery.type === 'store_pickup') {
      return { ...selectedDelivery.storeInfo, readyEta: selectedDelivery.eta };
    }
    if (selectedDelivery.type === 'hyperlocal') {
      const provider = selectedDelivery.providers?.find(p => p.name === selectedProvider) ?? selectedDelivery.providers?.[0];
      return { provider: provider?.name, providerLabel: provider?.label, fee: provider?.fee, eta: provider?.eta };
    }
    return { fee: selectedDelivery.fee, freeAbove: selectedDelivery.freeAbove, eta: selectedDelivery.eta };
  };

  const placeAfterPayment = async (paymentData: { razorpayOrderId?: string; paymentId?: string }) => {
    const shippingAddress = buildAddress();
    const deliveryMethod  = selectedDelivery?.type ?? 'standard';
    const deliveryConfig  = buildDeliveryConfig();
    const groupOrderId = (items.length > 0 && designItems.length > 0)
      ? `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      : undefined;
    try {
      if (items.length > 0) {
        await api.createOrder(
          items.map(i => ({ productId: i.product.id, quantity: i.quantity, color: i.color, size: i.size, customText: i.customText })),
          shippingAddress,
          { razorpayOrderId: paymentData.razorpayOrderId, paymentId: paymentData.paymentId, couponCode: appliedCoupon?.code, discountAmount: appliedCoupon?.discountAmount, groupOrderId, deliveryMethod, deliveryConfig, shippingCost }
        );
      }
      for (const d of designItems) {
        await api.createDesignOrder({
          productType: d.productType, colorHex: d.colorHex, colorName: d.colorName,
          printSize: d.printSize, sides: d.sides, designImages: d.designImages,
          uploadedImages: d.uploadedImages, quantity: d.quantity, unitPrice: d.unitPrice,
          total: d.total, shippingAddress, groupOrderId, deliveryMethod, deliveryConfig, shippingCost,
        });
      }
      // Track purchase event for each product
      items.forEach(i => api.trackEvent({ type: 'purchase', productId: i.product.id, productName: i.product.name, category: i.product.category, brandId: (i.product as any).brandId, size: i.size || undefined, color: i.color || undefined, price: i.product.price, quantity: i.quantity, sessionId: getSessionId() }));
      clearCart();
      sessionStorage.removeItem('tfw_design_cart');
      navigate('/payment/success', { replace: true, state: { finalTotal, name: form.fullName || 'Customer', city: form.city || selectedDelivery?.storeInfo?.city || '' } });
    } catch (e: any) {
      toast.error(e.message || 'Order creation failed');
      setProcessing(false);
    }
  };

  const handleMakePayment = async () => {
    if (!formValid) { toast.error('Please fill in all required fields'); return; }
    setProcessing(true);

    if (finalTotal <= 0) {
      await placeAfterPayment({});
      return;
    }

    try {
      const rpOrder = await api.createRazorpayOrder(finalTotal);

      if (rpOrder.simulated) {
        await placeAfterPayment({ razorpayOrderId: rpOrder.orderId, paymentId: `sim_pay_${Date.now()}` });
        return;
      }

      const options = {
        key: rpOrder.keyId, amount: rpOrder.amount, currency: rpOrder.currency,
        name: 'TheFramedWall', description: 'Order Payment', order_id: rpOrder.orderId,
        handler: async (response: any) => {
          try {
            const verif = await api.verifyRazorpayPayment(response);
            if (verif.verified) {
              await placeAfterPayment({ razorpayOrderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id });
            } else {
              toast.error('Payment verification failed'); setProcessing(false);
            }
          } catch { toast.error('Payment verification failed'); setProcessing(false); }
        },
        prefill: { name: form.fullName, contact: form.phone, email: user?.email || form.email || '' },
        theme: { color: '#0E7C61' },
        modal: { ondismiss: () => setProcessing(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (r: any) => { toast.error(r.error?.description || 'Payment failed'); setProcessing(false); });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Payment init failed');
      setProcessing(false);
    }
  };

  // ── Login gate ─────────────────────────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <div className="cart-page">
        <div className="container"><CartLoginGate /></div>
      </div>
    );
  }

  // ── Empty cart ─────────────────────────────────────────────────────────────
  if (count === 0 && step === 1) {
    return (
      <div className="cart-page">
        <div className="container">
          <motion.div className="empty-state" initial={{ opacity: 0, scale: 0.88, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}>
            <EmptyCartAnim />
            <h2 style={{ marginTop: '1.25rem' }}>Your cart is empty</h2>
            <p>Looks like you haven&apos;t added any products yet.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/products" className="btn btn-primary btn-lg btn-shimmer btn-glow">Browse Products</Link>
              <Link to="/design-studio" className="btn btn-outline btn-lg"><Palette size={18} /> Design Your Own</Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Shared order summary sidebar ───────────────────────────────────────────
  const OrderSummary = ({ showItems = false }: { showItems?: boolean }) => (
    <motion.div className="cart-summary checkout-summary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <h3>Order Summary</h3>
      {showItems && (
        <div className="checkout-item-list">
          {items.map(item => (
            <div key={item.cartItemId} className="checkout-mini-item">
              <img src={item.product.image} alt={item.product.name} />
              <span className="checkout-mini-name">{item.product.name} ×{item.quantity}</span>
              <span className="checkout-mini-price">₹{(item.product.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
          {designItems.map(d => (
            <div key={d.id} className="checkout-mini-item">
              <div className="checkout-mini-img-placeholder"><Palette size={16} /></div>
              <span className="checkout-mini-name">{PRODUCT_LABELS[d.productType] || d.productType} ×{d.quantity}</span>
              <span className="checkout-mini-price">₹{d.total.toLocaleString('en-IN')}</span>
            </div>
          ))}
          <div className="summary-divider" />
        </div>
      )}
      <div className="summary-row"><span>Subtotal</span><span>₹{total.toFixed(0)}</span></div>
      <div className="summary-row">
        <span>Shipping {selectedDelivery && <span className="summary-method-badge">{selectedDelivery.label}</span>}</span>
        <span>{shippingCost === 0 ? 'Free' : `₹${shippingCost}`}</span>
      </div>
      {appliedCoupon && (
        <div className="summary-row" style={{ color: 'var(--success, #16a34a)' }}>
          <span>Discount ({appliedCoupon.code})</span><span>-₹{discount.toFixed(0)}</span>
        </div>
      )}
      <div className="summary-row total"><span>Total</span><span>₹{finalTotal.toFixed(0)}</span></div>
      {cartWeightGrams > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>📦</span>
          <span>Order weight: {cartWeightGrams >= 1000 ? `${(cartWeightGrams / 1000).toFixed(2)} kg` : `${cartWeightGrams} g`}</span>
        </div>
      )}
    </motion.div>
  );

  // ── STEP 3: Details + Payment ──────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="cart-page checkout-step">
        <div className="container">
          <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <button className="back-link" onClick={() => setStep(2)}><ArrowLeft size={16} /> Change Delivery</button>
            <h1>Checkout</h1>
          </motion.div>
          <StepBar step={3} />

          <div className="checkout-layout">
            <motion.div className="checkout-address-panel" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>

              {/* Delivery method badge */}
              <div className="checkout-delivery-badge">
                {(() => { const Icon = METHOD_ICONS[selectedDelivery?.type ?? 'standard']; return <Icon size={14} />; })()}
                <span>{selectedDelivery?.label ?? 'Standard Shipping'}</span>
                <span className="checkout-delivery-eta">· {selectedDelivery?.eta}</span>
                <button className="checkout-change-delivery" onClick={() => setStep(2)}>Change</button>
              </div>

              <div className="checkout-section-card">
                <h2 className="checkout-section-title">
                  {isStorePickup ? 'Your Details' : 'Delivery Address'}
                </h2>
                <div className="checkout-form">
                  <div className="checkout-form-row">
                    <div>
                      <label>Full Name *</label>
                      <input type="text" placeholder="Your full name" value={form.fullName} onChange={set('fullName')} />
                    </div>
                    <div>
                      <label>Mobile Number *</label>
                      <input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} maxLength={13} />
                    </div>
                  </div>
                  <div>
                    <label>Email Address * <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: '0.85em' }}>(order updates &amp; invoice)</span></label>
                    <input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
                  </div>

                  {/* Store pickup: show store location info, no address fields */}
                  {isStorePickup && selectedDelivery?.storeInfo && (
                    <div className="checkout-pickup-info">
                      <MapPin size={15} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 600 }}>{selectedDelivery.storeInfo.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                          {selectedDelivery.storeInfo.address}, {selectedDelivery.storeInfo.city} - {selectedDelivery.storeInfo.pincode}
                        </p>
                        {selectedDelivery.storeInfo.landmark && (
                          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-3)' }}>Landmark: {selectedDelivery.storeInfo.landmark}</p>
                        )}
                        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 500 }}>
                          <Clock size={11} /> {selectedDelivery.storeInfo.hours}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Full address for standard + hyperlocal */}
                  {!isStorePickup && (
                    <>
                      <div>
                        <label>Address Line 1 *</label>
                        <input type="text" placeholder="House no., Street, Area" value={form.addressLine1} onChange={set('addressLine1')} />
                      </div>
                      <div>
                        <label>Address Line 2 <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
                        <input type="text" placeholder="Landmark, Colony" value={form.addressLine2} onChange={set('addressLine2')} />
                      </div>
                      <div className="checkout-form-row">
                        <div>
                          <label>City *</label>
                          <input type="text" placeholder="City" value={form.city} onChange={set('city')} />
                        </div>
                        <div>
                          <label>Pincode *</label>
                          <input type="text" placeholder="6-digit pincode" value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} maxLength={6} />
                        </div>
                      </div>
                      <div>
                        <label>State *</label>
                        <select value={form.state} onChange={set('state')}>
                          <option value="">Select State</option>
                          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="checkout-trust-row">
                <span><Lock size={14} /> Secure Payment</span>
                {isStorePickup
                  ? <span><Store size={14} /> In-store Pickup</span>
                  : isHyperlocal
                    ? <span><Zap size={14} /> Same-Day Delivery</span>
                    : <span><Truck size={14} /> 3–5 Business Days</span>
                }
                <span><CheckCircle size={14} /> 100% Authentic</span>
              </div>
            </motion.div>

            <div>
              <OrderSummary showItems />
              <div className="checkout-pay-note">
                <CreditCard size={15} /> UPI · Card · Net Banking · Wallets
              </div>
              <button
                className="btn btn-primary btn-block btn-lg"
                onClick={handleMakePayment}
                disabled={!formValid || processing}
                style={{ marginTop: 12 }}
              >
                {processing
                  ? <><div className="spinner-sm" /> Processing…</>
                  : <><CreditCard size={18} /> Make Payment · ₹{finalTotal.toFixed(0)}</>
                }
              </button>
              {selectedDelivery?.type === 'standard' && selectedDelivery.freeAbove && shippingCost > 0 && (
                <p className="free-ship-note">Add ₹{(selectedDelivery.freeAbove - total).toFixed(0)} more for free shipping!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 2: Delivery Method Selection ─────────────────────────────────────
  if (step === 2) {
    return (
      <div className="cart-page checkout-step">
        <div className="container">
          <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <button className="back-link" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back to Cart</button>
            <h1>Choose Delivery</h1>
          </motion.div>
          <StepBar step={2} />

          <div className="checkout-layout">
            <motion.div className="checkout-address-panel" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>

              {deliveryLoading ? (
                <div className="delivery-loading">
                  <div className="spinner-sm" />
                  <span>Checking available options…</span>
                </div>
              ) : deliveryOptions.length === 0 ? (
                /* Fallback: API unavailable — show standard option */
                <DeliveryCard
                  option={{ type: 'standard', label: 'Standard Shipping', description: 'Reliable national courier delivery', fee: total >= 999 ? 0 : 49, freeAbove: 999, eta: '3–5 business days', available: true }}
                  selected
                  onSelect={() => {}}
                />
              ) : (
                <div className="delivery-options-list" role="radiogroup" aria-label="Delivery method">
                  {deliveryOptions.map(opt => (
                    <DeliveryCard
                      key={opt.type}
                      option={opt}
                      selected={selectedDelivery?.type === opt.type}
                      onSelect={() => {
                        setSelectedDelivery(opt);
                        if (opt.type === 'hyperlocal' && opt.providers?.[0]) {
                          setSelectedProvider(opt.selectedProvider ?? opt.providers[0].name);
                        }
                      }}
                      selectedProvider={selectedProvider}
                      onProviderChange={setSelectedProvider}
                    />
                  ))}
                </div>
              )}

              {/* Hyperlocal notice */}
              {selectedDelivery?.type === 'hyperlocal' && (
                <div className="delivery-hyperlocal-note">
                  <Package size={14} />
                  <span>Same-day delivery is available within {(deliveryOptions.find(o => o.type === 'hyperlocal') as any)?.maxRadiusKm ?? 15} km of our store. Order by 4 PM for today&apos;s delivery.</span>
                </div>
              )}
            </motion.div>

            <div>
              <OrderSummary />
              <button
                className="btn btn-primary btn-block btn-lg"
                style={{ marginTop: 16 }}
                onClick={handleProceedToCheckout}
                disabled={!selectedDelivery}
              >
                Continue <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 1: Cart ───────────────────────────────────────────────────────────
  return (
    <div className="cart-page">
      <div className="container">
        <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/products" className="back-link"><ArrowLeft size={16} /> Continue Shopping</Link>
          <h1>Shopping Cart ({count})</h1>
        </motion.div>
        <StepBar step={1} />

        <div className="cart-layout">
          <div className="cart-items">
            <AnimatePresence>
              {items.map(item => (
                <motion.div key={item.cartItemId} className="cart-item" layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, height: 0 }}>
                  <img src={item.product.image} alt={item.product.name} className="cart-item-img" />
                  <div className="cart-item-info">
                    <Link to={`/products/${item.product.id}`}><h3>{item.product.name}</h3></Link>
                    <p className="cart-item-meta">
                      {item.color && <span className="color-dot" style={{ background: item.color, border: item.color === '#ffffff' ? '1px solid var(--border)' : 'none' }} />}
                      {item.size && <span>{item.size}</span>}
                      {item.product.customizable && (
                        <Link to={item.product.mockupId ? `/design-studio/product/${item.product.id}` : '/design-studio'} className="cart-customize-btn"><Palette size={12} /> Customise</Link>
                      )}
                    </p>
                    <span className="cart-item-price">₹{item.product.price.toFixed(0)}</span>
                  </div>
                  <div className="cart-item-controls">
                    <div className="quantity-selector">
                      <button onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} disabled={item.quantity <= 1}><Minus size={14} /></button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}><Plus size={14} /></button>
                    </div>
                    <span className="cart-item-total">₹{(item.product.price * item.quantity).toFixed(0)}</span>
                    <button className="icon-btn danger" onClick={() => removeItem(item.cartItemId)}><Trash2 size={16} /></button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {designItems.map(d => {
                const firstImage = Object.values(d.designImages || {}).find(img => img);
                return (
                  <motion.div key={d.id} className="cart-item" layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, height: 0 }}>
                    {firstImage ? (
                      <img src={firstImage} alt="Custom design" className="cart-item-img" style={{ objectFit: 'contain', background: 'var(--surface-2)' }} />
                    ) : (
                      <div className="cart-item-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
                        <Palette size={24} style={{ color: 'var(--primary)' }} />
                      </div>
                    )}
                    <div className="cart-item-info">
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {PRODUCT_LABELS[d.productType] || d.productType}
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--primary-50)', color: 'var(--primary)', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>Custom</span>
                      </h3>
                      <p className="cart-item-meta">
                        <span className="color-dot" style={{ background: d.colorHex, border: d.colorHex === '#ffffff' ? '1px solid var(--border)' : 'none' }} />
                        <span>{d.colorName}</span>
                        <span style={{ color: 'var(--text-2)' }}>•</span>
                        <span style={{ textTransform: 'capitalize' }}>{d.printSize} print</span>
                        <span style={{ color: 'var(--text-2)' }}>•</span>
                        <span>{d.sides.join(' + ')}</span>
                      </p>
                      <span className="cart-item-price">₹{d.unitPrice.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="cart-item-controls">
                      <div className="quantity-selector">
                        <button onClick={() => updateDesignQuantity(d.id, d.quantity - 1)} disabled={d.quantity <= 1}><Minus size={14} /></button>
                        <span>{d.quantity}</span>
                        <button onClick={() => updateDesignQuantity(d.id, d.quantity + 1)}><Plus size={14} /></button>
                      </div>
                      <span className="cart-item-total">₹{d.total.toLocaleString('en-IN')}</span>
                      <button className="icon-btn danger" onClick={() => removeDesignItem(d.id)}><Trash2 size={16} /></button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <motion.div className="cart-summary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3>Order Summary</h3>
            <div className="summary-row"><span>Subtotal</span><span>₹{total.toFixed(0)}</span></div>
            <div className="summary-row"><span>Shipping</span><span className="summary-shipping-preview">Select delivery →</span></div>
            {appliedCoupon && (
              <div className="summary-row" style={{ color: 'var(--success, #16a34a)' }}>
                <span>Discount ({appliedCoupon.code})</span><span>-₹{discount.toFixed(0)}</span>
              </div>
            )}
            <div className="summary-row total"><span>Subtotal</span><span>₹{(total - discount).toFixed(0)}</span></div>

            {!appliedCoupon ? (
              <div className="coupon-row">
                <Tag size={15} style={{ color: 'var(--primary)' }} />
                <input type="text" placeholder="Coupon code" value={couponInput}
                  onChange={e => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                  style={{ flex: 1 }} />
                <button className="btn btn-outline btn-sm" onClick={handleApplyCoupon} disabled={couponLoading || !couponInput.trim()}>
                  {couponLoading ? <div className="spinner-sm" /> : 'Apply'}
                </button>
              </div>
            ) : (
              <div className="coupon-applied">
                <CheckCircle size={15} style={{ color: 'var(--success, #16a34a)' }} />
                <span style={{ flex: 1 }}>
                  <strong>{appliedCoupon.code}</strong>{appliedCoupon.description ? ` — ${appliedCoupon.description}` : ''}
                </span>
                <button className="icon-btn" onClick={removeCoupon} title="Remove coupon"><X size={14} /></button>
              </div>
            )}

            <button className="btn btn-primary btn-block btn-lg" onClick={handleProceedToDelivery}>
              Choose Delivery <ChevronRight size={18} />
            </button>
            <p className="cart-delivery-preview-note">
              <Store size={12} /> Pickup · <Zap size={12} /> Same-Day · <Truck size={12} /> Standard
            </p>
          </motion.div>
        </div>

        {suggestedProducts.length > 0 && (
          <motion.div className="cart-suggestions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3>You might also like</h3>
            <div className="products-grid">
              {suggestedProducts.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
