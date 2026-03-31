import type { PrintSide, PrintSize } from '../../mockups';

interface PriceResult {
  originalPrice: number;
  finalPrice: number;
  discountPercent: number;
}

interface BottomBarProps {
  selectedSides: PrintSide[];
  quantity: number;
  price: PriceResult | null;
  onQuantityChange: (q: number) => void;
  onAddToCart: () => void;
  onPreview: () => void;
  activeColorName: string;
  activePrintSize: PrintSize;
  pocketPrintEnabled: boolean;
}

export default function BottomBar({
  selectedSides, quantity, price, onQuantityChange,
  onAddToCart, onPreview, activeColorName, activePrintSize, pocketPrintEnabled,
}: BottomBarProps) {
  return (
    <div className="bottom-bar">
      <div className="bottom-left">
        <div className="bottom-info">
          <strong>{selectedSides.join(' + ')}</strong>
          <span className="dot-sep" />
          <span>{activeColorName}</span>
          <span className="dot-sep" />
          <span style={{ textTransform: 'capitalize' }}>{activePrintSize}{pocketPrintEnabled ? ' + Pocket' : ''}</span>
        </div>
      </div>

      <div className="bottom-center">
        <span className="qty-label">QTY</span>
        <button className="qty-btn" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button>
        <input className="qty-input" type="number" min={1} max={999}
          value={quantity} onChange={e => onQuantityChange(Math.max(1, +e.target.value || 1))} />
        <button className="qty-btn" onClick={() => onQuantityChange(Math.min(999, quantity + 1))}>+</button>
      </div>

      <div className="bottom-right">
        {price && (
          <div className="price-display">
            <span className="price-final">₹{price.finalPrice.toLocaleString()}</span>
            {price.discountPercent > 0 && (
              <>
                <span className="price-original">₹{price.originalPrice.toLocaleString()}</span>
                <span className="price-discount">-{price.discountPercent}%</span>
              </>
            )}
          </div>
        )}
        <button className="preview-btn" onClick={onPreview}>&#128065; Preview</button>
        <button className="cart-btn" onClick={onAddToCart}>&#128722; Add to Cart</button>
      </div>
    </div>
  );
}
