import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Palette, ArrowLeft, Check, CheckCircle, Info, Ruler,
  Truck, Star, ChevronRight, Zap, Shield, RotateCcw,
} from 'lucide-react';
import { api } from '../api';
import MockupPreview from '../components/MockupPreview';
import { COLORS } from '../mockups';
import type { Product } from '../types';

function getColorName(hex: string): string {
  const match = COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
  return match?.name ?? hex;
}

const SIZE_CHART: Record<string, { sizes: string[]; chest: string[]; length: string[] }> = {
  'T-Shirts': { sizes: ['XS','S','M','L','XL','XXL'], chest: ['34"','36"','38"','40"','42"','44"'], length: ['26"','27"','28"','29"','30"','31"'] },
  'Hoodies':  { sizes: ['S','M','L','XL','XXL'],      chest: ['38"','40"','42"','44"','46"'],       length: ['26"','27"','28"','29"','30"'] },
};
const FABRIC: Record<string, string> = {
  'T-Shirts':    '100% Combed Cotton (180 GSM), Bio-washed, Pre-shrunk.',
  'Hoodies':     '80% Cotton / 20% Polyester Fleece (320 GSM), Brushed interior.',
  'Mugs':        'Premium AAA-grade ceramic. Dishwasher & microwave safe.',
  'Phone Cases': 'Polycarbonate hard shell with TPU bumper.',
  'Posters':     'Museum-quality 250 GSM matte paper. Archival inks.',
  'Canvas':      'Gallery-grade 380 GSM poly-cotton canvas.',
  'Stickers':    'Premium vinyl, waterproof & UV-resistant.',
  'Tote Bags':   '12oz natural cotton canvas (340 GSM). Machine washable.',
};

