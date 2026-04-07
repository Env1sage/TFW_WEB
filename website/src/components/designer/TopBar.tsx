import { Link } from 'react-router-dom';
import type { PrintSide, PrintSize, PrintSizeOption, PrintLayout } from '../../mockups';

interface TopBarProps {
  activeSide: PrintSide;
  selectedSides: PrintSide[];
  sides: PrintSide[];
  colors: { name: string; hex: string }[];
  activeColorHex: string;
  saveStatus: 'saved' | 'saving' | 'error';
  onToggleSide: (side: PrintSide) => void;
  onSwitchColor: (hex: string, name: string) => void;
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
  // Layout mode (generic named zones)
  layouts?: PrintLayout[];
  selectedLayoutIds?: string[];
  activeEditingLayoutId?: string | null;
  allowMultipleLayouts?: boolean;
  onToggleLayout?: (id: string) => void;
}

const LAYOUT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#e879f9', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

export default function TopBar({
  activeSide, selectedSides, sides, colors, activeColorHex,
  saveStatus, onToggleSide, onSwitchColor, onUndo, onRedo,
  activePrintSize, printSizes, onSwitchPrintSize,
  pocketPrintEnabled, onTogglePocketPrint, editingPocket, onDisablePocket, showPocketToggle,
  layouts = [], selectedLayoutIds = [], activeEditingLayoutId, allowMultipleLayouts, onToggleLayout,
}: TopBarProps) {
  const hasLayouts = layouts.length > 0;

  return (
    <div className="topbar">
      <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>TFW Studio</Link>
      <span className="sep" />

      {/* Side pills */}
      <div className="pill-group">
        {sides.map(s => (
          <button key={s} className={`pill ${activeSide === s ? 'active' : ''}`} onClick={() => onToggleSide(s)}>
            {selectedSides.includes(s) && <span className="check">&#10003;</span>}
            {s}
          </button>
        ))}
      </div>

      <span className="sep" />

      {/* Print zone pills — layout mode or legacy size mode */}
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
                  className={`pill layout-pill ${isEditing ? 'active' : isSelected ? 'enabled' : ''}`}
                  style={isEditing ? { borderColor: color } : isSelected ? { borderColor: color + '88' } : undefined}
                  onClick={() => onToggleLayout?.(layout.id)}
                  title={allowMultipleLayouts ? 'Click to select · multiple zones allowed' : 'Click to edit this print zone'}
                >
                  <span className="layout-pill-dot" style={{ background: color }} />
                  {isSelected && <span className="check">&#10003;</span>}
                  {layout.name}
                </button>
              );
            })}
            {allowMultipleLayouts && (
              <span className="pill-hint" title="Multiple layouts per order are allowed">multi</span>
            )}
          </>
        ) : (
          <>
            {printSizes.map(ps => (
              <button key={ps.id} className={`pill ${activePrintSize === ps.id && !editingPocket ? 'active' : ''}`}
                onClick={() => onSwitchPrintSize(ps.id)} title={ps.inchLabel}>
                {ps.label}
              </button>
            ))}
            {showPocketToggle && (
              <button
                className={`pill ${pocketPrintEnabled ? (editingPocket ? 'active' : 'enabled') : ''}`}
                onClick={onTogglePocketPrint}
                onContextMenu={(e) => { e.preventDefault(); if (pocketPrintEnabled) onDisablePocket(); }}
                title={pocketPrintEnabled
                  ? (editingPocket ? 'Click body size to switch back · Right-click to remove pocket' : 'Click to edit pocket area · Right-click to remove')
                  : '3 × 3 in — add a pocket print alongside body print'}
              >
                {pocketPrintEnabled && <span className="check">&#10003;</span>}
                Pocket Print
              </button>
            )}
          </>
        )}
      </div>

      <span className="sep" />

      {/* Color swatches */}
      <div className="color-row">
        {colors.map(c => (
          <div key={c.hex}
            className={`color-sw ${activeColorHex === c.hex ? 'active' : ''}`}
            style={{ background: c.hex, border: c.hex === '#ffffff' ? '2px solid #ddd' : undefined }}
            title={c.name} onClick={() => onSwitchColor(c.hex, c.name)} />
        ))}
      </div>

      <div className="topbar-actions">
        <div className="save-indicator">
          <span className={`save-dot ${saveStatus}`} />
          {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Error'}
        </div>
        <button className="icon-btn" onClick={onUndo} title="Undo (Ctrl+Z)">&#8617;</button>
        <button className="icon-btn" onClick={onRedo} title="Redo (Ctrl+Y)">&#8618;</button>
      </div>
    </div>
  );
}
