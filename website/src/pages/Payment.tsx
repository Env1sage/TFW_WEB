import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, ArrowLeft,
  Lock, Package, Tag, Truck,
} from 'lucide-react';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export interface PaymentPageState {
  items: any[];
  designItems: any[];
  shippingAddress: string;
  form: { fullName: string; phone: string; city: string; state: string; pincode: string };
  subtotal: number;
  shippingCost: number;
  discount: number;
  finalTotal: number;
  appliedCoupon: { code: string; discountAmount: number; description: string } | null;
}

export default function Payment() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const { clearCart } = useCart();
  const state = location.state as PaymentPageState | null;

  const [rpOrder,       setRpOrder]       = useState<{ orderId: string; amount: number; currency: string; keyId: string; simulated?: boolean } | null>(null);
  const [loadingOrder,  setLoadingOrder]  = useState(true);
  const [processing,    setProcessing]    = useState(false);

  useEffect(() => {
    if (!state || !user) { navigate('/cart'); return; }
    api.createRazorpayOrder(state.finalTotal)
      .then(setRpOrder)
      .catch(e => { toast.error(e.message || 'Payment init failed'); navigate('/cart'); })
      .finally(() => setLoadingOrder(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const placeAfterPayment = async (paymentData: { razorpayOrderId?: string; paymentId?: string }) => {
    if (!state) return;
    setProcessing(true);
    try {
      const promises: Promise<any>[] = [];

      if (state.items.length > 0) {
        const orderItems = state.items.map((i: any) => ({
          productId:  i.product.id,
          quantity:   i.quantity,
          color:      i.color,
          size:       i.size,
          customText: i.customText,
        }));
        promises.push(api.createOrder(orderItems, state.shippingAddress, {
          razorpayOrderId: paymentData.razorpayOrderId,
          paymentId:       paymentData.paymentId,
          couponCode:      state.appliedCoupon?.code,
          discountAmount:  state.appliedCoupon?.discountAmount,
        }));
      }

      for (const d of state.designItems) {
        promises.push(api.createDesignOrder({
          productType:    d.productType,
          colorHex:       d.colorHex,
          colorName:      d.colorName,
          printSize:      d.printSize,
          sides:          d.sides,
          designImages:   d.designImages,
          uploadedImages: d.uploadedImages,
          quantity:       d.quantity,
          unitPrice:      d.unitPrice,
          total:          d.total,
          shippingAddress: state.shippingAddress,
        }));
      }

      await Promise.all(promises);
      clearCart();
      sessionStorage.removeItem('tfw_design_cart');
      navigate('/payment/success', {
        replace: true,
        state: {
          finalTotal: state.finalTotal,
          name:       state.form.fullName,
          city:       state.form.city,
        },
      });
    } catch (e: any) {
      toast.error(e.message || 'Order creation failed');
      setProcessing(false);
    }
  };

  /* ── Real Razorpay checkout popup ── */
  const handleRazorpayPayment = () => {
    if (!rpOrder || !user || !state) return;

    // Simulated mode (Razorpay keys not configured on server)
    if (rpOrder.simulated) {
      placeAfterPayment({ razorpayOrderId: rpOrder.orderId, paymentId: `sim_pay_${Date.now()}` });
      return;
    }

    setProcessing(true);
    const options = {
      key:         rpOrder.keyId,
      amount:      rpOrder.amount,
      currency:    rpOrder.currency,
      name:        'TheFramedWall',
      description: 'Order Payment',
      order_id:    rpOrder.orderId,
      handler: async (response: any) => {
        try {
          const verif = await api.verifyRazorpayPayment(response);
          if (verif.verified) {
            await placeAfterPayment({
              razorpayOrderId: response.razorpay_order_id,
              paymentId:       response.razorpay_payment_id,
            });
          } else {
            toast.error('Payment verification failed');
            setProcessing(false);
          }
        } catch {
          toast.error('Payment verification failed');
          setProcessing(false);
        }
      },
      prefill: {
        name:    state.form.fullName,
        contact: state.form.phone,
        email:   user.email || '',
      },
      theme:  { color: '#0E7C61' },
      modal:  { ondismiss: () => setProcessing(false) },
    };
    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', (response: any) => {
      toast.error(response.error?.description || 'Payment failed. Please try again.');
      setProcessing(false);
    });
    rzp.open();
  };

  /* ── Loading states ── */
  if (!state) return null;

  if (loadingOrder) {
    return (
      <div className="payment-page">
        <div className="payment-loading">
          <div className="spinner-xl" />
          <p className="payment-loading-title">Initializing secure payment…</p>
          <p className="payment-loading-sub"><Lock size={13} /> 256-bit SSL encrypted</p>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="payment-page">
        <div className="payment-loading">
          <div className="spinner-xl" />
          <p className="payment-loading-title">Processing your payment…</p>
          <p className="payment-loading-sub">Please do not close or refresh this window.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <div className="container">
        <button className="back-link" style={{ marginBottom: 24 }} onClick={() => navigate('/cart')}>
          <ArrowLeft size={16} /> Back to Cart
        </button>

        <div className="payment-layout">

          {/* ── Left: Order Summary ── */}
          <motion.div className="payment-summary-box" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h2><Package size={18} /> Order Summary</h2>

            <div className="payment-items-list">
              {state.items.map((item: any, i: number) => (
                <div key={i} className="payment-item-row">
                  <img src={item.product.image} alt={item.product.name} className="payment-item-img" />
                  <div className="payment-item-info">
                    <p className="payment-item-name">{item.product.name}</p>
                    <p className="payment-item-meta">
                      {item.size && <span>{item.size}</span>}
                      {item.color && <span className="color-dot" style={{ background: item.color, width: 10, height: 10, borderRadius: '50%', display: 'inline-block', border: '1px solid rgba(0,0,0,.15)' }} />}
                      <span>× {item.quantity}</span>
                    </p>
                  </div>
                  <span className="payment-item-price">₹{(item.product.price * item.quantity).toLocaleString('en-IN')}</span>
                </div>
              ))}
              {state.designItems.map((d: any, i: number) => (
                <div key={`d${i}`} className="payment-item-row">
                  <div className="payment-item-img payment-item-img-design">
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700 }}>CUSTOM</span>
                  </div>
                  <div className="payment-item-info">
                    <p className="payment-item-name">{d.productType}</p>
                    <p className="payment-item-meta"><span>{d.colorName}</span> <span>× {d.quantity}</span></p>
                  </div>
                  <span className="payment-item-price">₹{d.total.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            <div className="payment-summary-rows">
              <div className="payment-summary-row"><span>Subtotal</span><span>₹{state.subtotal.toLocaleString('en-IN')}</span></div>
              <div className="payment-summary-row">
                <span><Truck size={13} /> Shipping</span>
                <span>{state.shippingCost === 0 ? <span style={{ color: '#10b981' }}>Free</span> : `₹${state.shippingCost}`}</span>
              </div>
              {state.discount > 0 && (
                <div className="payment-summary-row" style={{ color: '#10b981' }}>
                  <span><Tag size={13} /> Coupon ({state.appliedCoupon?.code})</span>
                  <span>−₹{state.discount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="payment-summary-row payment-summary-total">
                <span>Amount to Pay</span>
                <span>₹{state.finalTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="payment-address-box">
              <p style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: 'var(--text-2)' }}>SHIPPING TO</p>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem' }}>{state.shippingAddress}</p>
            </div>
          </motion.div>

          {/* ── Right: Pay with Razorpay ── */}
          <motion.div className="payment-form-box" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="payment-secure-badge">
              <Lock size={14} /> Secure Checkout — 256-bit SSL
            </div>

            <div className="payment-rzp-info">
              <Shield size={40} className="payment-rzp-icon" />
              <h2>Secure Payment</h2>
              <p className="payment-rzp-desc">
                Pay securely via Razorpay — India's most trusted payment gateway.
                UPI, Cards, Net Banking, Wallets & EMI accepted.
              </p>
              <div className="payment-rzp-methods">
                {['UPI', 'Cards', 'Net Banking', 'Wallets', 'EMI'].map(m => (
                  <span key={m} className="payment-rzp-method-chip">{m}</span>
                ))}
              </div>
            </div>

            <div className="payment-cta">
              <button className="btn btn-primary btn-block btn-lg payment-pay-btn" onClick={handleRazorpayPayment}>
                <Shield size={18} />
                Pay ₹{state.finalTotal.toLocaleString('en-IN')} Securely
              </button>
              <p className="payment-tnc">
                <Lock size={12} /> By paying you agree to our <a href="/faq" target="_blank">Terms &amp; Policy</a>.
                Your payment info is never stored on our servers.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
