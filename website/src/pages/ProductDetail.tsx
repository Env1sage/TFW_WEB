import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ShoppingCart, Minus, Plus, Check, Palette, Ruler, Truck, Info, Bell, X, Loader, Package, MapPin, ChevronDown, Droplets, Wind, Sun, Scissors } from 'lucide-react';
import { api, getSessionId } from '../api';
import { useCart } from '../context/CartContext';
import type { Product, Brand, DeviceModel } from '../types';
import ProductCard from '../components/ProductCard';
import toast from 'react-hot-toast';
import { COLORS } from '../mockups';

function colorName(hex: string): string {
  return COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}

// ── Data tables ────────────────────────────────────────────────────────────────

const SIZE_CHART: Record<string, {
  unit: string;
  headers: string[];
  rows: { label: string; values: string[] }[];
}> = {
  'T-Shirts': {
    unit: 'inches',
    headers: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    rows: [
      { label: 'Chest',  values: ['34', '36', '38', '40', '42', '44', '46'] },
      { label: 'Length', values: ['26', '27', '28', '29', '30', '31', '32'] },
      { label: 'Sleeve', values: ['7', '7.5', '8', '8.5', '9', '9.5', '10'] },
    ],
  },
  'Polo T-Shirts': {
    unit: 'inches',
    headers: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    rows: [
      { label: 'Chest',  values: ['38', '40', '42', '44', '46', '48'] },
      { label: 'Length', values: ['27', '28', '29', '30', '31', '32'] },
      { label: 'Sleeve', values: ['8', '8.5', '9', '9.5', '10', '10.5'] },
    ],
  },
  'Shirts': {
    unit: 'inches',
    headers: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    rows: [
      { label: 'Chest',   values: ['38', '40', '42', '44', '46', '48'] },
      { label: 'Length',  values: ['28', '29', '30', '31', '32', '33'] },
      { label: 'Shoulder',values: ['16', '17', '18', '19', '20', '21'] },
      { label: 'Sleeve',  values: ['24', '25', '26', '27', '28', '29'] },
    ],
  },
  'Hoodies': {
    unit: 'inches',
    headers: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    rows: [
      { label: 'Chest',  values: ['38', '40', '42', '44', '46', '48'] },
      { label: 'Length', values: ['26', '27', '28', '29', '30', '31'] },
      { label: 'Sleeve', values: ['24', '25', '26', '27', '28', '29'] },
    ],
  },
  'Jackets': {
    unit: 'inches',
    headers: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    rows: [
      { label: 'Chest',  values: ['40', '42', '44', '46', '48', '50'] },
      { label: 'Length', values: ['27', '28', '29', '30', '31', '32'] },
      { label: 'Sleeve', values: ['24', '25', '26', '27', '28', '29'] },
    ],
  },
  'Kids Clothing': {
    unit: 'inches',
    headers: ['2Y', '4Y', '6Y', '8Y', '10Y', '12Y'],
    rows: [
      { label: 'Chest',  values: ['24', '26', '28', '30', '32', '34'] },
      { label: 'Length', values: ['14', '16', '18', '20', '22', '24'] },
      { label: 'Sleeve', values: ['4.5', '5', '5.5', '6', '6.5', '7'] },
    ],
  },
};

