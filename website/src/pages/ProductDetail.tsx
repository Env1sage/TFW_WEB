import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, Minus, Plus, ArrowLeft, Check, Palette, Ruler, Truck, Info, Shirt, Image as ImageIcon } from 'lucide-react';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import type { Product } from '../types';
import MockupPreview from '../components/MockupPreview';

const SIZE_CHART: Record<string, { sizes: string[]; chest: string[]; length: string[]; sleeve: string[] }> = {
  'T-Shirts': {
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    chest: ['34"', '36"', '38"', '40"', '42"', '44"'],
    length: ['26"', '27"', '28"', '29"', '30"', '31"'],
    sleeve: ['7"', '7.5"', '8"', '8.5"', '9"', '9.5"'],
  },
  'Hoodies': {
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    chest: ['38"', '40"', '42"', '44"', '46"'],
    length: ['26"', '27"', '28"', '29"', '30"'],
    sleeve: ['24"', '25"', '26"', '27"', '28"'],
  },
};

const FABRIC_INFO: Record<string, string> = {
  'T-Shirts': '100% Combed Cotton (180 GSM), Bio-washed, Pre-shrunk. Soft hand feel with excellent color retention.',
  'Hoodies': '80% Cotton / 20% Polyester Fleece (320 GSM), Brushed interior for warmth. Reinforced hood and kangaroo pocket.',
  'Mugs': 'Premium AAA-grade ceramic, Dishwasher & microwave safe. Vibrant sublimation print that never fades.',
  'Phone Cases': 'Polycarbonate hard shell with TPU bumper. Impact-resistant, scratch-proof coating. Precise cutouts.',
  'Posters': 'Museum-quality 250 GSM matte paper. Archival inks rated for 100+ years. Rich color reproduction.',
  'Canvas': 'Gallery-grade 380 GSM poly-cotton canvas, Archival pigment inks. Hand-stretched on kiln-dried wood frame.',
  'Stickers': 'Premium vinyl, waterproof & UV-resistant. Dishwasher safe, outdoor rated for 3+ years.',
  'Tote Bags': '12oz natural cotton canvas (340 GSM). Reinforced handles. Machine washable.',
};

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [galleryView, setGalleryView] = useState<'mockup' | 'design'>('mockup');
  const { addItem } = useCart();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.getProduct(id).then(p => {
      if (!p) throw new Error('Product not found');
      setProduct(p);
      if (p.colors?.length) setSelectedColor(p.colors[0]);
      if (p.sizes?.length) setSelectedSize(p.sizes[0]);
    }).catch((err) => {
      console.error('Failed to load product:', err);
      setError(err.message || 'Failed to load product');
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-spinner"><div className="spinner" /></div>;
  if (error || !product) return <div className="container"><div className="empty-state"><h3>{error || 'Product not found'}</h3><Link to="/products" className="btn btn-primary">Back to Products</Link></div></div>;

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(product, { color: selectedColor, size: selectedSize });
    }
  };

  return (
    <div className="product-detail-page">
      <div className="container">
        <Link to="/products" className="back-link"><ArrowLeft size={16} /> Back to Products</Link>

        <div className="product-detail-grid">
          <motion.div className="product-gallery" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div className="main-image">
              {galleryView === 'mockup' ? (
                <MockupPreview
                  category={product.category}
                  designImage={product.image}
                  color={selectedColor || product.colors?.[0]}
                  mockup={product.mockup}
                />
              ) : (
                <img src={product.image} alt={product.name} className="design-only-img" />
              )}
              {product.customizable && (
                <Link to={`/design-studio/${product.id}`} className="customize-badge">
                  <Palette size={16} /> Open Design Studio
                </Link>
              )}
            </div>
            {/* Thumbnail strip: mockup view + design-only view */}
            <div className="gallery-thumbs">
              <button
                className={`gallery-thumb ${galleryView === 'mockup' ? 'active' : ''}`}
                onClick={() => setGalleryView('mockup')}
                title="Mockup view"
              >
                <Shirt size={20} />
                <span>Mockup</span>
              </button>
              <button
                className={`gallery-thumb ${galleryView === 'design' ? 'active' : ''}`}
                onClick={() => setGalleryView('design')}
                title="Design artwork"
              >
                <ImageIcon size={20} />
                <span>Design</span>
              </button>
            </div>
          </motion.div>

          <motion.div className="product-info" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <span className="product-category-tag">{product.category}</span>
            <h1>{product.name}</h1>

            <div className="product-rating-large">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={18} fill={i < Math.round(product.rating) ? '#f59e0b' : 'none'} stroke="#f59e0b" />
              ))}
              <span>{product.rating.toFixed(1)} ({product.reviewCount} reviews)</span>
            </div>

            <p className="product-price-large">₹{product.price.toFixed(0)}</p>
            <p className="product-description">{product.description}</p>

            {product.colors.length > 0 && (
              <div className="option-group">
                <label>Color</label>
                <div className="color-options">
                  {[...new Set(product.colors)].map(c => (
                    <button
                      key={c}
                      className={`color-option ${selectedColor === c ? 'active' : ''}`}
                      style={{ background: c, border: c === '#ffffff' ? '2px solid var(--border)' : '2px solid transparent' }}
                      onClick={() => setSelectedColor(c)}
                    >
                      {selectedColor === c && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes.length > 0 && (
              <div className="option-group">
                <label>Size</label>
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

            <div className="option-group">
              <label>Quantity</label>
              <div className="quantity-selector">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(Math.min(99, quantity + 1))}><Plus size={16} /></button>
              </div>
            </div>

            <div className="product-actions">
              <button className="btn btn-primary btn-lg btn-block" onClick={handleAdd}>
                <ShoppingCart size={18} /> Add to Cart — ₹{(product.price * quantity).toFixed(0)}
              </button>
              {product.customizable && (
                <Link to={`/design-studio/${product.id}`} className="btn btn-outline btn-lg btn-block" style={{ marginTop: 10 }}>
                  <Palette size={18} /> Customize in Design Studio
                </Link>
              )}
            </div>

            <div className="product-badges">
              <span>Free shipping over ₹999</span>
              <span>7-day returns</span>
              <span>Secure checkout</span>
            </div>

            {/* Size Chart */}
            {SIZE_CHART[product.category] && (
              <div className="product-extra-section">
                <button className="extra-section-toggle" onClick={() => setShowSizeChart(!showSizeChart)}>
                  <Ruler size={16} />
                  <span>Size Chart</span>
                  <span className="toggle-arrow">{showSizeChart ? '▲' : '▼'}</span>
                </button>
                {showSizeChart && (
                  <div className="size-chart-table-wrap">
                    <table className="size-chart-table">
                      <thead>
                        <tr>
                          <th>Size</th>
                          {SIZE_CHART[product.category].sizes.map(s => <th key={s}>{s}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td>Chest</td>{SIZE_CHART[product.category].chest.map((v, i) => <td key={i}>{v}</td>)}</tr>
                        <tr><td>Length</td>{SIZE_CHART[product.category].length.map((v, i) => <td key={i}>{v}</td>)}</tr>
                        <tr><td>Sleeve</td>{SIZE_CHART[product.category].sleeve.map((v, i) => <td key={i}>{v}</td>)}</tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Fabric & Material Info */}
            {FABRIC_INFO[product.category] && (
              <div className="product-extra-section">
                <div className="extra-section-header">
                  <Info size={16} />
                  <span>Fabric &amp; Material</span>
                </div>
                <p className="fabric-info-text">{FABRIC_INFO[product.category]}</p>
              </div>
            )}

            {/* Delivery Estimate */}
            <div className="product-extra-section delivery-estimate">
              <Truck size={16} />
              <div>
                <strong>Estimated Delivery</strong>
                <p>3–5 business days across India. Express delivery available in select metros.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
