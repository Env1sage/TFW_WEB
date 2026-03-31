import type { PrintSide, PrintSize, PriceResult } from '../types';
import { PRINT_SIZES } from '../mockups';

interface Props {
  selectedSides: PrintSide[];
  quantity: number;
  price: PriceResult | null;
  onQuantityChange: (q: number) => void;
  onAddToCart: () => void;
  onPreview: () => void;
  activeColorName: string;
  activePrintSize: PrintSize;
}

export default function BottomBar({
  selectedSides, quantity, price,
  onQuantityChange, onAddToCart, onPreview, activeColorName, activePrintSize,
}: Props) {
  const sizeInfo = PRINT_SIZES.find((s) => s.id === activePrintSize);

  return (
    <div className="bottom-bar">
      <div className="bottom-left">
        <span className="bottom-info">
          <strong>{selectedSides.join(' + ')}</strong>
          <span className="dot-sep" />
          <strong>{activeColorName}</strong>
          <span className="dot-sep" />
          <strong>{sizeInfo?.label ?? activePrintSize}</strong>
        </span>
      </div>

      <div className="bottom-center">
        <label className="qty-label">Qty</label>
        <button className="qty-btn" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>-</button>
        <input type="number" className="qty-input" min={1} value={quantity}
          onChange={(e) => { const v = parseInt(e.target.value, 10); if (v > 0) onQuantityChange(v); }} />
        <button className="qty-btn" onClick={() => onQuantityChange(quantity + 1)}>+</button>
      </div>

      <div className="bottom-right">
        {price && (
          <div className="price-display">
            {price.discountPercentage > 0 && (
              <span className="price-original">&#8377;{price.subtotal.toFixed(0)}</span>
            )}
            <span className="price-final">&#8377;{price.finalPrice.toFixed(0)}</span>
            {price.discountPercentage > 0 && (
              <span className="price-discount">{price.discountPercentage}% off</span>
            )}
          </div>
        )}
        <button className="preview-btn" onClick={onPreview}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
          Preview
        </button>
        <button className="cart-btn" onClick={onAddToCart}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
          </svg>
          Add to Cart
        </button>
      </div>
    </div>
  );
}
