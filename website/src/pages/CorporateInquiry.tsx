import { useState } from 'react';
import { Building2, Send, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

export default function CorporateInquiry() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: '', contactName: '', email: '', phone: '',
    productInterest: '', quantity: 100, message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.name === 'quantity' ? Number(e.target.value) : e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactName || !form.email) {
      toast.error('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      await api.submitCorporateInquiry(form);
      setSubmitted(true);
    } catch {
      toast.error('Failed to submit inquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="contact-page">
        <div className="contact-container" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <CheckCircle size={64} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
          <h1>Inquiry Submitted!</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '1rem auto' }}>
            Thank you for your interest in bulk orders. Our corporate team will review your inquiry
            and get back to you within 1-2 business days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-page">
      <div className="contact-container">
        <div className="contact-header">
          <Building2 size={40} style={{ color: 'var(--primary)' }} />
          <h1>Corporate & Bulk Orders</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto' }}>
            Need custom merchandise for your company, event, or team? Fill out the form below and
            our corporate sales team will create a personalised quote for you.
          </p>
        </div>

        <div className="inquiry-benefits" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', margin: '2rem 0' }}>
          {[
            { title: 'Bulk Discounts', desc: 'Up to 40% off on 500+ units' },
            { title: 'Custom Branding', desc: 'Your logo on every item' },
            { title: 'Dedicated Manager', desc: 'Personal account manager' },
            { title: 'Fast Turnaround', desc: '7-10 day delivery' },
          ].map((b) => (
            <div key={b.title} style={{ background: 'var(--surface-2)', padding: '1.2rem', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 4px', color: 'var(--primary)' }}>{b.title}</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{b.desc}</p>
            </div>
          ))}
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Company Name *</label>
              <input name="companyName" value={form.companyName} onChange={handleChange} required placeholder="Your company name" />
            </div>
            <div className="form-group">
              <label>Contact Name *</label>
              <input name="contactName" value={form.contactName} onChange={handleChange} required placeholder="Full name" />
            </div>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Email *</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="company@example.com" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="+91 XXXXX XXXXX" />
            </div>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Product Interest</label>
              <select name="productInterest" value={form.productInterest} onChange={handleChange}>
                <option value="">Select product type</option>
                <option value="T-Shirts">T-Shirts</option>
                <option value="Hoodies">Hoodies</option>
                <option value="Mugs">Mugs</option>
                <option value="Tote Bags">Tote Bags</option>
                <option value="Posters">Posters</option>
                <option value="Canvas">Canvas Prints</option>
                <option value="Stickers">Stickers</option>
                <option value="Phone Cases">Phone Cases</option>
                <option value="Mixed">Mixed / Multiple</option>
              </select>
            </div>
            <div className="form-group">
              <label>Estimated Quantity</label>
              <input name="quantity" type="number" min={10} value={form.quantity} onChange={handleChange} placeholder="100" />
            </div>
          </div>
          <div className="form-group">
            <label>Message / Requirements</label>
            <textarea name="message" value={form.message} onChange={handleChange} rows={4} placeholder="Tell us about your requirements, timeline, and any specific design needs..." />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.9rem' }}>
            {loading ? <><span className="spinner-sm" /> Submitting...</> : <><Send size={16} /> Submit Inquiry</>}
          </button>
        </form>
      </div>
    </div>
  );
}
