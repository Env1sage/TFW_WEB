import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import type { Brand } from '../types';
import './CategoryBrands.css';

export default function CategoryBrands() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!categorySlug) return;
    setLoading(true);
    setError('');
    api.getBrandsByCategory(categorySlug)
      .then((data) => {
        setBrands(data);
        if (data.length > 0) setCategoryName(data[0].categoryName || humanize(categorySlug));
        else setCategoryName(humanize(categorySlug));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [categorySlug]);

  // Update page title for SEO
  useEffect(() => {
    document.title = categoryName
      ? `${categoryName} - Shop by Brand | TheFramedWall`
      : 'Shop by Brand | TheFramedWall';
  }, [categoryName]);

  return (
    <div className="cb-page">
      {/* Breadcrumb */}
      <nav className="cb-breadcrumb" aria-label="breadcrumb">
        <Link to="/">Home</Link>
        <span className="cb-bc-sep">›</span>
        <Link to="/shop">Shop</Link>
        <span className="cb-bc-sep">›</span>
        <span>{categoryName || humanize(categorySlug || '')}</span>
      </nav>

      <div className="cb-hero">
        <h1 className="cb-title">
          {categoryName || humanize(categorySlug || '')}
        </h1>
        <p className="cb-subtitle">Select your brand to find the perfect skin</p>
      </div>

      {loading && (
        <div className="cb-loading">
          <div className="cb-spinner" />
          <p>Loading brands…</p>
        </div>
      )}

      {error && (
        <div className="cb-error">
          <p>Could not load brands: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {!loading && !error && brands.length === 0 && (
        <div className="cb-empty">
          <p>No brands available for this category yet.</p>
          <Link to="/shop" className="cb-back-btn">Browse All Categories</Link>
        </div>
      )}

      {!loading && !error && brands.length > 0 && (
        <div className="cb-grid">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              to={`/shop/${categorySlug}/${brand.slug}`}
              className="cb-brand-card"
              aria-label={`${brand.name} – ${brand.modelCount} models`}
            >
              <div className="cb-brand-logo-wrap">
                {brand.logo ? (
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    className="cb-brand-logo"
                    loading="lazy"
                  />
                ) : (
                  <div className="cb-brand-logo-placeholder">
                    {brand.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="cb-brand-info">
                <span className="cb-brand-name">{brand.name}</span>
                <span className="cb-brand-count">
                  {brand.modelCount} {brand.modelCount === 1 ? 'model' : 'models'}
                </span>
              </div>
              <span className="cb-brand-arrow">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function humanize(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
