import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';

const faqs = [
  {
    category: 'Orders & Shipping',
    items: [
      { q: 'How long does shipping take?', a: 'Standard shipping takes 3–5 business days across India. Express delivery is available at checkout for metro cities. We ship via reputed courier partners for reliable tracking.' },
      { q: 'Can I track my order?', a: 'Yes! Once your order is dispatched, you\'ll receive a tracking link via email and SMS. You can also view your order status in real-time from the Orders page in your account.' },
      { q: 'Do you ship across India?', a: 'Yes, we ship pan-India including all major cities and most pin codes. Remote areas may take 2–3 additional days. Shipping is free on orders above ₹999.' },
      { q: 'What is your return policy?', a: 'We offer a 7-day return policy. If there\'s a print defect or quality issue, contact us with a photo and we\'ll arrange a free replacement or full refund. Custom designs cannot be returned if the design itself is correct.' },
    ],
  },
  {
    category: 'Products & Design',
    items: [
      { q: 'What file formats do you accept for custom designs?', a: 'We accept PNG, JPG, SVG, and PDF files. For best print results, use high-resolution images (at least 300 DPI). Our built-in design studio also lets you create designs from scratch with text and shapes.' },
      { q: 'Can I preview my design before ordering?', a: 'Absolutely! Our Design Studio shows a live mockup of your design on the product — front and back. You can adjust placement, size, and colors before placing your order.' },
      { q: 'What printing method do you use?', a: 'We use Direct-to-Garment (DTG) printing for apparel items and sublimation printing for mugs, phone cases, and canvas prints. Both methods produce vibrant, wash-resistant, long-lasting prints.' },
      { q: 'Are the colors accurate to what I see on screen?', a: 'Yes, we calibrate for maximum accuracy. Minor variations can occur across different fabrics and materials, but we match as closely as possible. Our design studio includes a color guide to help you pick the right shades.' },
    ],
  },
  {
    category: 'Account & Payment',
    items: [
      { q: 'Is my payment information secure?', a: 'Absolutely. All transactions are SSL-encrypted. We integrate with secure, PCI-DSS compliant payment gateways and never store your card/UPI details on our servers.' },
      { q: 'What payment methods do you accept?', a: 'We accept UPI (GPay, PhonePe, BHIM), Debit/Credit Cards (Visa, Mastercard, RuPay), Net Banking, and popular wallets. All payments are processed via Razorpay — India\'s most trusted payment gateway.' },
      { q: 'How do I enable two-factor authentication (2FA)?', a: 'Go to your Profile page and click "Enable 2FA." You\'ll scan a QR code with an authenticator app (like Google Authenticator or Authy) and confirm with a 6-digit code to activate it.' },
      { q: 'Can I sign in using Google?', a: 'Yes! Click "Sign in with Google" on the login or registration page for quick access. If you already have an account with the same email, your Google account will be linked automatically.' },
    ],
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggle = (key: string) => setOpenIndex(openIndex === key ? null : key);

  const filtered = faqs.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <div className="faq-page">
      <div className="container">
        <motion.div className="page-header" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <span className="section-badge"><HelpCircle size={14} /> Help Center</span>
          <h1>Frequently Asked Questions</h1>
          <p>Find answers to common questions about orders, products, and your account.</p>
        </motion.div>

        <motion.div className="faq-search" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="input-wrapper">
            <Search size={18} className="input-icon" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </motion.div>

        <div className="faq-content">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No matching questions</h3>
              <p>Try a different search term or browse all categories.</p>
            </div>
          ) : (
            filtered.map((cat, ci) => (
              <motion.div key={cat.category} className="faq-category" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + ci * 0.1 }}>
                <h2>{cat.category}</h2>
                <div className="faq-list">
                  {cat.items.map((item, i) => {
                    const key = `${ci}-${i}`;
                    const isOpen = openIndex === key;
                    return (
                      <div key={key} className={`faq-item ${isOpen ? 'open' : ''}`}>
                        <button className="faq-question" onClick={() => toggle(key)}>
                          <span>{item.q}</span>
                          <ChevronDown size={18} className={`faq-chevron ${isOpen ? 'rotated' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div className="faq-answer" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                              <p>{item.a}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
