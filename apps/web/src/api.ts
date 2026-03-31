import type { Product, PriceResult, Design } from './types';

const BASE = '/api';

export async function fetchProduct(slug: string): Promise<Product> {
  const res = await fetch(`${BASE}/admin/products/${slug}`);
  if (!res.ok) throw new Error(`Product fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchAllProducts(): Promise<Product[]> {
  const res = await fetch(`${BASE}/admin/products`);
  if (!res.ok) throw new Error(`Products fetch failed: ${res.status}`);
  return res.json();
}

export async function calculatePrice(
  productId: string,
  sides: string[],
  quantity: number,
): Promise<PriceResult> {
  const res = await fetch(`${BASE}/pricing/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, sides, quantity }),
  });
  if (!res.ok) throw new Error(`Price calc failed: ${res.status}`);
  return res.json();
}

export async function createDesign(
  name: string,
  productId: string,
): Promise<Design> {
  const res = await fetch(`${BASE}/designs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, productId }),
  });
  if (!res.ok) throw new Error(`Create design failed: ${res.status}`);
  return res.json();
}

export async function saveDesignSide(
  designId: string,
  side: string,
  canvasWidth: number,
  canvasHeight: number,
  jsonData: unknown,
): Promise<unknown> {
  const res = await fetch(`${BASE}/designs/${designId}/sides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ side, canvasWidth, canvasHeight, jsonData }),
  });
  if (!res.ok) throw new Error(`Save side failed: ${res.status}`);
  return res.json();
}

export async function getDesign(designId: string): Promise<Design> {
  const res = await fetch(`${BASE}/designs/${designId}`);
  if (!res.ok) throw new Error(`Get design failed: ${res.status}`);
  return res.json();
}

export async function addToCart(
  productId: string,
  colorId: string,
  sides: string[],
  quantity: number,
  designData: unknown,
): Promise<unknown> {
  const res = await fetch(`${BASE}/cart/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, colorId, sides, quantity, designData }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || `Cart add failed: ${res.status}`);
  }
  return res.json();
}
