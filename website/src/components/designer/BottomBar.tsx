import { ShoppingCart, ZoomIn, ZoomOut, RefreshCcw } from 'lucide-react';
import type { PrintSide, PrintSize } from '../../mockups';

interface PriceResult {
  originalPrice: number;
  finalPrice: number;
  discountPercent: number;
}

interface BottomBarProps {
  // Side navigation
  activeSide: PrintSide;
  sides: PrintSide[];
  selectedSides: PrintSide[];
  onToggleSide: (side: PrintSide) => void;
  // Zoom
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  // Order
  quantity: number;
  price: PriceResult | null;
  productBasePrice?: number;
  onAddToCart: () => void;
  onPreview: () => void;
  pocketPrintEnabled: boolean;
  activePrintSize: PrintSize;
}

export default function BottomBar({
  activeSide, sides, selectedSides, onToggleSide,
  onZoomIn, onZoomOut, onResetView,
  quantity, price, productBasePrice = 0, onAddToCart, onPreview,
  pocketPrintEnabled, activePrintSize,
}: BottomBarProps) {
  const displayPrice = price ?? (productBasePrice > 0
    ? { finalPrice: productBasePrice * quantity, originalPrice: productBasePrice * quantity, discountPercent: 0 }
    : null);

  return (
    <div className="bottom-bar">
      {/* Left: side tabs */}
      <div className="bb-sides">
        {sides.map(side => (
          <button
            key={side}
            className={`bb-side-tab${activeSide === side ? ' active' : ''}${selectedSides.includes(side) ? ' has-design' : ''}`}
            onClick={() => onToggleSide(side)}
          >
            {selectedSides.includes(side) && <span className="bb-side-dot" />}
            {side}
          </button>
        ))}
      </div>

      {/* Center: zoom controls */}
      <div className="bb-zoom">
        <button className="bb-zoom-btn" onClick={onZoomOut} title="Zoom Out"><ZoomOut size={14} /></button>
        <button className="bb-zoom-btn" onClick={onResetView} title="Reset"><RefreshCcw size={14} /></button>
        <button className="bb-zoom-btn" onClick={onZoomIn} title="Zoom In"><ZoomIn size={14} /></button>
      </div>

      {/* Right: price + cart */}
      <div className="bb-right">
        {displayPrice && (
          <div className="bb-price">
            <span className="bb-price-label">Total Price:</span>
            <span className="bb-price-val">₹{displayPrice.finalPrice.toLocaleString()}</span>
            {displayPrice.discountPercent > 0 && (
              <span className="bb-price-discount">-{displayPrice.discountPercent}%</span>
            )}
          </div>
        )}
        <button className="ds-cart-btn" onClick={onAddToCart}>
          <ShoppingCart size={16} />
          Add to Cart
        </button>
      </div>
    </div>
  );
}
