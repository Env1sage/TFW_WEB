import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import type { CartItem, Product } from '../types';
import { api } from '../api';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export interface DesignCartItem {
  id: string;           // unique client-side id (Date.now string)
  productType: string;
  productName?: string;
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
  addItem: (product: Product, opts?: { color?: string; size?: string; customText?: string; phoneBrand?: string; phoneModel?: string }) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, qty: number) => void;
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
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [designItems, setDesignItems] = useState<DesignCartItem[]>(loadDesignItems);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(DESIGN_CART_KEY, JSON.stringify(designItems));
  }, [designItems]);

  // Debounced cart sync — only for logged-in users
  const scheduleSync = useCallback((nextItems: CartItem[], nextDesign: DesignCartItem[]) => {
    if (!user) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const total = nextItems.reduce((s, i) => s + i.product.price * i.quantity, 0)
        + nextDesign.reduce((s, d) => s + d.total, 0);
      api.syncCart(nextItems, nextDesign, total).catch(() => {});
    }, 5000);
  }, [user]);

  // Sync cart when user logs in (captures any pre-existing localStorage items)
  useEffect(() => {
    if (!user || (!items.length && !designItems.length)) return;
    const total = items.reduce((s, i) => s + i.product.price * i.quantity, 0)
      + designItems.reduce((s, d) => s + d.total, 0);
    api.syncCart(items, designItems, total).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = useCallback((product: Product, opts?: { color?: string; size?: string; customText?: string; phoneBrand?: string; phoneModel?: string }) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.color === opts?.color && i.size === opts?.size && i.phoneBrand === opts?.phoneBrand && i.phoneModel === opts?.phoneModel);
      let next: CartItem[];
      if (existing) {
        toast.success('Updated quantity in cart');
        next = prev.map(i => i.cartItemId === existing.cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        toast.success('Added to cart!');
        next = [...prev, { cartItemId: genId(), product, quantity: 1, ...opts }];
      }
      scheduleSync(next, designItems);
      return next;
    });
  }, [scheduleSync, designItems]);

  const removeItem = useCallback((cartItemId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.cartItemId !== cartItemId);
      scheduleSync(next, designItems);
      return next;
    });
    toast.success('Removed from cart');
  }, [scheduleSync, designItems]);

  const updateQuantity = useCallback((cartItemId: string, qty: number) => {
    if (qty < 1) return;
    setItems(prev => {
      const next = prev.map(i => i.cartItemId === cartItemId ? { ...i, quantity: qty } : i);
      scheduleSync(next, designItems);
      return next;
    });
  }, [scheduleSync, designItems]);

  const addDesignItem = useCallback((item: Omit<DesignCartItem, 'id'>) => {
    const id = String(Date.now());
    setDesignItems(prev => {
      const next = [...prev, { ...item, id }];
      scheduleSync(items, next);
      return next;
    });
    toast.success('Custom design added to cart!');
  }, [scheduleSync, items]);

  const removeDesignItem = useCallback((id: string) => {
    setDesignItems(prev => {
      const next = prev.filter(d => d.id !== id);
      scheduleSync(items, next);
      return next;
    });
    toast.success('Removed from cart');
  }, [scheduleSync, items]);

  const updateDesignQuantity = useCallback((id: string, qty: number) => {
    if (qty < 1) return;
    setDesignItems(prev => {
      const next = prev.map(d => d.id === id ? { ...d, quantity: qty, total: d.unitPrice * qty } : d);
      scheduleSync(items, next);
      return next;
    });
  }, [scheduleSync, items]);

  const clearCart = useCallback(() => {
    setItems([]);
    setDesignItems([]);
    if (user) api.convertCart().catch(() => {});
  }, [user]);

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