const PRODUCT_HIGHLIGHTS: Record<string, string[]> = {
  'T-Shirts':      ['180 GSM', '100% Combed Cotton', 'Pre-Shrunk', 'Bio-Washed', 'Regular Fit', 'Ribbed Collar', 'No MOQ'],
  'Polo T-Shirts': ['220 GSM', '100% Pique Cotton', 'Pre-Shrunk', 'Regular Fit', 'Ribbed Collar', 'Side Vents', 'No MOQ'],
  'Shirts':        ['200 GSM', '60% Cotton / 40% Poly', 'Wrinkle Resistant', 'Spread Collar', 'Regular Fit', 'No MOQ'],
  'Hoodies':       ['320 GSM', '80% Cotton / 20% Poly', 'Fleece Interior', 'Kangaroo Pocket', 'Ribbed Cuffs', 'No MOQ'],
  'Jackets':       ['240 GSM', 'Polyester Shell', 'Zip Closure', 'Side Pockets', 'Regular Fit', 'No MOQ'],
  'Kids Clothing': ['160 GSM', '100% Combed Cotton', 'Pre-Shrunk', 'Soft Finish', 'Safe Dyes', 'No MOQ'],
  'Mugs':          ['330ml', 'AAA Ceramic', 'Dishwasher Safe', 'Microwave Safe', 'Sublimation Print', 'No Fade'],
  'Bottles':       ['750ml', 'Food-Grade Steel', 'BPA Free', 'Leak Proof', 'Double-Wall', 'Keeps 24h Cold'],
  'Tote Bags':     ['12oz Canvas', '340 GSM Cotton', 'Reinforced Handles', 'Machine Washable', 'No MOQ'],
  'Stickers':      ['Premium Vinyl', 'Waterproof', 'UV Resistant', 'Outdoor Rated', '3+ Years Life'],
  'Canvas':        ['380 GSM', 'Poly-Cotton', 'Archival Inks', 'Kiln-Dried Frame', 'Hand-Stretched'],
  'Posters':       ['250 GSM', 'Matte Paper', 'Archival Inks', '100+ Year Life', 'Museum Quality'],
  'Phone Cases':   ['Polycarbonate', 'TPU Bumper', 'Impact Resistant', 'Scratch Proof', 'Precise Cutouts'],
  'Headwear':      ['6-Panel', 'Cotton Twill', 'Adjustable Strap', 'Pre-Curved Brim', 'No MOQ'],
  'Bags':          ['600D Polyester', 'Padded Straps', 'Multiple Pockets', 'Water Resistant', 'No MOQ'],
};

const PRINTING_METHODS: Record<string, string[]> = {
  'T-Shirts':      ['DTG Printing', 'DTF Transfer', 'Screen Printing', 'Embroidery'],
  'Polo T-Shirts': ['Embroidery', 'DTF Transfer', 'Screen Printing'],
  'Shirts':        ['Embroidery', 'DTF Transfer', 'Screen Printing'],
  'Hoodies':       ['DTG Printing', 'DTF Transfer', 'Embroidery', 'Screen Printing'],
  'Jackets':       ['Embroidery', 'DTF Transfer', 'Screen Printing'],
  'Kids Clothing': ['DTG Printing', 'DTF Transfer', 'Screen Printing'],
  'Mugs':          ['Sublimation Printing'],
  'Bottles':       ['Laser Engraving', 'UV Printing'],
  'Tote Bags':     ['Screen Printing', 'DTF Transfer', 'Embroidery'],
  'Stickers':      ['Digital Printing', 'Die-Cut Printing'],
  'Canvas':        ['Giclée Printing', 'UV Printing'],
  'Posters':       ['Digital Printing', 'Giclée Printing'],
  'Phone Cases':   ['UV Printing', 'Sublimation Printing'],
  'Headwear':      ['Embroidery', 'DTF Transfer', 'Screen Printing'],
  'Bags':          ['Screen Printing', 'Embroidery', 'DTF Transfer'],
};

const PRINT_AREAS: Record<string, { name: string; w: string; h: string }[]> = {
  'T-Shirts': [
    { name: 'Front Full', w: '12"', h: '16"' },
    { name: 'Back Full',  w: '12"', h: '16"' },
    { name: 'Left Chest', w: '4"',  h: '4"'  },
  ],
  'Polo T-Shirts': [
    { name: 'Left Chest', w: '4"', h: '4"' },
    { name: 'Back Yoke',  w: '6"', h: '3"' },
  ],
  'Hoodies': [
    { name: 'Front Chest', w: '10"', h: '12"' },
    { name: 'Back Full',   w: '12"', h: '14"' },
    { name: 'Sleeve',      w: '3"',  h: '10"' },
  ],
  'Mugs': [
    { name: 'Wrap Print', w: '8.5"', h: '3.75"' },
  ],
  'Tote Bags': [
    { name: 'Front',  w: '10"', h: '10"' },
    { name: 'Back',   w: '10"', h: '10"' },
  ],
  'Phone Cases': [
    { name: 'Full Back', w: '2.5"', h: '5"' },
  ],
};

