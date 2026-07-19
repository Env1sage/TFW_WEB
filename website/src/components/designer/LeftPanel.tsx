import { useState, useRef, useEffect } from 'react';
import * as fabric from 'fabric';
import {
  Package, Layers as LayersIcon, Upload, Type, Smile,
  ImageUp, Trash2, Copy, AlignCenter, FlipHorizontal2, FlipVertical2,
  Lock, LockOpen, Eye, EyeOff, Square, Circle, Triangle, Minus,
  ZoomIn, ZoomOut, RefreshCcw, Search, Bold, Italic, Underline,
  Plus, Check, Palette,
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
  extraClassName?: string; // mobile open
}

export default function LeftPanel({
  activeTab, onTabChange,
  productName, colors, activeColorHex, onSwitchColor, selectedSize,
  quantity, onQuantityChange, price, productBasePrice, onAddToCart, onPreview,
  selectedSides, pocketPrintEnabled, activePrintSize,
  onAddText, onAddImage, onAddShape,
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
  const isText = selectedObj instanceof fabric.IText;

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
