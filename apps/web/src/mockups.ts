import type { MockupTemplate, PrintSide, PrintSize, PrintSizeOption } from './types';

/* ── Canvas dimensions ── */
export const CW = 800, CH = 1000;

/* ── Image preloading for real mockups ── */
const _imgCache: Record<string, string> = {};
let _preloaded: Promise<void> | null = null;

/** Fetch mockup PNGs and cache them as base64 data URIs (call once on app start). */
export function preloadMockupImages(): Promise<void> {
  if (_preloaded) return _preloaded;
  const urls = new Set<string>();
  for (const tmpl of Object.values(MOCKUP_TEMPLATES)) {
    if (tmpl.imageUrls) for (const url of Object.values(tmpl.imageUrls)) { if (url) urls.add(url); }
    if (tmpl.shadowUrls) for (const url of Object.values(tmpl.shadowUrls)) { if (url) urls.add(url); }
  }
  if (!urls.size) { _preloaded = Promise.resolve(); return _preloaded; }
  _preloaded = Promise.all(
    [...urls].map(url =>
      fetch(url)
        .then(r => r.blob())
        .then(blob => new Promise<void>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => { _imgCache[url] = reader.result as string; resolve(); };
          reader.readAsDataURL(blob);
        }))
        .catch(e => console.warn('Mockup preload failed:', url, e))
    )
  ).then(() => {});
  return _preloaded;
}

/** Get a cached mockup image as base64. */
export function getCachedImage(url: string): string | undefined {
  return _imgCache[url];
}

/* ── Print sizes with pricing ── */
export const PRINT_SIZES: PrintSizeOption[] = [
  { id: 'full',   label: 'Full Print',   description: '14×18 in — covers the chest/back',    widthRatio: 0.82, heightRatio: 0.62, sides: ['FRONT','BACK'], priceMultiplier: 1.0 },
  { id: 'medium', label: 'Medium Print',  description: '10×12 in — standard centre print',    widthRatio: 0.58, heightRatio: 0.42, sides: ['FRONT','BACK'], priceMultiplier: 0.75 },
  { id: 'small',  label: 'Small Print',   description: '6×6 in — compact centre design',      widthRatio: 0.35, heightRatio: 0.22, sides: ['FRONT','BACK'], priceMultiplier: 0.50 },
  { id: 'pocket', label: 'Pocket Print',  description: '3×3 in — left-chest pocket area',     widthRatio: 0.18, heightRatio: 0.12, sides: ['FRONT'],        priceMultiplier: 0.35 },
];

/* ── Color palette ── */
export const COLORS = [
  { name: 'White',      hex: '#ffffff' },
  { name: 'Black',      hex: '#1a1a1a' },
  { name: 'Navy',       hex: '#1b2a4a' },
  { name: 'Charcoal',   hex: '#36454f' },
  { name: 'Red',        hex: '#c0392b' },
  { name: 'Burgundy',   hex: '#6b1c23' },
  { name: 'Forest',     hex: '#2d5a3d' },
  { name: 'Olive',      hex: '#556b2f' },
  { name: 'Slate Blue', hex: '#5b7fa5' },
  { name: 'Sky Blue',   hex: '#87ceeb' },
  { name: 'Sand',       hex: '#c2b280' },
  { name: 'Heather Grey', hex: '#b2bec3' },
];

/* ══════════════════════════════════════════════════════════════
   PRINT AREA DEFINITIONS
   ──────────────────────────────────────────────────────────────
   Defined directly per product type so they fit perfectly
   inside the garment silhouettes.
   ══════════════════════════════════════════════════════════════ */

/*
 * For each product type we define the "printable body" rect — the rectangular
 * region of the torso / front panel where prints can go. Then each print size
 * is a proportion of THAT rect, centered vertically a bit above middle (the
 * visual "chest center").
 */
interface BodyRect { cx: number; top: number; w: number; h: number; pocketOffsetX?: number; pocketY?: number }

