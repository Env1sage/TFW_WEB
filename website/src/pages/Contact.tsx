import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, Clock, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    // Simulate sending
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Message sent! We\'ll get back to you within 24 hours.');
    setForm({ name: '', email: '', subject: '', message: '' });
    setLoading(false);
  };

  const contactInfo = [
    { icon: <Mail size={22} />, title: 'Email Us', detail: 'support@theframedwall.com', sub: 'We reply within 24 hours' },
    { icon: <Phone size={22} />, title: 'WhatsApp / Call', detail: '+91 89833 01235', sub: 'Mon–Sat, 10am–7pm IST' },
    { icon: <MapPin size={22} />, title: 'Our Studio', detail: 'Sector 18, Gurugram', sub: 'Haryana, India — 122015' },
    { icon: <Clock size={22} />, title: 'Business Hours', detail: 'Mon – Sat: 10am – 7pm', sub: 'Sunday: Closed (IST)' },
  ];

  return (
    <div className="contact-page">
      <div className="container">
        <motion.div className="page-header" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <span className="section-badge"><MessageCircle size={14} /> Get in Touch</span>
          <h1>Contact Us</h1>
          <p>Have a question, feedback, or need help with an order? We'd love to hear from you.</p>
        </motion.div>

        <div className="contact-grid">
          {/* Contact Info Cards */}
          <motion.div className="contact-info" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            {contactInfo.map(c => (
              <div key={c.title} className="contact-card">
                <div className="contact-card-icon">{c.icon}</div>
                <div>
                  <h3>{c.title}</h3>
                  <p className="contact-detail">{c.detail}</p>
                  <p className="contact-sub">{c.sub}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Contact Form */}
          <motion.div className="contact-form-wrap" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <h2>Send a Message</h2>
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="contact-name">Name *</label>
                  <input id="contact-name" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
                </div>
                <div className="form-group">
                  <label htmlFor="contact-email">Email *</label>
                  <input id="contact-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="contact-subject">Subject</label>
                <input id="contact-subject" type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="How can we help?" />
              </div>

              <div className="form-group">
                <label htmlFor="contact-message">Message *</label>
                <textarea id="contact-message" rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Tell us more..." />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? <div className="spinner-sm" /> : <><Send size={18} /> Send Message</>}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
