import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';

interface DesignCartData {
  productType: string;
  colorHex: string;
  colorName: string;
  printSize: string;
  pocketPrint?: boolean;
  sides: string[];
  designImages: Record<string, string>;
  uploadedImages?: Record<string, string[]>;
  quantity: number;
  unitPrice: number;
  total: number;
}

const PRODUCT_LABELS: Record<string, string> = {
  tshirt: 'Custom T-Shirt',
  hoodie: 'Custom Hoodie',
  jacket: 'Custom Jacket',
  cap: 'Custom Cap',
  pant: 'Custom Pants',
};

export default function DesignStudioCart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<DesignCartData | null>(null);
  const [address, setAddress] = useState('');
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('tfw_design_cart');
    if (raw) {
      try { setData(JSON.parse(raw)); } catch { /* invalid */ }
    }
  }, []);

  if (!data) {
    return (
      <div className="dsc-empty">
        <motion.div style={{ textAlign: 'center' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <ShoppingBag size={64} strokeWidth={1} className="dsc-empty-icon" />
          <h2 style={{ marginBottom: 8 }}>No design in cart</h2>
          <p className="dsc-empty p">Go back to the Design Studio to create your design.</p>
          <Link to="/design-studio" className="dsc-empty a">Back to Design Studio</Link>
        </motion.div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="dsc-success">
        <motion.div style={{ textAlign: 'center', maxWidth: 500, padding: 32 }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>&#10003;</div>
          <h2>Order Placed Successfully!</h2>
          <p>Your custom {PRODUCT_LABELS[data.productType] || data.productType} is being prepared.</p>
          <p className="order-id-text">Order ID: {orderId.slice(0, 8)}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/" className="dsc-btn-primary">Go Home</Link>
            <Link to="/design-studio" className="dsc-btn-secondary">Design Another</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const firstImage = Object.values(data.designImages).find(img => img);
  const shipping = data.total >= 50 ? 0 : 4.99;
  const grandTotal = data.total + shipping;

  const handlePlaceOrder = async () => {
    if (!address.trim()) { toast.error('Please enter a shipping address'); return; }
    setPlacing(true);
    try {
      const order = await api.createDesignOrder({
        ...data,
        shippingAddress: address,
      });
      setOrderId(order.id);
      setOrderPlaced(true);
      sessionStorage.removeItem('tfw_design_cart');
      toast.success('Order placed successfully!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to place order');
    } finally { setPlacing(false); }
  };

  return (
    <div className="dsc-page">
      <div className="dsc-container">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate('/design-studio')} className="dsc-back">
            <ArrowLeft size={16} /> Back to Design Studio
          </button>

          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 32 }}>Order Summary</h1>

          <div className="dsc-grid">
            {/* Design Preview */}
            <div className="dsc-card">
              <h3>Your Design</h3>
              {firstImage && (
                <div className="dsc-preview-box">
                  <img src={firstImage} alt="Design preview" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} />
                </div>
              )}
              <div className="dsc-detail-grid">
                <div>
                  <span className="dsc-detail-label">Product</span>
                  <p className="dsc-detail-value">{PRODUCT_LABELS[data.productType] || data.productType}</p>
                </div>
                <div>
                  <span className="dsc-detail-label">Color</span>
                  <p className="dsc-detail-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: data.colorHex, border: data.colorHex === '#ffffff' ? '2px solid var(--dark-border)' : 'none', display: 'inline-block' }} />
                    {data.colorName}
                  </p>
                </div>
                <div>
                  <span className="dsc-detail-label">Print Size</span>
                  <p className="dsc-detail-value" style={{ textTransform: 'capitalize' }}>{data.printSize}{data.pocketPrint ? ' + Pocket' : ''}</p>
                </div>
                <div>
                  <span className="dsc-detail-label">Sides</span>
                  <p className="dsc-detail-value">{data.sides.join(' + ')}</p>
                </div>
                <div>
                  <span className="dsc-detail-label">Quantity</span>
                  <p className="dsc-detail-value">{data.quantity}</p>
                </div>
              </div>
            </div>

            {/* Checkout */}
            <div className="dsc-card">
              <h3>Checkout</h3>

              <div style={{ marginBottom: 20 }}>
                <div className="dsc-summary-row">
                  <span>Subtotal</span>
                  <span>&#8377;{data.total.toLocaleString()}</span>
                </div>
                <div className="dsc-summary-row">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
                </div>
                <div className="dsc-total-row">
                  <span>Total</span>
                  <span>&#8377;{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {!user && (
                <p className="dsc-guest-note">
                  You're ordering as a guest. <Link to="/login">Login</Link> to track your order.
                </p>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, color: 'var(--dark-text-2)', marginBottom: 6 }}>Shipping Address</label>
                <textarea
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Enter your full shipping address..."
                  rows={3}
                  className="dsc-textarea"
                />
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={placing}
                className="dsc-place-btn"
              >
                {placing ? 'Placing Order...' : <><CreditCard size={18} /> Place Order</>}
              </button>

              {data.total < 50 && (
                <p className="dsc-ship-note">
                  Add &#8377;{(50 - data.total).toLocaleString()} more for free shipping!
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
