import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, CreditCard, Palette } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { useState } from 'react';
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

export default function Cart() {
  const { items, designItems, removeItem, updateQuantity, removeDesignItem, updateDesignQuantity, clearCart, total, count } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '' });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const buildAddress = () =>
    `${form.fullName}, ${form.phone}\n${form.addressLine1}${form.addressLine2 ? ', ' + form.addressLine2 : ''}\n${form.city}, ${form.state} - ${form.pincode}`;

  const formValid = form.fullName && form.phone && form.addressLine1 && form.city && form.state && form.pincode.length === 6;

  const handleCheckout = async () => {
    if (!user) { navigate('/login?redirect=/cart'); return; }
    if (!formValid) { toast.error('Please fill in all required address fields'); return; }
    setChecking(true);
    try {
      const finalTotal = total >= 999 ? total : total + 49;

      // Step 1: Create Razorpay order
      const rpOrder = await api.createRazorpayOrder(finalTotal);

      // Step 2: Open Razorpay checkout
      if (rpOrder.simulated) {
        await placeAllOrders();
        return;
      }

      const options = {
        key: rpOrder.keyId,
        amount: rpOrder.amount,
        currency: rpOrder.currency,
        name: 'TheFramedWall',
        description: `Order — ${count} item${count > 1 ? 's' : ''}`,
        order_id: rpOrder.orderId,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verification = await api.verifyRazorpayPayment(response);
            if (verification.verified) {
              await placeAllOrders();
            } else {
              toast.error('Payment verification failed');
              setChecking(false);
            }
          } catch {
            toast.error('Payment verification failed');
            setChecking(false);
          }
        },
        prefill: {
          name: form.fullName,
          contact: form.phone,
          email: user.email || '',
        },
        theme: { color: '#0E7C61' },
        modal: {
          ondismiss: () => { setChecking(false); },
        },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || 'Checkout failed');
      setChecking(false);
    }
  };

  const placeAllOrders = async () => {
    try {
      const address = buildAddress();
      const promises: Promise<any>[] = [];

      // Place regular product orders
      if (items.length > 0) {
        const orderItems = items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          color: i.color,
          size: i.size,
          customText: i.customText,
        }));
        promises.push(api.createOrder(orderItems, address));
      }

      // Place design orders
      for (const d of designItems) {
        promises.push(api.createDesignOrder({
          productType: d.productType,
          colorHex: d.colorHex,
          colorName: d.colorName,
          printSize: d.printSize,
          sides: d.sides,
          designImages: d.designImages,
          uploadedImages: d.uploadedImages,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          total: d.total,
          shippingAddress: address,
        }));
      }

      await Promise.all(promises);
      clearCart();
      sessionStorage.removeItem('tfw_design_cart');
      toast.success('Order placed successfully!');
      navigate('/orders');
    } catch (e: any) {
      toast.error(e.message || 'Order creation failed');
    } finally { setChecking(false); }
  };

  if (count === 0) {
    return (
      <div className="cart-page">
        <div className="container">
          <motion.div className="empty-state" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <ShoppingBag size={64} strokeWidth={1} />
            <h2>Your cart is empty</h2>
            <p>Looks like you haven&apos;t added any products yet.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/products" className="btn btn-primary btn-lg">Browse Products</Link>
              <Link to="/design-studio" className="btn btn-outline btn-lg"><Palette size={18} /> Design Your Own</Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container">
        <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/products" className="back-link"><ArrowLeft size={16} /> Continue Shopping</Link>
          <h1>Shopping Cart ({count})</h1>
        </motion.div>

        <div className="cart-layout">
          <div className="cart-items">
            {/* Regular product items */}
            <AnimatePresence>
              {items.map(item => (
                <motion.div key={item.product.id} className="cart-item" layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, height: 0 }}>
                  <img src={item.product.image} alt={item.product.name} className="cart-item-img" />
                  <div className="cart-item-info">
                    <Link to={`/products/${item.product.id}`}><h3>{item.product.name}</h3></Link>
                    <p className="cart-item-meta">
                      {item.color && <span className="color-dot" style={{ background: item.color, border: item.color === '#ffffff' ? '1px solid var(--border)' : 'none' }} />}
                      {item.size && <span>{item.size}</span>}
                    </p>
                    <span className="cart-item-price">₹{item.product.price.toFixed(0)}</span>
                  </div>
                  <div className="cart-item-controls">
                    <div className="quantity-selector">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} disabled={item.quantity <= 1}><Minus size={14} /></button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}><Plus size={14} /></button>
                    </div>
                    <span className="cart-item-total">₹{(item.product.price * item.quantity).toFixed(0)}</span>
                    <button className="icon-btn danger" onClick={() => removeItem(item.product.id)}><Trash2 size={16} /></button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Custom design items */}
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
            <div className="summary-row"><span>Shipping</span><span>{total >= 999 ? 'Free' : '₹49'}</span></div>
            <div className="summary-row total"><span>Total</span><span>₹{(total >= 999 ? total : total + 49).toFixed(0)}</span></div>

            {!showCheckout ? (
              <button className="btn btn-primary btn-block btn-lg" onClick={() => user ? setShowCheckout(true) : navigate('/login?redirect=/cart')}>
                <CreditCard size={18} /> Proceed to Checkout
              </button>
            ) : (
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
                  <label>Address Line 1 *</label>
                  <input type="text" placeholder="House no., Street, Area" value={form.addressLine1} onChange={set('addressLine1')} />
                </div>
                <div>
                  <label>Address Line 2</label>
                  <input type="text" placeholder="Landmark, Colony (optional)" value={form.addressLine2} onChange={set('addressLine2')} />
                </div>
                <div className="checkout-form-row">
                  <div>
                    <label>City *</label>
                    <input type="text" placeholder="City" value={form.city} onChange={set('city')} />
                  </div>
                  <div>
                    <label>Pincode *</label>
                    <input type="text" placeholder="6-digit pincode" value={form.pincode} onChange={set('pincode')} maxLength={6} pattern="[0-9]{6}" />
                  </div>
                </div>
                <div>
                  <label>State *</label>
                  <select value={form.state} onChange={set('state')}>
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="checkout-pay-note">
                  <CreditCard size={15} /> Secure payment via Razorpay — UPI / Card / Net Banking / Wallets
                </div>
                <button className="btn btn-primary btn-block btn-lg" onClick={handleCheckout} disabled={checking || !formValid}>
                  {checking ? <div className="spinner-sm" /> : <><CreditCard size={18} /> Place Order</>}
                </button>
              </div>
            )}
            {total < 999 && <p className="free-ship-note">Add ₹{(999 - total).toFixed(0)} more for free shipping!</p>}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
