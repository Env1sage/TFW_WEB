import { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Package, MapPin, ArrowRight, Home } from 'lucide-react';

interface SuccessState {
  finalTotal: number;
  name: string;
  city: string;
}

export default function PaymentSuccess() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const state     = location.state as SuccessState | null;

  // If landed directly without state, redirect home after a moment
  useEffect(() => {
    if (!state) {
      const t = setTimeout(() => navigate('/'), 2000);
      return () => clearTimeout(t);
    }
  }, [state, navigate]);

  return (
    <div className="payment-success-page">
      <div className="container">
        <motion.div
          className="payment-success-card"
          initial={{ opacity: 0, scale: 0.88, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}>

          {/* Animated checkmark */}
          <motion.div
            className="success-icon-wrap"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}>
            <CheckCircle size={72} strokeWidth={1.5} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}>
            Payment Successful!
          </motion.h1>

          <motion.p
            className="success-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}>
            {state?.name ? `Thank you, ${state.name}!` : 'Thank you for your order!'} Your order has been placed and is being processed.
          </motion.p>

          {state?.finalTotal != null && (
            <motion.div
              className="success-amount"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}>
              ₹{state.finalTotal.toLocaleString('en-IN')} paid
            </motion.div>
          )}

          <motion.div
            className="success-info-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}>
            <div className="success-info-item">
              <Package size={20} />
              <div>
                <strong>Order Placed</strong>
                <p>You will receive a confirmation email shortly.</p>
              </div>
            </div>
            <div className="success-info-item">
              <MapPin size={20} />
              <div>
                <strong>Shipping to {state?.city || 'your address'}</strong>
                <p>Expected delivery in 5–7 business days.</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="success-actions"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}>
            <Link to="/orders" className="btn btn-primary btn-lg">
              <Package size={18} /> Track Your Order <ArrowRight size={16} />
            </Link>
            <Link to="/products" className="btn btn-outline btn-lg">
              <Home size={16} /> Continue Shopping
            </Link>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}
