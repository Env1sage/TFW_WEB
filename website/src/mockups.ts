/* ═══════════════════════════════════════════════════════════
   MOCKUP ENGINE — SVG-based garment rendering with
   procedural mockups, color tinting, and print area system
   ═══════════════════════════════════════════════════════════ */

export type PrintSide = 'FRONT' | 'BACK';
export type PrintSize = 'full' | 'medium' | 'small' | 'pocket';

export interface PrintSizeOption {
  id: PrintSize;
  label: string;
  inchLabel: string;
  scaleFactor: number;
  sides: PrintSide[];
}

export interface PrintArea {
  x: number; y: number; w: number; h: number;
  price?: number;
}

/** A named printable zone defined by admin */
export interface PrintLayout {
  id: string;
  name: string;
  side: PrintSide;
  x: number; y: number; w: number; h: number;
  price?: number;
  /** IDs of other layouts this can be ordered together with */
  compatibleWith?: string[];
}

export interface MockupTemplate {
  label: string;
  icon: string;
  renderSVG: (side: PrintSide, color: string) => string;
  printAreas: Record<PrintSize, PrintArea>;
  printAreasBySide?: Record<PrintSide, Record<PrintSize, PrintArea>>;
  /** Generic named layouts (new format) */
  layouts?: PrintLayout[];
  allowMultipleLayouts?: boolean;
  allowBackPrint?: boolean;
  imageUrls?: Partial<Record<PrintSide, string>>;
  shadowUrls?: Partial<Record<PrintSide, string>>;
  /** Base cost of the physical product (added to design/printing fee in cart) */
  basePrice?: number;
  /** Printing fee for front-side print job */
  frontPrintPrice?: number;
  /** Printing fee for back-side print job */
  backPrintPrice?: number;
}

/** Convert legacy {front:{full,medium,...}, back:{...}} format → PrintLayout[] */
export function legacyToLayouts(printArea: any): PrintLayout[] {
  if (!printArea) return [];
  const SIZE_NAMES: Record<string, string> = {
    full: 'Full Print', medium: 'Medium Print', small: 'Small Print', pocket: 'Pocket Print',
  };
  const layouts: PrintLayout[] = [];
  const pairs: Array<[any, PrintSide]> = [];
  if (printArea.front !== undefined || printArea.back !== undefined) {
    if (printArea.front) pairs.push([printArea.front, 'FRONT']);
    if (printArea.back) pairs.push([printArea.back, 'BACK']);
  } else {
    pairs.push([printArea, 'FRONT']);
  }
  for (const [data, side] of pairs) {
    for (const [k, v] of Object.entries(data)) {
      const a = v as any;
      if (!a?.w || !a?.h) continue;
      layouts.push({ id: `legacy_${side}_${k}`, name: SIZE_NAMES[k] || k, side, x: a.x, y: a.y, w: a.w, h: a.h, price: a.price });
    }
  }
  return layouts;
}

export const CW = 800;
export const CH = 1000;

/* ── Image preloading / caching ── */
const imageCache: Record<string, string> = {};
let preloaded = false;

export async function preloadMockupImages(): Promise<void> {
  if (preloaded) return;
  const urls: string[] = [];
  Object.values(MOCKUP_TEMPLATES).forEach(t => {
    if (t.imageUrls) Object.values(t.imageUrls).forEach(u => { if (u) urls.push(u); });
    if (t.shadowUrls) Object.values(t.shadowUrls).forEach(u => { if (u) urls.push(u); });
  });
  await Promise.all(urls.map(url =>
    fetch(url)
      .then(r => r.blob())
      .then(blob => new Promise<void>(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => { imageCache[url] = reader.result as string; resolve(); };
        reader.readAsDataURL(blob);
      }))
      .catch(() => {})
  ));
  preloaded = true;
}

export function getCachedImage(url: string): string | null {
  return imageCache[url] || null;
}

/* ── Preload additional images (DB mockups loaded at runtime) ── */
export async function preloadAdditionalImages(urls: string[]): Promise<void> {
  await Promise.all(
    urls.filter(u => u && !imageCache[u]).map(url =>
      fetch(url)
        .then(r => r.blob())
        .then(blob => new Promise<void>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => { imageCache[url] = reader.result as string; resolve(); };
          reader.readAsDataURL(blob);
        }))
        .catch(() => {})
    )
  );
}

/* ── DB mockup shape (matches server DBMockup) ── */
export interface DBMockupShape {
  id: string;
  name: string;
  category: string;
  frontImage: string;
  backImage?: string;
  frontShadow?: string;
  backShadow?: string;
  printArea?: any;
  basePrice?: number;
  frontPrintPrice?: number;
  backPrintPrice?: number;
  active: boolean;
}

