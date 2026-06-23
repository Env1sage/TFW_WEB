import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Palette, Truck, Shield, Star, Sparkles, CheckCircle, Package, Zap, Phone, Shirt, Coffee, Smartphone, Image, Frame, Sticker, ShoppingBag, Flag, Quote } from 'lucide-react';
import { AnimatedEmoji } from '../components/AnimatedEmoji';
import { LottieLoader } from '../components/LottieLoader';

const CLIENTS = [
  { name: 'TechCorp India',   abbr: 'TC' },
  { name: 'ZeroGravity Wear', abbr: 'ZG' },
  { name: 'BoldBrands Co.',   abbr: 'BB' },
  { name: 'Startopia HQ',     abbr: 'ST' },
  { name: 'PrintNation',      abbr: 'PN' },
  { name: 'EventEdge Pro',    abbr: 'EE' },
  { name: 'FestMerch India',  abbr: 'FM' },
  { name: 'Campus Closet',    abbr: 'CC' },
  { name: 'MerchHive',        abbr: 'MH' },
  { name: 'LogoLab Studio',   abbr: 'LL' },
  { name: 'InkWave Agency',   abbr: 'IW' },
  { name: 'TeamGear Pro',     abbr: 'TG' },
];
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import PromoBanner from '../components/PromoBanner';
import type { Product } from '../types';

const fadeUp = { hidden: { opacity: 0, y: 40 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }) };

const HERO_PRODUCTS = [
  { label: 'Classic White Tee',    img: '/products/tshirt-1.jpg', accent: '#0E7C61', badge: '300 DPI Print',     stat: 'From ₹349' },
  { label: 'Bold Black Edition',   img: '/products/tshirt-2.jpg', accent: '#111827', badge: 'Premium Fabric',    stat: 'From ₹349' },
  { label: 'Minimalist Gray',      img: '/products/tshirt-3.jpg', accent: '#6B7280', badge: 'Unisex Fit',        stat: 'From ₹349' },
  { label: 'Streetwear Drop',      img: '/products/tshirt-4.jpg', accent: '#7C3AED', badge: 'Limited Design',    stat: 'From ₹449' },
  { label: 'Graphic Print Series', img: '/products/tshirt-5.jpg', accent: '#DC2626', badge: 'Full Front Print',  stat: 'From ₹399' },
];

