import { useEffect, useRef, useState, useCallback } from 'react';
import type { ProductMockup } from '../types';
import { CW, CH } from '../mockups';

/* ── Helpers ── */
const imgCache = new Map<string, HTMLImageElement>();

function loadImg(src: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(src);
  if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only set crossOrigin for external URLs; local paths served by nginx don't need CORS
    if (/^https?:\/\//.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => { imgCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

// Only apply mockup for locally-uploaded design artwork, not external product photos
function isDesignArtwork(src: string): boolean {
  return src.startsWith('/uploads/') || src.startsWith('/api/uploads/');
}

/* ── Canvas compositing (from Mens_T-Shirt_Mockup.psd) ──
 *
 * PSD layer order (bottom → top):
 *   Background color (solid fill)
 *   Shirt > Shadows (LINEAR_BURN 70%) — drop shadow beneath shirt
 *   Shirt > Shirt (NORMAL) — white fabric photo
 *   Mockup > Design > Front (MULTIPLY) — design smart object
 *   Mockup > Highlights (SCREEN) — fabric shine overlay
 *
 * Canvas compositing approach:
 *   OFFSCREEN: Build colored shirt + design + highlights, clipped to shirt body
 *     1. Draw base shirt → source-in fill color → multiply base texture → dest-in fix alpha
 *     2. Draw design at print area (NORMAL blend — vibrant colors)
 *     3. Screen highlights (fabric shine makes design look "printed")
 *     4. Dest-in clip to shirt silhouette
 *   MAIN CANVAS:
 *     5. Draw drop shadow (below)
 *     6. Draw composited shirt (on top)
 */
function renderMockup(
  canvas: HTMLCanvasElement,
  base: HTMLImageElement,
  design: HTMLImageElement | null,
  dropShadow: HTMLImageElement | null,
  highlights: HTMLImageElement | null,
  color: string,
  pa: { left: number; top: number; width: number; height: number },
) {
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  // Base image fills the canvas exactly (same dimensions)
  const bx = 0, by = 0, bw = W, bh = H;

  ctx.clearRect(0, 0, W, H);

  // -- Offscreen: alpha mask from base shirt body --
  const mask = document.createElement('canvas');
  mask.width = W; mask.height = H;
  const mCtx = mask.getContext('2d')!;
  mCtx.drawImage(base, bx, by, bw, bh);

  // -- Offscreen: colored shirt + design + highlights --
  const comp = document.createElement('canvas');
  comp.width = W; comp.height = H;
  const cCtx = comp.getContext('2d')!;

  // Step 1: Fill shirt silhouette with chosen color
  cCtx.drawImage(base, bx, by, bw, bh);           // draw base for alpha shape
  cCtx.globalCompositeOperation = 'source-in';
  cCtx.fillStyle = color;
  cCtx.fillRect(0, 0, W, H);                      // color fills only where shirt has alpha

  // Step 2: Multiply white fabric texture → wrinkle/fold detail appears on color
  cCtx.globalCompositeOperation = 'multiply';
  cCtx.drawImage(base, bx, by, bw, bh);

  // Fix alpha corrupted by multiply
  cCtx.globalCompositeOperation = 'destination-in';
  cCtx.drawImage(mask, 0, 0);

  // Step 3: Draw design artwork at print area (NORMAL blend — full vibrant colors)
  if (design && design.naturalWidth > 0) {
    const areaX = bx + pa.left * bw;
    const areaY = by + pa.top * bh;
    const areaW = pa.width * bw;
    const areaH = pa.height * bh;

    // Fit design inside print area, maintaining aspect ratio
    const dar = design.naturalWidth / design.naturalHeight;
    const par = areaW / areaH;
    let dx: number, dy: number, dw: number, dh: number;
    if (dar > par) {
      dw = areaW; dh = areaW / dar;
      dx = areaX; dy = areaY + (areaH - dh) / 2;
    } else {
      dh = areaH; dw = areaH * dar;
      dx = areaX + (areaW - dw) / 2; dy = areaY;
    }

    cCtx.globalCompositeOperation = 'source-over';
    cCtx.drawImage(design, dx, dy, dw, dh);
  }

  // Step 4: Screen highlights → fabric shine over design (looks "printed" on fabric)
  if (highlights && highlights.naturalWidth > 0) {
    cCtx.globalCompositeOperation = 'screen';
    cCtx.globalAlpha = 0.45;
    cCtx.drawImage(highlights, bx, by, bw, bh);
    cCtx.globalAlpha = 1;
  }

  // Step 5: Final clip to shirt body silhouette
  cCtx.globalCompositeOperation = 'destination-in';
  cCtx.drawImage(mask, 0, 0);
  cCtx.globalCompositeOperation = 'source-over';

  // -- Main canvas: shadow + composited shirt --
  // Draw drop shadow first (beneath the shirt)
  if (dropShadow && dropShadow.naturalWidth > 0) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(dropShadow, bx, by, bw, bh);
  }

  // Draw the composited (colored shirt + design + highlights) on top
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(comp, 0, 0);
}

/* ── Component ── */
interface Props {
  category: string;
  designImage: string;
  color?: string;
  className?: string;
  mockup?: ProductMockup;
}

/** Extract the FRONT print‐area layout from a DB mockup, normalized to 0–1 fractions */
function getFrontPrintArea(mockup: ProductMockup): { left: number; top: number; width: number; height: number } | null {
  const pa = mockup.printArea;
  if (!pa?.layouts?.length) return null;
  const front = pa.layouts.find((l: any) => l.side === 'FRONT') ?? pa.layouts[0];
  // DB stores pixel coords in 800×1000 space — divide by CW/CH to get 0-1 fractions
  return {
    left:   front.x / CW,
    top:    front.y / CH,
    width:  front.w / CW,
    height: front.h / CH,
  };
}

export default function MockupPreview({ category, designImage, color = '#ffffff', className, mockup }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [designFailed, setDesignFailed] = useState(false);
  const [paStyle, setPaStyle] = useState<React.CSSProperties | null>(null);

  const shouldMockup = !!mockup?.frontImage && isDesignArtwork(designImage);

  const render = useCallback(async () => {
    if (!shouldMockup || !canvasRef.current || !mockup) { setState('fallback'); return; }
    const printArea = getFrontPrintArea(mockup);
    if (!printArea) { setState('fallback'); return; }

    // Pre-compute CSS for overlay fallback (design positioned at print area)
    setPaStyle({
      position: 'absolute',
      left: `${printArea.left * 100}%`,
      top: `${printArea.top * 100}%`,
      width: `${printArea.width * 100}%`,
      height: `${printArea.height * 100}%`,
      objectFit: 'contain' as const,
      pointerEvents: 'none' as const,
    });

    try {
      const baseSrc = mockup.frontImage;
      const shadowSrc = mockup.frontShadow;
      // Derive highlights path: same as front image but with "-highlights" suffix
      const highlightsSrc = baseSrc.replace(/(\.[^.]+)$/, '-highlights$1');

      const [base, design, dropShadow, highlights] = await Promise.all([
        loadImg(baseSrc),
        loadImg(designImage).catch(() => null),
        shadowSrc ? loadImg(shadowSrc).catch(() => null) : Promise.resolve(null),
        loadImg(highlightsSrc).catch(() => null),
      ]);
      if (!canvasRef.current) return;

      const ok = !!design && design.naturalWidth > 0;
      setDesignFailed(!ok);

      // Use the base image's natural dimensions as canvas size
      canvasRef.current.width = base.naturalWidth;
      canvasRef.current.height = base.naturalHeight;
      renderMockup(canvasRef.current, base, design, dropShadow, highlights, color, printArea);
      setState('ready');
    } catch {
      setState('fallback');
    }
  }, [shouldMockup, designImage, color, mockup]);

  useEffect(() => { setState('loading'); setDesignFailed(false); render(); }, [render]);

  // No mockup data or not a design artwork → show product photo directly
  if (!shouldMockup || state === 'fallback') {
    return <img src={designImage} alt="Product" className={className} loading="lazy" />;
  }

  return (
    <div className={`mockup-wrap ${className || ''}`}>
      <canvas
        ref={canvasRef}
        width={800}
        height={1054}
        className="mockup-canvas"
      />
      {/* If design failed to composite on canvas, overlay it as a positioned <img> */}
      {designFailed && paStyle && (
        <img src={designImage} alt="Design" style={paStyle} loading="lazy" />
      )}
      {state === 'loading' && <div className="mockup-loading" />}
    </div>
  );
}