/* ── Build a MockupTemplate from a DB mockup entry ── */
export function buildTemplateFromDBMockup(m: DBMockupShape): MockupTemplate {
  const renderSVG = (side: PrintSide, color: string): string => {
    const url = side === 'BACK' && m.backImage ? m.backImage : m.frontImage;
    const cached = getCachedImage(url);
    if (cached) {
      const num = parseInt(color.replace('#', ''), 16);
      const rr = ((num >> 16) & 0xff) / 255;
      const gg = ((num >> 8) & 0xff) / 255;
      const bb = (num & 0xff) / 255;
      // Grayscale-then-colorize: removes original color cast, then applies selected color.
      // Works correctly for both white-base T-shirts and photo-based mockups (tote bags, etc.)
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
<defs>
  <filter id="colorize" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" result="gray"
      values="0.33 0.33 0.33 0 0
              0.33 0.33 0.33 0 0
              0.33 0.33 0.33 0 0
              0    0    0    1 0"/>
    <feColorMatrix type="matrix" in="gray"
      values="${rr} 0 0 0 0
              0 ${gg} 0 0 0
              0 0 ${bb} 0 0
              0 0  0   1 0"/>
  </filter>
</defs>
<image href="${cached}" x="0" y="0" width="${CW}" height="${CH}" filter="url(#colorize)"/>
</svg>`;
    }
    // Fallback: plain coloured rect with label while image loads
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
<rect width="${CW}" height="${CH}" fill="${color}" rx="24"/>
<text x="${CW / 2}" y="${CH / 2}" text-anchor="middle" dominant-baseline="middle"
  fill="rgba(0,0,0,0.3)" font-size="36" font-family="sans-serif">${m.name}</text>
</svg>`;
  };

  const icon = `<img src="${m.frontImage}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;" />`;

  // Detect new generic layouts format
  const hasLayoutsFormat = Array.isArray(m.printArea?.layouts) && m.printArea.layouts.length > 0;
  const layouts: PrintLayout[] = hasLayoutsFormat
    ? m.printArea.layouts
    : legacyToLayouts(m.printArea);
  const allowMultipleLayouts: boolean = m.printArea?.allowMultipleLayouts ?? false;
  const allowBackPrint: boolean = m.printArea?.allowBackPrint ?? layouts.some(l => l.side === 'BACK');

  // Also build legacy printAreas for backward-compat fallback
  const hasSidedFormat = m.printArea && (m.printArea as any).front !== undefined;
  const frontAreas = hasSidedFormat ? ((m.printArea as any).front || {}) : (hasLayoutsFormat ? {} : (m.printArea || {}));
  const backAreas = hasSidedFormat ? ((m.printArea as any).back || {}) : {};
  const hasFrontAreas = (frontAreas as any)?.full?.w > 0;
  const hasBackAreas = (backAreas as any)?.full?.w > 0;

  return {
    label: m.name,
    icon,
    renderSVG,
    printAreas: hasFrontAreas
      ? (frontAreas as Record<PrintSize, PrintArea>)
      : allPrintAreas('tshirt'),
    ...(hasBackAreas ? {
      printAreasBySide: {
        FRONT: hasFrontAreas ? (frontAreas as Record<PrintSize, PrintArea>) : allPrintAreas('tshirt'),
        BACK: backAreas as Record<PrintSize, PrintArea>,
      },
    } : {}),
    layouts: layouts.length > 0 ? layouts : undefined,
    allowMultipleLayouts,
    allowBackPrint,
    imageUrls: {
      FRONT: m.frontImage,
      ...(m.backImage ? { BACK: m.backImage } : {}),
    },
    shadowUrls: {
      ...(m.frontShadow ? { FRONT: m.frontShadow } : {}),
      ...(m.backShadow ? { BACK: m.backShadow } : {}),
    },
    basePrice: m.basePrice || 0,
    frontPrintPrice: m.frontPrintPrice || 0,
    backPrintPrice: m.backPrintPrice || 0,
  };
}

/* ── Print sizes ── */
export const PRINT_SIZES: PrintSizeOption[] = [
  { id: 'full',   label: 'Full Print',   inchLabel: '14 × 18 in', scaleFactor: 1.00, sides: ['FRONT', 'BACK'] },
  { id: 'medium', label: 'Medium Print', inchLabel: '10 × 12 in', scaleFactor: 0.75, sides: ['FRONT', 'BACK'] },
  { id: 'small',  label: 'Small Print',  inchLabel: '6 × 6 in',   scaleFactor: 0.50, sides: ['FRONT', 'BACK'] },
  { id: 'pocket', label: 'Pocket Print', inchLabel: '3 × 3 in',   scaleFactor: 0.35, sides: ['FRONT'] },
];

/* ── Color palette ── */
export const COLORS: { name: string; hex: string }[] = [
  { name: 'White',        hex: '#ffffff' },
  { name: 'Black',        hex: '#1a1a1a' },
  { name: 'Navy',         hex: '#1b2a4a' },
  { name: 'Charcoal',     hex: '#36454f' },
  { name: 'Red',          hex: '#c0392b' },
  { name: 'Burgundy',     hex: '#6b1c23' },
  { name: 'Forest Green', hex: '#2d5a3d' },
  { name: 'Olive',        hex: '#556b2f' },
  { name: 'Sky Blue',     hex: '#87ceeb' },
  { name: 'Sand',         hex: '#c2b280' },
  { name: 'Lavender',     hex: '#b4a7d6' },
  { name: 'Heather Grey', hex: '#b2bec3' },
];

/* ── Body rect definitions for garment types ── */
const BODIES: Record<string, { x: number; y: number; w: number; h: number }> = {
  tshirt:  { x: 270, y: 175, w: 260, h: 655 },
  hoodie:  { x: 270, y: 55,  w: 260, h: 785 },
  jacket:  { x: 260, y: 118, w: 280, h: 722 },
  cap:     { x: 210, y: 190, w: 380, h: 415 },
  pant:    { x: 250, y: 78,  w: 300, h: 840 },
};

/* ── Print area calculation ── */
export function computePrintArea(type: string, size: PrintSize): PrintArea {
  const body = BODIES[type] || BODIES.tshirt;
  const ps = PRINT_SIZES.find(p => p.id === size) || PRINT_SIZES[0];
  const s = ps.scaleFactor;
  const w = Math.round(body.w * s);
  const h = Math.round(body.h * 0.55 * s);
  return {
    x: Math.round(body.x + (body.w - w) / 2),
    y: Math.round(body.y + body.h * 0.15),
    w, h,
  };
}

export function allPrintAreas(type: string): Record<PrintSize, PrintArea> {
  return {
    full:   computePrintArea(type, 'full'),
    medium: computePrintArea(type, 'medium'),
    small:  computePrintArea(type, 'small'),
    pocket: computePrintArea(type, 'pocket'),
  };
}

/* ── Color helpers ── */
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `rgb(${r},${g},${b})`;
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount));
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount));
  return `rgb(${r},${g},${b})`;
}

