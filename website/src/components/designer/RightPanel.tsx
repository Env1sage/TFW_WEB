import * as fabric from 'fabric';
import { Sliders } from 'lucide-react';

interface RightPanelProps {
  selectedObj: fabric.FabricObject | null;
  onUpdateProp: (prop: string, value: unknown) => void;
  canvas: fabric.Canvas | null;
  extraClassName?: string;
}

const FONTS = [
  'Arial','Georgia','Courier New','Impact','Trebuchet MS',
  'Verdana','Times New Roman','Palatino','Comic Sans MS',
  'Montserrat','Poppins','Inter','Oswald','Raleway',
];

export default function RightPanel({ selectedObj, onUpdateProp, extraClassName = '' }: RightPanelProps) {
  const isText = selectedObj instanceof fabric.IText;

  if (!selectedObj) return null;

  return (
    <div className={`right-panel${extraClassName ? ' ' + extraClassName : ''}`}>
      <div className="rpanel-section">
        <div className="rpanel-title"><Sliders size={12} style={{ marginRight: 5 }} /> Properties</div>
        <div className="prop-grid">
          <div className="prop-row">
            <span className="prop-label">X</span>
            <input className="prop-input" type="number" value={Math.round(selectedObj.left || 0)} onChange={e => onUpdateProp('left', +e.target.value)} />
            <span className="prop-label">Y</span>
            <input className="prop-input" type="number" value={Math.round(selectedObj.top || 0)} onChange={e => onUpdateProp('top', +e.target.value)} />
          </div>
          <div className="prop-row">
            <span className="prop-label">W</span>
            <input className="prop-input" type="number" value={Math.round(selectedObj.getScaledWidth())} onChange={e => { const s = +e.target.value / (selectedObj.width || 1); onUpdateProp('scaleX', s); }} />
            <span className="prop-label">H</span>
            <input className="prop-input" type="number" value={Math.round(selectedObj.getScaledHeight())} onChange={e => { const s = +e.target.value / (selectedObj.height || 1); onUpdateProp('scaleY', s); }} />
          </div>
          <div className="prop-row">
            <span className="prop-label">Angle</span>
            <input className="prop-input" type="number" value={Math.round(selectedObj.angle || 0)} onChange={e => onUpdateProp('angle', +e.target.value)} />
          </div>
          <div className="prop-row">
            <span className="prop-label">Opacity</span>
            <input className="prop-range" type="range" min={0} max={1} step={0.05} value={selectedObj.opacity ?? 1} onChange={e => onUpdateProp('opacity', +e.target.value)} />
          </div>
        </div>
      </div>

      {isText && (
        <div className="rpanel-section">
          <div className="rpanel-title">Text</div>
          <div className="prop-grid">
            <div className="prop-row">
              <span className="prop-label">Font</span>
              <select className="prop-select" value={(selectedObj as fabric.IText).fontFamily || 'Arial'} onChange={e => onUpdateProp('fontFamily', e.target.value)}>
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="prop-row">
              <span className="prop-label">Size</span>
              <input className="prop-input" type="number" value={Math.round((selectedObj as fabric.IText).fontSize || 36)} onChange={e => onUpdateProp('fontSize', +e.target.value)} />
              <span className="prop-label">Color</span>
              <input className="prop-color" type="color" value={String((selectedObj as fabric.IText).fill || '#000000')} onChange={e => onUpdateProp('fill', e.target.value)} />
            </div>
            <div className="prop-row style-row">
              <button className={`style-btn${(selectedObj as fabric.IText).fontWeight === 'bold' ? ' active' : ''}`} onClick={() => onUpdateProp('fontWeight', (selectedObj as fabric.IText).fontWeight === 'bold' ? 'normal' : 'bold')}><b>B</b></button>
              <button className={`style-btn${(selectedObj as fabric.IText).fontStyle === 'italic' ? ' active' : ''}`} onClick={() => onUpdateProp('fontStyle', (selectedObj as fabric.IText).fontStyle === 'italic' ? 'normal' : 'italic')}><i>I</i></button>
              <button className={`style-btn${(selectedObj as fabric.IText).underline ? ' active' : ''}`} onClick={() => onUpdateProp('underline', !(selectedObj as fabric.IText).underline)}><u>U</u></button>
            </div>
            <div className="prop-row">
              <span className="prop-label">Spacing</span>
              <input className="prop-input" type="number" value={Math.round((selectedObj as fabric.IText).charSpacing || 0)} onChange={e => onUpdateProp('charSpacing', +e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
