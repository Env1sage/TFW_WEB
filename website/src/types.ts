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
}

export interface CartItem {
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
  customerName?: string;
  customerEmail?: string;
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
  customerName?: string;
  customerEmail?: string;
}
