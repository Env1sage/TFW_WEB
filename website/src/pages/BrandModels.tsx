import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Brand, DeviceModel } from '../types';
import './BrandModels.css';

export default function BrandModels() {
  const { categorySlug, brandSlug } = useParams<{ categorySlug: string; brandSlug: string }>();
  const navigate = useNavigate();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!brandSlug) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.getBrand(brandSlug),
      api.getModelsByBrand(brandSlug),
    ])
      .then(([b, m]) => {
        setBrand(b);
        setModels(m);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [brandSlug]);

  useEffect(() => {
    if (brand) {
      document.title = `${brand.name} Models - ${humanize(categorySlug || '')} | TheFramedWall`;
    }
  }, [brand, categorySlug]);

  const filtered = search
    ? models.filter((m) =>
        m.displayName.toLowerCase().includes(search.toLowerCase()) ||
        m.name.toLowerCase().includes(search.toLowerCase())
      )
    : models;

  function handleModelClick(model: DeviceModel) {
    // Navigate to design studio product page filtered for this brand+model
    // Products are linked by model_id; we pass brandSlug & modelSlug as query params
    // so the design studio / product listing can filter appropriately.
    navigate(`/products?brand=${brandSlug}&model=${model.slug}`);
  }

  return (
    <div className="bm-page">
      {/* Breadcrumb */}
      <nav className="bm-breadcrumb" aria-label="breadcrumb">
        <Link to="/">Home</Link>
        <span className="bm-bc-sep">›</span>
        <Link to="/shop">Shop</Link>
        <span className="bm-bc-sep">›</span>
        <Link to={`/shop/${categorySlug}`}>{humanize(categorySlug || '')}</Link>
        <span className="bm-bc-sep">›</span>
        <span>{brand?.name || humanize(brandSlug || '')}</span>
      </nav>

      {/* Brand Header */}
      {brand && (
        <div className="bm-brand-header">
          <div className="bm-brand-logo-wrap">
            {brand.logo ? (
              <img src={brand.logo} alt={brand.name} className="bm-brand-logo" />
            ) : (
              <div className="bm-brand-logo-placeholder">
                {brand.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="bm-brand-meta">
            <h1 className="bm-brand-title">{brand.name}</h1>
            <p className="bm-brand-subtitle">
              {brand.modelCount} {brand.modelCount === 1 ? 'device' : 'devices'} available
            </p>
          </div>
        </div>
      )}

      {!loading && !error && models.length > 3 && (
        <div className="bm-search-wrap">
          <input
            type="search"
            className="bm-search"
            placeholder={`Search ${brand?.name || ''} models…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="bm-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="bm-loading">
          <div className="bm-spinner" />
          <p>Loading models…</p>
        </div>
      )}

      {error && (
        <div className="bm-error">
          <p>Could not load models: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bm-empty">
          {search ? (
            <>
              <p>No models found for "{search}"</p>
              <button className="bm-clear-btn" onClick={() => setSearch('')}>Clear Search</button>
            </>
          ) : (
            <>
              <p>No models available for this brand yet.</p>
              <Link to={`/shop/${categorySlug}`} className="bm-back-btn">
                ← Back to Brands
              </Link>
            </>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <p className="bm-count">
            {filtered.length} {filtered.length === 1 ? 'model' : 'models'}
            {search && ` matching "${search}"`}
          </p>
          <div className="bm-grid">
            {filtered.map((model) => (
              <button
                key={model.id}
                className="bm-model-card"
                onClick={() => handleModelClick(model)}
                aria-label={`Customize for ${model.displayName}`}
              >
                <div className="bm-model-icon">
                  <DeviceIcon />
                </div>
                <div className="bm-model-info">
                  <span className="bm-model-name">{model.displayName}</span>
                  <span className="bm-model-cta">Customize →</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function humanize(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function DeviceIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}