/* ═══════════════════════════════════════════════════════════
   SVG MOCKUP GENERATORS
   ═══════════════════════════════════════════════════════════ */

function tshirtSVG(side: PrintSide, color: string): string {
  const imgUrl = side === 'FRONT'
    ? getCachedImage('/mockups/tshirt-front.png')
    : getCachedImage('/mockups/tshirt-back.png');
  if (imgUrl) return tshirtImageSVG(side, color, imgUrl);
  return tshirtFallbackSVG(side, color);
}

function tshirtImageSVG(side: PrintSide, color: string, b64: string): string {
  const num = parseInt(color.replace('#', ''), 16);
  const rr = ((num >> 16) & 0xff) / 255;
  const gg = ((num >> 8) & 0xff) / 255;
  const bb = (num & 0xff) / 255;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
<defs>
  <filter id="tint" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix"
      values="${rr} 0 0 0 0
              0 ${gg} 0 0 0
              0 0 ${bb} 0 0
              0 0 0 1 0"/>
  </filter>
</defs>
<image href="${b64}" x="0" y="0" width="${CW}" height="${CH}" filter="url(#tint)"/>
</svg>`;
}

function tshirtFallbackSVG(side: PrintSide, color: string): string {
  const f = side === 'FRONT';
  const dk = darken(color, 0.10);
  const dk2 = darken(color, 0.18);
  const lt = lighten(color, 0.06);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs>
  <filter id="ds" x="-10%" y="-5%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="18"/>
    <feOffset dy="14"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="foldH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#000" stop-opacity=".07"/>
    <stop offset="18%" stop-color="#fff" stop-opacity=".04"/>
    <stop offset="50%" stop-color="#000" stop-opacity="0"/>
    <stop offset="82%" stop-color="#fff" stop-opacity=".04"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".07"/>
  </linearGradient>
  <linearGradient id="foldV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff" stop-opacity=".06"/>
    <stop offset="40%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".08"/>
  </linearGradient>
  <linearGradient id="sleeveL" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#000" stop-opacity=".06"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="sleeveR" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#000" stop-opacity=".06"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
</defs>
<g filter="url(#ds)">
  <path d="M275,175 L148,235 C142,238 143,245 148,248 L198,340 C202,346 208,346 212,342 L270,295 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M275,175 L148,235 C142,238 143,245 148,248 L198,340 C202,346 208,346 212,342 L270,295 Z"
        fill="url(#sleeveL)"/>
  <path d="M525,175 L652,235 C658,238 657,245 652,248 L602,340 C598,346 592,346 588,342 L530,295 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M525,175 L652,235 C658,238 657,245 652,248 L602,340 C598,346 592,346 588,342 L530,295 Z"
        fill="url(#sleeveR)"/>
  <path d="M270,295 L270,790 C270,815 285,830 310,830 L490,830 C515,830 530,815 530,790 L530,295 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M275,175 C325,205 362,218 400,218 C438,218 475,205 525,175 L530,295 L270,295 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.5" stroke-linejoin="round"/>
</g>
<path d="M270,295 L270,790 C270,815 285,830 310,830 L490,830 C515,830 530,815 530,790 L530,295 Z"
      fill="url(#foldH)"/>
<path d="M270,295 L270,790 C270,815 285,830 310,830 L490,830 C515,830 530,815 530,790 L530,295 Z"
      fill="url(#foldV)"/>
<path d="M310,380 Q360,374 400,378 Q440,382 470,375" fill="none" stroke="rgba(0,0,0,.03)" stroke-width="1"/>
<path d="M305,520 Q370,512 400,516 Q430,520 490,510" fill="none" stroke="rgba(0,0,0,.025)" stroke-width="1"/>
<path d="M310,660 Q360,654 400,658 Q440,662 480,654" fill="none" stroke="rgba(0,0,0,.025)" stroke-width="1"/>
<path d="M275,177 L270,295" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,4" opacity=".4"/>
<path d="M525,177 L530,295" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,4" opacity=".4"/>
<path d="M198,336 Q205,342 212,338" fill="none" stroke="${dk2}" stroke-width="0.8" stroke-dasharray="2,2" opacity=".35"/>
<path d="M588,338 Q595,342 602,336" fill="none" stroke="${dk2}" stroke-width="0.8" stroke-dasharray="2,2" opacity=".35"/>
<path d="M310,826 L490,826" fill="none" stroke="${dk2}" stroke-width="0.7" stroke-dasharray="3,3" opacity=".3"/>
${f ? `
<ellipse cx="400" cy="182" rx="58" ry="22" fill="${dk}"/>
<ellipse cx="400" cy="182" rx="55" ry="20" fill="${color}"/>
<ellipse cx="400" cy="182" rx="48" ry="16" fill="${lt}" opacity=".25"/>
<ellipse cx="400" cy="182" rx="54" ry="19.5" fill="none" stroke="${dk2}" stroke-width="0.5" stroke-dasharray="2,2" opacity=".3"/>
<ellipse cx="400" cy="192" rx="40" ry="6" fill="rgba(0,0,0,.04)"/>
` : `
<path d="M350,180 Q400,195 450,180" fill="none" stroke="${dk}" stroke-width="1.5"/>
<path d="M352,178 Q400,192 448,178" fill="none" stroke="${dk2}" stroke-width="0.5" stroke-dasharray="2,2" opacity=".3"/>
<rect x="388" y="192" width="24" height="12" rx="1.5" fill="${dk}" opacity=".12"/>
`}
</svg>`;
}