const BODIES: Record<string, BodyRect> = {
  //            cx    top   width  height  (canvas coords)
  tshirt:  { cx: 400, top: 230, w: 260, h: 490, pocketOffsetX: -60, pocketY: 270 },
  hoodie:  { cx: 400, top: 255, w: 260, h: 480, pocketOffsetX: -60, pocketY: 295 },
  jacket:  { cx: 400, top: 265, w: 280, h: 470, pocketOffsetX: -65, pocketY: 305 },
  cap:     { cx: 400, top: 260, w: 220, h: 220 },
  pant:    { cx: 400, top: 140, w: 240, h: 350 },
};

function computePrintArea(productType: string, size: PrintSize): { x: number; y: number; w: number; h: number } {
  const body = BODIES[productType] || BODIES.tshirt;
  const so = PRINT_SIZES.find(s => s.id === size)!;

  const pw = Math.round(body.w * so.widthRatio);
  const ph = Math.round(body.h * so.heightRatio);

  if (size === 'pocket') {
    const px = body.cx + (body.pocketOffsetX ?? -50);
    const py = body.pocketY ?? (body.top + 40);
    return { x: Math.round(px - pw / 2), y: py, w: pw, h: ph };
  }

  // Centre vertically at ~40 % from top of body (slightly above geometric centre)
  const cy = body.top + body.h * 0.40;
  return {
    x: Math.round(body.cx - pw / 2),
    y: Math.round(cy - ph / 2),
    w: pw,
    h: ph,
  };
}

function allPrintAreas(productType: string): Record<PrintSize, { x: number; y: number; w: number; h: number }> {
  return {
    full:   computePrintArea(productType, 'full'),
    medium: computePrintArea(productType, 'medium'),
    small:  computePrintArea(productType, 'small'),
    pocket: computePrintArea(productType, 'pocket'),
  };
}

/* ══════════════════════════════════════════════════════════════
   REALISTIC SVG MOCKUP GENERATORS
   ──────────────────────────────────────────────────────────────
   Photorealistic flat-lay style with:
   • Ambient drop shadow
   • Left/right edge fabric folds (vertical linear gradient)
   • Vertical fabric drape gradient
   • Collar / hood / detail stitching
   • Subtle wrinkle lines for realism
   ══════════════════════════════════════════════════════════════ */

/** Darken a hex colour by a fraction (0-1) */
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `rgb(${r},${g},${b})`;
}

/** Lighten a hex colour by a fraction (0-1) */
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount));
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount));
  return `rgb(${r},${g},${b})`;
}

// ─── T-SHIRT ──────────────────────────────────────────────────
function tshirtSVG(side: PrintSide, color: string): string {
  const imgUrl = side === 'FRONT' ? '/mockups/tshirt-front.png' : '/mockups/tshirt-back.png';
  const b64 = _imgCache[imgUrl];
  if (b64) return tshirtImageSVG(b64, color);
  return tshirtFallbackSVG(side, color);
}

/**
 * Image-based t-shirt: base64 PNG with multiply-blend color tinting.
 * The extracted PSD shirt is neutral/white with realistic fabric texture.
 * Multiply blend: white areas → target color, shadows stay dark.
 */
function tshirtImageSVG(b64: string, color: string): string {
  const num = parseInt(color.replace('#', ''), 16);
  const r = ((num >> 16) & 0xff) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;
  const isWhite = r > 0.95 && g > 0.95 && b > 0.95;

  if (isWhite) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<image href="${b64}" width="800" height="1000"/>
</svg>`;
  }

  // Multiply blend: desaturate shirt to grayscale, then multiply with target color.
  // This preserves all fabric detail (folds, shadows, texture) while changing the color.
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="800" height="1000" viewBox="0 0 800 1000">
<defs>
  <filter id="tint" color-interpolation-filters="sRGB">
    <!-- Desaturate to grayscale -->
    <feColorMatrix type="saturate" values="0" result="gray"/>
    <!-- Multiply: gray × color. Keeps dark shadows, tints light areas -->
    <feColorMatrix type="matrix" in="gray" values="
      ${r.toFixed(4)} 0 0 0 0
      0 ${g.toFixed(4)} 0 0 0
      0 0 ${b.toFixed(4)} 0 0
      0 0 0 1 0
    "/>
  </filter>
</defs>
<image href="${b64}" width="800" height="1000" filter="url(#tint)"/>
</svg>`;
}

