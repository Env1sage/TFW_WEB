export interface User {
  id: string;
  name: string;
  email: string;
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
}

export interface CartItem {
  cartItemId: string;  // unique per-entry id for reliable removal
  product: Product;
  quantity: number;
  color?: string;
  size?: string;
  customText?: string;
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