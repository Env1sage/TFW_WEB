import { motion } from 'framer-motion';
import { Heart, Award, Users, Globe, Sparkles, Truck, Shield, Palette } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
  const values = [
    { icon: <Palette size={28} />, title: 'Creative Freedom', desc: 'We empower everyone to express themselves through custom-designed products.' },
    { icon: <Award size={28} />, title: 'Premium Quality', desc: 'We use only the finest materials and printing techniques for lasting results.' },
    { icon: <Globe size={28} />, title: 'Sustainability', desc: 'Eco-friendly inks and responsible sourcing — because the planet matters.' },
    { icon: <Users size={28} />, title: 'Community First', desc: 'Built by creators, for creators. Your feedback shapes everything we do.' },
  ];

  const stats = [
    { number: '10K+', label: 'Happy Customers' },
    { number: '50K+', label: 'Products Created' },
    { number: '500+', label: 'Pin Codes Served' },
    { number: '4.9', label: 'Average Rating' },
  ];

  return (
    <div className="about-page">
      <div className="container">
        {/* Hero */}
        <motion.div className="about-hero" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="section-badge"><Sparkles size={14} /> Our Story</span>
          <h1>We Make Custom Products <span className="text-gradient">Personal</span></h1>
          <p className="about-lead">
            TheFramedWall was born from a simple belief: everyone deserves products that truly reflect who they are.
            We combine a professional-grade design studio with premium DTG printing to turn your imagination into reality — and deliver it across India.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div className="about-stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          {stats.map(s => (
            <div key={s.label} className="stat-card">
              <span className="stat-number">{s.number}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Mission */}
        <motion.div className="about-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="about-section-content">
            <h2>Our Mission</h2>
            <p>
              We believe self-expression should never be limited by mass production. Our platform bridges the gap
              between your creativity and high-quality custom merchandise. Whether it's branded t-shirts for your
              startup, personalised mugs for a loved one, or canvas art for your home — we make it effortless.
            </p>
            <p>
              Every product starts with your vision. Our design studio lets you upload artwork, add text, select
              colours, and preview your creation on the actual mockup before you order — all in real-time.
            </p>
          </div>
        </motion.div>

        {/* Values */}
        <motion.div className="about-values" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h2>What We Stand For</h2>
          <div className="values-grid">
            {values.map(v => (
              <div key={v.title} className="value-card">
                <div className="value-icon">{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div className="about-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <h2>How It Works</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Choose a Product</h3>
              <p>Browse our catalog of customizable t-shirts, hoodies, mugs, posters, and more.</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Design It</h3>
              <p>Use our built-in designer to upload images, add text, and pick colors.</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>We Print & Ship</h3>
              <p>We produce your custom product with care and deliver it to your door.</p>
            </div>
          </div>
        </motion.div>

        {/* Shipping & Quality badges */}
        <motion.div className="about-badges" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <div className="badge-item"><Truck size={22} /> <span>Free Shipping on ₹999+</span></div>
          <div className="badge-item"><Shield size={22} /> <span>7-Day Returns</span></div>
          <div className="badge-item"><Heart size={22} /> <span>Satisfaction Guaranteed</span></div>
        </motion.div>

        {/* CTA */}
        <motion.div className="about-cta" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <h2>Ready to Create?</h2>
          <p>Start designing your custom products today.</p>
          <Link to="/products" className="btn btn-primary btn-lg">Browse Products</Link>
        </motion.div>
      </div>
    </div>
  );
}
