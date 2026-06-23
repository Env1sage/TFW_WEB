import { useRef } from 'react';
import * as fabric from 'fabric';
import {
  Type, ImageUp, Trash2, Copy, AlignCenter,
  FlipHorizontal2, FlipVertical2, Lock, LockOpen,
  ZoomIn, ZoomOut, RefreshCcw, Eye, EyeOff,
  Square, Circle, Triangle, Minus,
} from 'lucide-react';
import { type MockupTemplate } from '../../mockups';

type ShapeType = 'rect' | 'circle' | 'triangle' | 'line';

interface LeftPanelProps {
  activeProductType: string;
  onSwitchType: (type: string) => void;
  templates?: Record<string, MockupTemplate>;
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
  layers: fabric.FabricObject[];
  selectedObj: fabric.FabricObject | null;
  onSelectLayer: (obj: fabric.FabricObject) => void;
  onRemoveLayer: (obj: fabric.FabricObject) => void;
  onToggleVisibility: (obj: fabric.FabricObject) => void;
  extraClassName?: string;
  productName?: string;
  uploadEnabled?: boolean;
}

export default function LeftPanel({
  activeProductType, onSwitchType,
  templates,
  onAddText, onAddImage, onAddShape,
  onDelete, onDuplicate, onCenter,
  onFlipH, onFlipV, onToggleLock, isLocked,
  onZoomIn, onZoomOut, onResetView,
  layers, selectedObj, onSelectLayer, onRemoveLayer, onToggleVisibility,
  extraClassName = '',
  productName,
  uploadEnabled = true,
}: LeftPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const templateEntries = Object.entries(templates ?? {});
  const showProductGrid = templateEntries.length > 1;

  return (
    <div className={`left-panel${extraClassName ? ' ' + extraClassName : ''}`}>
      <div className="panel-drawer-handle" />

      {/* Product selector — only when multiple templates */}
      {showProductGrid && (
        <div className="ds-panel-section">
          <span className="ds-section-title">Product</span>
          <div className="ds-product-grid">
            {templateEntries.map(([key, t]) => (
              <button
                key={key}
                className={`ds-product-btn${activeProductType === key ? ' active' : ''}`}
                onClick={() => onSwitchType(key)}
                title={t.label}
              >
                <span className="ds-product-icon" dangerouslySetInnerHTML={{ __html: t.icon }} />
                <span className="ds-product-name">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload Design */}
      <div className="ds-panel-section">
        <span className="ds-section-title">Add to Canvas</span>
        {uploadEnabled ? (
          <>
            <button className="ds-upload-card" onClick={() => fileRef.current?.click()}>
              <ImageUp size={22} />
              <span className="ds-upload-card__label">Upload Design</span>
              <span className="ds-upload-card__hint">PNG, JPG, SVG</span>
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
          <div style={{ padding: '10px 12px', background: 'var(--bg-2)', border: '1px dashed var(--border)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-3)', textAlign: 'center' }}>
            Uploads are currently disabled
          </div>
        )}
        <button className="ds-tool-btn ds-tool-btn--primary" onClick={onAddText} style={{ marginTop: 8 }}>
          <Type size={15} />
          Add Text
        </button>
      </div>

      {/* Shapes */}
      <div className="ds-panel-section">
        <span className="ds-section-title">Shapes</span>
        <div className="ds-shape-grid">
          <button className="ds-shape-btn" onClick={() => onAddShape('rect')} title="Rectangle">
            <Square size={18} />
          </button>
          <button className="ds-shape-btn" onClick={() => onAddShape('circle')} title="Circle">
            <Circle size={18} />
          </button>
          <button className="ds-shape-btn" onClick={() => onAddShape('triangle')} title="Triangle">
            <Triangle size={18} />
          </button>
          <button className="ds-shape-btn" onClick={() => onAddShape('line')} title="Line">
            <Minus size={18} />
          </button>
        </div>
      </div>

      {/* Alignment & Transform */}
      <div className="ds-panel-section">
        <span className="ds-section-title">Alignment</span>
        <div className="ds-icon-grid">
          <button className="ds-icon-btn ds-icon-btn--danger" onClick={onDelete} title="Delete">
            <Trash2 size={15} />
          </button>
          <button className="ds-icon-btn" onClick={onDuplicate} title="Duplicate">
            <Copy size={15} />
          </button>
          <button className="ds-icon-btn" onClick={onCenter} title="Center">
            <AlignCenter size={15} />
          </button>
          <button className="ds-icon-btn" onClick={onFlipH} title="Flip Horizontal">
            <FlipHorizontal2 size={15} />
          </button>
          <button className="ds-icon-btn" onClick={onFlipV} title="Flip Vertical">
            <FlipVertical2 size={15} />
          </button>
          <button
            className={`ds-icon-btn${isLocked ? ' active' : ''}`}
            onClick={onToggleLock}
            title={isLocked ? 'Unlock' : 'Lock'}
          >
            {isLocked ? <Lock size={15} /> : <LockOpen size={15} />}
          </button>
        </div>
      </div>

      {/* Layers */}
      <div className="ds-panel-section ds-panel-section--layers">
        <span className="ds-section-title">Layers ({layers.length})</span>
        <div className="ds-layer-list">
          {layers.length === 0 ? (
            <div className="ds-layer-empty">No layers yet</div>
          ) : (
            [...layers].reverse().map((obj, i) => (
              <div
                key={i}
                className={`layer-item${selectedObj === obj ? ' selected' : ''}`}
                onClick={() => onSelectLayer(obj)}
              >
                <span className="layer-name">
                  {(obj as any).layerName || obj.type || 'Object'}
                </span>
                <button
                  className="vis-btn"
                  onClick={e => { e.stopPropagation(); onToggleVisibility(obj); }}
                  title={obj.visible !== false ? 'Hide' : 'Show'}
                >
                  {obj.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button
                  className="del-btn"
                  onClick={e => { e.stopPropagation(); onRemoveLayer(obj); }}
                  title="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Zoom */}
      <div className="ds-panel-section">
        <span className="ds-section-title">Zoom</span>
        <div className="ds-zoom-row">
          <button className="ds-icon-btn" onClick={onZoomOut} title="Zoom Out">
            <ZoomOut size={15} />
          </button>
          <button className="ds-icon-btn" onClick={onResetView} title="Reset View">
            <RefreshCcw size={15} />
          </button>
          <button className="ds-icon-btn" onClick={onZoomIn} title="Zoom In">
            <ZoomIn size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
