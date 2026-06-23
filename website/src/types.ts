export interface User {
  id: string;
  name: string;
  email: string | null;
  phone?: string;
  role: 'user' | 'admin';
  twoFactorEnabled: boolean;
  avatar?: string;
  createdAt: string;
}

export interface ProductMockup {
  id: string;
  frontImage: string;
  backImage?: string;
  frontShadow?: string;
  backShadow?: string;
  printArea: any;
}

export interface Product {
  id: string;
  sku?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  images: string[];
  customizable: boolean;
  colors: string[];
  sizes: string[];
  stock: number;
  lowStockThreshold?: number;
  variants?: ProductVariant[];
  rating: number;
  reviewCount: number;
  featured: boolean;
  createdAt: string;
  mockupId?: string;
  mockup?: ProductMockup;
  weightGrams?: number;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
  brandId?: string;
  modelId?: string;
}

export interface ProductVariant {
  id: string;
  label: string;
  size?: string;
  color?: string;
  colorName?: string;
  skuSuffix?: string;
  stock: number;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  variants: ProductVariant[];
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  image: string;
  sizes: string[];
  colors: string[];
  created_at: string;
}

export interface InventoryMetrics {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  inStockCount: number;
  categoryCount: number;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  change_type: string;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  note: string;
  created_at: string;
}

export interface CartItem {
  cartItemId: string;  // unique per-entry id for reliable removal
  product: Product;
  quantity: number;
  color?: string;
  size?: string;
  customText?: string;
}

export type DeliveryMethodType = 'store_pickup' | 'hyperlocal' | 'standard';

export interface DeliveryProvider {
  name: 'dunzo' | 'porter';
  label: string;
  fee: number;
  eta: string;
  available: boolean;
}

export interface DeliveryOption {
  type: DeliveryMethodType;
  label: string;
  description: string;
  fee: number;
  freeAbove?: number;
  eta: string;
  available: boolean;
  storeInfo?: {
    name: string; address: string; city: string; state: string;
    pincode: string; phone: string; hours: string; landmark: string;
  };
  providers?: DeliveryProvider[];
  selectedProvider?: 'dunzo' | 'porter';
}

export interface Order {
  id: string;
  userId: string;
  items: { productId: string; productName?: string; productImage?: string; quantity: number; color?: string; size?: string; customText?: string; price: number }[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  razorpayOrderId?: string;
  paymentId?: string;
  paymentStatus?: string;
  couponCode?: string;
  discountAmount?: number;
  groupOrderId?: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
  deliveryMethod?: DeliveryMethodType;
  deliveryConfig?: any;
  shippingCost?: number;
  shipment?: {
    id: string; orderId: string;
    shiprocketOrderId?: string; shiprocketShipmentId?: string;
    awbCode?: string; courierName?: string;
    status: string; trackingData?: any; createdAt: string;
  };
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxUses: number | null;
  useCount: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  popupEnabled: boolean;
  popupMessage: string;
  createdAt: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  active: boolean;
  sortOrder: number;
  modelCount: number;
  createdAt: string;
}

export interface DeviceModel {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  brandId: string;
  brandName: string | null;
  brandSlug: string | null;
  categorySlug: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface DesignOrder {
  id: string;
  userId: string | null;
  productType: string;
  colorHex: string;
  colorName: string;
  printSize: string;
  pocketPrint?: boolean;
  sides: string[];
  designImages: Record<string, string>;
  uploadedImages?: Record<string, string[]>;
  quantity: number;
  unitPrice: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  createdAt: string;
  groupOrderId?: string;
  customerName?: string;
  customerEmail?: string;
  deliveryMethod?: DeliveryMethodType;
  deliveryConfig?: any;
  shippingCost?: number;
  shipment?: {
    id: string; orderId: string;
    shiprocketOrderId?: string; shiprocketShipmentId?: string;
    awbCode?: string; courierName?: string;
    status: string; trackingData?: any; createdAt: string;
  };
}