// ─── HOODIE ───────────────────────────────────────────────────
function hoodieSVG(side: PrintSide, color: string): string {
  const f = side === 'FRONT';
  const dk = darken(color, 0.10);
  const dk2 = darken(color, 0.18);
  const lt = lighten(color, 0.06);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs>
  <filter id="ds" x="-10%" y="-5%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="18"/>
    <feOffset dy="14"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="foldH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#000" stop-opacity=".07"/>
    <stop offset="18%" stop-color="#fff" stop-opacity=".03"/>
    <stop offset="50%" stop-color="#000" stop-opacity="0"/>
    <stop offset="82%" stop-color="#fff" stop-opacity=".03"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".07"/>
  </linearGradient>
  <linearGradient id="foldV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff" stop-opacity=".05"/>
    <stop offset="40%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".07"/>
  </linearGradient>
  <linearGradient id="hoodShade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff" stop-opacity=".08"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".10"/>
  </linearGradient>
  <linearGradient id="sleeveL" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#000" stop-opacity=".06"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="sleeveR" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#000" stop-opacity=".06"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
</defs>
<g filter="url(#ds)">
  <path d="M295,185 C295,105 330,55 400,55 C470,55 505,105 505,185"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M295,185 C295,105 330,55 400,55 C470,55 505,105 505,185"
        fill="url(#hoodShade)"/>
  <path d="M275,190 L148,250 C142,253 143,260 148,263 L198,358 C202,364 208,364 212,360 L270,310 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M275,190 L148,250 C142,253 143,260 148,263 L198,358 C202,364 208,364 212,360 L270,310 Z"
        fill="url(#sleeveL)"/>
  <path d="M525,190 L652,250 C658,253 657,260 652,263 L602,358 C598,364 592,364 588,360 L530,310 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M525,190 L652,250 C658,253 657,260 652,263 L602,358 C598,364 592,364 588,360 L530,310 Z"
        fill="url(#sleeveR)"/>
  <path d="M270,310 L270,800 C270,825 285,840 310,840 L490,840 C515,840 530,825 530,800 L530,310 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M275,190 C325,220 362,232 400,232 C438,232 475,220 525,190 L530,310 L270,310 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.5"/>
</g>
<path d="M270,310 L270,800 C270,825 285,840 310,840 L490,840 C515,840 530,825 530,800 L530,310 Z"
      fill="url(#foldH)"/>
<path d="M270,310 L270,800 C270,825 285,840 310,840 L490,840 C515,840 530,825 530,800 L530,310 Z"
      fill="url(#foldV)"/>
<path d="M305,420 Q360,414 400,418 Q440,422 490,415" fill="none" stroke="rgba(0,0,0,.025)" stroke-width="1"/>
<path d="M305,560 Q370,552 400,556 Q430,560 490,550" fill="none" stroke="rgba(0,0,0,.02)" stroke-width="1"/>
<path d="M298,182 C298,108 332,60 400,60 C468,60 502,108 502,182"
      fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,4" opacity=".35"/>
<path d="M310,836 L490,836" fill="none" stroke="${dk2}" stroke-width="0.7" stroke-dasharray="3,3" opacity=".3"/>
<path d="M198,354 Q205,360 212,356" fill="none" stroke="${dk2}" stroke-width="0.7" stroke-dasharray="2,2" opacity=".3"/>
<path d="M588,356 Q595,360 602,354" fill="none" stroke="${dk2}" stroke-width="0.7" stroke-dasharray="2,2" opacity=".3"/>
${f ? `
<line x1="387" y1="210" x2="383" y2="310" stroke="${dk2}" stroke-width="1.2" opacity=".25"/>
<line x1="413" y1="210" x2="417" y2="310" stroke="${dk2}" stroke-width="1.2" opacity=".25"/>
<circle cx="383" cy="312" r="3" fill="${dk}" opacity=".2"/>
<circle cx="417" cy="312" r="3" fill="${dk}" opacity=".2"/>
<path d="M330,590 Q330,585 335,585 L465,585 Q470,585 470,590 L470,670 Q470,690 450,690 L350,690 Q330,690 330,670 Z"
      fill="none" stroke="${dk}" stroke-width="1" opacity=".15"/>
<line x1="400" y1="585" x2="400" y2="690" stroke="${dk}" stroke-width="0.5" opacity=".1"/>
` : `
<line x1="400" y1="232" x2="400" y2="800" stroke="${dk}" stroke-width="0.5" opacity=".08"/>
<rect x="388" y="210" width="24" height="12" rx="1.5" fill="${dk}" opacity=".1"/>
`}
</svg>`;
}

// ─── JACKET ───────────────────────────────────────────────────
function jacketSVG(side: PrintSide, color: string): string {
  const f = side === 'FRONT';
  const dk = darken(color, 0.10);
  const dk2 = darken(color, 0.18);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs>
  <filter id="ds" x="-10%" y="-5%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="18"/>
    <feOffset dy="14"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="foldH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#000" stop-opacity=".07"/>
    <stop offset="18%" stop-color="#fff" stop-opacity=".03"/>
    <stop offset="50%" stop-color="#000" stop-opacity="0"/>
    <stop offset="82%" stop-color="#fff" stop-opacity=".03"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".07"/>
  </linearGradient>
  <linearGradient id="foldV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff" stop-opacity=".05"/>
    <stop offset="40%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".07"/>
  </linearGradient>
  <linearGradient id="sleeveL" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#000" stop-opacity=".06"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="sleeveR" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#000" stop-opacity=".06"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
</defs>
<g filter="url(#ds)">
  <path d="M315,168 L315,148 C315,132 345,118 400,118 C455,118 485,132 485,148 L485,168"
        fill="${color}" stroke="${dk}" stroke-width="1"/>
  <path d="M315,168 L315,148 C315,132 345,118 400,118 C455,118 485,132 485,148 L485,168"
        fill="rgba(0,0,0,.04)"/>
  <path d="M268,190 L140,255 C134,258 135,265 140,268 L192,365 C196,371 202,371 206,367 L260,318 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M268,190 L140,255 C134,258 135,265 140,268 L192,365 C196,371 202,371 206,367 L260,318 Z"
        fill="url(#sleeveL)"/>
  <path d="M532,190 L660,255 C666,258 665,265 660,268 L608,365 C604,371 598,371 594,367 L540,318 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M532,190 L660,255 C666,258 665,265 660,268 L608,365 C604,371 598,371 594,367 L540,318 Z"
        fill="url(#sleeveR)"/>
  <path d="M260,318 L260,800 C260,825 275,840 300,840 L500,840 C525,840 540,825 540,800 L540,318 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M268,190 C318,218 358,230 400,230 C442,230 482,218 532,190 L540,318 L260,318 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.5"/>
</g>
<path d="M260,318 L260,800 C260,825 275,840 300,840 L500,840 C525,840 540,825 540,800 L540,318 Z"
      fill="url(#foldH)"/>
<path d="M260,318 L260,800 C260,825 275,840 300,840 L500,840 C525,840 540,825 540,800 L540,318 Z"
      fill="url(#foldV)"/>
<path d="M270,192 L260,318" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,4" opacity=".3"/>
<path d="M530,192 L540,318" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,4" opacity=".3"/>
<path d="M300,836 L500,836" fill="none" stroke="${dk2}" stroke-width="0.7" stroke-dasharray="3,3" opacity=".3"/>
<path d="M300,420 Q365,414 400,418 Q435,422 500,415" fill="none" stroke="rgba(0,0,0,.02)" stroke-width="1"/>
<path d="M300,580 Q365,573 400,577 Q435,581 500,573" fill="none" stroke="rgba(0,0,0,.02)" stroke-width="1"/>
${f ? `
<line x1="400" y1="168" x2="400" y2="840" stroke="${dk}" stroke-width="2.5" opacity=".15"/>
<line x1="400" y1="168" x2="400" y2="840" stroke="${lighten(color, 0.15)}" stroke-width="0.8" opacity=".2"/>
<rect x="396" y="170" width="8" height="14" rx="2" fill="${dk}" opacity=".15"/>
<path d="M298,360 L373,360 L373,415 Q373,425 363,425 L308,425 Q298,425 298,415 Z"
      fill="none" stroke="${dk}" stroke-width="0.8" opacity=".15"/>
<path d="M427,580 L515,580 L515,650 Q515,660 505,660 L437,660 Q427,660 427,650 Z"
      fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
<path d="M285,580 L373,580 L373,650 Q373,660 363,660 L295,660 Q285,660 285,650 Z"
      fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
` : `
<line x1="400" y1="230" x2="400" y2="800" stroke="${dk}" stroke-width="0.5" opacity=".08"/>
<path d="M260,370 L540,370" fill="none" stroke="${dk}" stroke-width="0.5" stroke-dasharray="4,4" opacity=".1"/>
<rect x="388" y="205" width="24" height="12" rx="1.5" fill="${dk}" opacity=".1"/>
`}
</svg>`;
}