const CARE_INSTRUCTIONS: Record<string, { icon: 'wash' | 'bleach' | 'dry' | 'iron' | 'clean'; text: string }[]> = {
  'T-Shirts': [
    { icon: 'wash',  text: 'Machine wash cold (30°C)' },
    { icon: 'bleach',text: 'Do not bleach' },
    { icon: 'dry',   text: 'Tumble dry low or hang dry' },
    { icon: 'iron',  text: 'Iron on reverse side only' },
    { icon: 'clean', text: 'Do not dry clean' },
  ],
  'Hoodies': [
    { icon: 'wash',  text: 'Machine wash cold (30°C)' },
    { icon: 'bleach',text: 'Do not bleach' },
    { icon: 'dry',   text: 'Tumble dry low' },
    { icon: 'iron',  text: 'Do not iron on print' },
    { icon: 'clean', text: 'Do not dry clean' },
  ],
  'Mugs': [
    { icon: 'wash',  text: 'Dishwasher safe (top rack)' },
    { icon: 'bleach',text: 'No abrasive cleaners' },
    { icon: 'dry',   text: 'Air dry recommended' },
    { icon: 'iron',  text: 'Microwave safe' },
  ],
};

const PRODUCT_FAQS: Record<string, { q: string; a: string }[]> = {
  'T-Shirts': [
    { q: 'What printing method do you use for T-shirts?', a: 'We primarily use DTG (Direct-to-Garment) and DTF (Direct-to-Film) printing for vibrant, long-lasting designs. Bulk orders may use screen printing for better unit economics.' },
    { q: 'Will the print fade after washing?', a: 'Our prints are made to last. DTG and DTF prints maintain vibrancy for 50+ washes when care instructions are followed — wash cold, inside out, avoid bleach.' },
    { q: 'Can I get a custom size or fit?', a: 'Standard sizes are XS to 3XL. For custom fits or plus sizes beyond 3XL, contact us via WhatsApp and we\'ll arrange a custom order.' },
    { q: 'What is the minimum order quantity?', a: 'No minimum order quantity. Order even 1 piece. Bulk pricing starts at 25+ pieces — contact us for a corporate quote.' },
    { q: 'How long does production take?', a: 'Production takes 2–4 working days. Standard delivery is 4–7 days pan-India. Express options may be available on request.' },
  ],
  'default': [
    { q: 'What is the print quality like?', a: 'We use professional-grade printing equipment to ensure sharp, vibrant, and durable prints on all products.' },
    { q: 'What is your return policy?', a: '7-day return policy on all products. If the product has a manufacturing defect or print issue, we offer a free reprint or full refund.' },
    { q: 'How long does delivery take?', a: 'Production: 2–4 working days. Delivery: 4–7 days pan-India. Express delivery available for select pincodes.' },
    { q: 'Do you offer bulk discounts?', a: 'Yes! Bulk pricing starts at 25+ units. Contact us on WhatsApp or fill the Corporate Inquiry form for a custom quote.' },
  ],
};

const FABRIC_INFO: Record<string, string> = {
  'T-Shirts':      '100% Combed Cotton (180 GSM). Bio-washed and pre-shrunk for lasting softness. Reinforced neck tape prevents stretching. Excellent colour retention through 50+ washes.',
  'Polo T-Shirts': '100% Pique Cotton (220 GSM). Classic polo weave for breathability. Pre-shrunk with side vents for comfortable fit. Ribbed collar and 3-button placket.',
  'Shirts':        '60% Cotton / 40% Polyester (200 GSM). Wrinkle-resistant blend for all-day crispness. Reinforced buttons and double-needle stitching throughout.',
  'Hoodies':       '80% Cotton / 20% Polyester (320 GSM). Brushed fleece interior for warmth. Ribbed cuffs, waistband and hood lining. Double-lined kangaroo pocket.',
  'Jackets':       '240 GSM bonded shell with fleece lining. Windproof and water-resistant outer. YKK zipper. Stretch panels at underarms for full range of motion.',
  'Kids Clothing': '100% Combed Cotton (160 GSM). Soft bio-washed finish. OEKO-TEX certified dyes — safe for children\'s skin. Pre-shrunk for lasting fit.',
  'Mugs':          'Premium AAA-grade ceramic (330ml). Dishwasher and microwave safe. Sublimation-printed interior and exterior glaze locks colour permanently — no fade, no peel.',
  'Bottles':       'Food-grade 18/8 stainless steel. BPA free. Vacuum double-wall insulation: cold 24 hours, hot 12 hours. Leak-proof screw cap with loop handle.',
  'Tote Bags':     '12oz natural cotton canvas (340 GSM). Double-stitched reinforced handles (24" length). 15L capacity. Machine washable. No zipper — open-top design.',
  'Stickers':      'Premium cast vinyl with permanent adhesive. Waterproof, UV-resistant, dishwasher-safe. Outdoor rated for 3+ years. Full bleed digital print with laminate coat.',
  'Canvas':        'Gallery-grade 380 GSM poly-cotton canvas. Archival pigment inks rated for 100+ years. Hand-stretched on 2cm kiln-dried pine frame. Hanging hardware included.',
  'Posters':       'Museum-quality 250 GSM matte art paper. Archival inks with 100+ year lightfastness. Rich gamut reproduction. Available in A2, A1, and custom sizes.',
  'Phone Cases':   'Hard polycarbonate back with soft TPU bumper. Dual-layer impact protection. Scratch-resistant coating. Precise cutouts for all ports and buttons.',
  'Headwear':      '100% cotton twill 6-panel construction. Pre-curved brim. Adjustable strap with brass buckle. Structured front panels. Embroidered eyelets for ventilation.',
  'Bags':          '600D Oxford polyester. Padded laptop compartment (15"). Multiple organiser pockets. Water-resistant base. Padded adjustable shoulder straps.',
};

