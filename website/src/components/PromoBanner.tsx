import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles, Tag, TrendingUp, Star, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import './PromoBanner.css';

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  badgeType: 'new-arrivals' | 'best-sellers' | 'featured' | 'seasonal';
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaLabel2: string;
  ctaUrl2: string;
  bgGradient: string;
  accentColor: string;
  textColor: string;
}

const BADGE_META: Record<string, { icon: JSX.Element; defaultLabel: string }> = {
  'new-arrivals':  { icon: <Sparkles size={13} />, defaultLabel: 'New Arrivals'  },
  'best-sellers':  { icon: <TrendingUp size={13} />, defaultLabel: 'Best Sellers' },
  'featured':      { icon: <Star size={13} />,      defaultLabel: 'Featured'      },
  'seasonal':      { icon: <Gift size={13} />,       defaultLabel: 'Seasonal Deal' },
};

const SLIDE_INTERVAL = 4500;

export default function PromoBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    api.getActiveBanners()
      .then((data) => setBanners(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const go = useCallback((to: number, dir: 1 | -1 = 1) => {
    setDirection(dir);
    setIdx(to);
  }, []);

  const next = useCallback(() => {
    if (!banners.length) return;
    go((idx + 1) % banners.length, 1);
  }, [banners.length, idx, go]);

  const prev = useCallback(() => {
    if (!banners.length) return;
    go((idx - 1 + banners.length) % banners.length, -1);
  }, [banners.length, idx, go]);

  // Auto-rotate
  useEffect(() => {
    if (paused || banners.length <= 1) return;
    timerRef.current = setInterval(() => next(), SLIDE_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, banners.length, next]);

  const resumeAfterManual = useCallback(() => {
    setPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setTimeout(() => setPaused(false), 8000) as any;
  }, []);

  const handlePrev = () => { prev(); resumeAfterManual(); };
  const handleNext = () => { next(); resumeAfterManual(); };
  const handleDot = (i: number) => {
    go(i, i > idx ? 1 : -1);
    resumeAfterManual();
  };

  // Touch / swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) { delta < 0 ? handleNext() : handlePrev(); }
    touchStartX.current = null;
  };

  // Keyboard nav when focused
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
  };

  if (loading) return <div className="promo-banner-skeleton" aria-hidden />;
  if (!banners.length) return null;

  const banner = banners[idx];
  const badge = BADGE_META[banner.badgeType] ?? BADGE_META['featured'];
  const badgeLabel = banner.badgeText || badge.defaultLabel;

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <section
      className="promo-banner-section"
      aria-label="Promotional banners"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
      tabIndex={0}
      ref={trackRef}
    >
      <div className="promo-banner-track">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={banner.id + idx}
            className="promo-banner-slide"
            style={{
              background: banner.bgGradient,
              color: banner.textColor,
              '--accent': banner.accentColor,
            } as React.CSSProperties}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Left — Text */}
            <div className="promo-slide-content">
              <span className="promo-badge" style={{ background: banner.accentColor }}>
                {badge.icon}
                {badgeLabel}
              </span>

              <h2 className="promo-title">{banner.title}</h2>

              {banner.subtitle && (
                <p className="promo-subtitle">{banner.subtitle}</p>
              )}

              <div className="promo-ctas">
                {banner.ctaLabel && (
                  <Link
                    to={banner.ctaUrl}
                    className="promo-cta-primary"
                    style={{ background: banner.accentColor, color: '#fff' }}
                  >
                    {banner.ctaLabel} <ArrowRight size={15} />
                  </Link>
                )}
                {banner.ctaLabel2 && (
                  <Link
                    to={banner.ctaUrl2}
                    className="promo-cta-secondary"
                    style={{ borderColor: banner.textColor, color: banner.textColor }}
                  >
                    {banner.ctaLabel2}
                  </Link>
                )}
              </div>
            </div>

            {/* Right — Image */}
            {banner.imageUrl && (
              <div className="promo-slide-image-wrap">
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="promo-slide-image"
                  loading="lazy"
                  draggable={false}
                />
              </div>
            )}

            {/* Decorative blobs */}
            <div className="promo-blob promo-blob-1" style={{ background: banner.accentColor }} />
            <div className="promo-blob promo-blob-2" style={{ background: banner.accentColor }} />
          </motion.div>
        </AnimatePresence>

        {/* Prev/Next arrows */}
        {banners.length > 1 && (
          <>
            <button
              className="promo-arrow promo-arrow-prev"
              onClick={handlePrev}
              aria-label="Previous banner"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="promo-arrow promo-arrow-next"
              onClick={handleNext}
              aria-label="Next banner"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Progress bar */}
        {banners.length > 1 && (
          <div className="promo-progress-track">
            <motion.div
              key={idx}
              className="promo-progress-fill"
              style={{ background: banners[idx].accentColor }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: paused ? undefined : 1 }}
              transition={{ duration: SLIDE_INTERVAL / 1000, ease: 'linear' }}
            />
          </div>
        )}
      </div>

      {/* Dot indicators */}
      {banners.length > 1 && (
        <div className="promo-dots" role="tablist" aria-label="Banner slides">
          {banners.map((b, i) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={i === idx}
              aria-label={`Slide ${i + 1}: ${b.title}`}
              className={`promo-dot ${i === idx ? 'active' : ''}`}
              style={i === idx ? { background: banners[idx].accentColor, width: 28 } : {}}
              onClick={() => handleDot(i)}
            />
          ))}
        </div>
      )}

      {/* Slide count badge */}
      {banners.length > 1 && (
        <div className="promo-counter" aria-live="polite">
          {idx + 1} / {banners.length}
        </div>
      )}
    </section>
  );
}