const categories = [
  { name: 'T-Shirts',     icon: <Shirt size={28} />,       color: '#0E7C61', bgImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&auto=format' },
  { name: 'Hoodies',      icon: <Shirt size={28} />,       color: '#0A5C49', bgImage: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400&h=400&fit=crop&auto=format' },
  { name: 'Mugs',         icon: <Coffee size={28} />,      color: '#C6A75E', bgImage: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop&auto=format' },
  { name: 'Phone Cases',  icon: <Smartphone size={28} />,  color: '#12A07D', bgImage: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400&h=400&fit=crop&auto=format' },
  { name: 'Posters',      icon: <Image size={28} />,       color: '#0E7C61', bgImage: 'https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?w=400&h=400&fit=crop&auto=format' },
  { name: 'Canvas',       icon: <Frame size={28} />,       color: '#A8893D', bgImage: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=400&fit=crop&auto=format' },
  { name: 'Stickers',     icon: <Sticker size={28} />,     color: '#16A34A', bgImage: 'https://images.unsplash.com/photo-1626784215021-2e39ccf971cd?w=400&h=400&fit=crop&auto=format' },
  { name: 'Tote Bags',    icon: <ShoppingBag size={28} />, color: '#0A5C49', bgImage: 'https://images.unsplash.com/photo-1597633125097-35e0a92d67e4?w=400&h=400&fit=crop&auto=format' },
];

const testimonials = [
  { name: 'Aarav Sharma', city: 'Delhi', avatar: 'A', rating: 5, text: 'Absolutely love the quality! Ordered custom t-shirts for my college fest and everyone was blown away. Super easy designer tool and fast delivery.' },
  { name: 'Priya Mehta', city: 'Mumbai', avatar: 'P', rating: 5, text: 'TheFramedWall delivered exactly what I designed. The print quality is outstanding and the hoodie fabric is really premium. Will order again!' },
  { name: 'Rohan Gupta', city: 'Bangalore', avatar: 'R', rating: 5, text: 'Used them for my startup merchandise. The design studio is incredibly intuitive — placed front & back prints with ease. Highly recommended!' },
  { name: 'Sneha Patel', city: 'Ahmedabad', avatar: 'S', rating: 4, text: 'Great experience from start to finish. The customizable canvas prints look stunning in my home office. Packaging was also very careful.' },
  { name: 'Karan Verma', city: 'Pune', avatar: 'K', rating: 5, text: 'Ordered bulk tees for our sports team. The quality is consistent across all pieces and the turnaround time was impressive. 10/10!' },
  { name: 'Ananya Singh', city: 'Hyderabad', avatar: 'A', rating: 5, text: 'The tote bags I designed for my brand promotion turned out perfect! Every detail came through clearly. Excellent value for money.' },
];

export default function Home() {
  const { user } = useAuth();
  const [featured, setFeatured] = useState<Product[]>([]);
  const [newsletter, setNewsletter] = useState('');
  const [newsletterSent, setNewsletterSent] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.getProducts({ featured: 'true' }).then(setFeatured).catch(console.error);
  }, []);

  useEffect(() => {
    if (heroPaused) return;
    timerRef.current = setInterval(() => setHeroIdx(i => (i + 1) % HERO_PRODUCTS.length), 3200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [heroPaused]);

  const goTo = (idx: number) => {
    setHeroIdx(idx);
    setHeroPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setTimeout(() => setHeroPaused(false), 5000) as any;
  };

  const current = HERO_PRODUCTS[heroIdx];

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletter.trim()) return;
    try {
      await api.subscribeNewsletter(newsletter.trim());
    } catch (_) { /* non-critical */ }
    setNewsletterSent(true);
  };

  return (
    <div className="home-page">
      {/* Hero — Dark Bold */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-glow-1" />
          <div className="hero-glow-2" />
          <div className="hero-grid-pattern" />
          <div className="aurora-orb aurora-orb-1" />
          <div className="aurora-orb aurora-orb-2" />
          <div className="aurora-orb aurora-orb-3" />
        </div>
        <div className="hero-inner">
          <motion.div className="hero-content" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="hero-eyebrow"><Flag size={14} /> India's #1 Custom Print Studio</span>
            <h1>Design Your Vision.<br /><span className="text-gradient-animated">Print Your Story.</span></h1>
            <p className="hero-motto">
              "If You Can Think It,&nbsp;<span className="motto-ink">We Can Ink It</span>"
            </p>
            <p>Professional custom t-shirts, mugs, canvas prints — crafted with 300 DPI precision and delivered pan-India in 3–5 business days.</p>
            <div className="hero-actions">
              <Link to="/products" className="btn btn-primary btn-lg btn-shimmer btn-glow">
                <span className="sparkle-wrap">
                  <span className="spark" /><span className="spark" /><span className="spark" />
                  Shop Products <ArrowRight size={18} />
                </span>
              </Link>
              <Link to="/design-studio" className="btn btn-primary btn-lg btn-shimmer">
                <Palette size={18} /> Design Studio
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat"><strong>10K+</strong><span>Happy Customers</span></div>
              <div className="stat"><strong>300 DPI</strong><span>Print Precision</span></div>
              <div className="stat"><strong>3–5 Days</strong><span>Pan-India Delivery</span></div>
              <div className="stat"><strong>4.9</strong><span>Average Rating</span></div>
            </div>
          </motion.div>
          <motion.div className="hero-visual" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
            <div className="hero-image-wrap">

              {/* Main rotating image */}
              <div className="hero-carousel" style={{ '--hero-accent': current.accent } as React.CSSProperties}>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={heroIdx}
                    src={current.img}
                    alt={current.label}
                    className="hero-img-main"
                    initial={{ opacity: 0, scale: 1.04, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: -8 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                  />
                </AnimatePresence>

                {/* Product label pill */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`label-${heroIdx}`}
                    className="hero-product-label"
                    style={{ background: current.accent }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                  >
                    {current.label}
                  </motion.div>
                </AnimatePresence>

                {/* Dot progress bar */}
                <div className="hero-progress-bar">
                  <div
                    className="hero-progress-fill"
                    style={{ background: current.accent, width: `${((heroIdx + 1) / HERO_PRODUCTS.length) * 100}%`, transition: 'width 0.5s ease, background 0.4s ease' }}
                  />
                </div>
              </div>

              {/* Nav dots */}
              <div className="hero-dots">
                {HERO_PRODUCTS.map((_, i) => (
                  <button
                    key={i}
                    className={`hero-dot ${i === heroIdx ? 'active' : ''}`}
                    onClick={() => goTo(i)}
                    style={i === heroIdx ? { background: current.accent, width: 24 } : {}}
                  />
                ))}
              </div>

              {/* Floating badges */}
              <div className="hero-badge hero-badge-1">
                <CheckCircle size={16} className="badge-icon" />
                <AnimatePresence mode="wait">
                  <motion.span key={`b1-${heroIdx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                    {current.badge}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="hero-badge hero-badge-2">
                <Star size={16} className="badge-icon-gold" fill="var(--accent)" stroke="var(--accent)" />
                <AnimatePresence mode="wait">
                  <motion.span key={`b2-${heroIdx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                    {current.stat}
                  </motion.span>
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Bar */}
      <div className="trust-bar">
        <div className="container">
          <div className="trust-items">
            <div className="trust-item"><Truck size={15} /><span>Free Shipping over ₹999</span></div>
            <div className="trust-item"><CheckCircle size={15} /><span>7-Day Easy Returns</span></div>
            <div className="trust-item"><Zap size={15} /><span>3–5 Day Delivery</span></div>
            <div className="trust-item"><Shield size={15} /><span>100% Secure Payments</span></div>
            <div className="trust-item"><Phone size={15} /><span>WhatsApp Support</span></div>
          </div>
        </div>
      </div>

      {/* Promotional Banners */}
      <PromoBanner />

      {/* Categories */}
      <section className="section categories-section">
        <div className="container">
          <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <span className="section-eyebrow">Browse Range</span>
            <h2>Shop by Category</h2>
            <p>Find the perfect canvas for your creativity</p>
          </motion.div>
          <div className="categories-grid">
            {categories.map((cat, i) => (
              <motion.div key={cat.name} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Link to={`/products?category=${encodeURIComponent(cat.name)}`} className="category-card">
                  <div className="category-card-bg" style={{ backgroundImage: `url(${cat.bgImage})` }} />
                  <div className="category-card-overlay" style={{ background: `linear-gradient(135deg, ${cat.color}cc 0%, ${cat.color}99 100%)` }} />
                  <div className="category-card-content">
                    <span className="category-icon">{cat.icon}</span>
                    <span className="category-name">{cat.name}</span>
                    <span className="category-count">Explore <ArrowRight size={12} /></span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section how-it-works-section">
        <div className="container">
          <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <span className="section-eyebrow">Simple Process</span>
            <h2>How It Works</h2>
            <p>Create and receive your custom product in 3 simple steps</p>
          </motion.div>
          <div className="how-steps">
            <motion.div className="how-step" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
              <div className="how-step-number">1</div>
              <div className="step-badge">1</div>
              <div className="how-step-icon"><Package size={28} /></div>
              <h3>Choose a Product</h3>
              <p>Browse our catalog of 100+ customizable products — t-shirts, hoodies, mugs, posters, and more.</p>
            </motion.div>
            <div className="how-step-arrow"><ArrowRight size={20} /></div>
            <motion.div className="how-step" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}>
              <div className="how-step-number">2</div>
              <div className="step-badge">2</div>
              <div className="how-step-icon"><Palette size={28} /></div>
              <h3>Design It Your Way</h3>
              <p>Use our professional design studio to upload artwork, add text, choose colors, and preview in real-time.</p>
            </motion.div>
            <div className="how-step-arrow"><ArrowRight size={20} /></div>
            <motion.div className="how-step" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={3}>
              <div className="how-step-number">3</div>
              <div className="step-badge">3</div>
              <div className="how-step-icon"><Truck size={28} /></div>
              <h3>We Print & Deliver</h3>
              <p>We produce your product using 300 DPI precision printing and deliver it pan-India in 3–5 business days.</p>
            </motion.div>
          </div>
          <div className="section-cta">
            <Link to="/design-studio" className="btn btn-primary btn-lg btn-shimmer btn-glow">
              <span className="sparkle-wrap">
                <span className="spark" /><span className="spark" /><span className="spark" />
                <Palette size={18} /> Start Designing Now
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="section featured-section">
          <div className="container">
            <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <span className="section-eyebrow">Top Picks</span>
              <h2>Featured Products</h2>
              <p>Our most popular customizable items</p>
            </motion.div>
            <div className="products-grid">
              {featured.slice(0, 8).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
            <div className="section-cta">
              <Link to="/products" className="btn btn-outline btn-lg">View All Products <ArrowRight size={18} /></Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Moving Clients Marquee ── */}
      <section className="clients-section">
        <div className="clients-header">
          <span>Trusted by 500+ brands & colleges across India</span>
        </div>
        <div className="clients-track-wrap">
          <div className="clients-track">
            {[...CLIENTS, ...CLIENTS].map((c, i) => (
              <div key={i} className="client-chip">
                <span className="client-abbr">{c.abbr}</span>
                <span className="client-name">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — Dark Section */}
      <section className="section features-section">
        <div className="container">
          <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <span className="section-eyebrow">Why Us</span>
            <h2>Why Choose TheFramedWall?</h2>
            <p>We make custom printing simple, fast, and beautiful</p>
          </motion.div>
          <div className="features-grid">
            {[
              { icon: <Palette size={28} />, title: 'Professional Designer', desc: 'Powerful drag-and-drop studio with layers, text, shapes, and real-time mockup preview.' },
              { icon: <Star size={28} />, title: 'Premium Print Quality', desc: '300 DPI printing on high-quality materials for vibrant, long-lasting results.' },
              { icon: <Truck size={28} />, title: 'Pan-India Delivery', desc: 'Fast and reliable delivery across India. Free shipping on orders above ₹999.' },
              { icon: <Shield size={28} />, title: '100% Satisfaction', desc: 'Not happy with your order? We offer a 7-day return & replacement guarantee.' },
            ].map((f, i) => (
              <motion.div key={f.title} className="feature-card" custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — Compact Horizontal Cards */}
      <section className="testimonials-section">
        <div className="container">
          {/* Header */}
          <motion.div className="tst-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <div className="tst-header-left">
              <span className="section-eyebrow">Reviews</span>
              <h2 className="tst-title">What Our Customers Say</h2>
              <p className="tst-subtitle">Trusted by 10,000+ customers across India</p>
            </div>
            <div className="tst-rating-summary">
              <span className="tst-big-rating">4.9</span>
              <div>
                <div className="tst-stars-row">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="#f59e0b" stroke="#f59e0b" />
                  ))}
                </div>
                <span className="tst-rating-label">Average rating</span>
              </div>
            </div>
          </motion.div>

          {/* Cards grid */}
          <div className="tst-grid">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                className="tst-card"
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={fadeUp}
                whileHover={{ y: -3, boxShadow: '0 10px 28px rgba(14,124,97,0.12)', borderColor: 'var(--primary)' }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              >
                {/* Left column: avatar + stars */}
                <div className="tst-card-left">
                  <div className="tst-avatar">{t.avatar}</div>
                  <div className="tst-stars">
                    {[...Array(5)].map((_, si) => (
                      <Star key={si} size={11} fill={si < t.rating ? '#f59e0b' : 'none'} stroke="#f59e0b" />
                    ))}
                  </div>
                </div>

                {/* Right column: quote + author */}
                <div className="tst-card-right">
                  <Quote size={14} className="tst-quote-icon" />
                  <p className="tst-text">{t.text}</p>
                  <div className="tst-author">
                    <strong>{t.name}</strong>
                    <span className="tst-sep">·</span>
                    <span>{t.city}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA strip */}
          <motion.div
            className="tst-cta"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div className="tst-cta-text">
              <span className="tst-cta-heading">Have Questions? Contact Us Today</span>
              <span className="tst-cta-sub">Our team is ready to help you create something amazing</span>
            </div>
            <Link to="/contact" className="btn btn-primary tst-cta-btn">
              Contact Us <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="section newsletter-section">
        <div className="container">
          <motion.div className="newsletter-banner" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="newsletter-content">
              <span className="hero-eyebrow"><Sparkles size={14} /> Stay Updated</span>
              <h2>Get Exclusive Deals & Design Inspiration</h2>
              <p>Subscribe for special offers, new product launches, and creative tips — straight to your inbox.</p>
              {newsletterSent ? (
                <div className="newsletter-success" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <LottieLoader type="success" size={72} loop={false} />
                  <span>Thanks for subscribing! Exciting offers coming soon. <AnimatedEmoji emoji="🎉" anim="bounce" trigger="auto" /></span>
                </div>
              ) : (
                <form className="newsletter-form" onSubmit={handleNewsletter}>
                  <input type="email" placeholder="Enter your email address" value={newsletter} onChange={e => setNewsletter(e.target.value)} required />
                  <button type="submit" className="btn btn-primary">Subscribe <ArrowRight size={16} /></button>
                </form>
              )}
              <p className="newsletter-note">No spam. Unsubscribe anytime.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="section cta-section">
        <div className="container">
          <motion.div className="cta-banner" initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2>Ready to Create Something Amazing?</h2>
            <p>Join 10,000+ creators across India and start designing your custom products today.</p>
            <Link to={user ? '/design-studio' : '/register'} className="btn btn-white btn-lg btn-shimmer">
              <AnimatedEmoji emoji="✨" anim="wiggle" trigger="hover" size="1.1em" /> Start Designing Free <ArrowRight size={18} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