/** SVG-art fallback t-shirt (used before images are preloaded) */
function tshirtFallbackSVG(side: PrintSide, color: string): string {
  const f = side === 'FRONT';
  const dk = darken(color, 0.08);
  const dk2 = darken(color, 0.15);
  const lt = lighten(color, 0.08);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs>
  <!-- Ambient shadow under the garment -->
  <filter id="ds" x="-10%" y="-5%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="18"/>
    <feOffset dy="14"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <!-- Horizontal fabric fold gradient -->
  <linearGradient id="foldH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#000" stop-opacity=".07"/>
    <stop offset="18%" stop-color="#fff" stop-opacity=".04"/>
    <stop offset="50%" stop-color="#000" stop-opacity="0"/>
    <stop offset="82%" stop-color="#fff" stop-opacity=".04"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".07"/>
  </linearGradient>
  <!-- Vertical drape gradient -->
  <linearGradient id="foldV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff" stop-opacity=".06"/>
    <stop offset="40%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".08"/>
  </linearGradient>
  <!-- Sleeve shading -->
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
  <!-- ** Left sleeve ** -->
  <path d="M275,175 L148,235 C142,238 143,245 148,248 L198,340 C202,346 208,346 212,342 L270,295 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M275,175 L148,235 C142,238 143,245 148,248 L198,340 C202,346 208,346 212,342 L270,295 Z"
        fill="url(#sleeveL)"/>

  <!-- ** Right sleeve ** -->
  <path d="M525,175 L652,235 C658,238 657,245 652,248 L602,340 C598,346 592,346 588,342 L530,295 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M525,175 L652,235 C658,238 657,245 652,248 L602,340 C598,346 592,346 588,342 L530,295 Z"
        fill="url(#sleeveR)"/>

  <!-- ** Body ** -->
  <path d="M270,295 L270,790 C270,815 285,830 310,830 L490,830 C515,830 530,815 530,790 L530,295 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>

  <!-- ** Shoulder yoke ** -->
  <path d="M275,175 C325,205 362,218 400,218 C438,218 475,205 525,175 L530,295 L270,295 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.5" stroke-linejoin="round"/>
</g>

<!-- Body fabric folds -->
<path d="M270,295 L270,790 C270,815 285,830 310,830 L490,830 C515,830 530,815 530,790 L530,295 Z"
      fill="url(#foldH)"/>
<path d="M270,295 L270,790 C270,815 285,830 310,830 L490,830 C515,830 530,815 530,790 L530,295 Z"
      fill="url(#foldV)"/>

<!-- Subtle wrinkle lines -->
<path d="M310,380 Q360,374 400,378 Q440,382 470,375" fill="none" stroke="rgba(0,0,0,.03)" stroke-width="1"/>
<path d="M305,520 Q370,512 400,516 Q430,520 490,510" fill="none" stroke="rgba(0,0,0,.025)" stroke-width="1"/>
<path d="M310,660 Q360,654 400,658 Q440,662 480,654" fill="none" stroke="rgba(0,0,0,.025)" stroke-width="1"/>

<!-- Shoulder seams -->
<path d="M275,177 L270,295" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,4" opacity=".4"/>
<path d="M525,177 L530,295" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,4" opacity=".4"/>

<!-- Sleeve cuff stitching -->
<path d="M198,336 Q205,342 212,338" fill="none" stroke="${dk2}" stroke-width="0.8" stroke-dasharray="2,2" opacity=".35"/>
<path d="M588,338 Q595,342 602,336" fill="none" stroke="${dk2}" stroke-width="0.8" stroke-dasharray="2,2" opacity=".35"/>

<!-- Hem stitching -->
<path d="M310,826 L490,826" fill="none" stroke="${dk2}" stroke-width="0.7" stroke-dasharray="3,3" opacity=".3"/>

${f ? `
<!-- Front collar — round neck -->
<ellipse cx="400" cy="182" rx="58" ry="22" fill="${dk}"/>
<ellipse cx="400" cy="182" rx="55" ry="20" fill="${color}"/>
<ellipse cx="400" cy="182" rx="48" ry="16" fill="${lt}" opacity=".25"/>
<!-- Collar rib stitching -->
<ellipse cx="400" cy="182" rx="54" ry="19.5" fill="none" stroke="${dk2}" stroke-width="0.5" stroke-dasharray="2,2" opacity=".3"/>
<!-- Neck shadow -->
<ellipse cx="400" cy="192" rx="40" ry="6" fill="rgba(0,0,0,.04)"/>
` : `
<!-- Back collar — low neckline -->
<path d="M350,180 Q400,195 450,180" fill="none" stroke="${dk}" stroke-width="1.5"/>
<path d="M352,178 Q400,192 448,178" fill="none" stroke="${dk2}" stroke-width="0.5" stroke-dasharray="2,2" opacity=".3"/>
<!-- Back neck label area -->
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
  <!-- Hood -->
  <path d="M295,185 C295,105 330,55 400,55 C470,55 505,105 505,185"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M295,185 C295,105 330,55 400,55 C470,55 505,105 505,185"
        fill="url(#hoodShade)"/>

  <!-- Left sleeve -->
  <path d="M275,190 L148,250 C142,253 143,260 148,263 L198,358 C202,364 208,364 212,360 L270,310 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M275,190 L148,250 C142,253 143,260 148,263 L198,358 C202,364 208,364 212,360 L270,310 Z"
        fill="url(#sleeveL)"/>

  <!-- Right sleeve -->
  <path d="M525,190 L652,250 C658,253 657,260 652,263 L602,358 C598,364 592,364 588,360 L530,310 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M525,190 L652,250 C658,253 657,260 652,263 L602,358 C598,364 592,364 588,360 L530,310 Z"
        fill="url(#sleeveR)"/>

  <!-- Body -->
  <path d="M270,310 L270,800 C270,825 285,840 310,840 L490,840 C515,840 530,825 530,800 L530,310 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>

  <!-- Shoulder yoke -->
  <path d="M275,190 C325,220 362,232 400,232 C438,232 475,220 525,190 L530,310 L270,310 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.5"/>
</g>

<!-- Body fabric folds -->
<path d="M270,310 L270,800 C270,825 285,840 310,840 L490,840 C515,840 530,825 530,800 L530,310 Z"
      fill="url(#foldH)"/>
<path d="M270,310 L270,800 C270,825 285,840 310,840 L490,840 C515,840 530,825 530,800 L530,310 Z"
      fill="url(#foldV)"/>

<!-- Wrinkle lines -->
<path d="M305,420 Q360,414 400,418 Q440,422 490,415" fill="none" stroke="rgba(0,0,0,.025)" stroke-width="1"/>
<path d="M305,560 Q370,552 400,556 Q430,560 490,550" fill="none" stroke="rgba(0,0,0,.02)" stroke-width="1"/>

<!-- Hood stitching -->
<path d="M298,182 C298,108 332,60 400,60 C468,60 502,108 502,182"
      fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,4" opacity=".35"/>

<!-- Hem stitching -->
<path d="M310,836 L490,836" fill="none" stroke="${dk2}" stroke-width="0.7" stroke-dasharray="3,3" opacity=".3"/>

<!-- Cuff stitching -->
<path d="M198,354 Q205,360 212,356" fill="none" stroke="${dk2}" stroke-width="0.7" stroke-dasharray="2,2" opacity=".3"/>
<path d="M588,356 Q595,360 602,354" fill="none" stroke="${dk2}" stroke-width="0.7" stroke-dasharray="2,2" opacity=".3"/>

${f ? `
<!-- Drawstrings -->
<line x1="387" y1="210" x2="383" y2="310" stroke="${dk2}" stroke-width="1.2" opacity=".25"/>
<line x1="413" y1="210" x2="417" y2="310" stroke="${dk2}" stroke-width="1.2" opacity=".25"/>
<circle cx="383" cy="312" r="3" fill="${dk}" opacity=".2"/>
<circle cx="417" cy="312" r="3" fill="${dk}" opacity=".2"/>
<!-- Kangaroo pocket -->
<path d="M330,590 Q330,585 335,585 L465,585 Q470,585 470,590 L470,670 Q470,690 450,690 L350,690 Q330,690 330,670 Z"
      fill="none" stroke="${dk}" stroke-width="1" opacity=".15"/>
<line x1="400" y1="585" x2="400" y2="690" stroke="${dk}" stroke-width="0.5" opacity=".1"/>
` : `
<!-- Back centre seam -->
<line x1="400" y1="232" x2="400" y2="800" stroke="${dk}" stroke-width="0.5" opacity=".08"/>
<!-- Back neck label -->
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
  <!-- Stand collar -->
  <path d="M315,168 L315,148 C315,132 345,118 400,118 C455,118 485,132 485,148 L485,168"
        fill="${color}" stroke="${dk}" stroke-width="1"/>
  <path d="M315,168 L315,148 C315,132 345,118 400,118 C455,118 485,132 485,148 L485,168"
        fill="rgba(0,0,0,.04)"/>

  <!-- Left sleeve -->
  <path d="M268,190 L140,255 C134,258 135,265 140,268 L192,365 C196,371 202,371 206,367 L260,318 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M268,190 L140,255 C134,258 135,265 140,268 L192,365 C196,371 202,371 206,367 L260,318 Z"
        fill="url(#sleeveL)"/>

  <!-- Right sleeve -->
  <path d="M532,190 L660,255 C666,258 665,265 660,268 L608,365 C604,371 598,371 594,367 L540,318 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M532,190 L660,255 C666,258 665,265 660,268 L608,365 C604,371 598,371 594,367 L540,318 Z"
        fill="url(#sleeveR)"/>

  <!-- Body -->
  <path d="M260,318 L260,800 C260,825 275,840 300,840 L500,840 C525,840 540,825 540,800 L540,318 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>

  <!-- Shoulders -->
  <path d="M268,190 C318,218 358,230 400,230 C442,230 482,218 532,190 L540,318 L260,318 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.5"/>
</g>

<!-- Body fabric folds -->
<path d="M260,318 L260,800 C260,825 275,840 300,840 L500,840 C525,840 540,825 540,800 L540,318 Z"
      fill="url(#foldH)"/>
<path d="M260,318 L260,800 C260,825 275,840 300,840 L500,840 C525,840 540,825 540,800 L540,318 Z"
      fill="url(#foldV)"/>

<!-- Shoulder seams -->
<path d="M270,192 L260,318" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,4" opacity=".3"/>
<path d="M530,192 L540,318" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,4" opacity=".3"/>

<!-- Hem stitching -->
<path d="M300,836 L500,836" fill="none" stroke="${dk2}" stroke-width="0.7" stroke-dasharray="3,3" opacity=".3"/>

<!-- Wrinkle lines -->
<path d="M300,420 Q365,414 400,418 Q435,422 500,415" fill="none" stroke="rgba(0,0,0,.02)" stroke-width="1"/>
<path d="M300,580 Q365,573 400,577 Q435,581 500,573" fill="none" stroke="rgba(0,0,0,.02)" stroke-width="1"/>

${f ? `
<!-- Centre zip -->
<line x1="400" y1="168" x2="400" y2="840" stroke="${dk}" stroke-width="2.5" opacity=".15"/>
<line x1="400" y1="168" x2="400" y2="840" stroke="${lighten(color, 0.15)}" stroke-width="0.8" opacity=".2"/>
<!-- Zip pull -->
<rect x="396" y="170" width="8" height="14" rx="2" fill="${dk}" opacity=".15"/>
<!-- Left chest pocket -->
<path d="M298,360 L373,360 L373,415 Q373,425 363,425 L308,425 Q298,425 298,415 Z"
      fill="none" stroke="${dk}" stroke-width="0.8" opacity=".15"/>
<!-- Right pocket -->
<path d="M427,580 L515,580 L515,650 Q515,660 505,660 L437,660 Q427,660 427,650 Z"
      fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
<path d="M285,580 L373,580 L373,650 Q373,660 363,660 L295,660 Q285,660 285,650 Z"
      fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
` : `
<!-- Back centre seam -->
<line x1="400" y1="230" x2="400" y2="800" stroke="${dk}" stroke-width="0.5" opacity=".08"/>
<!-- Back yoke seam -->
<path d="M260,370 L540,370" fill="none" stroke="${dk}" stroke-width="0.5" stroke-dasharray="4,4" opacity=".1"/>
<!-- Back neck label -->
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
  <!-- Crown -->
  <path d="M210,490 C210,290 280,190 400,190 C520,190 590,290 590,490 Z"
        fill="${color}" stroke="${dk}" stroke-width="1"/>
  <path d="M210,490 C210,290 280,190 400,190 C520,190 590,290 590,490 Z"
        fill="url(#crownShade)"/>
  <path d="M210,490 C210,290 280,190 400,190 C520,190 590,290 590,490 Z"
        fill="url(#crownHL)"/>

  <!-- Brim -->
  <ellipse cx="400" cy="490" rx="245" ry="50" fill="${color}" stroke="${dk}" stroke-width="1"/>
  <ellipse cx="400" cy="490" rx="245" ry="50" fill="url(#brimShade)"/>
  <path d="M155,498 C195,565 290,605 400,605 C510,605 605,565 645,498"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>
  <path d="M155,498 C195,565 290,605 400,605 C510,605 605,565 645,498"
        fill="url(#brimShade)"/>
</g>

<!-- Panel lines -->
<line x1="400" y1="195" x2="400" y2="490" stroke="${dk2}" stroke-width="0.7" opacity=".15"/>
<line x1="305" y1="210" x2="335" y2="490" stroke="${dk2}" stroke-width="0.5" opacity=".1"/>
<line x1="495" y1="210" x2="465" y2="490" stroke="${dk2}" stroke-width="0.5" opacity=".1"/>

<!-- Crown seam arcs -->
<path d="M305,212 Q350,195 400,195 Q450,195 495,212" fill="none" stroke="${dk2}" stroke-width="0.5" opacity=".1"/>

<!-- Top button -->
<circle cx="400" cy="195" r="8" fill="${color}" stroke="${dk}" stroke-width="1.5"/>
<circle cx="400" cy="195" r="4" fill="${dk}" opacity=".15"/>

<!-- Eyelet holes -->
<circle cx="340" cy="250" r="3" fill="none" stroke="${dk2}" stroke-width="0.6" opacity=".2"/>
<circle cx="460" cy="250" r="3" fill="none" stroke="${dk2}" stroke-width="0.6" opacity=".2"/>

<!-- Brim edge stitching -->
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
  <linearGradient id="foldH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#000" stop-opacity=".06"/>
    <stop offset="18%" stop-color="#fff" stop-opacity=".03"/>
    <stop offset="50%" stop-color="#000" stop-opacity="0"/>
    <stop offset="82%" stop-color="#fff" stop-opacity=".03"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".06"/>
  </linearGradient>
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
  <!-- Waistband -->
  <rect x="250" y="78" width="300" height="45" rx="5" fill="${color}" stroke="${dk}" stroke-width="1"/>
  <rect x="250" y="78" width="300" height="45" rx="5" fill="rgba(0,0,0,.03)"/>

  <!-- Left leg -->
  <path d="M250,123 L250,480 L232,890 C232,905 244,918 260,918 L385,918 C395,918 400,905 400,890 L400,480 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>

  <!-- Right leg -->
  <path d="M400,480 L400,890 C400,905 405,918 415,918 L540,918 C556,918 568,905 568,890 L550,480 L550,123 Z"
        fill="${color}" stroke="${dk}" stroke-width="0.8"/>

  <!-- Hip/waist bridge -->
  <rect x="250" y="123" width="300" height="15" fill="${color}"/>
</g>

<!-- Leg shading -->
<path d="M250,138 L250,480 L232,890 C232,905 244,918 260,918 L385,918 C395,918 400,905 400,890 L400,480 L400,138 Z"
      fill="url(#legL)"/>
<path d="M400,138 L400,480 L400,890 C400,905 405,918 415,918 L540,918 C556,918 568,905 568,890 L550,480 L550,138 Z"
      fill="url(#legR)"/>
<path d="M250,138 L550,138 L550,890 C550,900 544,918 540,918 L260,918 C252,918 242,905 240,890 Z"
      fill="url(#foldV)" opacity=".6"/>

<!-- Wrinkle lines -->
<path d="M280,300 Q330,295 380,300" fill="none" stroke="rgba(0,0,0,.025)" stroke-width="1"/>
<path d="M420,310 Q470,305 530,310" fill="none" stroke="rgba(0,0,0,.025)" stroke-width="1"/>
<path d="M265,550 Q320,544 370,550" fill="none" stroke="rgba(0,0,0,.02)" stroke-width="1"/>
<path d="M430,560 Q480,554 535,560" fill="none" stroke="rgba(0,0,0,.02)" stroke-width="1"/>

<!-- Crotch seam -->
<path d="M400,138 L400,480" fill="none" stroke="${dk}" stroke-width="0.8" opacity=".1"/>

<!-- Leg hem stitching -->
<path d="M240,910 L390,910" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,3" opacity=".25"/>
<path d="M410,910 L560,910" fill="none" stroke="${dk2}" stroke-width="0.6" stroke-dasharray="3,3" opacity=".25"/>

${f ? `
<!-- Fly -->
<line x1="400" y1="123" x2="400" y2="290" stroke="${dk}" stroke-width="1.5" opacity=".1"/>
<path d="M400,123 Q395,270 396,290" fill="none" stroke="${dk}" stroke-width="0.5" opacity=".12"/>
<!-- Belt loops -->
<rect x="290" y="75" width="9" height="50" rx="2" fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
<rect x="380" y="75" width="9" height="50" rx="2" fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
<rect x="411" y="75" width="9" height="50" rx="2" fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
<rect x="500" y="75" width="9" height="50" rx="2" fill="none" stroke="${dk}" stroke-width="0.8" opacity=".12"/>
<!-- Front pockets -->
<path d="M268,160 L268,280 Q268,295 282,300 L358,325 Q370,328 370,316 L370,155"
      fill="none" stroke="${dk}" stroke-width="0.6" opacity=".1"/>
<path d="M532,160 L532,280 Q532,295 518,300 L442,325 Q430,328 430,316 L430,155"
      fill="none" stroke="${dk}" stroke-width="0.6" opacity=".1"/>
` : `
<!-- Back pockets -->
<rect x="290" y="200" width="70" height="80" rx="4" fill="none" stroke="${dk}" stroke-width="0.7" opacity=".12"/>
<rect x="440" y="200" width="70" height="80" rx="4" fill="none" stroke="${dk}" stroke-width="0.7" opacity=".12"/>
<!-- Back centre seam -->
<line x1="400" y1="138" x2="400" y2="480" stroke="${dk}" stroke-width="0.5" opacity=".06"/>
`}
</svg>`;
}

/* ══════════════════════════════════════════════════════════════
   TEMPLATE REGISTRY
   ══════════════════════════════════════════════════════════════ */
export const MOCKUP_TEMPLATES: Record<string, MockupTemplate> = {
  tshirt: {
    label: 'T-Shirt',
    icon: `<svg viewBox="0 0 32 32" fill="none"><path d="M9 5L3 9l3 4 4-2v16h12V11l4 2 3-4-6-4c0 0-1.5 3.5-7 3.5S9 5 9 5z" fill="currentColor" opacity=".85"/></svg>`,
    renderSVG: tshirtSVG,
    printAreas: allPrintAreas('tshirt'),
    /*
     * Per-side print areas derived from PSD smart-object bounding boxes
     * (scaled from 3000×2000 PSD → 800×1000 canvas with 33px top-crop).
     * Front Effect SO: (195,142)→(433,386), center=(314,264), 238×244
     * Back Effect SO:  (200,162)→(578,462), center=(389,312), 378×300
     * Full = SO expanded ~125%, Medium = exact SO, Small = SO×60%.
     * Pocket on wearer's left chest (viewer's right).
     */
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