// ─── CAP ──────────────────────────────────────────────────────
function capSVG(side: PrintSide, color: string): string {
  const dk = darken(color, 0.12);
  const dk2 = darken(color, 0.20);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs>
  <filter id="ds" x="-10%" y="-5%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="16"/>
    <feOffset dy="10"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.16 0"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="crownShade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff" stop-opacity=".10"/>
    <stop offset="60%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".10"/>
  </linearGradient>
  <radialGradient id="crownHL" cx="0.4" cy="0.3" r="0.6">
    <stop offset="0%" stop-color="#fff" stop-opacity=".08"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="brimShade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#000" stop-opacity=".05"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".12"/>
  </linearGradient>
</defs>
<g filter="url(#ds)">
  <path d="M210,490 C210,290 280,190 400,190 C520,190 590,290 590,490 Z"
        fill="${color}" stroke="${dk}" stroke-width="1"/>
  <path d="M210,490 C210,290 280,190 400,190 C520,190 590,290 590,490 Z"
        fill="url(#crownShade)"/>
  <path d="M210,490 C210,290 280,190 400,190 C520,190 590,290 590,490 Z"
        fill="url(#crownHL)"/>
  <ellipse cx="400" cy="490" rx="245" ry="50" fill="${color}" stroke="${dk}" stroke-width="1"/>
  <ellipse cx="400" cy="490" rx="245" ry="50" fill="url(#brimShade)"/>
  <path d="M155,498 C195,565 290,605 400,605 C510,605 605,565 645,498"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M155,498 C195,565 290,605 400,605 C510,605 605,565 645,498"
        fill="url(#brimShade)"/>
</g>
<line x1="400" y1="195" x2="400" y2="490" stroke="${dk2}" stroke-width="0.7" opacity=".15"/>
<line x1="305" y1="210" x2="335" y2="490" stroke="${dk2}" stroke-width="0.5" opacity=".1"/>
<line x1="495" y1="210" x2="465" y2="490" stroke="${dk2}" stroke-width="0.5" opacity=".1"/>
<path d="M305,212 Q350,195 400,195 Q450,195 495,212" fill="none" stroke="${dk2}" stroke-width="0.5" opacity=".1"/>
<circle cx="400" cy="195" r="8" fill="${color}" stroke="${dk}" stroke-width="1.5"/>
<circle cx="400" cy="195" r="4" fill="${dk}" opacity=".15"/>
<circle cx="340" cy="250" r="3" fill="none" stroke="${dk2}" stroke-width="0.6" opacity=".2"/>
<circle cx="460" cy="250" r="3" fill="none" stroke="${dk2}" stroke-width="0.6" opacity=".2"/>
<ellipse cx="400" cy="490" rx="240" ry="47" fill="none" stroke="${dk2}" stroke-width="0.5" stroke-dasharray="3,3" opacity=".2"/>
</svg>`;
}

// ─── PANT ─────────────────────────────────────────────────────
function pantSVG(side: PrintSide, color: string): string {
  const f = side === 'FRONT';
  const dk = darken(color, 0.10);
  const dk2 = darken(color, 0.18);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs>
  <filter id="ds" x="-10%" y="-5%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="18"/>
    <feOffset dy="14"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="foldV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff" stop-opacity=".04"/>
    <stop offset="35%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".06"/>
  </linearGradient>
  <linearGradient id="legL" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#000" stop-opacity=".05"/>
    <stop offset="50%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".03"/>
  </linearGradient>
  <linearGradient id="legR" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#000" stop-opacity=".03"/>
    <stop offset="50%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".05"/>
  </linearGradient>
</defs>
<g filter="url(#ds)">
  <rect x="250" y="78" width="300" height="45" rx="5" fill="${color}" stroke="${dk}" stroke-width="1"/>
  <rect x="250" y="78" width="300" height="45" rx="5" fill="rgba(0,0,0,.03)"/>
  <path d="M250,123 L250,480 L232,890 C232,905 244,918 260,918 L385,918 C395,918 400,905 400,890 L400,480 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M400,480 L400,890 C400,905 405,918 415,918 L540,918 C556,918 568,905 568,890 L550,480 L550,123 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <rect x="250" y="123" width="300" height="15" fill="${color}"/>
</g>
<path d="M250,138 L250,480 L232,890 C232,905 244,918 260,918 L385,918 C395,918 400,905 400,890 L400,480 L400,138 Z"
      fill="url(#legL)"/>
<path d="M400,138 L400,480 L400,890 C400,905 405,918 415,918 L540,918 C556,918 568,905 568,890 L550,480 L550,138 Z"
      fill="url(#legR)"/>
<path d="M250,138 L550,138 L550,890 C550,900 544,918 540,918 L260,918 C252,918 242,905 240,890 Z"
      fill="url(#foldV)" opacity=".6"/>
<path d="M280,300 Q330,295 380,300" fill="none" stroke="rgba(0,0,0,.025)" stroke-width="1"/>
<path d="M420,310 Q470,305 530,310" fill="none" stroke="rgba(0,0,0,.025)" stroke-width="1"/>
<path d="M265,550 Q320,544 370,550" fill="none" stroke="rgba(0,0,0,.02)" stroke-width="1"/>
<path d="M430,560 Q480,554 535,560" fill="none" stroke="rgba(0,0,0,.02)" stroke-width="1"/>
<path d="M400,138 L400,480" fill="none" stroke="${dk}" stroke-width="0.8" opacity=".1"/>
<path d="M240,910 L390,910" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,3" opacity=".25"/>
<path d="M410,910 L560,910" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,3" opacity=".25"/>
${f ? `
<line x1="400" y1="123" x2="400" y2="290" stroke="${dk}" stroke-width="1.5" opacity=".1"/>
<path d="M400,123 Q395,270 396,290" fill="none" stroke="${dk}" stroke-width="0.5" opacity=".12"/>
<rect x="290" y="75" width="9" height="50" rx="2" fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
<rect x="380" y="75" width="9" height="50" rx="2" fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
<rect x="411" y="75" width="9" height="50" rx="2" fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
<rect x="500" y="75" width="9" height="50" rx="2" fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
<path d="M268,160 L268,280 Q268,295 282,300 L358,325 Q370,328 370,316 L370,155"
      fill="none" stroke="${dk}" stroke-width="0.6" opacity=".1"/>
<path d="M532,160 L532,280 Q532,295 518,300 L442,325 Q430,328 430,316 L430,155"
      fill="none" stroke="${dk}" stroke-width="0.6" opacity=".1"/>
` : `
<rect x="290" y="200" width="70" height="80" rx="4" fill="none" stroke="${dk}" stroke-width="0.7" opacity=".12"/>
<rect x="440" y="200" width="70" height="80" rx="4" fill="none" stroke="${dk}" stroke-width="0.7" opacity=".12"/>
<line x1="400" y1="138" x2="400" y2="480" stroke="${dk}" stroke-width="0.5" opacity=".06"/>
`}
</svg>`;
}

