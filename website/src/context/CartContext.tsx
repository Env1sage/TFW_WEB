import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { CartItem, Product } from '../types';
import toast from 'react-hot-toast';

export interface DesignCartItem {
  id: string;           // unique client-side id (Date.now string)
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
}

interface CartState {
  items: CartItem[];
  designItems: DesignCartItem[];
  addItem: (product: Product, opts?: { color?: string; size?: string; customText?: string }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  addDesignItem: (item: Omit<DesignCartItem, 'id'>) => void;
  removeDesignItem: (id: string) => void;
  updateDesignQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartState | null>(null);

const CART_KEY = 'tfw_cart';
const DESIGN_CART_KEY = 'tfw_design_items';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function loadDesignItems(): DesignCartItem[] {
  try {
    const raw = localStorage.getItem(DESIGN_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [designItems, setDesignItems] = useState<DesignCartItem[]>(loadDesignItems);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(DESIGN_CART_KEY, JSON.stringify(designItems));
  }, [designItems]);

  const addItem = useCallback((product: Product, opts?: { color?: string; size?: string; customText?: string }) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.color === opts?.color && i.size === opts?.size);
      if (existing) {
        toast.success('Updated quantity in cart');
        return prev.map(i =>
          i.product.id === product.id && i.color === opts?.color && i.size === opts?.size
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      toast.success('Added to cart!');
      return [...prev, { product, quantity: 1, ...opts }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.product.id !== productId));
    toast.success('Removed from cart');
  }, []);

  const updateQuantity = useCallback((productId: string, qty: number) => {
    if (qty < 1) return;
    setItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i));
  }, []);

  const addDesignItem = useCallback((item: Omit<DesignCartItem, 'id'>) => {
    const id = String(Date.now());
    setDesignItems(prev => [...prev, { ...item, id }]);
    toast.success('Custom design added to cart!');
  }, []);

  const removeDesignItem = useCallback((id: string) => {
    setDesignItems(prev => prev.filter(d => d.id !== id));
    toast.success('Removed from cart');
  }, []);

  const updateDesignQuantity = useCallback((id: string, qty: number) => {
    if (qty < 1) return;
    setDesignItems(prev => prev.map(d => d.id === id ? { ...d, quantity: qty, total: d.unitPrice * qty } : d));
  }, []);

  const clearCart = useCallback(() => { setItems([]); setDesignItems([]); }, []);

  const productTotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const designTotal = designItems.reduce((s, d) => s + d.total, 0);
  const total = productTotal + designTotal;
  const count = items.reduce((s, i) => s + i.quantity, 0) + designItems.reduce((s, d) => s + d.quantity, 0);

  return (
    <CartContext.Provider value={{ items, designItems, addItem, removeItem, updateQuantity, addDesignItem, removeDesignItem, updateDesignQuantity, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}
