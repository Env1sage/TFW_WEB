import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as fabric from 'fabric';
import { compressImage } from '../../utils/imageCompression';
import {
  COLORS, PRINT_SIZES, CW, CH,
  preloadMockupImages, preloadAdditionalImages, getCachedImage,
  buildTemplateFromDBMockup, computePrintArea,
  type MockupTemplate, type PrintSide, type PrintSize, type PrintLayout,
} from '../../mockups';
import { api } from '../../api';
import { useCart } from '../../context/CartContext';
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
  thumbnail?: string;
}

function isGuide(obj: fabric.FabricObject): boolean {
  return !!(obj as any).name && String((obj as any).name).startsWith('__');
}

interface PriceResult {
  originalPrice: number;
  finalPrice: number;
  discountPercent: number;
}

export default function Designer() {
  const navigate = useNavigate();
  const { id: productRouteId } = useParams<{ id?: string }>();
  const { addDesignItem } = useCart();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fcRef = useRef<fabric.Canvas | null>(null);
  const clipRef = useRef<fabric.Rect | null>(null);
  const pocketClipRef = useRef<fabric.Rect | null>(null);
  const isLoadingRef = useRef(false);

  const [activeSide, setActiveSide] = useState<PrintSide>('FRONT');
  const activeSideRef = useRef<PrintSide>('FRONT');
  const [selectedSides, setSelectedSides] = useState<PrintSide[]>([]);
  const [activePrintSize, setActivePrintSize] = useState<PrintSize>('full');
  const [pocketPrintEnabled, setPocketPrintEnabled] = useState(false);
  const [editingPocket, setEditingPocket] = useState(false);
  // Layout-mode state (for mockups with named layouts defined in admin)
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<string[]>([]);
  const [activeEditingLayoutId, setActiveEditingLayoutId] = useState<string | null>(null);
  const layoutClipRefs = useRef<Record<string, fabric.Rect>>({});
  const [activeColorHex, setActiveColorHex] = useState('#ffffff');
  const [activeColorName, setActiveColorName] = useState('White');
  const [activeProductType, setActiveProductType] = useState('');
  const [allTemplates, setAllTemplates] = useState<Record<string, MockupTemplate>>({});
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState<PriceResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [selectedObj, setSelectedObj] = useState<fabric.FabricObject | null>(null);
  const [layerList, setLayerList] = useState<fabric.FabricObject[]>([]);
  const [, forceUpdate] = useState(0);
  const [imgReady, setImgReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const colors = COLORS.map(c => ({ name: c.name, hex: c.hex }));

  const sideStateRef = useRef<Record<PrintSide, SideState>>({
    FRONT: { json: null, history: [], redo: [] },
    BACK: { json: null, history: [], redo: [] },
  });

  const getTemplate = useCallback(() => allTemplates[activeProductType], [activeProductType, allTemplates]);

  const getPrintArea = useCallback(() => {
    const tmpl = getTemplate();
    if (tmpl) {
      const bySide = tmpl.printAreasBySide?.[activeSide];
      if (bySide) return bySide[activePrintSize];
      return tmpl.printAreas[activePrintSize];
    }
    return { x: 290, y: 200, w: 220, h: 320 };
  }, [activeSide, getTemplate, activePrintSize]);

  const getPocketArea = useCallback(() => {
    const tmpl = getTemplate();
    if (tmpl) {
      const bySide = tmpl.printAreasBySide?.[activeSide];
      if (bySide) return bySide['pocket'];
      return tmpl.printAreas['pocket'];
    }
    return computePrintArea(activeProductType || 'tshirt', 'pocket');
  }, [activeSide, getTemplate, activeProductType]);

  const getActiveArea = useCallback(() => {
    const tmpl = getTemplate();
    // Layout mode: use the admin-defined named layout
    if (tmpl?.layouts?.length && activeEditingLayoutId) {
      const layout = tmpl.layouts.find((l: PrintLayout) => l.id === activeEditingLayoutId);
      if (layout) return { x: layout.x, y: layout.y, w: layout.w, h: layout.h };
    }
    return editingPocket ? getPocketArea() : getPrintArea();
  }, [getTemplate, activeEditingLayoutId, editingPocket, getPocketArea, getPrintArea]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUserObjects = useCallback(() => {
    const fc = fcRef.current;
    return fc ? fc.getObjects().filter(o => !isGuide(o)) : [];
  }, []);

  const refreshLayers = useCallback(() => {
    const objs = getUserObjects();
    setLayerList([...objs]);
    setHasUserContent(objs.length > 0);
  }, [getUserObjects]);

  const [hasUserContent, setHasUserContent] = useState(false);

  /* ── Shadow overlay ── */
  const loadShadowOverlay = useCallback((fc: fabric.Canvas, tmpl: { shadowUrls?: Partial<Record<string, string>> }, side: PrintSide) => {
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

    // For templates that have real PNG image URLs (DB mockups + tshirt),
    // load the PNG directly — avoids the SVG blob restriction where
    // object-URL SVGs cannot load external image hrefs.
    const directUrl = tmpl.imageUrls?.[activeSideRef.current] ?? tmpl.imageUrls?.FRONT;
    if (directUrl) {
      const applyFabricImage = (el: HTMLImageElement) => {
        try {
          const nw = el.naturalWidth || CW;
          const nh = el.naturalHeight || CH;
          const fImg = new fabric.FabricImage(el, {
            left: 0, top: 0,
            scaleX: CW / nw, scaleY: CH / nh,
            originX: 'left', originY: 'top',
            selectable: false, evented: false,
          });
          // Apply colour tint to ALL image templates (multiply blend).
          // White base shows color directly; pre-coloured images blend with selection.
          if (activeColorHex !== '#ffffff') {
            try {
              const tintFilter = new (fabric.filters as any).BlendColor({
                color: activeColorHex, mode: 'multiply', alpha: 1,
              });
              fImg.filters = [tintFilter];
              fImg.applyFilters();
            } catch { /* filter not available in this env — render without tint */ }
          }
          fc.backgroundImage = fImg;
          fc.requestRenderAll();
        } catch (e) { console.error('Mockup load error', e); }
      };

      const imgEl = new Image();
      imgEl.crossOrigin = 'anonymous'; // needed for canvas toDataURL (prevents taint)
      imgEl.onload = () => applyFabricImage(imgEl);
      imgEl.onerror = () => {
        // CORS load failed — try the pre-cached base64 data URL (no CORS restriction)
        const cached = getCachedImage(directUrl);
        if (cached) {
          const cacheEl = new Image();
          cacheEl.onload = () => applyFabricImage(cacheEl);
          cacheEl.onerror = () => fallbackSVG(fc, tmpl);
          cacheEl.src = cached;
        } else {
          fallbackSVG(fc, tmpl);
        }
      };
      imgEl.src = directUrl;
      loadShadowOverlay(fc, tmpl, activeSideRef.current);
      return;
    }

    // Procedural SVG path for templates without image assets (hoodie, jacket, cap, pant)
    fallbackSVG(fc, tmpl);
    loadShadowOverlay(fc, tmpl, activeSideRef.current);

    function fallbackSVG(fc: fabric.Canvas, tmpl: MockupTemplate) {
      const svgStr = tmpl.renderSVG(activeSideRef.current, activeColorHex);
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
      imgEl.onerror = () => { URL.revokeObjectURL(url); };
      imgEl.src = url;
    }
  }, [getTemplate, activeColorHex, activeProductType, imgReady, loadShadowOverlay]);

  /* ── Guides ── */
  const addGuides = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    fc.getObjects().filter(o => isGuide(o)).forEach(o => fc.remove(o));

    const tmpl = getTemplate();
    const LAYOUT_GUIDE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#e879f9', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

    // ── Layout mode ──
    if (tmpl?.layouts?.length) {
      const sideLayouts = tmpl.layouts.filter((l: PrintLayout) => l.side === activeSideRef.current);
      // Only match active layout if it belongs to current side (avoids stale cross-side reference)
      const activeLayout = sideLayouts.find((l: PrintLayout) => l.id === activeEditingLayoutId);
      // Fallback: if active layout is from another side, treat first side layout as active
      const effectiveActiveId = activeLayout?.id ?? sideLayouts[0]?.id ?? null;
      const pa = activeLayout ?? (sideLayouts[0] ?? { x: 290, y: 200, w: 220, h: 320 });
      const oc = 'rgba(0,0,0,0.04)';
      [
        { l: 0, t: 0, w: CW, h: pa.y, n: '__oT' },
        { l: 0, t: pa.y + pa.h, w: CW, h: CH - pa.y - pa.h, n: '__oB' },
        { l: 0, t: pa.y, w: pa.x, h: pa.h, n: '__oL' },
        { l: pa.x + pa.w, t: pa.y, w: CW - pa.x - pa.w, h: pa.h, n: '__oR' },
      ].forEach(s => {
        const r = new fabric.Rect({ left: s.l, top: s.t, width: s.w, height: s.h, fill: oc, selectable: false, evented: false, originX: 'left', originY: 'top', excludeFromExport: true });
        (r as any).name = s.n;
        fc.add(r);
      });
      // Draw each layout in the current side
      sideLayouts.forEach((layout: PrintLayout, idx: number) => {
        const isActive = layout.id === effectiveActiveId;
        const isSelected = selectedLayoutIds.includes(layout.id);
        const color = LAYOUT_GUIDE_COLORS[tmpl.layouts!.findIndex((l: PrintLayout) => l.id === layout.id) % LAYOUT_GUIDE_COLORS.length];
        const border = new fabric.Rect({
          left: layout.x, top: layout.y, width: layout.w, height: layout.h,
          fill: isActive ? color + '18' : isSelected ? color + '0d' : 'transparent',
          stroke: color, strokeWidth: isActive ? 1.5 : 1,
          strokeDashArray: isActive ? [8, 4] : [5, 5],
          selectable: false, evented: false, originX: 'left', originY: 'top', excludeFromExport: true,
          opacity: isActive ? 1 : isSelected ? 0.7 : 0.35,
        });
        (border as any).name = `__border_${idx}`;
        fc.add(border);
        const label = new fabric.Text(layout.name.toUpperCase(), {
          left: layout.x + layout.w / 2, top: layout.y - 8,
          originX: 'center', originY: 'bottom', fontSize: 10,
          fill: color, fontFamily: 'Inter,Arial,sans-serif', fontWeight: '700', charSpacing: 150,
          opacity: isActive ? 1 : 0.5,
          selectable: false, evented: false, excludeFromExport: true,
        });
        (label as any).name = `__label_${idx}`;
        fc.add(label);
      });
      fc.renderAll();
      return;
    }

    // ── Legacy mode ──
    const pa = editingPocket ? getPocketArea() : getPrintArea();
    const oc = 'rgba(0,0,0,0.04)';
    [
      { l: 0, t: 0, w: CW, h: pa.y, n: '__oT' },
      { l: 0, t: pa.y + pa.h, w: CW, h: CH - pa.y - pa.h, n: '__oB' },
      { l: 0, t: pa.y, w: pa.x, h: pa.h, n: '__oL' },
      { l: pa.x + pa.w, t: pa.y, w: CW - pa.x - pa.w, h: pa.h, n: '__oR' },
    ].forEach(s => {
      const r = new fabric.Rect({ left: s.l, top: s.t, width: s.w, height: s.h, fill: oc, selectable: false, evented: false, originX: 'left', originY: 'top', excludeFromExport: true });
      (r as any).name = s.n;
      fc.add(r);
    });
    const border = new fabric.Rect({
      left: pa.x, top: pa.y, width: pa.w, height: pa.h,
      fill: 'rgba(173,216,255,0.25)', stroke: 'rgba(99,160,230,0.5)', strokeWidth: 1.5,
      strokeDashArray: [8, 4], selectable: false, evented: false, originX: 'left', originY: 'top', excludeFromExport: true,
    });
    (border as any).name = '__border';
    fc.add(border);
    const sizeLabel = editingPocket ? 'Pocket Print' : (PRINT_SIZES.find(s => s.id === activePrintSize)?.label ?? 'Print Area');
    const label = new fabric.Text(sizeLabel.toUpperCase(), {
      left: pa.x + pa.w / 2, top: pa.y - 8, originX: 'center', originY: 'bottom', fontSize: 10,
      fill: 'rgba(99,102,241,0.45)', fontFamily: 'Inter,Arial,sans-serif', fontWeight: '700', charSpacing: 200,
      selectable: false, evented: false, excludeFromExport: true,
    });
    (label as any).name = '__label';
    fc.add(label);
    const cl = 10, cc = 'rgba(99,102,241,0.4)';
    [[pa.x, pa.y, 1, 1], [pa.x + pa.w, pa.y, -1, 1],
     [pa.x, pa.y + pa.h, 1, -1], [pa.x + pa.w, pa.y + pa.h, -1, -1]].forEach((c, i) => {
      const h = new fabric.Rect({ left: c[0] - (c[2] < 0 ? cl : 0), top: c[1] - (c[3] < 0 ? 2 : 0), width: cl, height: 2, fill: cc, selectable: false, evented: false, excludeFromExport: true });
      (h as any).name = '__c' + i + 'a';
      const v = new fabric.Rect({ left: c[0] - (c[2] < 0 ? 2 : 0), top: c[1] - (c[3] < 0 ? cl : 0), width: 2, height: cl, fill: cc, selectable: false, evented: false, excludeFromExport: true });
      (v as any).name = '__c' + i + 'b';
      fc.add(h); fc.add(v);
    });
    if (pocketPrintEnabled && activeSideRef.current === 'FRONT') {
      const otherArea = editingPocket ? getPrintArea() : getPocketArea();
      const otherBorder = new fabric.Rect({ left: otherArea.x, top: otherArea.y, width: otherArea.w, height: otherArea.h, fill: 'transparent', stroke: 'rgba(160,160,160,0.4)', strokeWidth: 1, strokeDashArray: [4, 4], selectable: false, evented: false, originX: 'left', originY: 'top', excludeFromExport: true });
      (otherBorder as any).name = '__otherBorder';
      fc.add(otherBorder);
      const otherLabel = new fabric.Text(
        editingPocket ? (PRINT_SIZES.find(s => s.id === activePrintSize)?.label ?? 'BODY').toUpperCase() : 'POCKET',
        { left: otherArea.x + otherArea.w / 2, top: otherArea.y - 6, originX: 'center', originY: 'bottom', fontSize: 8, fill: 'rgba(160,160,160,0.5)', fontFamily: 'Inter,Arial,sans-serif', fontWeight: '600', charSpacing: 150, selectable: false, evented: false, excludeFromExport: true }
      );
      (otherLabel as any).name = '__otherLabel';
      fc.add(otherLabel);
    }
    fc.renderAll();
  }, [getTemplate, getPrintArea, getPocketArea, activePrintSize, editingPocket, pocketPrintEnabled, activeEditingLayoutId, selectedLayoutIds]);

  /* ── History ── */
  const saveHistory = useCallback(() => {
    const fc = fcRef.current;
    if (isLoadingRef.current || !fc) return;
    const json = JSON.stringify(fc.toObject(['name', 'customId', 'layerName', 'printZone']));
    // Use ref so this function is stable and always saves to the correct side,
    // even when captured by canvas event listeners registered once at init.
    const ss = sideStateRef.current[activeSideRef.current];
    ss.history.push(json);
    ss.redo = [];
    if (ss.history.length > 50) ss.history.shift();
  }, []);  // no deps — uses activeSideRef.current

  const reapplyClipPaths = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    fc.getObjects().forEach(o => {
      if (isGuide(o)) return;
      const zone = (o as any).printZone as string | undefined;
      if (zone && layoutClipRefs.current[zone]) {
        o.clipPath = layoutClipRefs.current[zone];
      } else if (zone === 'pocket' && pocketClipRef.current) {
        o.clipPath = pocketClipRef.current;
      } else if (clipRef.current) {
        o.clipPath = clipRef.current;
      }
    });
  }, []);

  /* ── Auto-save (local) ── */
  const scheduleAutoSave = useCallback(() => {
    setSaveStatus('saving');
    // Capture the side at call time via ref so the timeout always saves to the right side.
    const sideAtCallTime = activeSideRef.current;
    setTimeout(() => {
      const fc = fcRef.current;
      if (!fc) return;
      sideStateRef.current[sideAtCallTime].json = fc.toObject(['name', 'customId', 'layerName', 'printZone']);
      setSaveStatus('saved');
    }, 500);
  }, []);  // no deps — uses activeSideRef.current snapshot

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
    const json = JSON.stringify(fc.toObject(['name', 'customId', 'layerName', 'printZone']));
    sideStateRef.current.FRONT.history.push(json);

    fc.on('object:added', (e: any) => {
      if (!isLoadingRef.current && !isGuide(e.target)) { saveHistory(); scheduleAutoSave(); }
      const shadow = fc.getObjects().find(o => (o as any).name === '__shadow');
      if (shadow && e.target !== shadow) fc.bringObjectToFront(shadow);
      refreshLayers();
    });
    fc.on('object:modified', (e: any) => {
      if (!isLoadingRef.current && !isGuide(e.target)) { saveHistory(); scheduleAutoSave(); }
      forceUpdate(n => n + 1);
    });
    fc.on('object:removed', () => {
      refreshLayers();
      const remaining = fc.getObjects().filter(o => !isGuide(o));
      // Remove layout from selectedLayoutIds if all its objects were deleted
      setSelectedLayoutIds(prev => prev.filter(id => remaining.some(o => (o as any).printZone === id)));
      // Remove this side from selectedSides if no user designs remain on it
      if (remaining.length === 0) {
        setSelectedSides(prev => prev.filter(s => s !== activeSideRef.current));
      }
    });
    fc.on('selection:created', (e: any) => setSelectedObj(e.selected?.[0] || null));
    fc.on('selection:updated', (e: any) => setSelectedObj(e.selected?.[0] || null));
    fc.on('selection:cleared', () => setSelectedObj(null));
    fc.on('object:moving', (e: any) => {
      const obj = e.target; if (!obj) return;
      const zone = (obj as any).printZone;
      const p = zone === 'pocket' ? getPocketArea() : getPrintArea();
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
      if (panning) {
        const v = fc.viewportTransform!;
        v[4] += o.e.clientX - lx; v[5] += o.e.clientY - ly;
        fc.requestRenderAll(); lx = o.e.clientX; ly = o.e.clientY;
      }
    });
    fc.on('mouse:up', () => { panning = false; });

    autoScale();
    window.addEventListener('resize', autoScale);
    return () => { window.removeEventListener('resize', autoScale); fc.dispose(); fcRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadMockup(); }, [loadMockup]);
  useEffect(() => {
    preloadMockupImages().then(() => setImgReady(true));
    // Fetch active DB mockups and merge them into the template registry
    api.getActiveMockups().then(async (dbMockups) => {
      if (!dbMockups || dbMockups.length === 0) return;
      // Preload all their images first
      const imageUrls: string[] = [];
      dbMockups.forEach(m => {
        if (m.frontImage) imageUrls.push(m.frontImage);
        if (m.backImage) imageUrls.push(m.backImage);
        if (m.frontShadow) imageUrls.push(m.frontShadow);
        if (m.backShadow) imageUrls.push(m.backShadow);
      });
      await preloadAdditionalImages(imageUrls);
      const newTemplates: Record<string, MockupTemplate> = {};
      dbMockups.forEach((m: any) => { newTemplates[`db_${m.id}`] = buildTemplateFromDBMockup(m); });
      setAllTemplates(newTemplates);
      // Auto-select the template linked to the product (from /design-studio/:id)
      if (productRouteId) {
        api.getProduct(productRouteId).then((product: any) => {
          if (product?.mockupId && newTemplates[`db_${product.mockupId}`]) {
            setActiveProductType(`db_${product.mockupId}`);
          } else {
            setActiveProductType(prev => (!prev || !newTemplates[prev]) ? Object.keys(newTemplates)[0] || '' : prev);
          }
        }).catch(() => {
          setActiveProductType(prev => (!prev || !newTemplates[prev]) ? Object.keys(newTemplates)[0] || '' : prev);
        });
      } else {
        setActiveProductType(prev => (!prev || !newTemplates[prev]) ? Object.keys(newTemplates)[0] || '' : prev);
      }
      setImgReady(r => !r ? true : r); // trigger re-render
    }).catch(() => {/* design studio works fine without DB mockups */});
  }, []);
  useEffect(() => {
    const fc = fcRef.current; if (!fc) return;
    const tmpl = getTemplate();

    if (tmpl?.layouts?.length) {
      // Layout mode — build a clip rect per layout
      layoutClipRefs.current = {};
      tmpl.layouts.forEach((layout: PrintLayout) => {
        layoutClipRefs.current[layout.id] = new fabric.Rect({ left: layout.x, top: layout.y, width: layout.w, height: layout.h, absolutePositioned: true });
      });
      // Body clip = first front layout or default
      const firstFront = tmpl.layouts.find((l: PrintLayout) => l.side === 'FRONT') ?? tmpl.layouts[0];
      clipRef.current = new fabric.Rect({ left: firstFront.x, top: firstFront.y, width: firstFront.w, height: firstFront.h, absolutePositioned: true });
    } else {
      // Legacy mode
      const bodyPa = getPrintArea();
      clipRef.current = new fabric.Rect({ left: bodyPa.x, top: bodyPa.y, width: bodyPa.w, height: bodyPa.h, absolutePositioned: true });
      const pocketPa = getPocketArea();
      pocketClipRef.current = new fabric.Rect({ left: pocketPa.x, top: pocketPa.y, width: pocketPa.w, height: pocketPa.h, absolutePositioned: true });
    }

    // Reapply correct clip paths
    fc.getObjects().filter(o => !isGuide(o)).forEach(o => {
      const zone = (o as any).printZone as string | undefined;
      if (zone && layoutClipRefs.current[zone]) {
        o.clipPath = layoutClipRefs.current[zone];
      } else if (zone === 'pocket') {
        o.clipPath = pocketClipRef.current ?? undefined;
      } else {
        o.clipPath = clipRef.current ?? undefined;
      }
    });
    addGuides();
  }, [activeProductType, activeSide, activePrintSize, editingPocket, activeEditingLayoutId, selectedLayoutIds, getPrintArea, getPocketArea, getTemplate, addGuides]);
  useEffect(() => { autoScale(); }, [autoScale]);

  /* ── Init layout selection when template/side changes ── */
  useEffect(() => {
    const tmpl = getTemplate();
    if (!tmpl?.layouts?.length) return;
    const sideLayouts = tmpl.layouts.filter((l: PrintLayout) => l.side === activeSide);
    if (sideLayouts.length === 0) return;
    // Only switch the active editing layout — do NOT touch selectedLayoutIds (that would drop the other side's selection)
    const stillValid = sideLayouts.find((l: PrintLayout) => l.id === activeEditingLayoutId);
    if (!stillValid) {
      setActiveEditingLayoutId(sideLayouts[0].id);
    }
  }, [activeProductType, activeSide, allTemplates]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Initialize layout selection when a new template is first loaded ── */
  useEffect(() => {
    const tmpl = getTemplate();
    if (!tmpl?.layouts?.length) return;
    if (activeEditingLayoutId) return; // already set
    const frontLayouts = tmpl.layouts.filter((l: PrintLayout) => l.side === 'FRONT');
    const first = frontLayouts[0] ?? tmpl.layouts[0];
    // Set active editing layout but DON'T pre-select it for pricing — user must place a design first
    if (first) { setActiveEditingLayoutId(first.id); setSelectedLayoutIds([]); }
  }, [activeProductType, allTemplates]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Local price calculation ── */
  useEffect(() => {
    const tmpl = allTemplates[activeProductType];
    let originalPrice: number;

    if (tmpl?.layouts?.length) {
      // Layout mode: only count layouts that actually have user objects on the canvas (current side)
      // plus any other sides saved in sideStateRef
      const allSideObjects: Array<{ printZone: string }> = [];
      // Current canvas objects
      const fc = fcRef.current;
      if (fc) {
        fc.getObjects().filter(o => !isGuide(o)).forEach(o => allSideObjects.push({ printZone: (o as any).printZone || '' }));
      }
      // Objects saved from other sides
      Object.entries(sideStateRef.current).forEach(([, ss]) => {
        if (ss.json) {
          const objs: any[] = (ss.json as any).objects || [];
          objs.filter(o => o.name == null || !String(o.name).startsWith('__')).forEach(o => allSideObjects.push({ printZone: o.printZone || '' }));
        }
      });
      const layoutTotal = tmpl.layouts!.reduce((sum: number, layout: PrintLayout) => {
        const hasContent = allSideObjects.some(o => o.printZone === layout.id);
        return sum + (hasContent ? (layout?.price ?? 499) : 0);
      }, 0);
      originalPrice = layoutTotal * quantity;
    } else {
      // Legacy mode
      const sizePrices: Record<string, number> = { full: 599, medium: 499, small: 399, pocket: 299 };
      const areaPrice = (tmpl?.printAreas?.[activePrintSize] as any)?.price;
      const basePrice = areaPrice != null ? areaPrice : (sizePrices[activePrintSize] ?? 499);
      const pocketAddon = pocketPrintEnabled && activePrintSize !== 'pocket' ? (sizePrices.pocket ?? 299) : 0;
      const sideMultiplier = selectedSides.length;
      originalPrice = (basePrice * sideMultiplier + pocketAddon) * quantity;
    }

    const discount = quantity >= 10 ? 15 : quantity >= 5 ? 10 : quantity >= 3 ? 5 : 0;
    const productBase = (tmpl?.basePrice || 0) * quantity;
    const finalPrice = Math.round((originalPrice + productBase) * (1 - discount / 100));
    setPrice({ originalPrice: originalPrice + productBase, finalPrice, discountPercent: discount });
  }, [selectedSides, quantity, activePrintSize, pocketPrintEnabled, activeProductType, allTemplates, layerList]); // layerList changes when objects are added/removed → re-evaluate price

  /* ── Actions ── */
  const handleAddText = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const pa = getActiveArea();
    const tmpl = getTemplate();
    const isLayoutMode = !!(tmpl?.layouts?.length && activeEditingLayoutId);
    const clip = isLayoutMode
      ? (layoutClipRefs.current[activeEditingLayoutId!] ?? clipRef.current)
      : (editingPocket ? pocketClipRef.current : clipRef.current);
    if (!clip) return;
    const zone = isLayoutMode ? activeEditingLayoutId! : (editingPocket ? 'pocket' : 'body');
    const activeLayout = isLayoutMode ? tmpl!.layouts!.find((l: PrintLayout) => l.id === activeEditingLayoutId) : null;
    const text = new fabric.IText('Your Text', {
      left: pa.x + pa.w / 2, top: pa.y + pa.h / 2,
      originX: 'center', originY: 'center',
      fill: '#000000', fontSize: isLayoutMode ? Math.max(14, Math.round(pa.w / 8)) : (editingPocket ? 14 : 36),
      fontFamily: 'Arial', clipPath: clip,
    });
    (text as any).customId = crypto.randomUUID();
    (text as any).layerName = activeLayout ? `${activeLayout.name} Text` : (editingPocket ? 'Pocket Text' : 'Text');
    (text as any).printZone = zone;
    fc.add(text); fc.setActiveObject(text); fc.renderAll();
    // Auto-add this layout to selectedLayoutIds so it's priced
    if (isLayoutMode && activeEditingLayoutId) {
      setSelectedLayoutIds(prev => prev.includes(activeEditingLayoutId) ? prev : [...prev, activeEditingLayoutId]);
    }
    // Auto-add this side to selectedSides so it's included in the order
    setSelectedSides(prev => prev.includes(activeSideRef.current) ? prev : [...prev, activeSideRef.current]);
  }, [getActiveArea, getTemplate, activeEditingLayoutId, editingPocket]);

  const handleAddImage = useCallback(async (file: File) => {
    const fc = fcRef.current; if (!fc) return;
    const tmpl = getTemplate();
    const isLayoutMode = !!(tmpl?.layouts?.length && activeEditingLayoutId);
    const clip = isLayoutMode
      ? (layoutClipRefs.current[activeEditingLayoutId!] ?? clipRef.current)
      : (editingPocket ? pocketClipRef.current : clipRef.current);
    if (!clip) return;
    if (file.size > 10 * 1024 * 1024) return;
    let blob: Blob = file;
    if (file.size > 500 * 1024) {
      try { blob = await compressImage(file, { maxWidth: 2048, maxHeight: 2048, quality: 0.85 }); } catch { blob = file; }
    }
    const zone = isLayoutMode ? activeEditingLayoutId! : (editingPocket ? 'pocket' : 'body');
    const activeLayout = isLayoutMode ? tmpl!.layouts!.find((l: PrintLayout) => l.id === activeEditingLayoutId) : null;
    const reader = new FileReader();
    reader.onload = () => {
      const imgEl = new Image();
      imgEl.onload = () => {
        const pa = getActiveArea();
        const fImg = new fabric.FabricImage(imgEl);
        const fitScale = Math.min((pa.w * 0.8) / fImg.width, (pa.h * 0.8) / fImg.height);
        fImg.set({ left: pa.x + pa.w / 2, top: pa.y + pa.h / 2, originX: 'center', originY: 'center', scaleX: fitScale, scaleY: fitScale, clipPath: clip });
        (fImg as any).customId = crypto.randomUUID();
        (fImg as any).layerName = activeLayout ? `${activeLayout.name} Image` : (editingPocket ? 'Pocket Image' : 'Image');
        (fImg as any).printZone = zone;
        fc.add(fImg); fc.setActiveObject(fImg); fc.renderAll();
        // Auto-add this layout to selectedLayoutIds so it's priced
        if (isLayoutMode && activeEditingLayoutId) {
          setSelectedLayoutIds(prev => prev.includes(activeEditingLayoutId) ? prev : [...prev, activeEditingLayoutId]);
        }
        // Auto-add this side to selectedSides so it's included in the order
        setSelectedSides(prev => prev.includes(activeSideRef.current) ? prev : [...prev, activeSideRef.current]);
      };
      imgEl.src = reader.result as string;
    };
    reader.readAsDataURL(blob);
  }, [getActiveArea, getTemplate, activeEditingLayoutId, editingPocket]);

  const handleDelete = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject();
    if (obj && !isGuide(obj)) { fc.remove(obj); fc.discardActiveObject(); fc.renderAll(); }
  }, []);

  const handleDuplicate = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject(); if (!obj || isGuide(obj)) return;
    const zone = (obj as any).printZone || 'body';
    const clip = zone === 'pocket' ? pocketClipRef.current : clipRef.current;
    obj.clone().then((c: fabric.FabricObject) => {
      c.set({ left: (obj.left || 0) + 20, top: (obj.top || 0) + 20, clipPath: clip });
      (c as any).customId = crypto.randomUUID();
      (c as any).layerName = ((obj as any).layerName || obj.type) + ' copy';
      (c as any).printZone = zone;
      fc.add(c); fc.setActiveObject(c); fc.renderAll();
    });
  }, []);

  const handleCenter = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject(); if (!obj || isGuide(obj)) return;
    const pa = getActiveArea();
    obj.set({ left: pa.x + pa.w / 2, top: pa.y + pa.h / 2, originX: 'center', originY: 'center' });
    obj.setCoords(); fc.renderAll();
  }, [getActiveArea]);

  const handleFlipH = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject(); if (!obj || isGuide(obj)) return;
    obj.set('flipX', !obj.flipX);
    fc.renderAll(); saveHistory(); scheduleAutoSave();
  }, [saveHistory, scheduleAutoSave]);

  const handleFlipV = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject(); if (!obj || isGuide(obj)) return;
    obj.set('flipY', !obj.flipY);
    fc.renderAll(); saveHistory(); scheduleAutoSave();
  }, [saveHistory, scheduleAutoSave]);

  const handleToggleLock = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject(); if (!obj || isGuide(obj)) return;
    const isLocked = obj.lockMovementX;
    obj.set({
      lockMovementX: !isLocked,
      lockMovementY: !isLocked,
      lockScalingX: !isLocked,
      lockScalingY: !isLocked,
      lockRotation: !isLocked,
      hasControls: isLocked,
    });
    fc.renderAll(); forceUpdate(n => n + 1);
  }, []);

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
    // Update ref FIRST so loadMockup/addGuides immediately use the correct new side
    activeSideRef.current = newSide;
    isLoadingRef.current = true;
    sideStateRef.current[activeSide].json = fc.toObject(['name', 'customId', 'layerName', 'printZone']);
    // Save a thumbnail of the current side (reset viewport to capture full design)
    const savedVT = fc.viewportTransform ? [...fc.viewportTransform] : [1, 0, 0, 1, 0, 0];
    fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fc.renderAll();
    sideStateRef.current[activeSide].thumbnail = fc.toDataURL({ format: 'png', multiplier: 1 });
    fc.setViewportTransform(savedVT as [number, number, number, number, number, number]);
    const ns = sideStateRef.current[newSide];
    if (ns.json) {
      fc.loadFromJSON(ns.json).then(() => {
        loadMockup(); reapplyClipPaths(); addGuides();
        isLoadingRef.current = false; refreshLayers();
      });
    } else {
      fc.clear(); fc.backgroundColor = '#e8eaed';
      loadMockup(); addGuides(); fc.renderAll();
      if (ns.history.length === 0) ns.history.push(JSON.stringify(fc.toObject(['name', 'customId', 'layerName', 'printZone'])));
      isLoadingRef.current = false; refreshLayers();
    }
    setActiveSide(newSide);
  }, [activeSide, loadMockup, reapplyClipPaths, addGuides, refreshLayers]);

  const handleToggleSide = useCallback((side: PrintSide) => {
    handleSwitchSide(side);
  }, [handleSwitchSide]);

  const handleZoomIn = useCallback(() => { const fc = fcRef.current; if (fc) { fc.setZoom(Math.min(3, fc.getZoom() + 0.15)); fc.requestRenderAll(); } }, []);
  const handleZoomOut = useCallback(() => { const fc = fcRef.current; if (fc) { fc.setZoom(Math.max(0.3, fc.getZoom() - 0.15)); fc.requestRenderAll(); } }, []);
  const handleResetView = useCallback(() => { const fc = fcRef.current; if (fc) { fc.setZoom(1); fc.viewportTransform = [1, 0, 0, 1, 0, 0]; fc.requestRenderAll(); } }, []);

  const handlePreview = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    // Hide decoration guides (print-area overlays, border, labels)
    // but keep the shadow overlay (__shadow) so the preview looks realistic.
    const decorGuides = fc.getObjects().filter(o => {
      const name = (o as any).name as string | undefined;
      return name && name.startsWith('__') && name !== '__shadow';
    });
    decorGuides.forEach(o => { o.visible = false; });
    // Temporarily reset viewport so export is at native canvas size
    const savedTransform = fc.viewportTransform ? [...fc.viewportTransform] : [1, 0, 0, 1, 0, 0];
    fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fc.renderAll();
    const dataUrl = fc.toDataURL({ format: 'png', multiplier: 2 });
    // Restore
    fc.setViewportTransform(savedTransform as [number, number, number, number, number, number]);
    decorGuides.forEach(o => { o.visible = true; });
    fc.renderAll();
    setPreviewUrl(dataUrl);
  }, []);

  const handleAddToCart = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    sideStateRef.current[activeSide].json = fc.toObject(['name', 'customId', 'layerName', 'printZone']);

    // Capture design images for all selected sides
    const designImages: Record<string, string> = {};
    // Current side
    designImages[activeSide] = fc.toDataURL({ format: 'png', multiplier: 2 });
    // Other selected sides — use thumbnail saved when the user last switched away from that side
    for (const side of selectedSides) {
      if (side !== activeSide && sideStateRef.current[side].json) {
        designImages[side] = sideStateRef.current[side].thumbnail || '';
      }
    }

    // Extract original uploaded images (base64) from the canvas JSON for each side.
    // Each Fabric image object serializes its src as the base64 data URL that was loaded into it.
    // We skip internal guide/shadow objects (those have names starting with '__').
    const uploadedImages: Record<string, string[]> = {};
    const extractImgs = (json: any): string[] =>
      ((json as any).objects || [])
        .filter((o: any) =>
          (o.type === 'image' || o.type === 'Image') &&
          typeof o.src === 'string' &&
          o.src.startsWith('data:') &&
          !String(o.name || '').startsWith('__')
        )
        .map((o: any) => o.src as string);

    // Current active side — use the just-saved JSON
    const activeImgs = extractImgs(sideStateRef.current[activeSide].json);
    if (activeImgs.length > 0) uploadedImages[activeSide] = activeImgs;

    // Other selected sides — use their saved state
    for (const side of selectedSides) {
      if (side !== activeSide) {
        const savedJson = sideStateRef.current[side].json;
        if (savedJson) {
          const imgs = extractImgs(savedJson);
          if (imgs.length > 0) uploadedImages[side] = imgs;
        }
      }
    }

    // Store design data in sessionStorage for the cart page
    const designData = {
      productType: activeProductType,
      colorHex: activeColorHex,
      colorName: activeColorName,
      printSize: activePrintSize,
      pocketPrint: pocketPrintEnabled,
      sides: selectedSides,
      designImages,
      uploadedImages,
      quantity,
      unitPrice: price?.finalPrice ? price.finalPrice / quantity : 0,
      total: price?.finalPrice || 0,
    };
    // Also keep sessionStorage for backward compat with design-studio/cart
    sessionStorage.setItem('tfw_design_cart', JSON.stringify(designData));
    // Add to unified cart
    addDesignItem(designData);
    navigate('/cart');
  }, [activeSide, activeProductType, activeColorHex, activeColorName, activePrintSize, selectedSides, quantity, price, navigate, addDesignItem]);

  const handleUpdateObj = useCallback((prop: string, value: unknown) => {
    const fc = fcRef.current; if (!fc) return;
    const obj = fc.getActiveObject(); if (!obj || isGuide(obj)) return;
    obj.set(prop as keyof fabric.FabricObject, value as any);
    fc.renderAll(); forceUpdate(n => n + 1);
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

  /* ── Keyboard shortcuts ── */
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

  const availablePrintSizes = PRINT_SIZES.filter(ps => ps.id !== 'pocket' && ps.sides.includes(activeSide));
  const currentTemplate = getTemplate();
  const templateLayouts = currentTemplate?.layouts ?? [];
  const sideLayouts = templateLayouts.filter((l: PrintLayout) => l.side === activeSide);

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
        onSwitchPrintSize={(size) => { setActivePrintSize(size); setEditingPocket(false); }}
        pocketPrintEnabled={pocketPrintEnabled}
        onTogglePocketPrint={() => {
          if (!pocketPrintEnabled) { setPocketPrintEnabled(true); setEditingPocket(true); }
          else if (editingPocket) { setEditingPocket(false); }
          else { setEditingPocket(true); }
        }}
        editingPocket={editingPocket}
        onDisablePocket={() => { setPocketPrintEnabled(false); setEditingPocket(false); }}
        showPocketToggle={activeSide === 'FRONT' && templateLayouts.length === 0}
        layouts={sideLayouts}
        selectedLayoutIds={selectedLayoutIds}
        activeEditingLayoutId={activeEditingLayoutId}
        allowMultipleLayouts={currentTemplate?.allowMultipleLayouts ?? false}
        onToggleLayout={(id) => {
          const tmpl = getTemplate();
          setSelectedLayoutIds(prev => {
            if (prev.includes(id)) {
              // Deselect — keep at least one
              return prev.length > 1 ? prev.filter(x => x !== id) : prev;
            }
            if (prev.length === 0) return [id];
            // Check if this layout is compatible with ALL currently selected layouts
            const target = tmpl?.layouts?.find((l: PrintLayout) => l.id === id);
            const canAdd = prev.every(selId => {
              const sel = tmpl?.layouts?.find((l: PrintLayout) => l.id === selId);
              return (sel?.compatibleWith ?? []).includes(id) && (target?.compatibleWith ?? []).includes(selId);
            });
            return canAdd ? [...prev, id] : [id];
          });
          setActiveEditingLayoutId(id);
        }}
      />
      <div className="main-area">
        {/* Mobile toolbar — visible only < 700px when left panel is hidden */}
        <div className="mobile-toolbar">
          <button onClick={handleAddText}>Text</button>
          <label className="file-label-mobile">
            Image
            <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleAddImage(f); e.target.value = ''; }} />
          </label>
          <button onClick={handleDelete}>Del</button>
          <button onClick={handleDuplicate}>Copy</button>
          <button onClick={handleCenter}>Center</button>
          <button onClick={handleFlipH}>Flip H</button>
          <button onClick={handleFlipV}>Flip V</button>
          <button onClick={handleToggleLock}>{selectedObj?.lockMovementX ? 'Locked' : 'Unlock'}</button>
          <button onClick={handlePreview}>Preview</button>
        </div>
        <LeftPanel
          activeProductType={activeProductType}
          onSwitchType={setActiveProductType}
          templates={allTemplates}
          onAddText={handleAddText}
          onAddImage={handleAddImage}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onCenter={handleCenter}
          onFlipH={handleFlipH}
          onFlipV={handleFlipV}
          onToggleLock={handleToggleLock}
          isLocked={selectedObj ? !!selectedObj.lockMovementX : false}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onPreview={handlePreview}
        />
        <div className="canvas-area">
          <div className="canvas-wrap" style={{ position: 'relative' }}>
            <canvas ref={canvasRef} width={CW} height={CH} />
            {!hasUserContent && (
              <button
                className="upload-overlay-btn"
                title="Upload Image"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleAddImage(f);
                e.target.value = '';
              }}
            />
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
        pocketPrintEnabled={pocketPrintEnabled}
      />

      {/* ── Preview Modal ── */}
      {previewUrl && (
        <div className="preview-overlay" onClick={() => setPreviewUrl(null)}>
          <div className="preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-modal-header">
              <span className="preview-modal-title">
                Print-Ready Preview
              </span>
              <div className="preview-modal-actions">
                <a className="preview-download-btn" href={previewUrl} download={`${activeProductType}-${activeSide.toLowerCase()}.png`}>
                  Download PNG
                </a>
                <button className="preview-close-btn" onClick={() => setPreviewUrl(null)}>X</button>
              </div>
            </div>
            <div className="preview-modal-body">
              <div className="preview-product-frame">
                <img src={previewUrl} alt="Product preview" className="preview-product-img" />
              </div>
              <div className="preview-product-meta">
                <div className="preview-meta-row">
                  <span className="preview-meta-label">Product</span>
                  <span className="preview-meta-value">{getTemplate()?.label ?? activeProductType}</span>
                </div>
                <div className="preview-meta-row">
                  <span className="preview-meta-label">Colour</span>
                  <span className="preview-meta-value" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: activeColorHex, border: activeColorHex === '#ffffff' ? '1px solid #ccc' : 'none', display: 'inline-block', flexShrink: 0 }} />
                    {activeColorName}
                  </span>
                </div>
                <div className="preview-meta-row">
                  <span className="preview-meta-label">Side</span>
                  <span className="preview-meta-value">{activeSide}</span>
                </div>
                <div className="preview-meta-row">
                  <span className="preview-meta-label">Print Size</span>
                  <span className="preview-meta-value" style={{ textTransform: 'capitalize' }}>{activePrintSize}</span>
                </div>
                <button
                  className="preview-cart-btn"
                  onClick={() => { setPreviewUrl(null); handleAddToCart(); }}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