/* ═══════════════════════════════════════════════════════════
   TEMPLATE REGISTRY
   ═══════════════════════════════════════════════════════════ */
export const MOCKUP_TEMPLATES: Record<string, MockupTemplate> = {
  tshirt: {
    label: 'T-Shirt',
    icon: `<svg viewBox="0 0 32 32" fill="none"><path d="M9 5L3 9l3 4 4-2v16h12V11l4 2 3-4-6-4c0 0-1.5 3.5-7 3.5S9 5 9 5z" fill="currentColor" opacity=".85"/></svg>`,
    renderSVG: tshirtSVG,
    printAreas: allPrintAreas('tshirt'),
    printAreasBySide: {
      FRONT: {
        full:   { x: 166, y: 112, w: 297, h: 305 },
        medium: { x: 195, y: 142, w: 238, h: 244 },
        small:  { x: 243, y: 191, w: 142, h: 146 },
        pocket: { x: 354, y: 162, w: 70, h: 70 },
      },
      BACK: {
        full:   { x: 200, y: 162, w: 378, h: 300 },
        medium: { x: 257, y: 207, w: 264, h: 210 },
        small:  { x: 304, y: 245, w: 170, h: 135 },
        pocket: { x: 354, y: 182, w: 70, h: 70 },
      },
    },
    imageUrls: { FRONT: '/mockups/tshirt-front.png', BACK: '/mockups/tshirt-back.png' },
    shadowUrls: { FRONT: '/mockups/tshirt-front-shadow.png', BACK: '/mockups/tshirt-back-shadow.png' },
  },
  hoodie: {
    label: 'Hoodie',
    icon: `<svg viewBox="0 0 32 32" fill="none"><path d="M9 8L3 12l3 4 4-2v14h12V14l4 2 3-4-6-4c0 0-1 3-7 3S9 8 9 8z" fill="currentColor" opacity=".85"/><path d="M12 8c0-3 2-5 4-5s4 2 4 5" stroke="currentColor" stroke-width="1" fill="none" opacity=".5"/></svg>`,
    renderSVG: hoodieSVG,
    printAreas: allPrintAreas('hoodie'),
  },
  jacket: {
    label: 'Jacket',
    icon: `<svg viewBox="0 0 32 32" fill="none"><path d="M9 6L2 11l3 5 4-3v15h5V12h6v16h5V13l4 3 3-5-7-5c0 0-2 3-7 3S9 6 9 6z" fill="currentColor" opacity=".85"/></svg>`,
    renderSVG: jacketSVG,
    printAreas: allPrintAreas('jacket'),
  },
  cap: {
    label: 'Cap',
    icon: `<svg viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="20" rx="12" ry="4" fill="currentColor" opacity=".7"/><path d="M5 20c0-9 5-14 11-14s11 5 11 14" fill="currentColor" opacity=".85"/></svg>`,
    renderSVG: capSVG,
    printAreas: allPrintAreas('cap'),
  },
  pant: {
    label: 'Pant',
    icon: `<svg viewBox="0 0 32 32" fill="none"><path d="M10 4h12v5l-1 19h-4l-1-14-1 14h-4l-1-19z" fill="currentColor" opacity=".85"/></svg>`,
    renderSVG: pantSVG,
    printAreas: allPrintAreas('pant'),
  },
};
