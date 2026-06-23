import { motion } from 'framer-motion';
import { RefreshCcw, CheckCircle, X, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RefundPolicy() {
  return (
    <div className="legal-page">
      <div className="container" style={{ maxWidth: 800 }}>
        <motion.div className="legal-header" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="legal-icon" style={{ background: 'rgba(198,167,94,0.12)', color: '#C6A75E' }}><RefreshCcw size={28} /></div>
          <h1>Refund &amp; Exchange Policy</h1>
          <p className="legal-updated">Last Updated: May 15, 2026</p>
          <p className="legal-intro">
            We want you to be completely happy with your order. Please read our policy below carefully.
          </p>
        </motion.div>

        <div className="legal-body">
          <motion.div className="legal-section" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h2>Our Policy</h2>
            <div className="refund-policy-grid">
              <div className="refund-policy-card refund-no">
                <div className="refund-card-icon"><X size={22} /></div>
                <h3>No Returns or Refunds</h3>
                <p>
                  As all our products are custom-made to your specifications, we do not accept returns or issue refunds
                  for change of mind, incorrect size ordered by the customer, or design errors submitted by the customer.
                </p>
              </div>
              <div className="refund-policy-card refund-yes">
                <div className="refund-card-icon"><CheckCircle size={22} /></div>
                <h3>Free Exchange — Our Fault Only</h3>
                <p>
                  We offer a <strong>free exchange</strong> if we send you the wrong product (wrong item, wrong size, wrong colour
                  from what was ordered). In this case, we bear all shipping costs. No charges are incurred by you.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div className="legal-section" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2>When Can You Claim an Exchange?</h2>
            <div className="legal-content">
              <div className="legal-bullet"><span>✓</span><span>Wrong product delivered (different from what was ordered)</span></div>
              <div className="legal-bullet"><span>✓</span><span>Wrong size shipped by us</span></div>
              <div className="legal-bullet"><span>✓</span><span>Wrong colour delivered (from what was ordered)</span></div>
              <div className="legal-bullet"><span>✓</span><span>Manufacturing defect or print quality issue on our end</span></div>
            </div>
          </motion.div>

          <motion.div className="legal-section" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2>What Is Not Covered?</h2>
            <div className="legal-content">
              <div className="legal-bullet"><span>✗</span><span>Incorrect size/colour selected by the customer at checkout</span></div>
              <div className="legal-bullet"><span>✗</span><span>Design errors in artwork submitted by the customer</span></div>
              <div className="legal-bullet"><span>✗</span><span>Change of mind after production has started</span></div>
              <div className="legal-bullet"><span>✗</span><span>Minor colour variation between screen preview and physical print (normal production tolerance)</span></div>
            </div>
          </motion.div>

          <motion.div className="legal-section" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2>How to Raise a Claim</h2>
            <div className="legal-content">
              <p>If you believe you have received the wrong product, please contact us within <strong>48 hours of delivery</strong> with:</p>
              <div className="legal-bullet"><span>1.</span><span>Your order number</span></div>
              <div className="legal-bullet"><span>2.</span><span>Clear photos of the product received</span></div>
              <div className="legal-bullet"><span>3.</span><span>Description of the issue</span></div>
            </div>
          </motion.div>

          <motion.div className="legal-section refund-contact-section" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2>Contact Us</h2>
            <p>Our support team is happy to help resolve any order issues.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
              <a href="mailto:support@theframedwall.com" className="btn btn-primary">Email Support</a>
              <a href="https://wa.me/918983301235" target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                <Phone size={15} /> WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
