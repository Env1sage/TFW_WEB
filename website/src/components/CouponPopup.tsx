import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, CheckCircle, Clock, Sparkles, Gift, ShoppingBag } from 'lucide-react';
import { api } from '../api';
import type { Coupon } from '../types';

const DISMISSED_KEY = 'tfw_popup_dismissed';

export default function CouponPopup() {
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getPopupCoupon();
        if (!data) return;

        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed === data.id) return;

        setCoupon(data);
        setTimeout(() => setVisible(true), 1200);
      } catch {
        // Silently ignore — popup is non-essential
      }
    };
    load();
  }, []);

  const dismiss = () => {
    setVisible(false);
    if (coupon) localStorage.setItem(DISMISSED_KEY, coupon.id);
  };

  const shopNow = () => {
    dismiss();
    navigate('/products');
  };

  const copyCode = () => {
    if (!coupon) return;
    navigator.clipboard.writeText(coupon.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!coupon) return null;

  const isPercentage = coupon.discountType === 'percentage';
  const discountValue = isPercentage
    ? `${coupon.discountValue}%`
    : `₹${coupon.discountValue}`;

  const message =
    coupon.popupMessage ||
    `Use code ${coupon.code} at checkout and save ${discountValue}!`;

  const daysLeft = coupon.validUntil
    ? Math.max(0, Math.ceil((new Date(coupon.validUntil).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="cp-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
        >
          <motion.div
            className="cp-box"
            initial={{ opacity: 0, scale: 0.85, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button className="cp-close" onClick={dismiss} aria-label="Close">
              <X size={18} />
            </button>

            {/* Decorative top section */}
            <div className="cp-header">
              <div className="cp-confetti cp-confetti-1" />
              <div className="cp-confetti cp-confetti-2" />
              <div className="cp-confetti cp-confetti-3" />
              <div className="cp-confetti cp-confetti-4" />
              <div className="cp-gift-icon">
                <Gift size={28} />
              </div>
            </div>

            {/* Content */}
            <div className="cp-content">
              <div className="cp-eyebrow">
                <Sparkles size={13} />
                <span>Exclusive Offer</span>
                <Sparkles size={13} />
              </div>

              <div className="cp-discount-block">
                <span className="cp-discount-value">{discountValue}</span>
                <span className="cp-discount-off">OFF</span>
              </div>

              <p className="cp-message">{message}</p>

              {/* Code box */}
              <div className="cp-code-box">
                <div className="cp-code-inner">
                  <span className="cp-code-label">Your code</span>
                  <div className="cp-code-row">
                    <span className="cp-code">{coupon.code}</span>
                    <button className="cp-copy-btn" onClick={copyCode}>
                      {copied ? (
                        <><CheckCircle size={14} /> Copied!</>
                      ) : (
                        <><Copy size={14} /> Copy</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Details chips */}
              <div className="cp-details">
                {coupon.minOrderAmount > 0 && (
                  <span className="cp-chip">
                    <ShoppingBag size={12} />
                    Min order ₹{coupon.minOrderAmount}
                  </span>
                )}
                {daysLeft !== null && daysLeft <= 30 && (
                  <span className="cp-chip cp-chip-urgent">
                    <Clock size={12} />
                    {daysLeft === 0 ? 'Expires today!' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
                  </span>
                )}
              </div>

              {/* CTA */}
              <button className="cp-cta" onClick={shopNow}>
                <ShoppingBag size={16} />
                Shop Now & Save
              </button>

              <button className="cp-dismiss" onClick={dismiss}>
                No thanks, maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