function StepBar({ step }: { step: number }) {
  const steps = ['Choose Product', 'Configure', 'Design & Add to Cart'];
  return (
    <div className="dsw-steps">
      {steps.map((label, i) => (
        <div key={i} className={`dsw-step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
          <div className="dsw-step__bubble">
            {i < step ? <CheckCircle size={13} /> : i + 1}
          </div>
          <span className="dsw-step__label">{label}</span>
          {i < steps.length - 1 && <div className="dsw-step__line" />}
        </div>
      ))}
    </div>
  );
}

export default function DesignStudioProduct() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct]         = useState<Product | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize]   = useState('');
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [showFabric, setShowFabric]       = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getProduct(id).then(p => {
      if (!p) throw new Error('Product not found');
      setProduct(p);
      const cols = [...new Set<string>(p.colors || [])];
      if (cols.length)      setSelectedColor(cols[0]);
      if (p.sizes?.length)  setSelectedSize(p.sizes[0]);
    }).catch(err => setError(err.message || 'Failed to load product'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDesign = () => {
    if (!id) return;
    const params = new URLSearchParams();
    if (selectedColor) { params.set('color', selectedColor); params.set('colorName', getColorName(selectedColor)); }
    if (selectedSize)  params.set('size', selectedSize);
    navigate(`/design-studio/customize/${id}?${params.toString()}`);
  };

  if (loading) return <div className="page-spinner"><div className="spinner" /></div>;
  if (error || !product) return (
    <div className="container" style={{ paddingTop: '3rem' }}>
      <div className="empty-state">
        <h3>{error || 'Product not found'}</h3>
        <Link to="/design-studio" className="btn btn-primary" style={{ marginTop: 16 }}>Back to Design Studio</Link>
      </div>
    </div>
  );

  const uniqueColors = [...new Set<string>(product.colors || [])];

  return (
    <div className="dsw-product-page">
      <div className="container">
        <StepBar step={1} />

        <Link to="/design-studio" className="dsw-back">
          <ArrowLeft size={15} /> Back to Products
        </Link>

        <div className="dsw-product-grid">

          {/* ── Left: preview ── */}
          <motion.div className="dsw-preview-col" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
            <div className="dsw-preview-wrap">
              {/* Live preview label */}
              <div className="dsw-preview-label">
                <span className="dsw-preview-dot" />
                Live Preview
              </div>
              <MockupPreview
                category={product.category}
                designImage={product.image}
                color={selectedColor || product.colors?.[0]}
                mockup={product.mockup}
              />
              <div className="dsw-preview-hint">
                <Palette size={13} /> Your design will appear here
              </div>
            </div>

            {/* Color swatch strip under preview */}
            {uniqueColors.length > 1 && (
              <div className="dsw-swatch-strip">
                <span className="dsw-swatch-strip__label">
                  <RotateCcw size={12} /> Click to change colour
                </span>
                <div className="dsw-swatch-strip__row">
                  {uniqueColors.map(c => (
                    <button
                      key={c}
                      className={`dsw-swatch ${selectedColor === c ? 'active' : ''}`}
                      style={{ background: c, border: c === '#ffffff' ? '2px solid #d1d5db' : '2px solid transparent' }}
                      onClick={() => setSelectedColor(c)}
                      title={getColorName(c)}
                    >
                      {selectedColor === c && <Check size={10} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* ── Right: configurator ── */}
          <motion.div className="dsw-config-col" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
            {/* Breadcrumb tag */}
            <span className="product-category-tag">{product.category}</span>
            <h1 className="dsw-config-name">{product.name}</h1>

            {/* Rating */}
            <div className="dsw-config-rating">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={15} fill={i < Math.round(product.rating) ? '#f59e0b' : 'none'} stroke="#f59e0b" />
              ))}
              <span>{product.rating.toFixed(1)}</span>
              <span className="dsw-config-rating__count">({product.reviewCount} reviews)</span>
            </div>

            <p className="dsw-config-price">from ₹{product.price.toFixed(0)}</p>
            <p className="dsw-config-desc">{product.description}</p>

            {/* Color picker */}
            {uniqueColors.length > 0 && (
              <div className="dsw-option-group">
                <div className="dsw-option-label">
                  Colour
                  <span className="dsw-option-value">{getColorName(selectedColor)}</span>
                </div>
                <div className="color-options">
                  {uniqueColors.map(c => (
                    <button
                      key={c}
                      className={`color-option ${selectedColor === c ? 'active' : ''}`}
                      style={{ background: c, border: c === '#ffffff' ? '2px solid var(--border)' : '2px solid transparent' }}
                      onClick={() => setSelectedColor(c)}
                      title={getColorName(c)}
                    >
                      {selectedColor === c && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size picker */}
            {product.sizes?.length > 0 && (
              <div className="dsw-option-group">
                <div className="dsw-option-label">
                  Size
                  <span className="dsw-option-value">{selectedSize}</span>
                </div>
                <div className="size-options">
                  {product.sizes.map(s => (
                    <button
                      key={s}
                      className={`size-option ${selectedSize === s ? 'active' : ''}`}
                      onClick={() => setSelectedSize(s)}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* CTA block */}
            <div className="dsw-cta-block">
              <button
                className="btn btn-primary btn-lg btn-block dsw-cta-btn"
                onClick={handleDesign}
                disabled={product.stock === 0}
              >
                <Palette size={18} />
                {product.stock === 0 ? 'Out of Stock' : 'Start Designing'}
                {product.stock > 0 && <ChevronRight size={16} />}
              </button>
              <p className="dsw-cta-hint">You'll add your artwork on the next screen</p>
            </div>

            {/* Trust pills */}
            <div className="dsw-trust-pills">
              <span><Zap size={12} /> 300 DPI precision</span>
              <span><Truck size={12} /> 3–5 day delivery</span>
              <span><Shield size={12} /> 7-day returns</span>
            </div>

            {/* Expandable sections */}
            {SIZE_CHART[product.category] && (
              <div className="dsw-accordion">
                <button className="dsw-accordion__toggle" onClick={() => setShowSizeChart(v => !v)}>
                  <Ruler size={14} /> Size Chart
                  <span className="dsw-accordion__arrow">{showSizeChart ? '▲' : '▼'}</span>
                </button>
                {showSizeChart && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.25 }}>
                    <div className="size-chart-table-wrap" style={{ marginTop: 10 }}>
                      <table className="size-chart-table">
                        <thead>
                          <tr><th>Size</th>{SIZE_CHART[product.category].sizes.map(s => <th key={s}>{s}</th>)}</tr>
                        </thead>
                        <tbody>
                          <tr><td>Chest</td>{SIZE_CHART[product.category].chest.map((v, i) => <td key={i}>{v}</td>)}</tr>
                          <tr><td>Length</td>{SIZE_CHART[product.category].length.map((v, i) => <td key={i}>{v}</td>)}</tr>
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {FABRIC[product.category] && (
              <div className="dsw-accordion">
                <button className="dsw-accordion__toggle" onClick={() => setShowFabric(v => !v)}>
                  <Info size={14} /> Fabric &amp; Material
                  <span className="dsw-accordion__arrow">{showFabric ? '▲' : '▼'}</span>
                </button>
                {showFabric && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.25 }}>
                    <p className="dsw-fabric-text">{FABRIC[product.category]}</p>
                  </motion.div>
                )}
              </div>
            )}

            <div className="dsw-delivery-row">
              <Truck size={14} />
              <span><strong>Estimated Delivery:</strong> 3–5 business days across India.</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className="dsw-sticky-cta">
        <div className="dsw-sticky-cta__inner">
          <div>
            <p className="dsw-sticky-cta__name">{product.name}</p>
            <p className="dsw-sticky-cta__price">from ₹{product.price.toFixed(0)}</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleDesign}
            disabled={product.stock === 0}
          >
            <Palette size={15} /> {product.stock === 0 ? 'Out of Stock' : 'Design This'}
          </button>
        </div>
      </div>
    </div>
  );
}
