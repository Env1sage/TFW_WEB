import type { PrintSide, PrintSize, PrintSizeOption } from '../types';

interface Props {
  activeSide: PrintSide;
  selectedSides: PrintSide[];
  sides: PrintSide[];
  colors: { name: string; hex: string; id: string }[];
  activeColorHex: string;
  saveStatus: 'saved' | 'saving' | 'error';
  onToggleSide: (side: PrintSide) => void;
  onSwitchColor: (hex: string, name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  activePrintSize: PrintSize;
  printSizes: PrintSizeOption[];
  onSwitchPrintSize: (size: PrintSize) => void;
}

export default function TopBar({
  activeSide, selectedSides, sides, colors, activeColorHex,
  saveStatus, onToggleSide, onSwitchColor, onUndo, onRedo,
  activePrintSize, printSizes, onSwitchPrintSize,
}: Props) {
  return (
    <div className="topbar">
      <span className="logo">TheFramedWall</span>
      <div className="sep" />

      {/* Side switcher */}
      <div className="pill-group">
        {sides.map((side) => (
          <button
            key={side}
            className={`pill-btn ${activeSide === side ? 'active' : ''}`}
            onClick={() => onToggleSide(side)}
          >
            {side}
            {selectedSides.includes(side) && <span className="check-mark">&#10003;</span>}
          </button>
        ))}
      </div>
      <div className="sep" />

      {/* Print size selector */}
      <div className="pill-group size-pills">
        {printSizes.map((ps) => (
          <button
            key={ps.id}
            className={`pill-btn ${activePrintSize === ps.id ? 'active' : ''}`}
            onClick={() => onSwitchPrintSize(ps.id)}
            title={ps.description}
          >
            {ps.label}
          </button>
        ))}
      </div>
      <div className="sep" />

      {/* Color swatches */}
      <div className="color-row">
        <span className="color-label-text">COLOR</span>
        <div className="color-swatches">
          {colors.map((c) => (
            <button
              key={c.hex}
              className={`color-swatch ${activeColorHex === c.hex ? 'active' : ''}`}
              style={{
                backgroundColor: c.hex,
                borderColor: (c.hex === '#ffffff' || c.hex === '#fff')
                  ? (activeColorHex === c.hex ? '#6366f1' : '#d1d5db')
                  : undefined,
              }}
              onClick={() => onSwitchColor(c.hex, c.name)}
            >
              <span className="tip">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right actions */}
      <div className="topbar-actions">
        <div className="save-indicator">
          <div className={`save-dot ${saveStatus === 'saving' ? 'saving' : saveStatus === 'error' ? 'error' : ''}`} />
          <span>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Save failed' : 'Saved'}</span>
        </div>
        <button onClick={onUndo} className="icon-btn" title="Undo (Ctrl+Z)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
        </button>
        <button onClick={onRedo} className="icon-btn" title="Redo (Ctrl+Y)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" /></svg>
        </button>
      </div>
    </div>
  );
}
