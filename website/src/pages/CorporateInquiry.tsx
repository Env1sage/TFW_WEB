import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Building2, Send, CheckCircle, Paperclip, X, Users, Percent, Clock, Tag, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const PRODUCT_OPTIONS = [
  'T-Shirts', 'Hoodies', 'Mugs', 'Tote Bags', 'Posters',
  'Canvas Prints', 'Stickers', 'Phone Cases', 'Caps', 'Jackets',
];

const BENEFITS = [
  { icon: <Percent size={22} />, title: 'Bulk Discounts', desc: 'Up to 40% off on 500+ units' },
  { icon: <Tag size={22} />,     title: 'Custom Branding', desc: 'Your logo on every item' },
  { icon: <Users size={22} />,   title: 'Dedicated Manager', desc: 'Personal account manager' },
  { icon: <Clock size={22} />,   title: 'Fast Turnaround', desc: '7–10 day delivery' },
];

export default function CorporateInquiry() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [qtyRange, setQtyRange] = useState<[number, number]>([50, 500]);
  const [attachment, setAttachment] = useState<{ name: string; data: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    companyName: '', contactName: '', email: '', phone: '', message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const toggleInterest = (item: string) =>
    setSelectedInterests(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, data: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactName || !form.email) {
      toast.error('Please fill all required fields'); return;
    }
    setLoading(true);
    try {
      await api.submitCorporateInquiry({
        ...form,
        productInterests: selectedInterests,
        quantityMin: qtyRange[0],
        quantityMax: qtyRange[1],
        attachmentName: attachment?.name,
        attachmentData: attachment?.data,
      } as any);
      setSubmitted(true);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="corp-page">
        <motion.div className="corp-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <CheckCircle size={64} color="var(--primary)" />
          <h1>Inquiry Submitted!</h1>
          <p>Our corporate team will review your inquiry and get back to you within <strong>1–2 business days</strong>.</p>
          <a href="/" className="btn btn-primary btn-lg" style={{ marginTop: 8 }}>Back to Home</a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="corp-page">
      {/* ── Hero ── */}
      <div className="corp-hero">
        <div className="container">
          <motion.div className="corp-hero-content" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="section-eyebrow">Bulk & Enterprise</span>
            <h1>Corporate &amp; Bulk Orders</h1>
            <p>Need custom merchandise for your company, event, or team? Fill out the form and our corporate sales team will create a personalised quote within 24 hours.</p>
          </motion.div>
        </div>
      </div>

      <div className="container">
        {/* Benefits */}
        <div className="corp-benefits">
          {BENEFITS.map((b, i) => (
            <motion.div key={b.title} className="corp-benefit" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              <div className="corp-benefit-icon">{b.icon}</div>
              <div>
                <strong>{b.title}</strong>
                <span>{b.desc}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Form */}
        <motion.form className="corp-form" onSubmit={handleSubmit} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <div className="corp-form-section">
            <h3 className="corp-form-section-title">Contact Details</h3>
            <div className="corp-grid-2">
              <div className="form-group">
                <label>Company Name <span className="req">*</span></label>
                <input name="companyName" value={form.companyName} onChange={handleChange} required placeholder="Your company name" />
              </div>
              <div className="form-group">
                <label>Contact Name <span className="req">*</span></label>
                <input name="contactName" value={form.contactName} onChange={handleChange} required placeholder="Full name" />
              </div>
              <div className="form-group">
                <label>Email Address <span className="req">*</span></label>
                <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="company@example.com" />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <div className="input-wrapper">
                  <span className="input-prefix">+91</span>
                  <input name="phone" type="tel" inputMode="numeric" value={form.phone} onChange={handleChange} placeholder="98765 43210" className="phone-input" maxLength={10} />
                </div>
              </div>
            </div>
          </div>

          <div className="corp-form-section">
            <h3 className="corp-form-section-title">Order Details</h3>

            {/* Multi-select product interest */}
            <div className="form-group">
              <label>Products of Interest <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: '0.82em' }}>(select all that apply)</span></label>
              <div className="corp-multi-select">
                {PRODUCT_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`corp-interest-chip${selectedInterests.includes(opt) ? ' active' : ''}`}
                    onClick={() => toggleInterest(opt)}
                  >
                    {selectedInterests.includes(opt) && <CheckCircle size={12} />}
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity range */}
            <div className="form-group">
              <label>Estimated Quantity Range: <strong style={{ color: 'var(--primary)' }}>{qtyRange[0]} – {qtyRange[1]} units</strong></label>
              <div className="corp-range-row">
                <div className="corp-range-field">
                  <span>Min</span>
                  <input
                    type="range" min={10} max={500} step={10}
                    value={qtyRange[0]}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setQtyRange([Math.min(v, qtyRange[1] - 10), qtyRange[1]]);
                    }}
                    className="corp-range-slider"
                  />
                  <span className="corp-range-val">{qtyRange[0]}</span>
                </div>
                <div className="corp-range-sep">—</div>
                <div className="corp-range-field">
                  <span>Max</span>
                  <input
                    type="range" min={50} max={5000} step={50}
                    value={qtyRange[1]}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setQtyRange([qtyRange[0], Math.max(v, qtyRange[0] + 10)]);
                    }}
                    className="corp-range-slider"
                  />
                  <span className="corp-range-val">{qtyRange[1]}</span>
                </div>
              </div>
              <div className="corp-range-presets">
                {[[10,50],[50,200],[200,500],[500,1000],[1000,5000]].map(([mn, mx]) => (
                  <button key={`${mn}-${mx}`} type="button" className={`corp-preset${qtyRange[0]===mn&&qtyRange[1]===mx?' active':''}`} onClick={() => setQtyRange([mn, mx])}>
                    {mn}–{mx}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="corp-form-section">
            <h3 className="corp-form-section-title">Additional Info</h3>
            <div className="form-group">
              <label>Message / Requirements</label>
              <textarea name="message" value={form.message} onChange={handleChange} rows={4} placeholder="Tell us about your requirements, timeline, design ideas, event date, etc." />
            </div>

            {/* File attachment */}
            <div className="form-group">
              <label>Design Reference <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
              <input ref={fileRef} type="file" accept="image/*,.pdf,.ai,.psd" style={{ display: 'none' }} onChange={handleFileChange} />
              {attachment ? (
                <div className="corp-attachment-preview">
                  <Paperclip size={14} />
                  <span>{attachment.name}</span>
                  <button type="button" onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ''; }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" className="corp-attachment-btn" onClick={() => fileRef.current?.click()}>
                  <Paperclip size={15} /> Attach design reference (image, PDF, AI, PSD — max 5MB)
                </button>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? <><span className="spinner-sm" /> Submitting…</> : <><Send size={16} /> Submit Inquiry</>}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
