import { useRef } from 'react';
import { MOCKUP_TEMPLATES } from '../mockups';

interface Props {
  activeProductType: string;
  onSwitchType: (type: string) => void;
  onAddText: () => void;
  onAddImage: (file: File) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCenter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onPreview: () => void;
}

export default function LeftPanel({
  activeProductType, onSwitchType,
  onAddText, onAddImage, onDelete, onDuplicate, onCenter,
  onZoomIn, onZoomOut, onResetView, onPreview,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="left-panel">
      <div className="panel-header">Product Type</div>
      <div className="product-grid">
        {Object.entries(MOCKUP_TEMPLATES).map(([key, tmpl]) => (
          <button
            key={key}
            className={`product-type-btn ${activeProductType === key ? 'active' : ''}`}
            onClick={() => onSwitchType(key)}
          >
            <span dangerouslySetInnerHTML={{ __html: tmpl.icon }} />
            <span>{tmpl.label}</span>
          </button>
        ))}
      </div>
      <div className="panel-divider" />

      <div className="panel-header">Design Tools</div>
      <div className="tool-list">
        <button onClick={onAddText} className="tool-btn primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
          </svg>
          Add Text
        </button>

        <label className="file-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          Upload Image
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddImage(f); e.target.value = ''; }}
          />
        </label>

        <div className="tool-divider" />

        <button onClick={onDelete} className="tool-btn danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" /><path d="M8 6V4h8v2" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
          </svg>
          Delete
        </button>

        <button onClick={onDuplicate} className="tool-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Duplicate
        </button>

        <button onClick={onCenter} className="tool-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20" /><path d="M2 12h20" />
          </svg>
          Center
        </button>

        <div className="tool-divider" />

        <div className="zoom-group">
          <button onClick={onZoomOut} className="icon-btn sm" title="Zoom out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M8 11h6" /></svg>
          </button>
          <button onClick={onResetView} className="icon-btn sm" title="Reset view">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
          </button>
          <button onClick={onZoomIn} className="icon-btn sm" title="Zoom in">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M8 11h6" /><path d="M11 8v6" /></svg>
          </button>
        </div>

        <div className="tool-divider" />

        <button onClick={onPreview} className="tool-btn preview-tool">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Preview
        </button>
      </div>
    </div>
  );
}