const getCareIcon = (icon: string) => {
  switch (icon) {
    case 'wash':  return <Droplets size={14} />;
    case 'bleach':return <X size={14} />;
    case 'dry':   return <Wind size={14} />;
    case 'iron':  return <Sun size={14} />;
    case 'clean': return <Scissors size={14} />;
    default:      return <Info size={14} />;
  }
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  // Phone brand/model selection
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<DeviceModel | null>(null);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Accordions
  const [openSection, setOpenSection] = useState<string | null>('size-chart');
  const toggleSection = (key: string) => setOpenSection(v => v === key ? null : key);

  // Notify modal
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyForm, setNotifyForm] = useState({ name: '', mobile: '', email: '' });
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);

  // Shipping estimate
  const [pinInput, setPinInput] = useState('');
  const [shippingEst, setShippingEst] = useState<{ cost: number; zone: string | null; estimatedDays: string } | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  // FAQ
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Touch swipe for gallery
  const touchStartX = useRef<number | null>(null);

  const { addItem } = useCart();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setBrands([]); setModels([]); setSelectedBrand(null); setSelectedModel(null);
    api.getProduct(id).then(p => {
      if (!p) throw new Error('Product not found');
      setProduct(p);
      if (p.colors?.length) setSelectedColor(p.colors[0]);
      if (p.sizes?.length) setSelectedSize(p.sizes[0]);
      api.trackEvent({ type: 'view', productId: p.id, productName: p.name, category: p.category, brandId: p.brandId, price: p.price, sessionId: getSessionId() });
      // Load brands for this category (for phone-case-style products)
      if (p.category) {
        setBrandsLoading(true);
        api.getBrandsByCategory(p.category.toLowerCase().replace(/\s+/g, '-'))
          .then(bs => { if (bs?.length) setBrands(bs as Brand[]); })
          .catch(() => {})
          .finally(() => setBrandsLoading(false));
      }
      // Load related products
      return api.getProducts({ category: p.category });
    }).then(all => {
      if (all) setRelated((all as Product[]).filter((x: Product) => x.id !== id).slice(0, 4));
    }).catch((err) => {
      setError(err.message || 'Failed to load product');
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!selectedBrand) { setModels([]); setSelectedModel(null); return; }
    setModelsLoading(true);
    setSelectedModel(null);
    api.getModelsByBrand(selectedBrand.slug)
      .then(ms => setModels((ms as DeviceModel[]).filter(m => m.active)))
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, [selectedBrand]);

  const handleAdd = () => {
    if (!product) return;
    for (let i = 0; i < quantity; i++) addItem(product, { color: selectedColor, size: selectedSize, phoneBrand: selectedBrand?.name, phoneModel: selectedModel?.displayName });
    toast.success('Added to cart!');
    api.trackEvent({ type: 'add_to_cart', productId: product.id, productName: product.name, category: product.category, size: selectedSize || undefined, color: selectedColor || undefined, price: product.price, quantity, sessionId: getSessionId() });
  };

  const checkShipping = async () => {
    if (!/^\d{6}$/.test(pinInput)) { toast.error('Enter a valid 6-digit pincode'); return; }
    setShippingLoading(true);
    setShippingEst(null);
    try {
      const result = await api.getShippingClassRate({ pinCode: pinInput, subtotal: product!.price * quantity, weightGrams: product!.weightGrams || 200 });
      setShippingEst(result);
    } catch { toast.error('Could not check shipping'); }
    finally { setShippingLoading(false); }
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyForm.name && !notifyForm.mobile && !notifyForm.email) { toast.error('Fill in at least one contact field'); return; }
    if (notifyForm.mobile && !/^[6-9]\d{9}$/.test(notifyForm.mobile)) { toast.error('Enter a valid 10-digit mobile number'); return; }
    setNotifySubmitting(true);
    try {
      await api.submitBackInStock({ productId: product!.id, ...notifyForm });
      setNotifyDone(true);
    } catch (err: any) { toast.error(err.message || 'Could not register notification'); }
    finally { setNotifySubmitting(false); }
  };

  if (loading) return <div className="page-spinner"><div className="spinner" /></div>;
  if (error || !product) return (
    <div className="container">
      <div className="empty-state">
        <h3>{error || 'Product not found'}</h3>
        <Link to="/products" className="btn btn-primary">Back to Products</Link>
      </div>
    </div>
  );

  const isOutOfStock = product.stock !== undefined && product.stock <= 0;
  const sizeChart = SIZE_CHART[product.category];
  const highlights = (product.highlights && product.highlights.length > 0) ? product.highlights : (PRODUCT_HIGHLIGHTS[product.category] || []);
  const printMethods = (product.printMethods && product.printMethods.length > 0) ? product.printMethods : (PRINTING_METHODS[product.category] || []);
  const printAreas = (product.printAreas && product.printAreas.length > 0) ? product.printAreas : (PRINT_AREAS[product.category] || []);
  const careSteps = (product.careInstructions && product.careInstructions.length > 0)
    ? product.careInstructions.map(c => ({ icon: 'wash' as const, text: c.text }))
    : (CARE_INSTRUCTIONS[product.category] || CARE_INSTRUCTIONS['T-Shirts']);
  const fabricInfo = product.fabricInfo || FABRIC_INFO[product.category] || product.description;
  const faqs = (product.faqs && product.faqs.length > 0) ? product.faqs : (PRODUCT_FAQS[product.category] || PRODUCT_FAQS['default']);
  const deadWeightKg = ((product.weightGrams || 200) / 1000);
  const volWeightKg = ((product.lengthCm || 30) * (product.breadthCm || 20) * (product.heightCm || 5)) / 5000;

  return (
    <div className="pd-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="pd-breadcrumb">
          <Link to="/products">Products</Link>
          <span>/</span>
          <Link to={`/products?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
          <span>/</span>
          <span>{product.name}</span>
        </nav>

        <div className="pd-grid">
          {/* ── LEFT: Gallery ── */}
          <div className="pd-gallery">
            {(() => {
              const allImages = [product.image, ...(product.images || [])];
              return (
                <>
                  <div
                    className="pd-gallery-main"
                    onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                    onTouchEnd={e => {
                      if (touchStartX.current === null) return;
                      const dx = e.changedTouches[0].clientX - touchStartX.current;
                      if (Math.abs(dx) > 40) {
                        if (dx < 0) setActiveImage(i => Math.min(i + 1, allImages.length - 1));
                        else setActiveImage(i => Math.max(i - 1, 0));
                      }
                      touchStartX.current = null;
                    }}
                  >
                    <img src={allImages[activeImage]} alt={product.name} className="pd-design-img" />
                    {allImages.length > 1 && (
                      <div className="pd-gallery-dots">
                        {allImages.map((_, idx) => (
                          <span key={idx} className={`pd-gallery-dot ${idx === activeImage ? 'active' : ''}`} onClick={() => setActiveImage(idx)} />
                        ))}
                      </div>
                    )}
                  </div>
                  {allImages.length > 1 && (
                    <div className="pd-thumbs">
                      {allImages.map((img, idx) => (
                        <button
                          key={idx}
                          className={`pd-thumb ${activeImage === idx ? 'active' : ''}`}
                          onClick={() => setActiveImage(idx)}
                        >
                          <img src={img} alt={`${product.name} view ${idx + 1}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* ── RIGHT: Info ── */}
          <motion.div className="pd-info" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <span className="pd-category-tag">{product.category}</span>
            <h1 className="pd-title">{product.name}</h1>

            <div className="pd-rating-row">
              <div className="pd-stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} fill={i < Math.round(product.rating) ? '#f59e0b' : 'none'} stroke="#f59e0b" />
                ))}
              </div>
              <span className="pd-rating-text">{product.rating.toFixed(1)} ({product.reviewCount} reviews)</span>
            </div>

            <div className="pd-price-row">
              <span className="pd-price">₹{product.price.toFixed(0)}</span>
              <span className="pd-price-note">+ GST &amp; shipping</span>
            </div>

            {/* Highlight chips */}
            {highlights.length > 0 && (
              <div className="pd-highlights">
                {highlights.map(h => (
                  <span key={h} className="pd-highlight-chip">{h}</span>
                ))}
              </div>
            )}

            {/* Printing methods */}
            {printMethods.length > 0 && (
              <div className="pd-print-methods">
                <span className="pd-print-label">Print Methods:</span>
                {printMethods.map(m => (
                  <span key={m} className="pd-print-badge">{m}</span>
                ))}
              </div>
            )}

            <div className="pd-divider" />

            {/* Phone brand/model selector — shown first so the customer picks their device before color/size */}
            {(brands.length > 0 || brandsLoading) && (
              <div className="pd-device-selector">
                <div className="pd-device-header">
                  <span className="pd-device-title">Select your phone</span>
                  {brandsLoading && <span className="pd-device-loading">loading…</span>}
                </div>
                <div className="pd-option-group" style={{ marginBottom: selectedBrand ? 0 : undefined }}>
                  <label>Brand</label>
                  <div className="pd-brand-grid">
                    {brands.map(b => (
                      <button
                        key={b.id}
                        className={`pd-brand-btn ${selectedBrand?.id === b.id ? 'active' : ''}`}
                        onClick={() => setSelectedBrand(selectedBrand?.id === b.id ? null : b)}
                      >
                        {b.logo && <img src={b.logo} alt={b.name} style={{ width: 20, height: 20, objectFit: 'contain' }} />}
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedBrand && (
                  <div className="pd-option-group">
                    <label>Model
                      {modelsLoading && <span className="pd-option-value" style={{ fontSize: '0.72rem' }}> loading…</span>}
                      {selectedModel && <span className="pd-option-value">{selectedModel.displayName}</span>}
                    </label>
                    <div className="pd-model-grid">
                      {models.map(m => (
                        <button
                          key={m.id}
                          className={`pd-model-btn ${selectedModel?.id === m.id ? 'active' : ''} ${!m.inStock ? 'oos' : ''}`}
                          disabled={!m.inStock}
                          onClick={() => setSelectedModel(selectedModel?.id === m.id ? null : m)}
                        >
                          {m.displayName}
                          {!m.inStock && <span className="pd-model-oos"> Out of Stock</span>}
                        </button>
                      ))}
                      {!modelsLoading && models.length === 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>No models available</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Color selector */}
            {product.colors.length > 0 && (
              <div className="pd-option-group">
                <label>Colour
                  {selectedColor && <span className="pd-option-value">{colorName(selectedColor)}</span>}
                </label>
                <div className="pd-colors">
                  {[...new Set(product.colors)].map(c => (
                    <button
                      key={c}
                      className={`pd-color ${selectedColor === c ? 'active' : ''}`}
                      style={{ background: c, border: c === '#ffffff' ? '2px solid var(--border)' : '2px solid transparent' }}
                      onClick={() => setSelectedColor(c)}
                      title={c}
                    >
                      {selectedColor === c && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size selector */}
            {product.sizes.length > 0 && (
              <div className="pd-option-group">
                <label>
                  Size
                  {selectedSize && <span className="pd-option-value">{selectedSize}</span>}
                  {sizeChart && (
                    <button className="pd-size-guide-link" onClick={() => setOpenSection(openSection === 'size-chart' ? null : 'size-chart')}>
                      <Ruler size={12} /> Size Guide
                    </button>
                  )}
                </label>
                <div className="pd-sizes">
                  {product.sizes.map(s => (
                    <button
                      key={s}
                      className={`pd-size ${selectedSize === s ? 'active' : ''}`}
                      onClick={() => setSelectedSize(s)}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="pd-option-group">
              <label>Quantity</label>
              <div className="pd-qty">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={15} /></button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(Math.min(99, quantity + 1))}><Plus size={15} /></button>
              </div>
            </div>

            {/* CTA */}
            {isOutOfStock ? (
              <div className="pd-oos">
                <div className="pd-oos-banner">
                  <span className="pd-oos-badge">Out of Stock</span>
                  <p>Get notified when this is back!</p>
                </div>
                <button className="btn btn-notify btn-lg btn-block" onClick={() => { setShowNotifyModal(true); setNotifyDone(false); }}>
                  <Bell size={18} /> Notify Me When Available
                </button>
              </div>
            ) : (
              <div className="pd-cta-group">
                <button className="btn btn-primary btn-lg pd-add-btn btn-shimmer" onClick={handleAdd}>
                  <ShoppingCart size={18} /> Add to Cart — ₹{(product.price * quantity).toFixed(0)}
                </button>
              </div>
            )}

            {/* Trust badges */}
            <div className="pd-trust">
              <div className="pd-trust-item"><Truck size={14} /><span>2–4 day dispatch</span></div>
              <div className="pd-trust-item"><Package size={14} /><span>7-day returns</span></div>
              <div className="pd-trust-item"><Check size={14} /><span>Secure checkout</span></div>
            </div>

            <div className="pd-divider" />

            {/* ── Accordions ── */}

            {/* Size Chart */}
            {sizeChart && (
              <div className="pd-accordion">
                <button className="pd-accordion-trigger" onClick={() => toggleSection('size-chart')}>
                  <Ruler size={16} /> Size Chart ({sizeChart.unit})
                  <ChevronDown size={16} className={openSection === 'size-chart' ? 'rotated' : ''} />
                </button>
                <AnimatePresence>
                  {openSection === 'size-chart' && (
                    <motion.div className="pd-accordion-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div className="pd-size-chart-wrap">
                        <table className="pd-size-table">
                          <thead>
                            <tr>
                              <th>Measurement</th>
                              {sizeChart.headers.map(h => <th key={h}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {sizeChart.rows.map(row => (
                              <tr key={row.label}>
                                <td className="pd-size-row-label">{row.label}</td>
                                {row.values.map((v, i) => <td key={i}>{v}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="pd-size-note">All measurements in {sizeChart.unit}. ±0.5" tolerance. We recommend sizing up for a relaxed fit.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Fabric & Material */}
            <div className="pd-accordion">
              <button className="pd-accordion-trigger" onClick={() => toggleSection('fabric')}>
                <Info size={16} /> Fabric &amp; Material
                <ChevronDown size={16} className={openSection === 'fabric' ? 'rotated' : ''} />
              </button>
              <AnimatePresence>
                {openSection === 'fabric' && (
                  <motion.div className="pd-accordion-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <p className="pd-fabric-text">{fabricInfo}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Print Areas */}
            {printAreas.length > 0 && (
              <div className="pd-accordion">
                <button className="pd-accordion-trigger" onClick={() => toggleSection('print-area')}>
                  <Palette size={16} /> Print Areas
                  <ChevronDown size={16} className={openSection === 'print-area' ? 'rotated' : ''} />
                </button>
                <AnimatePresence>
                  {openSection === 'print-area' && (
                    <motion.div className="pd-accordion-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div className="pd-print-areas">
                        {printAreas.map(area => (
                          <div key={area.name} className="pd-print-area-card">
                            <div className="pd-print-area-icon">
                              <Scissors size={18} />
                            </div>
                            <div>
                              <p className="pd-print-area-name">{area.name}</p>
                              <p className="pd-print-area-dims">{area.w} × {area.h}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Care Instructions */}
            <div className="pd-accordion">
              <button className="pd-accordion-trigger" onClick={() => toggleSection('care')}>
                <Droplets size={16} /> Care Instructions
                <ChevronDown size={16} className={openSection === 'care' ? 'rotated' : ''} />
              </button>
              <AnimatePresence>
                {openSection === 'care' && (
                  <motion.div className="pd-accordion-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div className="pd-care-list">
                      {careSteps.map((step, i) => (
                        <div key={i} className="pd-care-item">
                          <span className="pd-care-icon">{getCareIcon(step.icon)}</span>
                          <span>{step.text}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Delivery Check */}
            <div className="pd-accordion">
              <button className="pd-accordion-trigger" onClick={() => toggleSection('delivery')}>
                <Truck size={16} /> Check Delivery
                <ChevronDown size={16} className={openSection === 'delivery' ? 'rotated' : ''} />
              </button>
              <AnimatePresence>
                {openSection === 'delivery' && (
                  <motion.div className="pd-accordion-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div className="pd-delivery-widget">
                      <div className="pd-pin-row">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={pinInput}
                          onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setShippingEst(null); }}
                          onKeyDown={e => e.key === 'Enter' && checkShipping()}
                          placeholder="Enter 6-digit pincode"
                          className="pd-pin-input"
                        />
                        <button className="btn btn-outline btn-sm" onClick={checkShipping} disabled={shippingLoading || pinInput.length !== 6}>
                          {shippingLoading ? <Loader size={14} className="spin" /> : <><MapPin size={14} /> Check</>}
                        </button>
                      </div>
                      {shippingEst && (
                        <motion.div className={`pd-shipping-result ${shippingEst.cost === 0 ? 'free' : ''}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                          {shippingEst.cost === 0
                            ? <><Check size={14} /> <strong>Free Delivery</strong> · {shippingEst.estimatedDays}</>
                            : <><Truck size={14} /> <strong>₹{shippingEst.cost}</strong> shipping · {shippingEst.estimatedDays}</>
                          }
                        </motion.div>
                      )}
                      <div className="pd-dims-row">
                        <span><Package size={12} /> Dead wt: {deadWeightKg.toFixed(2)} kg</span>
                        <span>Vol wt: {volWeightKg.toFixed(2)} kg</span>
                        <span>{product.lengthCm || 30}×{product.breadthCm || 20}×{product.heightCm || 5} cm</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </motion.div>
        </div>

        {/* ── FAQ Section ── */}
        <section className="pd-faq-section">
          <h2 className="pd-section-title">Frequently Asked Questions</h2>
          <div className="pd-faq-list">
            {faqs.map((faq, i) => (
              <div key={i} className="pd-faq-item">
                <button className="pd-faq-trigger" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{faq.q}</span>
                  <ChevronDown size={16} className={openFaq === i ? 'rotated' : ''} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div className="pd-faq-answer" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <p>{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>

        {/* ── Related Products ── */}
        {related.length > 0 && (
          <section className="pd-related-section">
            <h2 className="pd-section-title">More from {product.category}</h2>
            <div className="products-grid">
              {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          </section>
        )}
      </div>

      {/* ── Notify Modal ── */}
      <AnimatePresence>
        {showNotifyModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => { if (e.target === e.currentTarget) setShowNotifyModal(false); }}>
            <motion.div className="notify-modal" initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
              <button className="modal-close-btn" onClick={() => setShowNotifyModal(false)}><X size={18} /></button>
              {notifyDone ? (
                <div className="notify-success">
                  <div className="notify-success-icon"><Check size={32} /></div>
                  <h3>You're on the list!</h3>
                  <p>We'll notify you when <strong>{product.name}</strong> is back in stock.</p>
                  <button className="btn btn-primary" onClick={() => setShowNotifyModal(false)}>Done</button>
                </div>
              ) : (
                <>
                  <div className="notify-modal-header">
                    <div className="notify-bell-icon"><Bell size={24} /></div>
                    <h3>Notify Me When Available</h3>
                    <p>We'll alert you the moment <strong>{product.name}</strong> is back.</p>
                  </div>
                  <form className="notify-form" onSubmit={handleNotifySubmit}>
                    <div className="form-group"><label>Name</label><input type="text" placeholder="Your name" value={notifyForm.name} onChange={e => setNotifyForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div className="form-group"><label>Mobile <span className="field-hint">(SMS alert)</span></label><div className="phone-input-wrap"><span className="phone-prefix">+91</span><input type="tel" placeholder="10-digit mobile" maxLength={10} value={notifyForm.mobile} onChange={e => setNotifyForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} /></div></div>
                    <div className="form-group"><label>Email <span className="field-hint">(email alert)</span></label><input type="email" placeholder="you@example.com" value={notifyForm.email} onChange={e => setNotifyForm(f => ({ ...f, email: e.target.value }))} /></div>
                    <p className="notify-privacy">No spam. Only notified about this product.</p>
                    <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={notifySubmitting}>
                      {notifySubmitting ? <><Loader size={16} className="spin" /> Registering...</> : <><Bell size={16} /> Notify Me</>}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
