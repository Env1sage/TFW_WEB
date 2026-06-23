import { Eye, ShoppingCart } from 'lucide-react';
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
  productBasePrice?: number;
  onQuantityChange: (q: number) => void;
  onAddToCart: () => void;
  onPreview: () => void;
  activeColorName: string;
  activePrintSize: PrintSize;
  pocketPrintEnabled: boolean;
}

export default function BottomBar({
  selectedSides, quantity, price, productBasePrice = 0, onQuantityChange,
  onAddToCart, onPreview, activeColorName, activePrintSize, pocketPrintEnabled,
}: BottomBarProps) {
  const displayPrice = price ?? (productBasePrice > 0
    ? { finalPrice: productBasePrice * quantity, originalPrice: productBasePrice * quantity, discountPercent: 0 }
    : null);
  return (
    <div className="bottom-bar">
      <div className="bottom-left">
        <div className="bottom-info">
          <strong>{selectedSides.length > 0 ? selectedSides.join(' + ') : 'No print'}</strong>
          <span className="dot-sep" />
          <span>{activeColorName}</span>
          <span className="dot-sep" />
          <span style={{ textTransform: 'capitalize' }}>{activePrintSize}{pocketPrintEnabled ? ' + Pocket' : ''}</span>
        </div>
      </div>

      <div className="bottom-center">
        <span className="qty-label">QTY</span>
        <button className="qty-btn" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button>
        <input
          className="qty-input"
          type="number"
          min={1}
          max={999}
          value={quantity}
          onChange={e => onQuantityChange(Math.max(1, +e.target.value || 1))}
        />
        <button className="qty-btn" onClick={() => onQuantityChange(Math.min(999, quantity + 1))}>+</button>
      </div>

      <div className="bottom-right">
        {displayPrice && (
          <div className="price-display">
            <span className="price-final">₹{displayPrice.finalPrice.toLocaleString()}</span>
            {displayPrice.discountPercent > 0 && (
              <>
                <span className="price-original">₹{displayPrice.originalPrice.toLocaleString()}</span>
                <span className="price-discount">-{displayPrice.discountPercent}%</span>
              </>
            )}
          </div>
        )}
        <button className="ds-preview-btn" onClick={onPreview} title="Preview">
          <Eye size={15} />
          Preview
        </button>
        <button className="ds-cart-btn" onClick={onAddToCart}>
          <ShoppingCart size={16} />
          Add to Cart
        </button>
      </div>
    </div>
  );
}
