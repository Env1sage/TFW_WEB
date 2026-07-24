import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Package, Layers as LayersIcon, Upload, Type, Smile, ShoppingCart } from 'lucide-react';
import * as fabric from 'fabric';
import type { TabId } from './LeftPanel';
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
  const [searchParams] = useSearchParams();
  const { addDesignItem } = useCart();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fcRef = useRef<fabric.Canvas | null>(null);
  const clipRef = useRef<fabric.Object | null>(null);
  const pocketClipRef = useRef<fabric.Object | null>(null);
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
  const layoutClipRefs = useRef<Record<string, fabric.Object>>({});
  const [activeColorHex, setActiveColorHex] = useState(() => searchParams.get('color') || '#ffffff');
  const [activeColorName, setActiveColorName] = useState(() => searchParams.get('colorName') || 'White');
  const [activeProductType, setActiveProductType] = useState('');
  const [productMockupKey, setProductMockupKey] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | undefined>(undefined);
  const [allTemplates, setAllTemplates] = useState<Record<string, MockupTemplate>>({});
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState<PriceResult | null>(null);
  const [productBasePrice, setProductBasePrice] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [selectedObj, setSelectedObj] = useState<fabric.FabricObject | null>(null);
  const [layerList, setLayerList] = useState<fabric.FabricObject[]>([]);
  const [, forceUpdate] = useState(0);
  const [imgReady, setImgReady] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Partial<Record<PrintSide, string>>>({});
  const [previewSide, setPreviewSide] = useState<PrintSide>('FRONT');
  const [activeTab, setActiveTab] = useState<TabId | null>('product');
  const [uploadEnabled, setUploadEnabled] = useState(true);

  const colors = COLORS.map(c => ({ name: c.name, hex: c.hex }));

  const sideStateRef = useRef<Record<PrintSide, SideState>>({
    FRONT: { json: null, history: [], redo: [] },
    BACK: { json: null, history: [], redo: [] },
  });

  const getTemplate = useCallback(() => allTemplates[activeProductType], [activeProductType, allTemplates]);

  // Only show BACK tab if the template has an actual back mockup image URL
  const availableSides = useMemo((): PrintSide[] => {
    const tmpl = allTemplates[activeProductType];
    if (!tmpl) return ['FRONT'];
    return tmpl.imageUrls?.BACK ? ['FRONT', 'BACK'] : ['FRONT'];
  }, [activeProductType, allTemplates]);

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
  const [sideThumbnails, setSideThumbnails] = useState<Partial<Record<PrintSide, string>>>({});
  const [hoverSnapshot, setHoverSnapshot] = useState<string | null>(null);
  const [canvasHover, setCanvasHover] = useState<{ bgX: number; bgY: number; left: number; top: number } | null>(null);

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
      const pa = activeLayout ?? (sideLayouts[0] ?? { x: 290, y: 200, w: 220, h: 320, shape: 'rect' as const });
      const oc = 'rgba(0,0,0,0.04)';
      if ((pa as PrintLayout).shape === 'polygon' && (pa as PrintLayout).points && (pa as PrintLayout).points!.length >= 3) {
        const polyHole = new fabric.Polygon((pa as PrintLayout).points!.map(p => ({ x: p.x, y: p.y })), { absolutePositioned: true });
        (polyHole as any).inverted = true;
        const dimOverlay = new fabric.Rect({ left: 0, top: 0, width: CW, height: CH, fill: oc, selectable: false, evented: false, originX: 'left', originY: 'top', excludeFromExport: true, clipPath: polyHole });
        (dimOverlay as any).name = '__oPolygon';
        fc.add(dimOverlay);
      } else if ((pa as PrintLayout).shape === 'ellipse' || (pa as PrintLayout).shape === 'circle') {
        // For ellipse: one full-canvas dim overlay clipped with an inverted ellipse
        const cx = pa.x + pa.w / 2, cy = pa.y + pa.h / 2;
        const ellipseHole = new fabric.Ellipse({ rx: pa.w / 2, ry: pa.h / 2, left: cx, top: cy, originX: 'center', originY: 'center', absolutePositioned: true });
        (ellipseHole as any).inverted = true;
        const dimOverlay = new fabric.Rect({ left: 0, top: 0, width: CW, height: CH, fill: oc, selectable: false, evented: false, originX: 'left', originY: 'top', excludeFromExport: true, clipPath: ellipseHole });
        (dimOverlay as any).name = '__oEllipse';
        fc.add(dimOverlay);
      } else {
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
      }
      // Draw each layout in the current side
      sideLayouts.forEach((layout: PrintLayout, idx: number) => {
        const isActive = layout.id === effectiveActiveId;
        const isSelected = selectedLayoutIds.includes(layout.id);
        const color = LAYOUT_GUIDE_COLORS[tmpl.layouts!.findIndex((l: PrintLayout) => l.id === layout.id) % LAYOUT_GUIDE_COLORS.length];
        const borderProps = {
          fill: isActive ? color + '18' : isSelected ? color + '0d' : 'transparent',
          stroke: color, strokeWidth: isActive ? 1.5 : 1,
          strokeDashArray: isActive ? [8, 4] : [5, 5],
          selectable: false, evented: false, excludeFromExport: true,
          opacity: isActive ? 1 : isSelected ? 0.7 : 0.35,
        };
        let border: fabric.Object;
        if (layout.shape === 'polygon' && layout.points && layout.points.length >= 3) {
          border = new fabric.Polygon(
            layout.points.map(p => ({ x: p.x, y: p.y })),
            { ...borderProps }
          );
        } else if (layout.shape === 'ellipse' || layout.shape === 'circle') {
          border = new fabric.Ellipse({
            left: layout.x + layout.w / 2, top: layout.y + layout.h / 2,
            rx: layout.w / 2, ry: layout.h / 2,
            originX: 'center', originY: 'center',
            ...borderProps,
          });
        } else {
          border = new fabric.Rect({
            left: layout.x, top: layout.y, width: layout.w, height: layout.h,
            originX: 'left', originY: 'top',
            ...borderProps,
          });
        }
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

  /* ── Thumbnail capture for bottom bar previews ── */
  const captureThumbnail = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const decorGuides = fc.getObjects().filter(o => {
      const name = (o as any).name as string | undefined;
      return name && name.startsWith('__') && name !== '__shadow';
    });
    decorGuides.forEach(o => { o.visible = false; });
    const savedVT = fc.viewportTransform ? [...fc.viewportTransform] : [1, 0, 0, 1, 0, 0];
    fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fc.renderAll();
    const smallThumb = fc.toDataURL({ format: 'jpeg', quality: 0.55, multiplier: 0.32 });
    const hoverThumb = fc.toDataURL({ format: 'jpeg', quality: 0.78, multiplier: 0.65 });
    fc.setViewportTransform(savedVT as [number, number, number, number, number, number]);
    decorGuides.forEach(o => { o.visible = true; });
    fc.renderAll();
    const side = activeSideRef.current;
    setSideThumbnails(prev => ({ ...prev, [side]: smallThumb }));
    setHoverSnapshot(hoverThumb);
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
      captureThumbnail();
    }, 500);
  }, [captureThumbnail]);  // stable: captureThumbnail only uses refs

  /* ── Canvas auto-scale ── */
  const autoScale = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const area = document.querySelector('.canvas-area');
    if (!area) return;
    const maxW = area.clientWidth - 32, maxH = area.clientHeight - 32;
    if (maxW <= 0 || maxH <= 0) return;
    const scale = Math.min(maxW / CW, maxH / CH);
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
      backgroundColor: '#ffffff',
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
      if (isGuide(e.target)) return;
      if (!isLoadingRef.current) { saveHistory(); scheduleAutoSave(); }
      const shadow = fc.getObjects().find(o => (o as any).name === '__shadow');
      if (shadow && e.target !== shadow) fc.bringObjectToFront(shadow);
      refreshLayers();
    });
    fc.on('object:modified', (e: any) => {
      if (!isLoadingRef.current && !isGuide(e.target)) { saveHistory(); scheduleAutoSave(); }
      forceUpdate(n => n + 1);
    });
    fc.on('object:removed', (e: any) => {
      if (isGuide(e.target)) return;
      saveHistory(); scheduleAutoSave();
      refreshLayers();
      const remaining = fc.getObjects().filter(o => !isGuide(o));
      setSelectedLayoutIds(prev => prev.filter(id => remaining.some(o => (o as any).printZone === id)));
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
    // ── Pinch-to-zoom (touch) ──
    let lastDist = 0;
    const canvasEl = fc.upperCanvasEl || fc.lowerCanvasEl;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastDist = Math.hypot(dx, dy);
        e.preventDefault();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastDist === 0) { lastDist = dist; return; }
        const delta = dist / lastDist;
        lastDist = dist;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = canvasEl.getBoundingClientRect();
        const z = Math.min(3, Math.max(0.3, fc.getZoom() * delta));
        fc.zoomToPoint(new fabric.Point(midX - rect.left, midY - rect.top), z);
        fc.requestRenderAll();
        e.preventDefault();
      }
    };
    const onTouchEnd = () => { lastDist = 0; };
    canvasEl.addEventListener('touchstart', onTouchStart, { passive: false });
    canvasEl.addEventListener('touchmove', onTouchMove, { passive: false });
    canvasEl.addEventListener('touchend', onTouchEnd);
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
    return () => {
      window.removeEventListener('resize', autoScale);
      canvasEl.removeEventListener('touchstart', onTouchStart);
      canvasEl.removeEventListener('touchmove', onTouchMove);
      canvasEl.removeEventListener('touchend', onTouchEnd);
      fc.dispose(); fcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.getSetting('upload_enabled').then(r => setUploadEnabled(r.value !== 'false')).catch(() => {});
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
      const fallbackToFirst = () => {
        setActiveProductType(prev => (!prev || !newTemplates[prev]) ? Object.keys(newTemplates)[0] || '' : prev);
      };
      if (productRouteId) {
        api.getProduct(productRouteId)
          .then((product: any) => {
            if (product?.mockupId && newTemplates[`db_${product.mockupId}`]) {
              // Catalog product with a linked mockup
              const key = `db_${product.mockupId}`;
              setActiveProductType(key);
              setProductMockupKey(key);
              if (product.name) setProductName(product.name);
              setProductBasePrice(product.price || 0);
            } else {
              fallbackToFirst();
            }
          })
          .catch(() => {
            // productRouteId is a mockup ID, not a catalog product ID
            api.getMockupPublic(productRouteId)
              .then((mockup: any) => {
                const key = `db_${mockup.id}`;
                if (newTemplates[key]) {
                  setActiveProductType(key);
                  setProductMockupKey(key);
                  if (mockup.name) setProductName(mockup.name);
                  setProductBasePrice(mockup.basePrice || 0);
                } else {
                  fallbackToFirst();
                }
              })
              .catch(fallbackToFirst);
          });
      } else {
        fallbackToFirst();
      }
      setImgReady(r => !r ? true : r); // trigger re-render
    }).catch(() => {/* design studio works fine without DB mockups */});
  }, []);
  useEffect(() => {
    const fc = fcRef.current; if (!fc) return;
    const tmpl = getTemplate();

    if (tmpl?.layouts?.length) {
      // Layout mode — build a clip shape per layout (rect, ellipse, or polygon)
      layoutClipRefs.current = {};
      tmpl.layouts.forEach((layout: PrintLayout) => {
        if (layout.shape === 'polygon' && layout.points && layout.points.length >= 3) {
          layoutClipRefs.current[layout.id] = new fabric.Polygon(
            layout.points.map(p => ({ x: p.x, y: p.y })),
            { absolutePositioned: true }
          );
        } else if (layout.shape === 'ellipse' || layout.shape === 'circle') {
          layoutClipRefs.current[layout.id] = new fabric.Ellipse({
            left: layout.x + layout.w / 2, top: layout.y + layout.h / 2,
            rx: layout.w / 2, ry: layout.h / 2,
            originX: 'center', originY: 'center',
            absolutePositioned: true,
          });
        } else {
          layoutClipRefs.current[layout.id] = new fabric.Rect({ left: layout.x, top: layout.y, width: layout.w, height: layout.h, absolutePositioned: true });
        }
      });
      // Body clip = first front layout or default
      const firstFront = tmpl.layouts.find((l: PrintLayout) => l.side === 'FRONT') ?? tmpl.layouts[0];
      if (firstFront.shape === 'polygon' && firstFront.points && firstFront.points.length >= 3) {
        clipRef.current = new fabric.Polygon(
          firstFront.points.map(p => ({ x: p.x, y: p.y })),
          { absolutePositioned: true }
        );
      } else if (firstFront.shape === 'ellipse') {
        clipRef.current = new fabric.Ellipse({
          left: firstFront.x + firstFront.w / 2, top: firstFront.y + firstFront.h / 2,
          rx: firstFront.w / 2, ry: firstFront.h / 2,
          originX: 'center', originY: 'center',
          absolutePositioned: true,
        });
      } else {
        clipRef.current = new fabric.Rect({ left: firstFront.x, top: firstFront.y, width: firstFront.w, height: firstFront.h, absolutePositioned: true });
      }
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

  /* ── Auto-capture thumbnail when mockup/color/side changes ── */
  useEffect(() => {
    if (!activeProductType) return;
    const t = setTimeout(captureThumbnail, 400);
    return () => clearTimeout(t);
  }, [activeProductType, activeColorHex, activeSide, captureThumbnail]);

  /* ── Canvas hover zoom handler ── */
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!hoverSnapshot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const bgX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const bgY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const POPUP_W = 320, POPUP_H = 400;
    let left = rect.right + 14;
    if (left + POPUP_W > window.innerWidth - 8) left = rect.left - POPUP_W - 14;
    let top = Math.max(8, Math.min(window.innerHeight - POPUP_H - 8, e.clientY - POPUP_H / 2));
    setCanvasHover({ bgX, bgY, left, top });
  }, [hoverSnapshot]);

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
      // Objects from OTHER sides saved in sideStateRef (skip current side — canvas is authoritative)
      Object.entries(sideStateRef.current).forEach(([side, ss]) => {
        if (side === activeSideRef.current) return;
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
    const productBase = (productBasePrice || tmpl?.basePrice || 0) * quantity;
    const finalPrice = Math.round((originalPrice + productBase) * (1 - discount / 100));
    setPrice({ originalPrice: originalPrice + productBase, finalPrice, discountPercent: discount });
  }, [selectedSides, quantity, activePrintSize, pocketPrintEnabled, activeProductType, allTemplates, layerList, productBasePrice]);

  /* ── Actions ── */
  const handleAddText = useCallback(() => {
    const fc = fcRef.current; if (!fc) return;
    const tmpl = getTemplate();
    // Auto-activate first layout if template has layouts but none is selected
    let effectiveLayoutId = activeEditingLayoutId;
    if (!effectiveLayoutId && tmpl?.layouts?.length) {
      const auto = (tmpl.layouts as PrintLayout[]).find((l: PrintLayout) => l.side === activeSideRef.current) || (tmpl.layouts[0] as PrintLayout);
      effectiveLayoutId = auto.id;
      setActiveEditingLayoutId(auto.id);
      setSelectedLayoutIds(prev => prev.includes(auto.id) ? prev : [...prev, auto.id]);
    }
    const isLayoutMode = !!(tmpl?.layouts?.length && effectiveLayoutId);
    const clip = isLayoutMode
      ? (layoutClipRefs.current[effectiveLayoutId!] ?? clipRef.current)
      : (editingPocket ? pocketClipRef.current : clipRef.current);
    if (!clip) return;
    const zone = isLayoutMode ? effectiveLayoutId! : (editingPocket ? 'pocket' : 'body');
    const activeLayout = isLayoutMode ? (tmpl!.layouts as PrintLayout[]).find((l: PrintLayout) => l.id === effectiveLayoutId) : null;
    // Use layout area if in layout mode, otherwise fall back to getActiveArea
    const pa = activeLayout ? { x: activeLayout.x, y: activeLayout.y, w: activeLayout.w, h: activeLayout.h } : getActiveArea();
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
    if (isLayoutMode && effectiveLayoutId) {
      setSelectedLayoutIds(prev => prev.includes(effectiveLayoutId!) ? prev : [...prev, effectiveLayoutId!]);
    }
    setSelectedSides(prev => prev.includes(activeSideRef.current) ? prev : [...prev, activeSideRef.current]);
  }, [getActiveArea, getTemplate, activeEditingLayoutId, editingPocket]);

  const handleAddImage = useCallback(async (file: File) => {
    const fc = fcRef.current; if (!fc) return;
    const tmpl = getTemplate();
    // Auto-activate first layout if template has layouts but none is selected
    let effectiveLayoutId = activeEditingLayoutId;
    if (!effectiveLayoutId && tmpl?.layouts?.length) {
      const auto = (tmpl.layouts as PrintLayout[]).find((l: PrintLayout) => l.side === activeSideRef.current) || (tmpl.layouts[0] as PrintLayout);
      effectiveLayoutId = auto.id;
      setActiveEditingLayoutId(auto.id);
      setSelectedLayoutIds(prev => prev.includes(auto.id) ? prev : [...prev, auto.id]);
    }
    const isLayoutMode = !!(tmpl?.layouts?.length && effectiveLayoutId);
    const clip = isLayoutMode
      ? (layoutClipRefs.current[effectiveLayoutId!] ?? clipRef.current)
      : (editingPocket ? pocketClipRef.current : clipRef.current);
    if (!clip) return;
    if (file.size > 10 * 1024 * 1024) return;
    let blob: Blob = file;
    if (file.size > 500 * 1024) {
      try { blob = await compressImage(file, { maxWidth: 2048, maxHeight: 2048, quality: 0.85 }); } catch { blob = file; }
    }
    const zone = isLayoutMode ? effectiveLayoutId! : (editingPocket ? 'pocket' : 'body');
    const activeLayout = isLayoutMode ? (tmpl!.layouts as PrintLayout[]).find((l: PrintLayout) => l.id === effectiveLayoutId) : null;
    const reader = new FileReader();
    reader.onload = () => {
      const imgEl = new Image();
      imgEl.onload = () => {
        const pa = activeLayout ? { x: activeLayout.x, y: activeLayout.y, w: activeLayout.w, h: activeLayout.h } : getActiveArea();
        const fImg = new fabric.FabricImage(imgEl);
        const fitScale = Math.min((pa.w * 0.8) / fImg.width, (pa.h * 0.8) / fImg.height);
        fImg.set({ left: pa.x + pa.w / 2, top: pa.y + pa.h / 2, originX: 'center', originY: 'center', scaleX: fitScale, scaleY: fitScale, clipPath: clip });
        (fImg as any).customId = crypto.randomUUID();
        (fImg as any).layerName = activeLayout ? `${activeLayout.name} Image` : (editingPocket ? 'Pocket Image' : 'Image');
        (fImg as any).printZone = zone;
        fc.add(fImg); fc.setActiveObject(fImg); fc.renderAll();
        if (isLayoutMode && effectiveLayoutId) {
          setSelectedLayoutIds(prev => prev.includes(effectiveLayoutId!) ? prev : [...prev, effectiveLayoutId!]);
        }
        setSelectedSides(prev => prev.includes(activeSideRef.current) ? prev : [...prev, activeSideRef.current]);
      };
      imgEl.src = reader.result as string;
    };
    reader.readAsDataURL(blob);
  }, [getActiveArea, getTemplate, activeEditingLayoutId, editingPocket]);

  const handleAddShape = useCallback((type: 'rect' | 'circle' | 'triangle' | 'line') => {
    const fc = fcRef.current; if (!fc) return;
    const tmpl = getTemplate();
    // Auto-activate first layout if template has layouts but none is selected
    let effectiveLayoutId = activeEditingLayoutId;
    if (!effectiveLayoutId && tmpl?.layouts?.length) {
      const auto = (tmpl.layouts as PrintLayout[]).find((l: PrintLayout) => l.side === activeSideRef.current) || (tmpl.layouts[0] as PrintLayout);
      effectiveLayoutId = auto.id;
      setActiveEditingLayoutId(auto.id);
      setSelectedLayoutIds(prev => prev.includes(auto.id) ? prev : [...prev, auto.id]);
    }
    const isLayoutMode = !!(tmpl?.layouts?.length && effectiveLayoutId);
    const clip = isLayoutMode
      ? (layoutClipRefs.current[effectiveLayoutId!] ?? clipRef.current)
      : (editingPocket ? pocketClipRef.current : clipRef.current);
    if (!clip) return;
    const zone = isLayoutMode ? effectiveLayoutId! : (editingPocket ? 'pocket' : 'body');
    const activeLayout = isLayoutMode ? (tmpl!.layouts as PrintLayout[]).find((l: PrintLayout) => l.id === effectiveLayoutId) : null;
    const pa = activeLayout ? { x: activeLayout.x, y: activeLayout.y, w: activeLayout.w, h: activeLayout.h } : getActiveArea();
    const cx = pa.x + pa.w / 2;
    const cy = pa.y + pa.h / 2;
    const fill = '#0E7C61';
    let obj: fabric.FabricObject;
    if (type === 'rect') {
      obj = new fabric.Rect({ left: cx - 50, top: cy - 50, width: 100, height: 100, fill, clipPath: clip });
    } else if (type === 'circle') {
      obj = new fabric.Circle({ left: cx - 50, top: cy - 50, radius: 50, fill, clipPath: clip });
    } else if (type === 'triangle') {
      obj = new fabric.Triangle({ left: cx - 50, top: cy - 50, width: 100, height: 100, fill, clipPath: clip });
    } else {
      obj = new fabric.Line([0, 0, 100, 0], { left: cx - 50, top: cy, stroke: fill, strokeWidth: 3, fill: '', clipPath: clip });
    }
    (obj as any).customId = crypto.randomUUID();
    (obj as any).layerName = type.charAt(0).toUpperCase() + type.slice(1);
    (obj as any).printZone = zone;
    if (isLayoutMode && effectiveLayoutId) {
      setSelectedLayoutIds(prev => prev.includes(effectiveLayoutId!) ? prev : [...prev, effectiveLayoutId!]);
    }
    fc.add(obj); fc.setActiveObject(obj); fc.renderAll();
    setSelectedSides(prev => prev.includes(activeSideRef.current) ? prev : [...prev, activeSideRef.current]);
  }, [getActiveArea, getTemplate, activeEditingLayoutId, editingPocket]);

  const handleAddTextStyle = useCallback((preset: { label: string; sampleText: string; font: string; size: number; weight: string | number; fill: string; stroke?: string; strokeWidth?: number; italic?: boolean }) => {
    const fc = fcRef.current; if (!fc) return;
    const tmpl = getTemplate();
    let effectiveLayoutId = activeEditingLayoutId;
    if (!effectiveLayoutId && tmpl?.layouts?.length) {
      const auto = (tmpl.layouts as PrintLayout[]).find((l: PrintLayout) => l.side === activeSideRef.current) || (tmpl.layouts[0] as PrintLayout);
      effectiveLayoutId = auto.id;
      setActiveEditingLayoutId(auto.id);
      setSelectedLayoutIds(prev => prev.includes(auto.id) ? prev : [...prev, auto.id]);
    }
    const isLayoutMode = !!(tmpl?.layouts?.length && effectiveLayoutId);
    const clip = isLayoutMode ? (layoutClipRefs.current[effectiveLayoutId!] ?? clipRef.current) : (editingPocket ? pocketClipRef.current : clipRef.current);
    const zone = isLayoutMode ? effectiveLayoutId! : (editingPocket ? 'pocket' : 'body');
    const pa = getActiveArea();
    const text = new fabric.IText(preset.sampleText, {
      left: pa.x + pa.w / 2, top: pa.y + pa.h / 2,
      originX: 'center', originY: 'center',
      fontFamily: preset.font, fontSize: preset.size,
      fontWeight: preset.weight as any, fill: preset.fill,
      fontStyle: preset.italic ? 'italic' : 'normal',
      stroke: preset.stroke, strokeWidth: preset.strokeWidth,
      textAlign: 'center', clipPath: clip ?? undefined,
    });
    (text as any).customId = crypto.randomUUID();
    (text as any).layerName = preset.label;
    (text as any).printZone = zone;
    fc.add(text); fc.setActiveObject(text); fc.renderAll();
    if (isLayoutMode && effectiveLayoutId) setSelectedLayoutIds(prev => prev.includes(effectiveLayoutId!) ? prev : [...prev, effectiveLayoutId!]);
    setSelectedSides(prev => prev.includes(activeSideRef.current) ? prev : [...prev, activeSideRef.current]);
  }, [getActiveArea, getTemplate, activeEditingLayoutId, editingPocket]);

  const handleAddSvgVector = useCallback(async (svgStr: string) => {
    const fc = fcRef.current; if (!fc) return;
    const tmpl = getTemplate();
    let effectiveLayoutId = activeEditingLayoutId;
    if (!effectiveLayoutId && tmpl?.layouts?.length) {
      const auto = (tmpl.layouts as PrintLayout[]).find((l: PrintLayout) => l.side === activeSideRef.current) || (tmpl.layouts[0] as PrintLayout);
      effectiveLayoutId = auto.id;
      setActiveEditingLayoutId(auto.id);
      setSelectedLayoutIds(prev => prev.includes(auto.id) ? prev : [...prev, auto.id]);
    }
    const isLayoutMode = !!(tmpl?.layouts?.length && effectiveLayoutId);
    const clip = isLayoutMode ? (layoutClipRefs.current[effectiveLayoutId!] ?? clipRef.current) : (editingPocket ? pocketClipRef.current : clipRef.current);
    const zone = isLayoutMode ? effectiveLayoutId! : (editingPocket ? 'pocket' : 'body');
    const activeLayout = isLayoutMode ? (tmpl!.layouts as PrintLayout[]).find((l: PrintLayout) => l.id === effectiveLayoutId) : null;
    const pa = activeLayout ? { x: activeLayout.x, y: activeLayout.y, w: activeLayout.w, h: activeLayout.h } : getActiveArea();
    try {
      const result = await (fabric as any).loadSVGFromString(svgStr);
      const objects = ((result.objects || []) as fabric.FabricObject[]).filter(Boolean);
      if (!objects.length) return;
      const group = new fabric.Group(objects);
      const maxDim = Math.min(pa.w || 200, pa.h || 200) * 0.7;
      const scale = maxDim / Math.max(group.width || 100, group.height || 100);
      group.set({ left: pa.x + (pa.w || 200) / 2, top: pa.y + (pa.h || 200) / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
      if (clip) group.set({ clipPath: clip });
      (group as any).customId = crypto.randomUUID();
      (group as any).layerName = 'Vector';
      (group as any).printZone = zone;
      fc.add(group); fc.setActiveObject(group); fc.renderAll();
      if (isLayoutMode && effectiveLayoutId) setSelectedLayoutIds(prev => prev.includes(effectiveLayoutId!) ? prev : [...prev, effectiveLayoutId!]);
      setSelectedSides(prev => prev.includes(activeSideRef.current) ? prev : [...prev, activeSideRef.current]);
    } catch (e) { console.error('SVG load error', e); }
  }, [getActiveArea, getTemplate, activeEditingLayoutId, editingPocket]);

  const handleRemoveBg = useCallback(async () => {
    const fc = fcRef.current; if (!fc) return;
    const activeObj = fc.getActiveObject();
    if (!(activeObj instanceof fabric.FabricImage)) return;
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const imgEl = (activeObj as fabric.FabricImage).getElement() as HTMLImageElement;
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = imgEl.naturalWidth || imgEl.width;
      tmpCanvas.height = imgEl.naturalHeight || imgEl.height;
      const ctx = tmpCanvas.getContext('2d')!;
      ctx.drawImage(imgEl, 0, 0);
      const blob = await new Promise<Blob>(res => tmpCanvas.toBlob(b => res(b!), 'image/png'));
      const resultBlob = await removeBackground(blob);
      const url = URL.createObjectURL(resultBlob);
      const newEl = new Image(); newEl.crossOrigin = 'anonymous';
      newEl.onload = () => {
        const newFImg = new fabric.FabricImage(newEl, {
          left: activeObj.left, top: activeObj.top,
          scaleX: activeObj.scaleX, scaleY: activeObj.scaleY,
          angle: activeObj.angle, clipPath: activeObj.clipPath,
          originX: activeObj.originX, originY: activeObj.originY,
        });
        (newFImg as any).customId = (activeObj as any).customId;
        (newFImg as any).layerName = (activeObj as any).layerName;
        (newFImg as any).printZone = (activeObj as any).printZone;
        fc.remove(activeObj);
        fc.add(newFImg); fc.setActiveObject(newFImg); fc.renderAll();
        URL.revokeObjectURL(url);
      };
      newEl.src = url;
    } catch (e) { console.error('Background removal failed', e); }
  }, []);

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
    const fullThumb = fc.toDataURL({ format: 'png', multiplier: 1 });
    sideStateRef.current[activeSide].thumbnail = fullThumb;
    // Also update thumbnails for bottom bar and hover zoom
    const smallThumb = fc.toDataURL({ format: 'jpeg', quality: 0.55, multiplier: 0.32 });
    const hoverThumb = fc.toDataURL({ format: 'jpeg', quality: 0.78, multiplier: 0.65 });
    setSideThumbnails(prev => ({ ...prev, [activeSide]: smallThumb }));
    setHoverSnapshot(hoverThumb);
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
    // Hide decoration guides but keep shadow overlay
    const decorGuides = fc.getObjects().filter(o => {
      const name = (o as any).name as string | undefined;
      return name && name.startsWith('__') && name !== '__shadow';
    });
    decorGuides.forEach(o => { o.visible = false; });
    const savedTransform = fc.viewportTransform ? [...fc.viewportTransform] : [1, 0, 0, 1, 0, 0];
    fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fc.renderAll();
    const currentDataUrl = fc.toDataURL({ format: 'png', multiplier: 2 });
    fc.setViewportTransform(savedTransform as [number, number, number, number, number, number]);
    decorGuides.forEach(o => { o.visible = true; });
    fc.renderAll();

    // Build previews map: current side from canvas, other side from saved thumbnail
    const currentSide = activeSideRef.current;
    const urls: Partial<Record<PrintSide, string>> = {};
    urls[currentSide] = currentDataUrl;
    // Save the freshly rendered URL as the thumbnail too
    sideStateRef.current[currentSide].thumbnail = currentDataUrl;
    // Collect other side's thumbnail if it has content
    for (const s of SIDES) {
      if (s !== currentSide && sideStateRef.current[s].thumbnail) {
        urls[s] = sideStateRef.current[s].thumbnail;
      }
    }
    setPreviewUrls(urls);
    setPreviewSide(currentSide);
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

  // When arriving via /design-studio/customize/:productId, always restrict to one template.
  const visibleTemplates = (() => {
    if (!productRouteId) return allTemplates;
    if (productMockupKey && allTemplates[productMockupKey])
      return { [productMockupKey]: allTemplates[productMockupKey] };
    if (activeProductType && allTemplates[activeProductType])
      return { [activeProductType]: allTemplates[activeProductType] };
    return {};
  })();

  const toggleLayout = useCallback((id: string) => {
    const tmpl = getTemplate();
    setSelectedLayoutIds(prev => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter(x => x !== id) : prev;
      if (prev.length === 0) return [id];
      const target = tmpl?.layouts?.find((l: PrintLayout) => l.id === id);
      const canAdd = prev.every(selId => {
        const sel = tmpl?.layouts?.find((l: PrintLayout) => l.id === selId);
        return (sel?.compatibleWith ?? []).includes(id) && (target?.compatibleWith ?? []).includes(selId);
      });
      return canAdd ? [...prev, id] : [id];
    });
    setActiveEditingLayoutId(id);
  }, [getTemplate]);

  return (
    <div className="designer">
      <TopBar
        activeSide={activeSide}
        selectedSides={selectedSides}
        sides={availableSides}
        saveStatus={saveStatus}
        onToggleSide={handleToggleSide}
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
        productName={productName}
        onToggleLayout={toggleLayout}
        onPreview={handlePreview}
        onAddToCart={handleAddToCart}
      />
      <div className="main-area">
        {activeTab && (
          <div className="mobile-panel-overlay visible" onClick={() => setActiveTab(null)} />
        )}
        <LeftPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          productName={productName}
          colors={colors}
          activeColorHex={activeColorHex}
          onSwitchColor={(hex, name) => { setActiveColorHex(hex); setActiveColorName(name); }}
          selectedSize={searchParams.get('size') || undefined}
          quantity={quantity}
          onQuantityChange={setQuantity}
          price={price}
          productBasePrice={productBasePrice}
          onAddToCart={handleAddToCart}
          onPreview={handlePreview}
          selectedSides={selectedSides}
          pocketPrintEnabled={pocketPrintEnabled}
          activePrintSize={activePrintSize}
          onAddText={handleAddText}
          onAddImage={handleAddImage}
          onAddShape={handleAddShape}
          onAddTextStyle={handleAddTextStyle}
          onAddSvgVector={handleAddSvgVector}
          onRemoveBg={handleRemoveBg}
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
          layers={layerList}
          selectedObj={selectedObj}
          onSelectLayer={handleSelectLayer}
          onRemoveLayer={handleRemoveLayer}
          onToggleVisibility={handleToggleVisibility}
          canvas={fcRef.current}
          onUpdateProp={handleUpdateObj}
          templates={visibleTemplates}
          activeProductType={activeProductType}
          onSwitchType={setActiveProductType}
          uploadEnabled={uploadEnabled}
          extraClassName={activeTab ? 'open' : ''}
        />
        <div
          className="canvas-area"
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setCanvasHover(null)}
        >
          {canvasHover && hoverSnapshot && (
            <div
              className="ds-hover-zoom"
              style={{
                position: 'fixed',
                left: canvasHover.left,
                top: canvasHover.top,
                zIndex: 2000,
                pointerEvents: 'none',
              }}
            >
              <img
                src={hoverSnapshot}
                alt="Zoom preview"
                style={{
                  width: 320, height: 400,
                  objectFit: 'contain',
                  display: 'block',
                  borderRadius: 16,
                  boxShadow: '0 12px 48px rgba(0,0,0,.28)',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                }}
              />
            </div>
          )}
          <div
            className="canvas-wrap"
            style={{ position: 'relative' }}
          >
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

          {/* ── Film strip: side thumbnails floating in canvas ── */}
          <div className="ds-film-strip">
            {availableSides.map(side => (
              <button
                key={side}
                className={`ds-film-card${activeSide === side ? ' active' : ''}${selectedSides.includes(side) ? ' has-design' : ''}`}
                onClick={() => handleToggleSide(side)}
                title={`${side} — click to switch`}
              >
                <div className="ds-film-card-img">
                  {sideThumbnails[side]
                    ? <img src={sideThumbnails[side]} alt={side} draggable={false} />
                    : <span className="ds-film-empty-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </span>
                  }
                </div>
                <span className="ds-film-label">{side}</span>
                {selectedSides.includes(side) && <span className="ds-film-check" />}
              </button>
            ))}
          </div>
        </div>
        <RightPanel
          selectedObj={selectedObj}
          onUpdateProp={handleUpdateObj}
          canvas={fcRef.current}
        />
      </div>
      <BottomBar
        activeSide={activeSide}
        sides={availableSides}
        selectedSides={selectedSides}
        onToggleSide={handleToggleSide}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        quantity={quantity}
        price={price}
        productBasePrice={productBasePrice}
        onAddToCart={handleAddToCart}
        onPreview={handlePreview}
        pocketPrintEnabled={pocketPrintEnabled}
        activePrintSize={activePrintSize}
      />


      {/* ── Mobile Bottom Navigation ── */}
      <nav className="mobile-bottom-nav">
        {([
          { id: 'product',  Icon: Package,    label: 'Product'  },
          { id: 'uploads',  Icon: Upload,     label: 'Uploads'  },
          { id: 'text',     Icon: Type,       label: 'Text'     },
          { id: 'graphics', Icon: Smile,      label: 'Graphics' },
          { id: 'layers',   Icon: LayersIcon, label: 'Layers'   },
        ] as const).map(({ id, Icon, label }) => (
          <button
            key={id}
            className={`mobile-nav-btn${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(prev => prev === id ? null : id)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
        <button className="mobile-nav-btn" onClick={handleAddToCart}>
          <ShoppingCart size={18} />
          Cart
        </button>
      </nav>

      {/* ── Preview Modal ── */}
      {Object.keys(previewUrls).length > 0 && (
        <div className="preview-overlay" onClick={() => setPreviewUrls({})}>
          <div className="preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-modal-header">
              <span className="preview-modal-title">
                Print-Ready Preview
              </span>
              <div className="preview-modal-actions">
                <a className="preview-download-btn" href={previewUrls[previewSide]} download={`${activeProductType}-${previewSide.toLowerCase()}.png`}>
                  Download PNG
                </a>
                <button className="preview-close-btn" onClick={() => setPreviewUrls({})}>X</button>
              </div>
            </div>
            {/* Side tabs — only shown when both sides have previews */}
            {Object.keys(previewUrls).length > 1 && (
              <div className="preview-side-tabs">
                {(Object.keys(previewUrls) as PrintSide[]).map(s => (
                  <button
                    key={s}
                    className={`preview-side-tab${previewSide === s ? ' active' : ''}`}
                    onClick={() => setPreviewSide(s)}
                  >{s}</button>
                ))}
              </div>
            )}
            <div className="preview-modal-body">
              <div className="preview-product-frame">
                <img src={previewUrls[previewSide]} alt="Product preview" className="preview-product-img" />
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
                  <span className="preview-meta-value">{previewSide}</span>
                </div>
                <div className="preview-meta-row">
                  <span className="preview-meta-label">Print Size</span>
                  <span className="preview-meta-value" style={{ textTransform: 'capitalize' }}>{activePrintSize}</span>
                </div>
                <button
                  className="preview-cart-btn"
                  onClick={() => { setPreviewUrls({}); handleAddToCart(); }}
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
