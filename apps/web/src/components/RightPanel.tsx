import * as fabric from 'fabric';

interface Props {
  selectedObj: fabric.FabricObject | null;
  layers: fabric.FabricObject[];
  onUpdateProp: (prop: string, value: unknown) => void;
  onSelectLayer: (obj: fabric.FabricObject) => void;
  onRemoveLayer: (obj: fabric.FabricObject) => void;
  onToggleVisibility: (obj: fabric.FabricObject) => void;
  canvas: fabric.Canvas | null;
}

const FONTS = [
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
  'Courier New', 'Verdana', 'Impact', 'Trebuchet MS',
];

export default function RightPanel({
  selectedObj, layers, onUpdateProp,
  onSelectLayer, onRemoveLayer, onToggleVisibility,
}: Props) {
  const isText = selectedObj && (selectedObj as any).text !== undefined;

  return (
    <div className="right-panel">
      {selectedObj ? (
        <>
          <div className="panel-header">Properties</div>
          <div className="rpanel-section">
            <div className="prop-grid">
              <div className="prop-row">
                <label className="prop-label">X</label>
                <input className="prop-input" type="number" value={Math.round(selectedObj.left ?? 0)}
                  onChange={(e) => onUpdateProp('left', Number(e.target.value))} />
                <label className="prop-label">Y</label>
                <input className="prop-input" type="number" value={Math.round(selectedObj.top ?? 0)}
                  onChange={(e) => onUpdateProp('top', Number(e.target.value))} />
              </div>
              <div className="prop-row">
                <label className="prop-label">W</label>
                <input className="prop-input" type="number"
                  value={Math.round((selectedObj.width ?? 0) * (selectedObj.scaleX ?? 1))}
                  onChange={(e) => { const w = Number(e.target.value); if (w > 0) onUpdateProp('scaleX', w / (selectedObj.width ?? 1)); }} />
                <label className="prop-label">H</label>
                <input className="prop-input" type="number"
                  value={Math.round((selectedObj.height ?? 0) * (selectedObj.scaleY ?? 1))}
                  onChange={(e) => { const h = Number(e.target.value); if (h > 0) onUpdateProp('scaleY', h / (selectedObj.height ?? 1)); }} />
              </div>
              <div className="prop-row">
                <label className="prop-label">Angle</label>
                <input className="prop-input" type="number" value={Math.round(selectedObj.angle ?? 0)}
                  onChange={(e) => onUpdateProp('angle', Number(e.target.value))} />
              </div>
              <div className="prop-row">
                <label className="prop-label">Opacity</label>
                <input className="prop-range" type="range" min={0} max={1} step={0.05}
                  value={selectedObj.opacity ?? 1}
                  onChange={(e) => onUpdateProp('opacity', Number(e.target.value))} />
              </div>
            </div>
          </div>

          {isText && (
            <div className="rpanel-section">
              <h3 className="rpanel-title">Text</h3>
              <div className="prop-grid">
                <div className="prop-row">
                  <label className="prop-label">Font</label>
                  <select className="prop-select"
                    value={(selectedObj as any).fontFamily ?? 'Arial'}
                    onChange={(e) => onUpdateProp('fontFamily', e.target.value)}>
                    {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="prop-row">
                  <label className="prop-label">Size</label>
                  <input className="prop-input" type="number" min={8} max={200}
                    value={(selectedObj as any).fontSize ?? 40}
                    onChange={(e) => onUpdateProp('fontSize', Number(e.target.value))} />
                  <label className="prop-label">Color</label>
                  <input className="prop-color" type="color"
                    value={(selectedObj as any).fill ?? '#000000'}
                    onChange={(e) => onUpdateProp('fill', e.target.value)} />
                </div>
                <div className="prop-row style-row">
                  <button className={`style-btn ${(selectedObj as any).fontWeight === 'bold' ? 'active' : ''}`}
                    onClick={() => onUpdateProp('fontWeight', (selectedObj as any).fontWeight === 'bold' ? 'normal' : 'bold')}>B</button>
                  <button className={`style-btn ${(selectedObj as any).fontStyle === 'italic' ? 'active' : ''}`}
                    onClick={() => onUpdateProp('fontStyle', (selectedObj as any).fontStyle === 'italic' ? 'normal' : 'italic')}><em>I</em></button>
                  <button className={`style-btn ${(selectedObj as any).underline ? 'active' : ''}`}
                    onClick={() => onUpdateProp('underline', !(selectedObj as any).underline)}><u>U</u></button>
                </div>
                <div className="prop-row">
                  <label className="prop-label">Spacing</label>
                  <input className="prop-input" type="number" min={-50} max={500}
                    value={(selectedObj as any).charSpacing ?? 0}
                    onChange={(e) => onUpdateProp('charSpacing', Number(e.target.value))} />
                </div>
                <div className="prop-row">
                  <label className="prop-label">Line H</label>
                  <input className="prop-input" type="number" min={0.5} max={4} step={0.1}
                    value={(selectedObj as any).lineHeight ?? 1.16}
                    onChange={(e) => onUpdateProp('lineHeight', Number(e.target.value))} />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="panel-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" width="32" height="32">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <p>Select an element to edit</p>
        </div>
      )}

      {/* Layers */}
      <div className="panel-header" style={{ marginTop: 8 }}>Layers</div>
      {layers.length === 0 ? (
        <div className="panel-empty"><p>No layers yet</p></div>
      ) : (
        <div className="layer-list">
          {layers.map((obj, i) => {
            const name = (obj as any).text
              ? `T: ${(obj as any).text.slice(0, 18)}`
              : `Image ${i + 1}`;
            const selected = selectedObj === obj;
            return (
              <div key={i} className={`layer-item ${selected ? 'selected' : ''}`}
                onClick={() => onSelectLayer(obj)}>
                <button className="vis-btn" title={obj.visible ? 'Hide' : 'Show'}
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(obj); }}>
                  {obj.visible !== false ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
                <span className="layer-name">{name}</span>
                <button className="del-btn" title="Remove"
                  onClick={(e) => { e.stopPropagation(); onRemoveLayer(obj); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
