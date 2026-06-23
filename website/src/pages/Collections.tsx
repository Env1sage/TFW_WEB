import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Palette, Zap, Star, Filter, Plus } from 'lucide-react';
import { api } from '../api';
import './Collections.css';

const ALL_TAG_FALLBACK = ['All', 'Comics', 'Anime', 'Sci-Fi', 'Sports', 'Music', 'Gaming', 'Nature', 'Fashion'];

function useTilt(strength = 12) {
  const ref = useRef<HTMLDivElement>(null);
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateY(${x * strength}deg) rotateX(${-y * strength}deg) translateZ(24px) scale(1.02)`;
  }, [strength]);
  const handleMouseLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg) translateZ(0px) scale(1)';
  }, []);
  return { ref, handleMouseMove, handleMouseLeave };
}

function CollectionCard({ c, index }: { c: any; index: number }) {
  const { ref, handleMouseMove, handleMouseLeave } = useTilt(12);
  return (
    <motion.div
      className="col-card-wrapper"
      initial={{ opacity: 0, y: 48, scale: 0.93 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: (index % 3) * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div
        ref={ref}
        className={`col-card${c.featured ? ' col-card--featured' : ''}`}
        style={{ '--card-gradient': c.gradient, '--card-glow': c.glow, '--card-shimmer': c.shimmer } as React.CSSProperties}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="col-card-symbol">{c.symbol}</div>
        <div className="col-card-shimmer" />
        <div className="col-card-badge" style={{ background: (c.badgeColor || '#C6A75E') + '22', color: c.badgeColor || '#C6A75E', borderColor: (c.badgeColor || '#C6A75E') + '44' }}>
          <Zap size={10} fill={c.badgeColor || '#C6A75E'} stroke="none" />
          {c.badge}
        </div>
        <div className="col-card-body">
          <span className="col-card-tag">{c.tag}</span>
          <h3 className="col-card-name">{c.name}</h3>
          <p className="col-card-tagline">{c.tagline}</p>
          <div className="col-card-footer">
            <span className="col-card-count">
              <Star size={12} fill="currentColor" /> {c.productCount || 0} products
            </span>
            <Link to={`/collections/${c.id}`} className="col-card-cta">
              Explore <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Collections() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState('All');
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);

  useEffect(() => {
    api.getCollections().then(setCollections).catch(() => setCollections([])).finally(() => setLoading(false));
  }, []);

  const tags = ['All', ...Array.from(new Set(collections.map((c: any) => c.tag)))];
  const filtered = activeTag === 'All' ? collections : collections.filter((c: any) => c.tag === activeTag);

  const particles = Array.from({ length: 16 }, (_, i) => ({
    symbol: ['⚡', '🌟', '🦇', '🌸', '⭐', '🎵', '🎮', '🌿', '👟', '🏆', '🎨', '🔥'][i % 12],
    style: {
      left: `${5 + (i * 17.3) % 90}%`,
      top: `${10 + (i * 23.7) % 80}%`,
      animationDelay: `${(i * 0.37) % 3}s`,
      animationDuration: `${4 + (i * 0.5) % 4}s`,
      fontSize: `${1.2 + (i * 0.15) % 1.4}rem`,
      opacity: 0.12 + (i * 0.03) % 0.15,
    } as React.CSSProperties,
  }));

  return (
    <div className="collections-page">
      {/* ── Hero ── */}
      <div className="col-hero" ref={heroRef}>
        <div className="col-orb col-orb-1" />
        <div className="col-orb col-orb-2" />
        <div className="col-orb col-orb-3" />
        {particles.map((p, i) => <div key={i} className="col-particle" style={p.style}>{p.symbol}</div>)}

        <motion.div className="col-hero-content" style={{ y: heroY, opacity: heroOpacity }}>
          <motion.div className="col-hero-eyebrow" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Sparkles size={14} /> Exclusive Themed Collections
          </motion.div>
          <motion.h1 className="col-hero-title" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
            Wear What<span className="col-hero-gradient-text"> You Love</span>
          </motion.h1>
          <motion.p className="col-hero-sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.22 }}>
            From Marvel to Anime — every fandom, every passion, printed on premium quality gear.
          </motion.p>
          <motion.div className="col-hero-actions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.34 }}>
            <a href="#collections" className="btn btn-primary btn-lg col-hero-btn">Browse Collections <ArrowRight size={18} /></a>
            <Link to="/design-studio" className="btn btn-outline btn-lg col-hero-btn-ghost"><Palette size={16} /> Design Your Own</Link>
          </motion.div>
          <motion.div className="col-hero-stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }}>
            {[
              { value: `${collections.length || '—'}`, label: 'Collections' },
              { value: `${collections.reduce((s: number, c: any) => s + (c.productCount || 0), 0) || '—'}`, label: 'Products' },
              { value: '8+', label: 'Product Types' },
            ].map(s => (
              <div key={s.label} className="col-stat">
                <span className="col-stat-value">{s.value}</span>
                <span className="col-stat-label">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
        <div className="col-hero-scroll-hint">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="col-scroll-dot" />
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="col-filter-bar" id="collections">
        <div className="container">
          <div className="col-filter-inner">
            <Filter size={15} className="col-filter-icon" />
            {(tags.length > 1 ? tags : ['All']).map(tag => (
              <button key={tag} className={`col-filter-btn${activeTag === tag ? ' active' : ''}`} onClick={() => setActiveTag(tag)}>
                {tag}
                {activeTag === tag && <motion.div className="col-filter-pill" layoutId="filter-pill" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <section className="col-grid-section">
        <div className="container">
          {loading ? (
            <div className="col-loading">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="col-skeleton" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No collections yet</h3>
              <p>Check back soon — new collections are being added.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTag} className="col-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                {filtered.map((c, i) => <CollectionCard key={c.id} c={c} index={i} />)}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="col-cta-section">
        <div className="container">
          <motion.div className="col-cta-banner" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <div className="col-cta-orb col-cta-orb-1" />
            <div className="col-cta-orb col-cta-orb-2" />
            <div className="col-cta-content">
              <span className="col-cta-eyebrow"><Sparkles size={14} /> Custom Collection</span>
              <h2>Don't see your fandom?</h2>
              <p>Use our design studio to create your own — upload artwork, add text, and bring any idea to life.</p>
              <Link to="/design-studio" className="btn btn-primary btn-lg"><Palette size={18} /> Start Designing</Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
