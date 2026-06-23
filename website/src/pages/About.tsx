import { motion } from 'framer-motion';
import { Heart, Award, Users, Globe, Sparkles, Truck, Shield, Palette, Target, Leaf, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const fadeUp = { hidden: { opacity: 0, y: 32 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.55 } }) };

const VALUES = [
  { icon: <Palette size={28} />, color: '#0E7C61', title: 'Creative Freedom', desc: 'We empower everyone to express themselves through custom-designed products — no design experience needed.' },
  { icon: <Award size={28} />, color: '#C6A75E', title: 'Premium Quality', desc: 'We use only the finest materials and 300 DPI printing techniques for vibrant, long-lasting results.' },
  { icon: <Leaf size={28} />, color: '#16A34A', title: 'Sustainability', desc: 'Eco-friendly inks and responsible sourcing — because the planet matters as much as your design.' },
  { icon: <Users size={28} />, color: '#7C3AED', title: 'Community First', desc: 'Built by creators, for creators. Your feedback shapes every feature we build.' },
];

const STATS = [
  { number: '10K+', label: 'Happy Customers', desc: 'Across India' },
  { number: '50K+', label: 'Products Created', desc: 'And counting' },
  { number: '500+', label: 'Pin Codes Served', desc: 'Pan-India delivery' },
  { number: '4.9★', label: 'Average Rating', desc: 'From verified buyers' },
];

const STEPS = [
  { n: '01', title: 'Choose a Product', desc: 'Browse 100+ customizable products — t-shirts, hoodies, mugs, canvases, and more.' },
  { n: '02', title: 'Design It Your Way', desc: 'Upload artwork, add text, pick colours, and preview on the actual mockup in real-time.' },
  { n: '03', title: 'We Print & Deliver', desc: '300 DPI precision printing on premium materials, shipped pan-India in 3–5 business days.' },
];

export default function About() {
  return (
    <div className="about-page">

      {/* ── Hero ── */}
      <section className="about-hero-section">
        <div className="container">
          <motion.div className="about-hero" initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="section-eyebrow"><Sparkles size={14} /> Our Story</span>
            <h1>We Make Custom Products<br /><span className="gradient-text">Deeply Personal</span></h1>
            <p className="about-lead">
              TheFramedWall was born from a simple belief: everyone deserves products that truly reflect who they are.
              We combine a professional-grade design studio with premium DTG printing to turn your imagination into reality —
              delivered pan-India.
            </p>
            <blockquote className="about-motto">
              <span className="about-motto-quote">"</span>
              If You Can Think It,&nbsp;<em>We Can <span className="motto-ink">Ink</span> It</em>
              <span className="about-motto-quote">"</span>
            </blockquote>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: '1.5rem' }}>
              <Link to="/design-studio" className="btn btn-primary btn-lg"><Palette size={16} /> Start Designing</Link>
              <Link to="/products" className="btn btn-outline btn-lg">Browse Products <ArrowRight size={16} /></Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="about-stats-section">
        <div className="container">
          <div className="about-stats-grid">
            {STATS.map((s, i) => (
              <motion.div key={s.label} className="about-stat-card" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <span className="about-stat-number">{s.number}</span>
                <span className="about-stat-label">{s.label}</span>
                <span className="about-stat-desc">{s.desc}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="about-mission-section">
        <div className="container">
          <div className="about-mission-grid">
            <motion.div className="about-mission-text" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <span className="section-eyebrow"><Target size={13} /> Our Mission</span>
              <h2>Bridging Creativity &amp; Quality</h2>
              <p>
                We believe self-expression should never be limited by mass production. Our platform bridges the gap
                between your creativity and high-quality custom merchandise. Whether it's branded t-shirts for your
                startup, personalised mugs for a loved one, or canvas art for your home — we make it effortless.
              </p>
              <p>
                Every product starts with your vision. Our design studio lets you upload artwork, add text, select
                colours, and preview your creation on the actual mockup before you order — all in real-time.
              </p>
            </motion.div>
            <motion.div className="about-mission-visual" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
              <div className="about-mission-img-wrap">
                <img src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80" alt="Custom T-Shirt" />
                <div className="about-mission-badge">
                  <Sparkles size={16} /> 300 DPI Quality
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="about-values-section">
        <div className="container">
          <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <span className="section-eyebrow">Our Core</span>
            <h2>What We Stand For</h2>
            <p>The principles that guide every product we make and every decision we take</p>
          </motion.div>
          <div className="about-values-grid">
            {VALUES.map((v, i) => (
              <motion.div key={v.title} className="about-value-card" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i} whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300 }}>
                <div className="about-value-icon" style={{ background: v.color + '18', color: v.color }}>{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="about-steps-section">
        <div className="container">
          <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <span className="section-eyebrow">Simple Process</span>
            <h2>From Idea to Doorstep in 3 Steps</h2>
            <p>Designing your custom product has never been easier</p>
          </motion.div>
          <div className="about-steps-grid">
            {STEPS.map((s, i) => (
              <motion.div key={s.n} className="about-step" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}>
                <div className="about-step-number">{s.n}</div>
                <div className="about-step-line" />
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quality Badges ── */}
      <section className="about-badges-section">
        <div className="container">
          <div className="about-badges">
            <div className="about-badge"><Truck size={22} /> <span><strong>Free Shipping</strong> on orders ₹999+</span></div>
            <div className="about-badge-sep" />
            <div className="about-badge"><Shield size={22} /> <span><strong>7-Day Returns</strong> hassle-free</span></div>
            <div className="about-badge-sep" />
            <div className="about-badge"><Heart size={22} /> <span><strong>Satisfaction</strong> guaranteed</span></div>
            <div className="about-badge-sep" />
            <div className="about-badge"><Globe size={22} /> <span><strong>Pan-India</strong> delivery</span></div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="about-cta-section">
        <div className="container">
          <motion.div className="about-cta" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <div className="about-cta-orb-1" /><div className="about-cta-orb-2" />
            <span className="section-eyebrow" style={{ color: '#10B887' }}><Sparkles size={13} /> Join the Community</span>
            <h2>Ready to Create Something Amazing?</h2>
            <p>Join 10,000+ creators across India and start designing your custom products today.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/design-studio" className="btn btn-lg" style={{ background: '#fff', color: '#0E7C61', fontWeight: 700 }}><Palette size={16} /> Open Design Studio</Link>
              <Link to="/contact" className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>Contact Us</Link>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
