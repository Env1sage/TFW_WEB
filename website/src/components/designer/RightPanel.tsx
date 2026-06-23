import * as fabric from 'fabric';
import { Sliders, ShoppingCart, Eye, Minus, Plus, Check } from 'lucide-react';
import type { PrintSide, PrintSize } from '../../mockups';

interface PriceResult {
  originalPrice: number;
  finalPrice: number;
  discountPercent: number;
}

interface RightPanelProps {
  selectedObj: fabric.FabricObject | null;
  onUpdateProp: (prop: string, value: unknown) => void;
  canvas: fabric.Canvas | null;
  extraClassName?: string;
  productName?: string;
  colors: { name: string; hex: string }[];
  activeColorHex: string;
  activeColorName: string;
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
}

const FONTS = [
  'Arial', 'Georgia', 'Courier New', 'Impact', 'Trebuchet MS',
  'Verdana', 'Times New Roman', 'Palatino', 'Comic Sans MS',
];

export default function RightPanel({
  selectedObj, onUpdateProp,
  extraClassName = '',
  productName, colors, activeColorHex, activeColorName, onSwitchColor, selectedSize,
  quantity, onQuantityChange, price, productBasePrice, onAddToCart, onPreview,
  selectedSides, pocketPrintEnabled, activePrintSize,
}: RightPanelProps) {
  const isText = selectedObj instanceof fabric.IText;

  const displayPrice = price ?? (productBasePrice > 0
    ? { finalPrice: productBasePrice * quantity, originalPrice: productBasePrice * quantity, discountPercent: 0 }
    : null);

  return (
    <div className={`right-panel${extraClassName ? ' ' + extraClassName : ''}`}>
      <div className="panel-drawer-handle" />

      <div className="ds-rp-scroll">
        {/* ── Product Info ── */}
        <div className="rpanel-section">
          <div className="rpanel-title">
            <Sliders size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
            Product
          </div>

          {productName && <div className="ds-rp-product-name">{productName}</div>}

          {colors.length > 0 && (
            <div className="ds-rp-color-row">
              <span className="ds-rp-color-label">
                Colour: <strong>{activeColorName}</strong>
              </span>
              <div className="ds-rp-swatches">
                {colors.map(c => (
                  <div
                    key={c.hex}
                    className={`ds-rp-swatch${activeColorHex === c.hex ? ' active' : ''}`}
                    style={{
                      background: c.hex,
                      border: c.hex === '#ffffff' ? '2px solid #ddd' : '2px solid transparent',
                    }}
                    title={c.name}
                    onClick={() => onSwitchColor(c.hex, c.name)}
                  >
                    {activeColorHex === c.hex && (
                      <Check size={9} color={c.hex === '#ffffff' ? '#333' : '#fff'} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedSize && (
            <div className="ds-rp-size-row">
              <span className="ds-rp-size-label">Size</span>
              <span className="ds-rp-size-badge">{selectedSize}</span>
            </div>
          )}
        </div>

        {/* ── Object Properties ── */}
        {selectedObj ? (
          <>
            <div className="rpanel-section">
              <div className="rpanel-title">
                <Sliders size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                Properties
              </div>
              <div className="prop-grid">
                <div className="prop-row">
                  <span className="prop-label">X</span>
                  <input className="prop-input" type="number" value={Math.round(selectedObj.left || 0)}
                    onChange={e => onUpdateProp('left', +e.target.value)} />
                  <span className="prop-label">Y</span>
                  <input className="prop-input" type="number" value={Math.round(selectedObj.top || 0)}
                    onChange={e => onUpdateProp('top', +e.target.value)} />
                </div>
                <div className="prop-row">
                  <span className="prop-label">W</span>
                  <input className="prop-input" type="number" value={Math.round(selectedObj.getScaledWidth())}
                    onChange={e => { const s = +e.target.value / (selectedObj.width || 1); onUpdateProp('scaleX', s); }} />
                  <span className="prop-label">H</span>
                  <input className="prop-input" type="number" value={Math.round(selectedObj.getScaledHeight())}
                    onChange={e => { const s = +e.target.value / (selectedObj.height || 1); onUpdateProp('scaleY', s); }} />
                </div>
                <div className="prop-row">
                  <span className="prop-label">Angle</span>
                  <input className="prop-input" type="number" value={Math.round(selectedObj.angle || 0)}
                    onChange={e => onUpdateProp('angle', +e.target.value)} />
                </div>
                <div className="prop-row">
                  <span className="prop-label">Opacity</span>
                  <input className="prop-range" type="range" min={0} max={1} step={0.05}
                    value={selectedObj.opacity ?? 1}
                    onChange={e => onUpdateProp('opacity', +e.target.value)} />
                </div>
              </div>
            </div>

            {/* Text styling */}
            {isText && (
              <div className="rpanel-section">
                <div className="rpanel-title">Text</div>
                <div className="prop-grid">
                  <div className="prop-row">
                    <span className="prop-label">Font</span>
                    <select className="prop-select" value={(selectedObj as fabric.IText).fontFamily || 'Arial'}
                      onChange={e => onUpdateProp('fontFamily', e.target.value)}>
                      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Size</span>
                    <input className="prop-input" type="number"
                      value={Math.round((selectedObj as fabric.IText).fontSize || 36)}
                      onChange={e => onUpdateProp('fontSize', +e.target.value)} />
                    <span className="prop-label">Color</span>
                    <input className="prop-color" type="color"
                      value={String((selectedObj as fabric.IText).fill || '#000000')}
                      onChange={e => onUpdateProp('fill', e.target.value)} />
                  </div>
                  <div className="prop-row style-row">
                    <button className={`style-btn ${(selectedObj as fabric.IText).fontWeight === 'bold' ? 'active' : ''}`}
                      onClick={() => onUpdateProp('fontWeight', (selectedObj as fabric.IText).fontWeight === 'bold' ? 'normal' : 'bold')}>
                      <b>B</b>
                    </button>
                    <button className={`style-btn ${(selectedObj as fabric.IText).fontStyle === 'italic' ? 'active' : ''}`}
                      onClick={() => onUpdateProp('fontStyle', (selectedObj as fabric.IText).fontStyle === 'italic' ? 'normal' : 'italic')}>
                      <i>I</i>
                    </button>
                    <button className={`style-btn ${(selectedObj as fabric.IText).underline ? 'active' : ''}`}
                      onClick={() => onUpdateProp('underline', !(selectedObj as fabric.IText).underline)}>
                      <u>U</u>
                    </button>
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Spacing</span>
                    <input className="prop-input" type="number"
                      value={Math.round((selectedObj as fabric.IText).charSpacing || 0)}
                      onChange={e => onUpdateProp('charSpacing', +e.target.value)} />
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Line H</span>
                    <input className="prop-input" type="number" step={0.1}
                      value={((selectedObj as fabric.IText).lineHeight || 1.16).toFixed(1)}
                      onChange={e => onUpdateProp('lineHeight', +e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="panel-empty">
            <Sliders size={24} style={{ opacity: 0.3 }} />
            Select an object to edit properties
          </div>
        )}
      </div>

      {/* ── Order Section (sticky bottom) ── */}
      <div className="ds-rp-order">
        {selectedSides.length > 0 && (
          <div className="ds-rp-print-info">
            {selectedSides.join(' + ')} print
            {pocketPrintEnabled ? ' + Pocket' : ''}
            {' · '}{activePrintSize}
          </div>
        )}

        <div className="ds-rp-qty-row">
          <span className="ds-rp-qty-label">Quantity</span>
          <div className="ds-rp-qty">
            <button className="qty-btn" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>
              <Minus size={13} />
            </button>
            <input
              className="qty-input"
              type="number"
              min={1}
              max={999}
              value={quantity}
              onChange={e => onQuantityChange(Math.max(1, +e.target.value || 1))}
            />
            <button className="qty-btn" onClick={() => onQuantityChange(Math.min(999, quantity + 1))}>
              <Plus size={13} />
            </button>
          </div>
        </div>

        {displayPrice && (
          <div className="ds-rp-price-row">
            <span className="ds-rp-price-final">₹{displayPrice.finalPrice.toLocaleString()}</span>
            {displayPrice.discountPercent > 0 && (
              <>
                <span className="ds-rp-price-original">₹{displayPrice.originalPrice.toLocaleString()}</span>
                <span className="ds-rp-price-discount">-{displayPrice.discountPercent}%</span>
              </>
            )}
          </div>
        )}

        <div className="ds-rp-cta">
          <button className="ds-rp-preview-btn" onClick={onPreview}>
            <Eye size={14} />
            Preview
          </button>
          <button className="ds-rp-cart-btn" onClick={onAddToCart}>
            <ShoppingCart size={16} />
            Add to Cart
          </button>
        </div>

        <p className="ds-rp-delivery">3–5 day delivery · Free shipping ₹999+</p>
      </div>
    </div>
  );
}
