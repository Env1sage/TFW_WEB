import * as fabric from 'fabric';
import { Eye, EyeOff } from 'lucide-react';

interface RightPanelProps {
  selectedObj: fabric.FabricObject | null;
  layers: fabric.FabricObject[];
  onUpdateProp: (prop: string, value: unknown) => void;
  onSelectLayer: (obj: fabric.FabricObject) => void;
  onRemoveLayer: (obj: fabric.FabricObject) => void;
  onToggleVisibility: (obj: fabric.FabricObject) => void;
  canvas: fabric.Canvas | null;
}

const FONTS = [
  'Arial', 'Georgia', 'Courier New', 'Impact', 'Trebuchet MS',
  'Verdana', 'Times New Roman', 'Palatino', 'Comic Sans MS',
];

export default function RightPanel({
  selectedObj, layers, onUpdateProp, onSelectLayer, onRemoveLayer, onToggleVisibility, canvas,
}: RightPanelProps) {
  const isText = selectedObj instanceof fabric.IText;

  return (
    <div className="right-panel">
      {selectedObj ? (
        <>
          {/* Position & Size */}
          <div className="rpanel-section">
            <div className="rpanel-title">Properties</div>
            <div className="prop-grid">
              <div className="prop-row">
                <span className="prop-label">X</span>
                <input className="prop-input" type="number" value={Math.round(selectedObj.left || 0)}
                  onChange={e => onUpdateProp('left', +e.target.value)} />
                <span className="prop-label">Y</span>
                <input className="prop-input" type="number" value={Math.round(selectedObj.top || 0)}
                  onChange={e => onUpdateProp('top', +e.target.value)} />
              </div>
              <div className="prop-row">
                <span className="prop-label">W</span>
                <input className="prop-input" type="number" value={Math.round(selectedObj.getScaledWidth())}
                  onChange={e => { const s = +e.target.value / (selectedObj.width || 1); onUpdateProp('scaleX', s); }} />
                <span className="prop-label">H</span>
                <input className="prop-input" type="number" value={Math.round(selectedObj.getScaledHeight())}
                  onChange={e => { const s = +e.target.value / (selectedObj.height || 1); onUpdateProp('scaleY', s); }} />
              </div>
              <div className="prop-row">
                <span className="prop-label">Angle</span>
                <input className="prop-input" type="number" value={Math.round(selectedObj.angle || 0)}
                  onChange={e => onUpdateProp('angle', +e.target.value)} />
              </div>
              <div className="prop-row">
                <span className="prop-label">Opacity</span>
                <input className="prop-range" type="range" min={0} max={1} step={0.05}
                  value={selectedObj.opacity ?? 1}
                  onChange={e => onUpdateProp('opacity', +e.target.value)} />
              </div>
            </div>
          </div>

          {/* Text styling */}
          {isText && (
            <div className="rpanel-section">
              <div className="rpanel-title">Text</div>
              <div className="prop-grid">
                <div className="prop-row">
                  <span className="prop-label">Font</span>
                  <select className="prop-select" value={(selectedObj as fabric.IText).fontFamily || 'Arial'}
                    onChange={e => onUpdateProp('fontFamily', e.target.value)}>
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="prop-row">
                  <span className="prop-label">Size</span>
                  <input className="prop-input" type="number"
                    value={Math.round((selectedObj as fabric.IText).fontSize || 36)}
                    onChange={e => onUpdateProp('fontSize', +e.target.value)} />
                  <span className="prop-label">Color</span>
                  <input className="prop-color" type="color"
                    value={String((selectedObj as fabric.IText).fill || '#000000')}
                    onChange={e => onUpdateProp('fill', e.target.value)} />
                </div>
                <div className="prop-row style-row">
                  <button className={`style-btn ${(selectedObj as fabric.IText).fontWeight === 'bold' ? 'active' : ''}`}
                    onClick={() => onUpdateProp('fontWeight', (selectedObj as fabric.IText).fontWeight === 'bold' ? 'normal' : 'bold')}>
                    <b>B</b>
                  </button>
                  <button className={`style-btn ${(selectedObj as fabric.IText).fontStyle === 'italic' ? 'active' : ''}`}
                    onClick={() => onUpdateProp('fontStyle', (selectedObj as fabric.IText).fontStyle === 'italic' ? 'normal' : 'italic')}>
                    <i>I</i>
                  </button>
                  <button className={`style-btn ${(selectedObj as fabric.IText).underline ? 'active' : ''}`}
                    onClick={() => onUpdateProp('underline', !(selectedObj as fabric.IText).underline)}>
                    <u>U</u>
                  </button>
                </div>
                <div className="prop-row">
                  <span className="prop-label">Spacing</span>
                  <input className="prop-input" type="number"
                    value={Math.round((selectedObj as fabric.IText).charSpacing || 0)}
                    onChange={e => onUpdateProp('charSpacing', +e.target.value)} />
                </div>
                <div className="prop-row">
                  <span className="prop-label">Line H</span>
                  <input className="prop-input" type="number" step={0.1}
                    value={((selectedObj as fabric.IText).lineHeight || 1.16).toFixed(1)}
                    onChange={e => onUpdateProp('lineHeight', +e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="panel-empty">
          <span style={{ fontSize: 24 }}>&#9997;</span>
          Select an object to edit properties
        </div>
      )}

      {/* Layers */}
      <div className="rpanel-section">
        <div className="rpanel-title">Layers ({layers.length})</div>
      </div>
      <div className="layer-list">
        {[...layers].reverse().map((obj, i) => (
          <div key={i}
            className={`layer-item ${selectedObj === obj ? 'selected' : ''}`}
            onClick={() => onSelectLayer(obj)}>
            <span className="layer-name">
              {(obj as any).layerName || obj.type || 'Object'}
            </span>
            <button className="vis-btn" onClick={e => { e.stopPropagation(); onToggleVisibility(obj); }}
              title={obj.visible !== false ? 'Hide' : 'Show'}>
              {obj.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button className="del-btn" onClick={e => { e.stopPropagation(); onRemoveLayer(obj); }} title="Remove">
              &#10005;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
