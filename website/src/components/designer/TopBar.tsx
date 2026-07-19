import { Link } from 'react-router-dom';
import { Undo2, Redo2, ChevronLeft, Eye, ShoppingCart } from 'lucide-react';
import type { PrintSide, PrintSize, PrintSizeOption, PrintLayout } from '../../mockups';

interface TopBarProps {
  activeSide: PrintSide;
  selectedSides: PrintSide[];
  sides: PrintSide[];
  saveStatus: 'saved' | 'saving' | 'error';
  onToggleSide: (side: PrintSide) => void;
  onUndo: () => void;
  onRedo: () => void;
  activePrintSize: PrintSize;
  printSizes: PrintSizeOption[];
  onSwitchPrintSize: (size: PrintSize) => void;
  pocketPrintEnabled: boolean;
  onTogglePocketPrint: () => void;
  editingPocket: boolean;
  onDisablePocket: () => void;
  showPocketToggle: boolean;
  layouts?: PrintLayout[];
  selectedLayoutIds?: string[];
  activeEditingLayoutId?: string | null;
  allowMultipleLayouts?: boolean;
  onToggleLayout?: (id: string) => void;
  productName?: string;
  onPreview: () => void;
  onAddToCart: () => void;
}

const LAYOUT_COLORS = ['#0E7C61','#C6A75E','#0A9B7A','#E07B30','#16A34A','#0891B2','#9A7C3A','#2D8A6E'];

export default function TopBar({
  activeSide, selectedSides, sides, saveStatus,
  onToggleSide, onUndo, onRedo,
  activePrintSize, printSizes, onSwitchPrintSize,
  pocketPrintEnabled, onTogglePocketPrint, editingPocket, onDisablePocket, showPocketToggle,
  layouts = [], selectedLayoutIds = [], activeEditingLayoutId, allowMultipleLayouts, onToggleLayout,
  productName, onPreview, onAddToCart,
}: TopBarProps) {
  const hasLayouts = layouts.length > 0;

  return (
    <div className="topbar">
      {/* Left: back + product name */}
      <div className="ds-topbar-left">
        <Link to="/design-studio" className="ds-back-btn" title="Back">
          <ChevronLeft size={18} />
        </Link>
        {productName && <span className="ds-product-label">{productName}</span>}
      </div>

      {/* Center: print zone / layout pills */}
      <div className="topbar-center">
        <div className="pill-group">
          {hasLayouts ? (
            <>
              {layouts.map((layout, idx) => {
                const isSelected = selectedLayoutIds.includes(layout.id);
                const isEditing = activeEditingLayoutId === layout.id;
                const color = LAYOUT_COLORS[idx % LAYOUT_COLORS.length];
                return (
                  <button
                    key={layout.id}
                    className={`pill layout-pill${isEditing ? ' active' : isSelected ? ' enabled' : ''}`}
                    style={isEditing ? { borderColor: color } : isSelected ? { borderColor: color + '88' } : undefined}
                    onClick={() => onToggleLayout?.(layout.id)}
                    title={layout.name}
                  >
                    <span className="layout-pill-dot" style={{ background: color }} />
                    {isSelected && <span className="check">✓</span>}
                    {layout.name}
                  </button>
                );
              })}
              {allowMultipleLayouts && <span className="pill-hint">multi</span>}
            </>
          ) : (
            <>
              {printSizes.map(ps => (
                <button
                  key={ps.id}
                  className={`pill${activePrintSize === ps.id && !editingPocket ? ' active' : ''}`}
                  onClick={() => onSwitchPrintSize(ps.id)}
                  title={ps.inchLabel}
                >
                  {ps.label}
                </button>
              ))}
              {showPocketToggle && (
                <button
                  className={`pill${pocketPrintEnabled ? (editingPocket ? ' active' : ' enabled') : ''}`}
                  onClick={onTogglePocketPrint}
                  onContextMenu={e => { e.preventDefault(); if (pocketPrintEnabled) onDisablePocket(); }}
                  title="Pocket print"
                >
                  {pocketPrintEnabled && <span className="check">✓</span>}
                  Pocket
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: undo/redo + save dot + preview + cart */}
      <div className="ds-topbar-right">
        <div className="topbar-actions">
          <button className="icon-btn" onClick={onUndo} title="Undo (Ctrl+Z)"><Undo2 size={15} /></button>
          <button className="icon-btn" onClick={onRedo} title="Redo (Ctrl+Y)"><Redo2 size={15} /></button>
          <span className={`save-dot ${saveStatus}`} title={saveStatus} />
        </div>
        <button className="ds-tb-preview-btn" onClick={onPreview} title="Preview">
          <Eye size={15} />
          <span>Preview</span>
        </button>
        <button className="ds-tb-cart-btn" onClick={onAddToCart}>
          <ShoppingCart size={15} />
          <span>Add to Cart</span>
        </button>
      </div>
    </div>
  );
}
