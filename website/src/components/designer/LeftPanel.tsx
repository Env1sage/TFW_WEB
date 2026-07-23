import { useState, useRef } from 'react';
import * as fabric from 'fabric';
import {
  Package, Layers as LayersIcon, Upload, Type, Smile,
  ImageUp, Trash2, Copy, AlignCenter, FlipHorizontal2, FlipVertical2,
  Lock, LockOpen, Eye, EyeOff, Square, Circle, Triangle, Minus,
  ZoomIn, ZoomOut, RefreshCcw, Search, Bold, Italic, Underline,
  Plus, Check, Palette, Wand2,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { MockupTemplate, PrintSide, PrintSize } from '../../mockups';

export type TabId = 'product' | 'layers' | 'uploads' | 'text' | 'graphics';
type ShapeType = 'rect' | 'circle' | 'triangle' | 'line';
type LucideIcon = React.ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>>;

const NAV_TABS: { id: TabId; Icon: LucideIcon; label: string }[] = [
  { id: 'product',  Icon: Package,    label: 'Product'  },
  { id: 'layers',   Icon: LayersIcon, label: 'Layers'   },
  { id: 'uploads',  Icon: Upload,     label: 'Uploads'  },
  { id: 'text',     Icon: Type,       label: 'Text'     },
  { id: 'graphics', Icon: Smile,      label: 'Graphics' },
];

const STUDIO_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato',
  'Raleway', 'Nunito', 'Ubuntu', 'Source Sans Pro', 'Work Sans', 'Oswald',
  'Playfair Display', 'Merriweather', 'PT Serif', 'Libre Baskerville',
  'Dancing Script', 'Pacifico', 'Lobster', 'Permanent Marker',
  'Impact', 'Arial Black', 'Arial', 'Georgia', 'Courier New', 'Verdana', 'Comic Sans MS',
];

