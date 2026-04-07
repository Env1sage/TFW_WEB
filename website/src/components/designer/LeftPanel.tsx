import { type MockupTemplate } from '../../mockups';

interface LeftPanelProps {
  activeProductType: string;
  onSwitchType: (type: string) => void;
  templates?: Record<string, MockupTemplate>;
  onAddText: () => void;
  onAddImage: (file: File) => void;
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
  onPreview: () => void;
  extraClassName?: string;
}

export default function LeftPanel({
  activeProductType, onSwitchType,
  templates,
  onAddText, onAddImage, onDelete, onDuplicate, onCenter,
  onFlipH, onFlipV, onToggleLock, isLocked,
  onZoomIn, onZoomOut, onResetView, onPreview,
  extraClassName = '',
}: LeftPanelProps) {
  const templateEntries = Object.entries(templates ?? {});
  return (
    <div className={`left-panel${extraClassName ? ' ' + extraClassName : ''}`}>
      <div className="panel-drawer-handle" />
      <div className="panel-header">Product Type</div>
      <div className="product-grid">
        {templateEntries.length === 0 ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', padding: '0.5rem', gridColumn: '1/-1' }}>No mockups configured yet.</p>
        ) : templateEntries.map(([key, t]) => (
          <button key={key}
            className={`product-type-btn ${activeProductType === key ? 'active' : ''}`}
            onClick={() => onSwitchType(key)}>
            <span dangerouslySetInnerHTML={{ __html: t.icon }} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel-header">Design Tools</div>
      <div className="tool-list">
        <button className="tool-btn primary" onClick={onAddText}>&#9998; Add Text</button>
        <label className="file-label">
          &#128247; Upload Image
          <input type="file" accept="image/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) { onAddImage(f); e.target.value = ''; } }} />
        </label>
        <button className="tool-btn danger" onClick={onDelete}>&#128465; Delete</button>
        <button className="tool-btn" onClick={onDuplicate}>&#10697; Duplicate</button>
        <button className="tool-btn" onClick={onCenter}>&#9678; Center</button>
      </div>

      <div className="panel-header">Transform</div>
      <div className="tool-list">
        <button className="tool-btn" onClick={onFlipH} title="Flip Horizontal">Flip H</button>
        <button className="tool-btn" onClick={onFlipV} title="Flip Vertical">Flip V</button>
        <button className={`tool-btn ${isLocked ? 'active' : ''}`} onClick={onToggleLock} title={isLocked ? 'Unlock' : 'Lock'}>
          {isLocked ? 'Locked' : 'Unlock'}
        </button>
      </div>

      <div className="zoom-group">
        <button className="tool-btn" onClick={onZoomIn}>&#43;</button>
        <button className="tool-btn" onClick={onResetView}>&#8634;</button>
        <button className="tool-btn" onClick={onZoomOut}>&#8722;</button>
      </div>

      <div className="tool-list" style={{ marginTop: 8 }}>
        <button className="tool-btn preview" onClick={onPreview}>&#128065; Preview</button>
      </div>
    </div>
  );
}
