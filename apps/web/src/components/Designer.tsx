import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import type { Product, PrintSide, PrintSize, PriceResult } from '../types';
import { MOCKUP_TEMPLATES, COLORS, PRINT_SIZES, CW, CH, preloadMockupImages, getCachedImage } from '../mockups';
import { calculatePrice, createDesign, saveDesignSide, addToCart } from '../api';
import TopBar from './TopBar';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import BottomBar from './BottomBar';
import './Designer.css';

const SIDES: PrintSide[] = ['FRONT', 'BACK'];

interface SideState {
  json: object | null;
  history: string[];
  redo: string[];
}

function isGuide(obj: fabric.FabricObject): boolean {
  return !!(obj as any).name && (obj as any).name.startsWith('__');
}

interface DesignerProps {
  product: Product;
  allProducts: Product[];
  onSwitchProduct: (p: Product) => void;
}

export default function Designer({ product, allProducts, onSwitchProduct }: DesignerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fcRef = useRef<fabric.Canvas | null>(null);
  const clipRef = useRef<fabric.Rect | null>(null);
  const isLoadingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designIdRef = useRef<string | null>(null);

  const [activeSide, setActiveSide] = useState<PrintSide>('FRONT');
  const [selectedSides, setSelectedSides] = useState<PrintSide[]>(['FRONT']);
  const [activePrintSize, setActivePrintSize] = useState<PrintSize>('full');
  const [activeColorHex, setActiveColorHex] = useState('#ffffff');
  const [activeColorName, setActiveColorName] = useState('White');
  const [activeProductType, setActiveProductType] = useState('tshirt');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState<PriceResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [selectedObj, setSelectedObj] = useState<fabric.FabricObject | null>(null);
  const [layerList, setLayerList] = useState<fabric.FabricObject[]>([]);
  const [, forceUpdate] = useState(0);
  const [imgReady, setImgReady] = useState(false);

  const colors = product.colors.length > 0
    ? product.colors.map((c) => ({ name: c.name, hex: c.hexCode, id: c.id }))
    : COLORS.map((c) => ({ ...c, id: '' }));

  const sideStateRef = useRef<Record<PrintSide, SideState>>({
    FRONT: { json: null, history: [], redo: [] },
    BACK: { json: null, history: [], redo: [] },
  });

  const getTemplate = useCallback(() => MOCKUP_TEMPLATES[activeProductType], [activeProductType]);

  const getPrintArea = useCallback(() => {
    const dbPA = product.printAreas.find((p) => p.side === activeSide);
    if (dbPA) return { x: dbPA.xPosition, y: dbPA.yPosition, w: dbPA.width, h: dbPA.height };
    const tmpl = getTemplate();
    if (tmpl) {
      const bySide = tmpl.printAreasBySide?.[activeSide];
      if (bySide) return bySide[activePrintSize];
      return tmpl.printAreas[activePrintSize];
    }
    return { x: 290, y: 200, w: 220, h: 320 };
  }, [product, activeSide, getTemplate, activePrintSize]);

  const getUserObjects = useCallback(() => {
    const fc = fcRef.current;
    return fc ? fc.getObjects().filter((o) => !isGuide(o)) : [];
  }, []);

  const refreshLayers = useCallback(() => {
    setLayerList([...getUserObjects()]);
  }, [getUserObjects]);

  /* ── Shadow overlay (fabric fold multiply layer on top of designs) ── */
  const loadShadowOverlay = useCallback((fc: fabric.Canvas, tmpl: { shadowUrls?: Partial<Record<string, string>> }, side: PrintSide) => {
    // Remove existing shadow overlay
    fc.getObjects().filter(o => (o as any).name === '__shadow').forEach(o => fc.remove(o));

    const shadowUrl = tmpl.shadowUrls?.[side];
    if (!shadowUrl) return;
    const b64 = getCachedImage(shadowUrl);
    if (!b64) return;

    const el = new Image();
    el.onload = () => {
      const nw = el.naturalWidth || CW;
      const nh = el.naturalHeight || CH;
      const overlay = new fabric.FabricImage(el, {
        left: 0, top: 0,
        scaleX: CW / nw, scaleY: CH / nh,
        originX: 'left', originY: 'top',
        selectable: false, evented: false,
        excludeFromExport: true,
        globalCompositeOperation: 'multiply',
        opacity: 0.6,
      });
      (overlay as any).name = '__shadow';
      fc.add(overlay);
      // Ensure shadow is always on top
      fc.bringObjectToFront(overlay);
      fc.requestRenderAll();
    };
    el.src = b64;
  }, []);

  /* ── Mockup loading ── */
  const loadMockup = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const tmpl = getTemplate();
    if (!tmpl) {
      fc.backgroundImage = undefined;
      fc.backgroundColor = '#e8eaed';
      fc.requestRenderAll();
      return;
    }
    const svgStr = tmpl.renderSVG(activeSide, activeColorHex);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const imgEl = new Image();
    imgEl.onload = () => {
      try {
        const nw = imgEl.naturalWidth || CW;
        const nh = imgEl.naturalHeight || CH;
        const fImg = new fabric.FabricImage(imgEl, {
          left: 0, top: 0,
          scaleX: CW / nw, scaleY: CH / nh,
          originX: 'left', originY: 'top',
          selectable: false, evented: false,
        });
        fc.backgroundImage = fImg;
        fc.requestRenderAll();
      } catch (e) { console.error('Mockup load error', e); }
      URL.revokeObjectURL(url);
    };
    imgEl.onerror = () => { console.error('SVG mockup failed'); URL.revokeObjectURL(url); };
    imgEl.src = url;

    // Load shadow overlay (multiply blend on top of design for fabric fold realism)
    loadShadowOverlay(fc, tmpl, activeSide);
  }, [getTemplate, activeSide, activeColorHex, imgReady]);

  /* ── Guides ── */
  const addGuides = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    fc.getObjects().filter((o) => isGuide(o)).forEach((o) => fc.remove(o));
    const pa = getPrintArea();
    const oc = 'rgba(0,0,0,0.04)';
    [
      { l: 0, t: 0, w: CW, h: pa.y, n: '__oT' },
      { l: 0, t: pa.y + pa.h, w: CW, h: CH - pa.y - pa.h, n: '__oB' },
      { l: 0, t: pa.y, w: pa.x, h: pa.h, n: '__oL' },
      { l: pa.x + pa.w, t: pa.y, w: CW - pa.x - pa.w, h: pa.h, n: '__oR' },
    ].forEach((s) => {
      const r = new fabric.Rect({
        left: s.l, top: s.t, width: s.w, height: s.h,
        fill: oc, selectable: false, evented: false,
        originX: 'left', originY: 'top', excludeFromExport: true,
      });
      (r as any).name = s.n;
      fc.add(r);
    });
    const border = new fabric.Rect({
      left: pa.x, top: pa.y, width: pa.w, height: pa.h,
      fill: 'transparent', stroke: 'rgba(99,102,241,0.35)', strokeWidth: 1.5,
      strokeDashArray: [8, 4], selectable: false, evented: false,
      originX: 'left', originY: 'top', excludeFromExport: true,
    });
    (border as any).name = '__border';
    fc.add(border);
    const sizeLabel = PRINT_SIZES.find(s => s.id === activePrintSize)?.label ?? 'Print Area';
    const label = new fabric.Text(sizeLabel.toUpperCase(), {
      left: pa.x + pa.w / 2, top: pa.y - 8,
      originX: 'center', originY: 'bottom', fontSize: 10,
      fill: 'rgba(99,102,241,0.45)', fontFamily: 'Inter,Arial,sans-serif',
      fontWeight: '700', charSpacing: 200,
      selectable: false, evented: false, excludeFromExport: true,
    });
    (label as any).name = '__label';
    fc.add(label);
    const cl = 10, cc = 'rgba(99,102,241,0.4)';
    [[pa.x, pa.y, 1, 1], [pa.x + pa.w, pa.y, -1, 1],
     [pa.x, pa.y + pa.h, 1, -1], [pa.x + pa.w, pa.y + pa.h, -1, -1]].forEach((c, i) => {
      const h = new fabric.Rect({
        left: c[0] - (c[2] < 0 ? cl : 0), top: c[1] - (c[3] < 0 ? 2 : 0),
        width: cl, height: 2, fill: cc,
        selectable: false, evented: false, excludeFromExport: true,
      });
      (h as any).name = '__c' + i + 'a';
      const v = new fabric.Rect({
        left: c[0] - (c[2] < 0 ? 2 : 0), top: c[1] - (c[3] < 0 ? cl : 0),
        width: 2, height: cl, fill: cc,
        selectable: false, evented: false, excludeFromExport: true,
      });
      (v as any).name = '__c' + i + 'b';
      fc.add(h); fc.add(v);
    });
    fc.renderAll();
  }, [getPrintArea, activePrintSize]);

  /* ── History ── */
  const saveHistory = useCallback(() => {
    const fc = fcRef.current;
    if (isLoadingRef.current || !fc) return;
    const json = JSON.stringify(fc.toObject(['name', 'customId', 'layerName']));
    const ss = sideStateRef.current[activeSide];
    ss.history.push(json);
    ss.redo = [];
    if (ss.history.length > 50) ss.history.shift();
  }, [activeSide]);

  const reapplyClipPaths = useCallback(() => {
    const fc = fcRef.current;
    const clip = clipRef.current;
    if (!fc || !clip) return;
    fc.getObjects().forEach((o) => { if (!isGuide(o)) o.clipPath = clip; });
  }, []);

  /* ── Auto-save ── */
  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      const fc = fcRef.current;
      if (!fc) return;
      try {
        sideStateRef.current[activeSide].json = fc.toObject(['name', 'customId', 'layerName']);
        if (!designIdRef.current) {
          const d = await createDesign('Design - ' + new Date().toLocaleString(), product.id);
          designIdRef.current = d.id;
        }
        for (const side of Object.keys(sideStateRef.current) as PrintSide[]) {
          const st = sideStateRef.current[side];
          if (st.json || st.history.length > 0) {
            const data = st.json || JSON.parse(st.history[st.history.length - 1] || '{}');
            await saveDesignSide(designIdRef.current, side, CW, CH, data);
          }
        }
        setSaveStatus('saved');
      } catch (e) {
        console.error('Auto-save error', e);
        setSaveStatus('error');
      }
    }, 2000);
  }, [activeSide, product.id]);

  /* ── Canvas auto-scale ── */
  const autoScale = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const area = document.querySelector('.canvas-area');
    if (!area) return;
    const maxW = area.clientWidth - 60, maxH = area.clientHeight - 60;
    if (maxW <= 0 || maxH <= 0) return;
    const scale = Math.min(maxW / CW, maxH / CH, 1);
    const w = Math.round(CW * scale) + 'px', h = Math.round(CH * scale) + 'px';
    if (fc.lowerCanvasEl) { fc.lowerCanvasEl.style.width = w; fc.lowerCanvasEl.style.height = h; }
    if (fc.upperCanvasEl) { fc.upperCanvasEl.style.width = w; fc.upperCanvasEl.style.height = h; }
    const container = (fc as any).wrapperEl || fc.lowerCanvasEl?.parentElement;
    if (container) { container.style.width = w; container.style.height = h; }
  }, []);

  /* ── Init canvas ── */
  useEffect(() => {
    if (!canvasRef.current) return;
    const fc = new fabric.Canvas(canvasRef.current, {
      width: CW, height: CH,
      backgroundColor: '#e8eaed',
      preserveObjectStacking: true,
    });
    fcRef.current = fc;
    const pa = getPrintArea();
    clipRef.current = new fabric.Rect({ left: pa.x, top: pa.y, width: pa.w, height: pa.h, absolutePositioned: true });
    loadMockup();
    addGuides();
    const json = JSON.stringify(fc.toObject(['name', 'customId', 'layerName']));
    sideStateRef.current.FRONT.history.push(json);
    fc.on('object:added', (e: any) => {
      if (!isLoadingRef.current && !isGuide(e.target)) { saveHistory(); scheduleAutoSave(); }
      // Keep shadow overlay always on top
      const shadow = fc.getObjects().find(o => (o as any).name === '__shadow');
      if (shadow && e.target !== shadow) fc.bringObjectToFront(shadow);
      refreshLayers();
    });
    fc.on('object:modified', (e: any) => {
      if (!isLoadingRef.current && !isGuide(e.target)) { saveHistory(); scheduleAutoSave(); }
      forceUpdate((n) => n + 1);
    });
    fc.on('object:removed', () => refreshLayers());
    fc.on('selection:created', (e: any) => setSelectedObj(e.selected?.[0] || null));
    fc.on('selection:updated', (e: any) => setSelectedObj(e.selected?.[0] || null));
    fc.on('selection:cleared', () => setSelectedObj(null));
    fc.on('object:moving', (e: any) => {
      const obj = e.target; if (!obj) return;
      const p = getPrintArea();
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      const ox = obj.left + obj.getScaledWidth() / 2, oy = obj.top + obj.getScaledHeight() / 2;
      if (Math.abs(ox - cx) < 10) obj.set({ left: cx - obj.getScaledWidth() / 2 });
      if (Math.abs(oy - cy) < 10) obj.set({ top: cy - obj.getScaledHeight() / 2 });
    });
    fc.on('mouse:wheel', (opt: any) => {
      let z = fc.getZoom() * (0.999 ** opt.e.deltaY);
      z = Math.min(3, Math.max(0.3, z));
      fc.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), z);
      opt.e.preventDefault(); opt.e.stopPropagation();
    });
    let panning = false, lx = 0, ly = 0;
    fc.on('mouse:down', (o: any) => {
      if (o.e.button === 1) { panning = true; lx = o.e.clientX; ly = o.e.clientY; o.e.preventDefault(); }
    });
    fc.on('mouse:move', (o: any) => {
      if (panning) { const v = fc.viewportTransform!; v[4] += o.e.clientX - lx; v[5] += o.e.clientY - ly; fc.requestRenderAll(); lx = o.e.clientX; ly = o.e.clientY; }
    });
    fc.on('mouse:up', () => { panning = false; });
    autoScale();
    window.addEventListener('resize', autoScale);
    return () => { window.removeEventListener('resize', autoScale); fc.dispose(); fcRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadMockup(); }, [loadMockup]);

  /* Preload real mockup images; once done, imgReady flips and loadMockup reruns */
  useEffect(() => { preloadMockupImages().then(() => setImgReady(true)); }, []);

  useEffect(() => {
    const fc = fcRef.current; if (!fc) return;
    const pa = getPrintArea();
    clipRef.current = new fabric.Rect({ left: pa.x, top: pa.y, width: pa.w, height: pa.h, absolutePositioned: true });
    fc.getObjects().filter((o) => !isGuide(o)).forEach((o) => { o.clipPath = clipRef.current ?? undefined; });
    addGuides();
  }, [activeProductType, activeSide, activePrintSize, getPrintArea, addGuides]);
  useEffect(() => { autoScale(); }, [autoScale]);
  useEffect(() => {
    calculatePrice(product.id, selectedSides, quantity).then(setPrice).catch((e) => console.error('Price error:', e));
  }, [product.id, selectedSides, quantity]);

  /* ── Actions ── */
  const handleAddText = useCallback(() => {
    const fc = fcRef.current, clip = clipRef.current; if (!fc || !clip) return;
    const pa = getPrintArea();
    const text = new fabric.IText('Your Text', {
      left: pa.x + pa.w / 2, top: pa.y + pa.h / 2,
      originX: 'center', originY: 'center',
      fill: '#000000', fontSize: 36, fontFamily: 'Arial', clipPath: clip,
    });
    (text as any).customId = crypto.randomUUID();
    (text as any).layerName = 'Text';
    fc.add(text); fc.setActiveObject(text); fc.renderAll();
  }, [getPrintArea]);

  const handleAddImage = useCallback((file: File) => {
    const fc = fcRef.current, clip = clipRef.current; if (!fc || !clip) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imgEl = new Image();
      imgEl.onload = () => {
        const pa = getPrintArea();
        const fImg = new fabric.FabricImage(imgEl);
        const fitScale = Math.min((pa.w * 0.8) / fImg.width, (pa.h * 0.8) / fImg.height);
        fImg.set({
          left: pa.x + pa.w / 2, top: pa.y + pa.h / 2,
          originX: 'center', originY: 'center',
          scaleX: fitScale, scaleY: fitScale, clipPath: clip,
        });
        (fImg as any).customId = crypto.randomUUID();
        (fImg as any).layerName = 'Image';
        fc.add(fImg); fc.setActiveObject(fImg); fc.renderAll();
      };
      imgEl.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, [getPrintArea]);

  const handleDelete = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject();
    if (obj && !isGuide(obj)) { fc.remove(obj); fc.discardActiveObject(); fc.renderAll(); }
  }, []);

  const handleDuplicate = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject(); if (!obj || isGuide(obj)) return;
    obj.clone().then((c: fabric.FabricObject) => {
      c.set({ left: (obj.left || 0) + 20, top: (obj.top || 0) + 20, clipPath: clipRef.current });
      (c as any).customId = crypto.randomUUID();
      (c as any).layerName = ((obj as any).layerName || obj.type) + ' copy';
      fc.add(c); fc.setActiveObject(c); fc.renderAll();
    });
  }, []);

  const handleCenter = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject(); if (!obj || isGuide(obj)) return;
    const pa = getPrintArea();
    obj.set({ left: pa.x + pa.w / 2, top: pa.y + pa.h / 2, originX: 'center', originY: 'center' });
    obj.setCoords(); fc.renderAll();
  }, [getPrintArea]);

  const handleUndo = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const ss = sideStateRef.current[activeSide];
    if (ss.history.length < 2) return;
    isLoadingRef.current = true;
    const cur = ss.history.pop()!; ss.redo.push(cur);
    fc.loadFromJSON(JSON.parse(ss.history[ss.history.length - 1])).then(() => {
      reapplyClipPaths(); fc.renderAll(); isLoadingRef.current = false; refreshLayers();
    });
  }, [activeSide, reapplyClipPaths, refreshLayers]);

  const handleRedo = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const ss = sideStateRef.current[activeSide];
    if (ss.redo.length === 0) return;
    isLoadingRef.current = true;
    const next = ss.redo.pop()!; ss.history.push(next);
    fc.loadFromJSON(JSON.parse(next)).then(() => {
      reapplyClipPaths(); fc.renderAll(); isLoadingRef.current = false; refreshLayers();
    });
  }, [activeSide, reapplyClipPaths, refreshLayers]);

  const handleSwitchSide = useCallback((newSide: PrintSide) => {
    const fc = fcRef.current; if (!fc || newSide === activeSide) return;
    isLoadingRef.current = true;
    sideStateRef.current[activeSide].json = fc.toObject(['name', 'customId', 'layerName']);
    const ns = sideStateRef.current[newSide];
    if (ns.json) {
      fc.loadFromJSON(ns.json).then(() => {
        loadMockup(); reapplyClipPaths(); addGuides();
        isLoadingRef.current = false; refreshLayers();
      });
    } else {
      fc.clear(); fc.backgroundColor = '#e8eaed';
      loadMockup(); addGuides(); fc.renderAll();
      if (ns.history.length === 0) ns.history.push(JSON.stringify(fc.toObject(['name', 'customId', 'layerName'])));
      isLoadingRef.current = false; refreshLayers();
    }
    setActiveSide(newSide);
  }, [activeSide, loadMockup, reapplyClipPaths, addGuides, refreshLayers]);

  const handleToggleSide = useCallback((side: PrintSide) => {
    setSelectedSides((prev) => prev.includes(side) ? (prev.length > 1 ? prev.filter((s) => s !== side) : prev) : [...prev, side]);
    handleSwitchSide(side);
  }, [handleSwitchSide]);

  const handleZoomIn = useCallback(() => { const fc = fcRef.current; if (fc) { fc.setZoom(Math.min(3, fc.getZoom() + 0.15)); fc.requestRenderAll(); } }, []);
  const handleZoomOut = useCallback(() => { const fc = fcRef.current; if (fc) { fc.setZoom(Math.max(0.3, fc.getZoom() - 0.15)); fc.requestRenderAll(); } }, []);
  const handleResetView = useCallback(() => { const fc = fcRef.current; if (fc) { fc.setZoom(1); fc.viewportTransform = [1, 0, 0, 1, 0, 0]; fc.requestRenderAll(); } }, []);

  const handlePreview = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const dataUrl = fc.toDataURL({ format: 'png', multiplier: 2 });
    const win = window.open();
    if (win) win.document.write(`<html><head><title>Preview</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#111}</style></head><body><img src="${dataUrl}" style="max-width:90%;max-height:90vh;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.4)"/></body></html>`);
  }, []);

  const handleAddToCart = useCallback(async () => {
    const fc = fcRef.current; if (!fc) return;
    sideStateRef.current[activeSide].json = fc.toObject(['name', 'customId', 'layerName']);
    const designData: Record<string, unknown> = {};
    for (const side of selectedSides) { const st = sideStateRef.current[side]; if (st.json) designData[side] = st.json; }
    const colorId = product.colors.length > 0 ? product.colors[0].id : '';
    await addToCart(product.id, colorId, selectedSides, quantity, designData);
    return true;
  }, [activeSide, selectedSides, quantity, product]);

  const handleUpdateObj = useCallback((prop: string, value: unknown) => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject(); if (!obj || isGuide(obj)) return;
    obj.set(prop as keyof fabric.FabricObject, value as any);
    fc.renderAll(); forceUpdate((n) => n + 1);
  }, []);

  const handleSelectLayer = useCallback((obj: fabric.FabricObject) => {
    const fc = fcRef.current; if (!fc) return;
    fc.setActiveObject(obj); fc.renderAll(); setSelectedObj(obj);
  }, []);

  const handleRemoveLayer = useCallback((obj: fabric.FabricObject) => {
    const fc = fcRef.current; if (!fc) return;
    fc.remove(obj); fc.discardActiveObject(); fc.renderAll(); setSelectedObj(null);
  }, []);

  const handleToggleVisibility = useCallback((obj: fabric.FabricObject) => {
    const fc = fcRef.current; if (!fc) return;
    obj.visible = !obj.visible; fc.renderAll(); refreshLayers();
  }, [refreshLayers]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const obj = fcRef.current?.getActiveObject();
        if (obj && (obj as any).type === 'i-text' && (obj as fabric.IText).isEditing) return;
        handleDelete();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, handleDelete]);

  const availablePrintSizes = PRINT_SIZES.filter(ps => ps.sides.includes(activeSide));

  return (
    <div className="designer">
      <TopBar
        activeSide={activeSide}
        selectedSides={selectedSides}
        sides={SIDES}
        colors={colors}
        activeColorHex={activeColorHex}
        saveStatus={saveStatus}
        onToggleSide={handleToggleSide}
        onSwitchColor={(hex, name) => { setActiveColorHex(hex); setActiveColorName(name); }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        activePrintSize={activePrintSize}
        printSizes={availablePrintSizes}
        onSwitchPrintSize={setActivePrintSize}
      />
      <div className="main-area">
        <LeftPanel
          activeProductType={activeProductType}
          onSwitchType={setActiveProductType}
          onAddText={handleAddText}
          onAddImage={handleAddImage}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onCenter={handleCenter}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onPreview={handlePreview}
        />
        <div className="canvas-area">
          <div className="canvas-wrap">
            <canvas ref={canvasRef} width={CW} height={CH} />
          </div>
        </div>
        <RightPanel
          selectedObj={selectedObj}
          layers={layerList}
          onUpdateProp={handleUpdateObj}
          onSelectLayer={handleSelectLayer}
          onRemoveLayer={handleRemoveLayer}
          onToggleVisibility={handleToggleVisibility}
          canvas={fcRef.current}
        />
      </div>
      <BottomBar
        selectedSides={selectedSides}
        quantity={quantity}
        price={price}
        onQuantityChange={setQuantity}
        onAddToCart={handleAddToCart}
        onPreview={handlePreview}
        activeColorName={activeColorName}
        activePrintSize={activePrintSize}
      />
    </div>
  );
}