const EMOJI_SETS = [
  { category: 'Hearts',   items: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💝','💖','💗','🫶','💞'] },
  { category: 'Stars',    items: ['⭐','🌟','✨','💫','⚡','❄️','🌠','✴️','🎇','⚜️','🔥','💥','🌈','🎆'] },
  { category: 'Animals',  items: ['🦁','🐯','🦅','🦋','🐺','🦊','🐻','🦄','🐲','🐬','🦁','🐉','🦚','🦜'] },
  { category: 'Sports',   items: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏆','🥇','🎽','🏋️','⛷️','🤸'] },
  { category: 'Symbols',  items: ['✅','❌','❗','❓','💯','⚠️','🎯','💎','👑','🔑','🗝️','🎪','🎭','🎨'] },
  { category: 'Gestures', items: ['👍','✌️','🤙','👊','✊','🙌','👏','🤘','💪','🫶','🙏','🤞','☝️','👌'] },
];

const FONT_STYLES = [
  { name: 'Impact',           preview: 'Bold Impact', weight: 700 },
  { name: 'Dancing Script',   preview: 'Elegant Script', weight: 700 },
  { name: 'Oswald',           preview: 'Clean Condensed', weight: 700 },
  { name: 'Playfair Display', preview: 'Classic Serif', weight: 700 },
  { name: 'Lobster',          preview: 'Fun Retro', weight: 400 },
  { name: 'Montserrat',       preview: 'Modern Sans', weight: 700 },
];

export interface TextStylePreset {
  label: string;
  sampleText: string;
  font: string;
  size: number;
  weight: string | number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  italic?: boolean;
}

const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  { label: 'Bold Impact',   sampleText: 'YOUR TEXT', font: 'Impact',           size: 72, weight: 'bold', fill: '#1a1a1a' },
  { label: 'Varsity',       sampleText: 'VARSITY',   font: 'Oswald',           size: 64, weight: '700',  fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 3 },
  { label: 'Script',        sampleText: 'Your Text', font: 'Dancing Script',   size: 60, weight: '700',  fill: '#1a1a1a' },
  { label: 'Retro',         sampleText: 'RETRO',     font: 'Lobster',          size: 58, weight: '400',  fill: '#e74c3c' },
  { label: 'Classic',       sampleText: 'Classic',   font: 'Playfair Display', size: 56, weight: '700',  fill: '#2c3e50', italic: true },
  { label: 'Modern',        sampleText: 'MODERN',    font: 'Montserrat',       size: 60, weight: '700',  fill: '#0e7c61' },
  { label: 'Shadow',        sampleText: 'SHADOW',    font: 'Impact',           size: 68, weight: 'bold', fill: '#ffffff', stroke: '#333333', strokeWidth: 2 },
  { label: 'Handwritten',   sampleText: 'Handwrite', font: 'Permanent Marker', size: 50, weight: '400',  fill: '#1a1a1a' },
];

const SVG_VECTOR_SETS = [
  {
    category: 'Stars & Bursts',
    items: [
      { label: '5-Point Star', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,4 L61.2,34.6 L93.7,35.8 L68.1,55.9 L77,87.2 L50,69 L23,87.2 L31.9,55.9 L6.3,35.8 L38.8,34.6 Z" fill="#FFD700" stroke="#E6B800" stroke-width="1"/></svg>` },
      { label: '4-Point Star', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,4 L61,39 L96,50 L61,61 L50,96 L39,61 L4,50 L39,39 Z" fill="#FFD700" stroke="#E6B800" stroke-width="1"/></svg>` },
      { label: '6-Point Star', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,4 L63,27 L90,27 L77,50 L90,73 L63,73 L50,96 L37,73 L10,73 L23,50 L10,27 L37,27 Z" fill="#FFD700" stroke="#E6B800" stroke-width="1"/></svg>` },
      { label: 'Starburst',    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,5 L53,37 L68,10 L62,42 L88,26 L72,54 L97,52 L76,70 L95,82 L72,83 L80,97 L58,86 L54,100 L46,86 L24,97 L32,83 L9,82 L28,70 L7,52 L32,54 L16,26 L42,42 L36,10 L51,37 Z" fill="#FFD700" stroke="#E6B800" stroke-width="0.5"/></svg>` },
      { label: 'Lightning',    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M60,5 L28,55 L52,55 L38,95 L78,40 L54,40 Z" fill="#FFD700" stroke="#E6B800" stroke-width="1"/></svg>` },
      { label: 'Sun',          svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="22" fill="#FFD700" stroke="#E6B800" stroke-width="1"/><line x1="50" y1="3" x2="50" y2="19" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="50" y1="81" x2="50" y2="97" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="3" y1="50" x2="19" y2="50" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="81" y1="50" x2="97" y2="50" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="17" y1="17" x2="29" y2="29" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="71" y1="71" x2="83" y2="83" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="83" y1="17" x2="71" y2="29" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/><line x1="17" y1="83" x2="29" y2="71" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/></svg>` },
    ],
  },
  {
    category: 'Arrows',
    items: [
      { label: 'Right Arrow',   svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M5,40 L62,40 L62,22 L95,50 L62,78 L62,60 L5,60 Z" fill="#0E7C61" stroke="#0a5c48" stroke-width="1"/></svg>` },
      { label: 'Left Arrow',    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M95,40 L38,40 L38,22 L5,50 L38,78 L38,60 L95,60 Z" fill="#0E7C61" stroke="#0a5c48" stroke-width="1"/></svg>` },
      { label: 'Up Arrow',      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M40,95 L40,38 L22,38 L50,5 L78,38 L60,38 L60,95 Z" fill="#0E7C61" stroke="#0a5c48" stroke-width="1"/></svg>` },
      { label: 'Double Arrow',  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M5,50 L28,28 L28,42 L72,42 L72,28 L95,50 L72,72 L72,58 L28,58 L28,72 Z" fill="#0E7C61" stroke="#0a5c48" stroke-width="1"/></svg>` },
      { label: 'Curved Arrow',  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M15,65 Q15,20 65,20 L65,8 L90,28 L65,48 L65,36 Q30,36 30,65 Z" fill="#0E7C61" stroke="#0a5c48" stroke-width="1"/></svg>` },
      { label: 'Circle Arrow',  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,10 A40,40 0 1,1 10,50 L10,35 L25,50 L10,65 L10,50 A40,40 0 1,0 50,10 Z" fill="#0E7C61" stroke="#0a5c48" stroke-width="1"/></svg>` },
    ],
  },
  {
    category: 'Shapes & Icons',
    items: [
      { label: 'Heart',     svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,82 C25,68 5,53 5,35 C5,22 14,13 26,13 C34,13 42,18 50,27 C58,18 66,13 74,13 C86,13 95,22 95,35 C95,53 75,68 50,82 Z" fill="#e74c3c" stroke="#c0392b" stroke-width="1"/></svg>` },
      { label: 'Crown',     svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10,75 L10,42 L25,62 L50,15 L75,62 L90,42 L90,75 Z" fill="#FFD700" stroke="#E6B800" stroke-width="1.5"/><rect x="8" y="75" width="84" height="12" rx="2" fill="#FFD700" stroke="#E6B800" stroke-width="1"/></svg>` },
      { label: 'Shield',    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,5 L90,22 L90,52 C90,73 70,88 50,97 C30,88 10,73 10,52 L10,22 Z" fill="#0E7C61" stroke="#0a5c48" stroke-width="1"/></svg>` },
      { label: 'Diamond',   svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,4 L94,50 L50,96 L6,50 Z" fill="#00bcd4" stroke="#0097a7" stroke-width="1"/></svg>` },
      { label: 'Hexagon',   svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,4 L93,27 L93,73 L50,96 L7,73 L7,27 Z" fill="#9c27b0" stroke="#7b1fa2" stroke-width="1"/></svg>` },
      { label: 'Pentagon',  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,4 L96,38 L78,92 L22,92 L4,38 Z" fill="#ff9800" stroke="#f57c00" stroke-width="1"/></svg>` },
    ],
  },
  {
    category: 'Badges & Frames',
    items: [
      { label: 'Badge',        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#0E7C61" stroke-width="4"/><circle cx="50" cy="50" r="38" fill="none" stroke="#0E7C61" stroke-width="1.5" stroke-dasharray="4 3"/></svg>` },
      { label: 'Label Tag',    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M8,20 L72,20 L92,50 L72,80 L8,80 Z" fill="none" stroke="#0E7C61" stroke-width="3" rx="3"/><circle cx="22" cy="50" r="6" fill="#0E7C61"/></svg>` },
      { label: 'Ribbon',       svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="5" y="35" width="90" height="30" rx="3" fill="#0E7C61" stroke="#0a5c48" stroke-width="1"/><path d="M5,35 L20,20 L5,35 Z" fill="#0a5c48"/><path d="M95,35 L80,20 L95,35 Z" fill="#0a5c48"/><path d="M5,65 L20,80 L5,65 Z" fill="#0a5c48"/><path d="M95,65 L80,80 L95,65 Z" fill="#0a5c48"/></svg>` },
      { label: 'Check Badge',  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#0E7C61"/><path d="M28,52 L44,68 L74,35" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
      { label: 'Oval Frame',   svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="46" ry="36" fill="none" stroke="#0E7C61" stroke-width="3"/><ellipse cx="50" cy="50" rx="40" ry="30" fill="none" stroke="#0E7C61" stroke-width="1" stroke-dasharray="3 3"/></svg>` },
      { label: 'Rect Frame',   svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" rx="4" fill="none" stroke="#0E7C61" stroke-width="3"/><rect x="12" y="12" width="76" height="76" rx="2" fill="none" stroke="#0E7C61" stroke-width="1" stroke-dasharray="3 3"/></svg>` },
    ],
  },
];

interface PriceResult {
  originalPrice: number;
  finalPrice: number;
  discountPercent: number;
}

interface LeftPanelProps {
  activeTab: TabId | null;
  onTabChange: (tab: TabId | null) => void;

  // Product info
  productName?: string;
  colors: { name: string; hex: string }[];
  activeColorHex: string;
  onSwitchColor: (hex: string, name: string) => void;
  selectedSize?: string;
  quantity: number;
  onQuantityChange: (q: number) => void;
  price: PriceResult | null;
  productBasePrice: number;
  onAddToCart: () => void;
  onPreview: () => void;
  selectedSides: PrintSide[];
  pocketPrintEnabled: boolean;
  activePrintSize: PrintSize;

  // Canvas tools
  onAddText: () => void;
  onAddImage: (file: File) => void;
  onAddShape: (type: ShapeType) => void;
  onAddTextStyle?: (preset: TextStylePreset) => void;
  onAddSvgVector?: (svgStr: string) => void;
  onRemoveBg?: () => Promise<void>;
  onDelete: () => void;
  onDuplicate: () => void;
  onCenter: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onToggleLock: () => void;
  isLocked: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;

  // Layers
  layers: fabric.FabricObject[];
  selectedObj: fabric.FabricObject | null;
  onSelectLayer: (obj: fabric.FabricObject) => void;
  onRemoveLayer: (obj: fabric.FabricObject) => void;
  onToggleVisibility: (obj: fabric.FabricObject) => void;

  // Text / font apply
  canvas: fabric.Canvas | null;
  onUpdateProp: (prop: string, value: unknown) => void;

  // Extras
  templates?: Record<string, MockupTemplate>;
  activeProductType?: string;
  onSwitchType?: (type: string) => void;
  uploadEnabled?: boolean;
  extraClassName?: string;
}

export default function LeftPanel({
  activeTab, onTabChange,
  productName, colors, activeColorHex, onSwitchColor, selectedSize,
  quantity, onQuantityChange, price, productBasePrice, onAddToCart, onPreview,
  selectedSides, pocketPrintEnabled, activePrintSize,
  onAddText, onAddImage, onAddShape,
  onAddTextStyle, onAddSvgVector, onRemoveBg,
  onDelete, onDuplicate, onCenter, onFlipH, onFlipV, onToggleLock, isLocked,
  onZoomIn, onZoomOut, onResetView,
  layers, selectedObj, onSelectLayer, onRemoveLayer, onToggleVisibility,
  canvas, onUpdateProp,
  templates, activeProductType, onSwitchType,
  uploadEnabled = true,
  extraClassName = '',
}: LeftPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fontSearch, setFontSearch] = useState('');
  const [bgRemoving, setBgRemoving] = useState(false);
  const isText = selectedObj instanceof fabric.IText;
  const isImage = selectedObj instanceof fabric.FabricImage;

  const displayPrice = price ?? (productBasePrice > 0
    ? { finalPrice: productBasePrice * quantity, originalPrice: productBasePrice * quantity, discountPercent: 0 }
    : null);

  const applyFont = (fontName: string) => {
    if (canvas && isText) {
      (selectedObj as fabric.IText).set('fontFamily', fontName);
      canvas.requestRenderAll();
      onUpdateProp('fontFamily', fontName);
    }
  };

  const addEmoji = (emoji: string) => {
    if (!canvas) return;
    const t = new fabric.IText(emoji, {
      left: 400, top: 300, originX: 'center', originY: 'center',
      fontSize: 60, fontFamily: 'Arial',
    });
    (t as any).customId = crypto.randomUUID();
    (t as any).layerName = `Emoji ${emoji}`;
    (t as any).printZone = 'body';
    canvas.add(t); canvas.setActiveObject(t); canvas.requestRenderAll();
  };

  const handleRemoveBgClick = async () => {
    if (!onRemoveBg) return;
    setBgRemoving(true);
    try { await onRemoveBg(); } finally { setBgRemoving(false); }
  };

  const filteredFonts = STUDIO_FONTS.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase()));
  const templateEntries = Object.entries(templates ?? {});
  const showProductGrid = templateEntries.length > 1;

  return (
    <div className={`lp-wrap${extraClassName ? ' ' + extraClassName : ''}`}>
      {/* ── Icon Nav Strip ── */}
      <nav className="lp-nav">
        {NAV_TABS.map(({ id, Icon, label }) => (
          <button
            key={id}
            className={`lp-nav-btn${activeTab === id ? ' active' : ''}`}
            onClick={() => onTabChange(activeTab === id ? null : id)}
            title={label}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Content Panel ── */}
      <div className={`lp-panel${activeTab ? ' open' : ''}`}>
        {/* ─── PRODUCT TAB ─── */}
        {activeTab === 'product' && (
          <div className="lp-content">
            <div className="lp-section-head">Product Information</div>

            {productName && (
              <div className="lp-product-name">
                <div className="lp-product-thumb">
                  <Package size={24} />
                </div>
                <div>
                  <p className="lp-product-title">{productName}</p>
                  {selectedSize && <p className="lp-product-meta">Size: <strong>{selectedSize}</strong></p>}
                </div>
              </div>
            )}

            {/* Product selector when multiple templates */}
            {showProductGrid && (
              <div className="lp-subsection">
                <p className="lp-sub-label">Select Product</p>
                <div className="lp-product-grid">
                  {templateEntries.map(([key, t]) => (
                    <button
                      key={key}
                      className={`lp-product-btn${activeProductType === key ? ' active' : ''}`}
                      onClick={() => onSwitchType?.(key)}
                      title={t.label}
                    >
                      <span className="lp-product-icon" dangerouslySetInnerHTML={{ __html: t.icon }} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Printing Options */}
            <div className="lp-subsection">
              <p className="lp-sub-label">Printing Options</p>
              <div className="lp-print-methods">
                {['DTG', 'DTF', 'Embroidery'].map(m => (
                  <span key={m} className="lp-print-chip">{m}</span>
                ))}
              </div>
            </div>

            {/* Colors */}
            {colors.length > 0 && (
              <div className="lp-subsection">
                <p className="lp-sub-label">Available Colors</p>
                <div className="lp-colors">
                  {colors.map(c => (
                    <button
                      key={c.hex}
                      className={`lp-color${activeColorHex === c.hex ? ' active' : ''}`}
                      style={{ background: c.hex, border: c.hex === '#ffffff' ? '2px solid var(--border)' : '2px solid transparent' }}
                      title={c.name}
                      onClick={() => onSwitchColor(c.hex, c.name)}
                    >
                      {activeColorHex === c.hex && <Check size={11} color={c.hex === '#ffffff' ? '#333' : '#fff'} />}
                    </button>
                  ))}
                </div>
                <p className="lp-color-name">{colors.find(c => c.hex === activeColorHex)?.name || ''}</p>
              </div>
            )}

            {/* Quantity */}
            <div className="lp-subsection">
              <p className="lp-sub-label">Quantity</p>
              <div className="lp-qty-row">
                <button className="lp-qty-btn" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}><Minus size={14} /></button>
                <span className="lp-qty-val">{quantity}</span>
                <button className="lp-qty-btn" onClick={() => onQuantityChange(Math.min(999, quantity + 1))}><Plus size={14} /></button>
              </div>
              {quantity >= 3 && (
                <p className="lp-discount-hint">
                  {quantity >= 10 ? '🎉 15% bulk discount applied!' : quantity >= 5 ? '🎉 10% bulk discount applied!' : '🎉 5% discount for 3+ pieces!'}
                </p>
              )}
            </div>

            {/* Price + CTA */}
            <div className="lp-order">
              {selectedSides.length > 0 && (
                <p className="lp-print-info">{selectedSides.join(' + ')} print{pocketPrintEnabled ? ' + Pocket' : ''} · {activePrintSize}</p>
              )}
              {displayPrice && (
                <div className="lp-price-row">
                  <span className="lp-price">₹{displayPrice.finalPrice.toLocaleString()}</span>
                  {displayPrice.discountPercent > 0 && (
                    <span className="lp-price-original">₹{displayPrice.originalPrice.toLocaleString()}</span>
                  )}
                </div>
              )}
              <div className="lp-cta-row">
                <button className="lp-preview-btn" onClick={onPreview}>Preview</button>
                <button className="lp-cart-btn" onClick={onAddToCart}>Add to Cart</button>
              </div>
              <p className="lp-delivery-hint">3–5 day delivery · Free shipping ₹999+</p>
            </div>
          </div>
        )}

        {/* ─── LAYERS TAB ─── */}
        {activeTab === 'layers' && (
          <div className="lp-content">
            <div className="lp-section-head">Layers ({layers.length})</div>
            <div className="lp-layer-list">
              {layers.length === 0 ? (
                <div className="lp-empty">
                  <LayersIcon size={28} opacity={0.25} />
                  <p>No layers yet</p>
                  <p>Add text, images or shapes</p>
                </div>
              ) : (
                [...layers].reverse().map((obj, i) => (
                  <div
                    key={i}
                    className={`lp-layer-item${selectedObj === obj ? ' selected' : ''}`}
                    onClick={() => onSelectLayer(obj)}
                  >
                    <span className="lp-layer-thumb">
                      {obj.type === 'i-text' ? <Type size={13} /> : <ImageUp size={13} />}
                    </span>
                    <span className="lp-layer-name">
                      {(obj as any).layerName || obj.type || 'Object'}
                    </span>
                    <button className="lp-layer-vis" onClick={e => { e.stopPropagation(); onToggleVisibility(obj); }} title={obj.visible !== false ? 'Hide' : 'Show'}>
                      {obj.visible !== false ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button className="lp-layer-del" onClick={e => { e.stopPropagation(); onRemoveLayer(obj); }} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Quick actions */}
            {selectedObj && (
              <div className="lp-subsection">
                <p className="lp-sub-label">Actions</p>
                <div className="lp-icon-grid">
                  <button className="lp-icon-btn danger" onClick={onDelete} title="Delete"><Trash2 size={15} /></button>
                  <button className="lp-icon-btn" onClick={onDuplicate} title="Duplicate"><Copy size={15} /></button>
                  <button className="lp-icon-btn" onClick={onCenter} title="Center"><AlignCenter size={15} /></button>
                  <button className="lp-icon-btn" onClick={onFlipH} title="Flip H"><FlipHorizontal2 size={15} /></button>
                  <button className="lp-icon-btn" onClick={onFlipV} title="Flip V"><FlipVertical2 size={15} /></button>
                  <button className={`lp-icon-btn${isLocked ? ' active' : ''}`} onClick={onToggleLock} title={isLocked ? 'Unlock' : 'Lock'}>
                    {isLocked ? <Lock size={15} /> : <LockOpen size={15} />}
                  </button>
                </div>
              </div>
            )}

            {/* Zoom */}
            <div className="lp-subsection">
              <p className="lp-sub-label">Zoom</p>
              <div className="lp-zoom-row">
                <button className="lp-icon-btn" onClick={onZoomOut} title="Zoom Out"><ZoomOut size={15} /></button>
                <button className="lp-icon-btn" onClick={onResetView} title="Reset"><RefreshCcw size={15} /></button>
                <button className="lp-icon-btn" onClick={onZoomIn} title="Zoom In"><ZoomIn size={15} /></button>
              </div>
            </div>
          </div>
        )}

        {/* ─── UPLOADS TAB ─── */}
        {activeTab === 'uploads' && (
          <div className="lp-content">
            <div className="lp-section-head">Upload Your Design</div>

            {uploadEnabled ? (
              <>
                <button className="lp-upload-card" onClick={() => fileRef.current?.click()}>
                  <ImageUp size={24} />
                  <span className="lp-upload-label">Drop files here or Click to Upload</span>
                  <span className="lp-upload-hint">PNG, JPG up to 25MB</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { onAddImage(f); e.target.value = ''; }
                  }}
                />
              </>
            ) : (
              <div className="lp-disabled-msg">Uploads are currently disabled</div>
            )}

            {/* Remove Background — visible when an image is selected */}
            {isImage && onRemoveBg && (
              <button
                className="lp-bg-remove-btn"
                onClick={handleRemoveBgClick}
                disabled={bgRemoving}
              >
                <Wand2 size={15} />
                {bgRemoving ? 'Removing background…' : 'Remove Background'}
              </button>
            )}

            {/* Shapes */}
            <div className="lp-subsection" style={{ marginTop: 16 }}>
              <p className="lp-sub-label">Basic Shapes</p>
              <div className="lp-shape-grid">
                <button className="lp-shape-btn" onClick={() => onAddShape('rect')} title="Rectangle"><Square size={18} /></button>
                <button className="lp-shape-btn" onClick={() => onAddShape('circle')} title="Circle"><Circle size={18} /></button>
                <button className="lp-shape-btn" onClick={() => onAddShape('triangle')} title="Triangle"><Triangle size={18} /></button>
                <button className="lp-shape-btn" onClick={() => onAddShape('line')} title="Line"><Minus size={18} /></button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TEXT TAB ─── */}
        {activeTab === 'text' && (
          <div className="lp-content">
            <div className="lp-section-head">Add Text</div>

            <button className="lp-add-text-btn" onClick={onAddText}>
              <Type size={16} />
              Add Text to Design
            </button>

            {/* Text Style Presets */}
            <div className="lp-subsection">
              <p className="lp-sub-label">Text Styles</p>
              <div className="lp-text-styles-grid">
                {TEXT_STYLE_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    className="lp-text-style-preset"
                    title={`Add ${preset.label} style`}
                    onClick={() => onAddTextStyle?.(preset)}
                  >
                    <span
                      className="lp-text-style-preview"
                      style={{
                        fontFamily: `"${preset.font}", sans-serif`,
                        fontWeight: preset.weight as any,
                        fontStyle: preset.italic ? 'italic' : 'normal',
                        color: preset.fill === '#ffffff' ? '#0E7C61' : preset.fill,
                        WebkitTextStroke: preset.stroke ? `1px ${preset.stroke}` : undefined,
                      }}
                    >
                      {preset.sampleText}
                    </span>
                    <span className="lp-text-style-label">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Text controls — only when a text object is selected */}
            {isText && (
              <>
                <div className="lp-subsection">
                  <p className="lp-sub-label">Style</p>
                  <div className="lp-text-style-row">
                    <button
                      className={`lp-style-btn${(selectedObj as fabric.IText).fontWeight === 'bold' ? ' active' : ''}`}
                      onClick={() => onUpdateProp('fontWeight', (selectedObj as fabric.IText).fontWeight === 'bold' ? 'normal' : 'bold')}
                      title="Bold"
                    ><Bold size={14} /></button>
                    <button
                      className={`lp-style-btn${(selectedObj as fabric.IText).fontStyle === 'italic' ? ' active' : ''}`}
                      onClick={() => onUpdateProp('fontStyle', (selectedObj as fabric.IText).fontStyle === 'italic' ? 'normal' : 'italic')}
                      title="Italic"
                    ><Italic size={14} /></button>
                    <button
                      className={`lp-style-btn${(selectedObj as fabric.IText).underline ? ' active' : ''}`}
                      onClick={() => onUpdateProp('underline', !(selectedObj as fabric.IText).underline)}
                      title="Underline"
                    ><Underline size={14} /></button>
                    <div className="lp-color-swatch-wrap">
                      <input
                        type="color"
                        value={String((selectedObj as fabric.IText).fill || '#000000')}
                        onChange={e => onUpdateProp('fill', e.target.value)}
                        title="Text Color"
                        className="lp-text-color"
                      />
                    </div>
                  </div>

                  <div className="lp-text-row">
                    <span className="lp-prop-label">Size</span>
                    <input
                      type="number"
                      className="lp-prop-input"
                      value={Math.round((selectedObj as fabric.IText).fontSize || 36)}
                      onChange={e => onUpdateProp('fontSize', +e.target.value)}
                    />
                    <span className="lp-prop-label">Spacing</span>
                    <input
                      type="number"
                      className="lp-prop-input"
                      value={Math.round((selectedObj as fabric.IText).charSpacing || 0)}
                      onChange={e => onUpdateProp('charSpacing', +e.target.value)}
                    />
                  </div>
                </div>

                {/* Preset font styles */}
                <div className="lp-subsection">
                  <p className="lp-sub-label">Font Style</p>
                  <div className="lp-font-style-grid">
                    {FONT_STYLES.map(fs => (
                      <button
                        key={fs.name}
                        className={`lp-font-style-btn${(selectedObj as fabric.IText).fontFamily === fs.name ? ' active' : ''}`}
                        onClick={() => applyFont(fs.name)}
                        style={{ fontFamily: `"${fs.name}", sans-serif`, fontWeight: fs.weight }}
                      >
                        {fs.preview}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Font picker */}
            <div className="lp-subsection">
              <p className="lp-sub-label">Discover Fonts</p>
              <div className="lp-search-row">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search Font"
                  value={fontSearch}
                  onChange={e => setFontSearch(e.target.value)}
                  className="lp-search-input"
                />
              </div>
              <div className="lp-font-list">
                {filteredFonts.map(font => (
                  <button
                    key={font}
                    className={`lp-font-item${isText && (selectedObj as fabric.IText).fontFamily === font ? ' active' : ''}`}
                    onClick={() => applyFont(font)}
                    style={{ fontFamily: `"${font}", sans-serif` }}
                  >
                    {font}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── GRAPHICS TAB ─── */}
        {activeTab === 'graphics' && (
          <div className="lp-content">
            <div className="lp-section-head">Graphics Kit</div>

            {/* SVG Vector graphics */}
            {SVG_VECTOR_SETS.map(set => (
              <div key={set.category} className="lp-subsection">
                <p className="lp-sub-label">{set.category}</p>
                <div className="lp-vector-grid">
                  {set.items.map(item => (
                    <button
                      key={item.label}
                      className="lp-vector-btn"
                      onClick={() => onAddSvgVector?.(item.svg)}
                      title={item.label}
                      dangerouslySetInnerHTML={{ __html: item.svg }}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Emoji */}
            {EMOJI_SETS.map(set => (
              <div key={set.category} className="lp-subsection">
                <p className="lp-sub-label">{set.category}</p>
                <div className="lp-emoji-grid">
                  {set.items.map(emoji => (
                    <button
                      key={emoji}
                      className="lp-emoji-btn"
                      onClick={() => addEmoji(emoji)}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Basic shapes */}
            <div className="lp-subsection">
              <p className="lp-sub-label">Shapes</p>
              <div className="lp-shape-grid">
                <button className="lp-shape-btn" onClick={() => onAddShape('rect')} title="Rectangle"><Square size={18} /></button>
                <button className="lp-shape-btn" onClick={() => onAddShape('circle')} title="Circle"><Circle size={18} /></button>
                <button className="lp-shape-btn" onClick={() => onAddShape('triangle')} title="Triangle"><Triangle size={18} /></button>
                <button className="lp-shape-btn" onClick={() => onAddShape('line')} title="Line"><Minus size={18} /></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
