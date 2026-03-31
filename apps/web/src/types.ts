export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sku: string;
  basePrice: number;
  isActive: boolean;
  colors: ProductColor[];
  printAreas: PrintArea[];
}

export interface ProductColor {
  id: string;
  name: string;
  hexCode: string;
  mockups: MockupImage[];
}

export interface MockupImage {
  id: string;
  side: string;
  imageUrl: string;
}

export interface PrintArea {
  id: string;
  side: string;
  width: number;
  height: number;
  xPosition: number;
  yPosition: number;
  safeZone: number;
  bleed: number;
  additionalPrice: number;
  realWidthInches: number;
  realHeightInches: number;
}

export interface Design {
  id: string;
  name: string;
  status: string;
  productId: string;
  totalPrice: number;
  sides: DesignSide[];
}

export interface DesignSide {
  id: string;
  side: string;
  canvasWidth: number;
  canvasHeight: number;
  jsonData: unknown;
  previewImagePath?: string;
  dpi?: number;
}

export interface PriceResult {
  basePrice: number;
  sideTotal: number;
  quantity: number;
  subtotal: number;
  discountPercentage: number;
  finalPrice: number;
}

export type PrintSide = 'FRONT' | 'BACK';

export type PrintSize = 'full' | 'medium' | 'small' | 'pocket';

export interface PrintSizeOption {
  id: PrintSize;
  label: string;
  description: string;
  /** ratio of garment body width/height */
  widthRatio: number;
  heightRatio: number;
  sides: PrintSide[];
  priceMultiplier: number;
}

export interface MockupTemplate {
  label: string;
  icon: string;
  renderSVG: (side: PrintSide, color: string) => string;
  printAreas: Record<PrintSize, { x: number; y: number; w: number; h: number }>;
  /** Per-side print areas (overrides printAreas when side matches) */
  printAreasBySide?: Partial<Record<PrintSide, Record<PrintSize, { x: number; y: number; w: number; h: number }>>>;
  /** URLs of real mockup images to preload (keyed by side) */
  imageUrls?: Partial<Record<PrintSide, string>>;
  /** Multiply-blend shadow overlay URLs (fabric fold details rendered ON TOP of design) */
  shadowUrls?: Partial<Record<PrintSide, string>>;
}

export interface CartItemLocal {
  id: string;
  productType: string;
  colorHex: string;
  colorName: string;
  side: PrintSide;
  printSize: PrintSize;
  quantity: number;
  designJson: unknown;
  previewUrl: string;
  price: number;
}
