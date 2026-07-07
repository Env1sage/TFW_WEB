const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('tfw_token');
}

export function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('tfw_sid');
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem('tfw_sid', sid);
    }
    return sid;
  } catch {
    return 'unknown';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((options.headers as Record<string, string>) || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}`);
  }
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

async function requestBlob(path: string): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.blob();
}

// Auth
export const api = {
  // Phone OTP auth
  sendOtp: (phone: string) =>
    request<{ sessionId: string; message: string }>('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),

  verifyOtp: (sessionId: string, otp: string) =>
    request<{ token: string; user: any; isNewUser: boolean }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ sessionId, otp }) }),

  // Admin email/password login (kept for admin portal)
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  getProfile: () => request<any>('/auth/me'),

  updateProfile: (data: { name?: string; email?: string; currentPassword?: string; newPassword?: string }) =>
    request<any>('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),

  // Products
  getProducts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/products${qs}`);
  },

  getCategories: () => request<{ id: string; name: string; slug: string; createdAt: string }[]>('/products/categories'),

  createCategory: (data: { name: string }) =>
    request<{ id: string; name: string; slug: string; createdAt: string }>('/products/categories', { method: 'POST', body: JSON.stringify(data) }),

  updateCategory: (id: string, data: { name: string }) =>
    request<{ id: string; name: string; slug: string; createdAt: string }>(`/products/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteCategory: (id: string) =>
    request<{ success: boolean }>(`/products/categories/${id}`, { method: 'DELETE' }),

  // Mockup categories
  getMockupCategories: () =>
    request<{ id: string; name: string; slug: string; createdAt: string }[]>('/products/mockup-categories'),

  createMockupCategory: (data: { name: string }) =>
    request<{ id: string; name: string; slug: string; createdAt: string }>('/products/mockup-categories', { method: 'POST', body: JSON.stringify(data) }),

  updateMockupCategory: (id: string, data: { name: string }) =>
    request<{ id: string; name: string; slug: string; createdAt: string }>(`/products/mockup-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteMockupCategory: (id: string) =>
    request<{ success: boolean }>(`/products/mockup-categories/${id}`, { method: 'DELETE' }),

  getProduct: (id: string) => request<any>(`/products/${id}`),

  createProduct: (data: any) =>
    request<any>('/products', { method: 'POST', body: JSON.stringify(data) }),

  updateProduct: (id: string, data: any) =>
    request<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteProduct: (id: string) =>
    request<any>(`/products/${id}`, { method: 'DELETE' }),

  seedCatalog: () =>
    request<{ inserted: number; skipped: number; categories: number }>('/products/seed-catalog', { method: 'POST' }),

  deleteAllProducts: () =>
    request<{ ok: boolean; message: string }>('/products/all', { method: 'DELETE' }),

  patchProductStock: (id: string, stock: number) =>
    request<any>(`/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock }) }),

  // Orders
  createOrder: (items: any[], shippingAddress: string, extra?: { razorpayOrderId?: string; paymentId?: string; couponCode?: string; discountAmount?: number; groupOrderId?: string; deliveryMethod?: string; deliveryConfig?: any; shippingCost?: number }) =>
    request<any>('/products/orders', { method: 'POST', body: JSON.stringify({ items, shippingAddress, ...extra }) }),

  // Razorpay
  createRazorpayOrder: (amount: number) =>
    request<{ orderId: string; amount: number; currency: string; keyId: string; simulated?: boolean }>('/products/razorpay/create-order', { method: 'POST', body: JSON.stringify({ amount }) }),

  verifyRazorpayPayment: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    request<{ verified: boolean; simulated?: boolean }>('/products/razorpay/verify', { method: 'POST', body: JSON.stringify(data) }),

  getMyOrders: () => request<any[]>('/products/orders/mine'),

  getAllOrders: () => request<any[]>('/products/orders/all'),

  updateOrderStatus: (id: string, status: string) =>
    request<any>(`/products/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Analytics (basic — used by old admin tab)
  getAnalytics: () => request<any>('/products/analytics'),

  // Advanced analytics dashboard
  getAdvancedAnalytics: (params?: { from?: string; to?: string; groupBy?: string }) => {
    const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString() : '';
    return request<any>(`/analytics/dashboard${qs}`);
  },
  exportAnalytics: (params: { from?: string; to?: string; type?: string }) => {
    const qs = '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return `${'/api'}/analytics/export${qs}`;
  },

  // Event tracking (fire-and-forget)
  trackEvent: (data: {
    type: 'view' | 'add_to_cart' | 'checkout_start' | 'purchase';
    productId?: string; productName?: string; category?: string;
    brandId?: string; brandName?: string; size?: string; color?: string;
    sessionId: string; price?: number; quantity?: number;
  }) => {
    try {
      navigator.sendBeacon('/api/analytics/event', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    } catch {
      fetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true }).catch(() => {});
    }
  },

  // Database viewer
  getDbViewer: () => request<any>('/products/db-viewer'),

  // Mockups
  getMockups: () => request<any[]>('/products/mockups'),

  // Public: active mockups for the design studio (no auth required)
  getActiveMockups: () => request<any[]>('/products/mockups/active'),

  uploadMockupImage: async (file: File): Promise<{ url: string }> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE}/products/mockups/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  uploadProductImage: async (file: File): Promise<{ url: string }> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE}/products/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  createMockup: (data: any) =>
    request<any>('/products/mockups', { method: 'POST', body: JSON.stringify(data) }),

  updateMockup: (id: string, data: any) =>
    request<any>(`/products/mockups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteMockup: (id: string) =>
    request<any>(`/products/mockups/${id}`, { method: 'DELETE' }),

  // Design Orders
  createDesignOrder: (data: any) =>
    request<any>('/products/design-orders', { method: 'POST', body: JSON.stringify(data) }),

  getDesignOrder: (id: string) =>
    request<any>(`/products/design-orders/${id}`),

  getMyDesignOrders: () =>
    request<any[]>('/products/design-orders/mine'),

  getAllDesignOrders: () =>
    request<any[]>('/products/design-orders/all'),

  updateDesignOrder: (id: string, data: any) =>
    request<any>(`/products/design-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updateDesignOrderStatus: (id: string, status: string) =>
    request<any>(`/products/design-orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Saved Designs
  getSavedDesigns: () => request<any[]>('/products/saved-designs'),

  saveDesign: (data: { name: string; productType: string; colorHex: string; colorName: string; printSize: string; canvasData: object; thumbnail: string }) =>
    request<any>('/products/saved-designs', { method: 'POST', body: JSON.stringify(data) }),

  deleteSavedDesign: (id: string) =>
    request<any>(`/products/saved-designs/${id}`, { method: 'DELETE' }),

  // Invoice
  getOrderInvoice: (orderId: string) =>
    request<any>(`/products/orders/${orderId}/invoice`),

  // Coupons (admin)
  getCoupons: () => request<any[]>('/products/coupons'),
  createCoupon: (data: any) => request<any>('/products/coupons', { method: 'POST', body: JSON.stringify(data) }),
  updateCoupon: (id: string, data: any) => request<any>(`/products/coupons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCoupon: (id: string) => request<any>(`/products/coupons/${id}`, { method: 'DELETE' }),
  validateCoupon: (code: string, orderAmount: number) =>
    request<{ valid: boolean; coupon: any; discountAmount: number }>('/products/coupons/validate', { method: 'POST', body: JSON.stringify({ code, orderAmount }) }),
  getPopupCoupon: () => request<any | null>('/products/coupons/popup'),
  getActiveCoupons: () => request<any[]>('/products/coupons/active'),

  // Shiprocket / Tracking
  createShipment: (orderId: string, data?: { weight?: number; length?: number; breadth?: number; height?: number; pickupLocation?: string }) =>
    request<any>(`/products/orders/${orderId}/create-shipment`, { method: 'POST', body: JSON.stringify(data || {}) }),
  createDesignShipment: (orderId: string, data?: { weight?: number; length?: number; breadth?: number; height?: number; pickupLocation?: string }) =>
    request<any>(`/products/design-orders/${orderId}/create-shipment`, { method: 'POST', body: JSON.stringify(data || {}) }),
  getOrderTracking: (orderId: string) =>
    request<any>(`/products/orders/${orderId}/tracking`),
  getOrder: (id: string) =>
    request<any>(`/products/orders/${id}`),
  updateManualTracking: (orderId: string, data: { courierName?: string; awbCode?: string; status?: string; estimatedDelivery?: string }) =>
    request<any>(`/products/orders/${orderId}/tracking/manual`, { method: 'POST', body: JSON.stringify(data) }),
  addTrackingEvent: (orderId: string, event: { status: string; message: string; location?: string }) =>
    request<any>(`/products/orders/${orderId}/tracking/event`, { method: 'POST', body: JSON.stringify(event) }),

  // Corporate Inquiries
  submitCorporateInquiry: (data: { companyName: string; contactName: string; email: string; phone?: string; productInterest?: string; quantity?: number; message?: string }) =>
    request<any>('/products/corporate-inquiry', { method: 'POST', body: JSON.stringify(data) }),

  // Newsletter
  subscribeNewsletter: (email: string) =>
    request<{ success: boolean }>('/products/newsletter/subscribe', { method: 'POST', body: JSON.stringify({ email }) }),

  // Shipping Zones (admin)
  getShippingZones: () => request<any[]>('/products/shipping-zones'),
  createShippingZone: (data: any) => request<any>('/products/shipping-zones', { method: 'POST', body: JSON.stringify(data) }),
  updateShippingZone: (id: string, data: any) => request<any>(`/products/shipping-zones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteShippingZone: (id: string) => request<any>(`/products/shipping-zones/${id}`, { method: 'DELETE' }),

  // Shipping estimate (public)
  getShippingEstimate: (pinCode: string, subtotal: number) =>
    request<{ cost: number; zone: string }>('/products/shipping-estimate', { method: 'POST', body: JSON.stringify({ pinCode, subtotal }) }),

  // Shipping class rate — weight + delivery-type aware
  getShippingClassRate: (params: { pinCode: string; subtotal: number; weightGrams?: number; deliveryType?: string }) =>
    request<{ cost: number; zone: string | null; estimatedDays: string; zoneId?: string }>(
      '/products/shipping-class-rate', { method: 'POST', body: JSON.stringify(params) }
    ),

  // Admin: seed product catalog
  seedProductCatalog: () => request<{ success: boolean; added: number; skipped: number; total: number }>('/products/seed-catalog', { method: 'POST' }),

  // Collections
  getCollections: () => request<any[]>('/collections'),
  getCollection: (id: string) => request<any>(`/collections/${id}`),
  getCollectionProducts: (id: string) => request<any[]>(`/collections/${id}/products`),
  createCollection: (data: any) => request<any>('/collections', { method: 'POST', body: JSON.stringify(data) }),
  updateCollection: (id: string, data: any) => request<any>(`/collections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCollection: (id: string) => request<any>(`/collections/${id}`, { method: 'DELETE' }),
  addProductToCollection: (collectionId: string, productId: string) =>
    request<any>(`/collections/${collectionId}/products`, { method: 'POST', body: JSON.stringify({ productId }) }),
  removeProductFromCollection: (collectionId: string, productId: string) =>
    request<any>(`/collections/${collectionId}/products/${productId}`, { method: 'DELETE' }),

  // Inventory
  getInventoryMetrics: () => request<import('./types').InventoryMetrics>('/inventory/metrics'),
  getInventory: (opts: { search?: string; status?: string; category?: string; sort?: string; page?: number; limit?: number }) => {
    const p = new URLSearchParams();
    if (opts.search)   p.set('search',   opts.search);
    if (opts.status)   p.set('status',   opts.status);
    if (opts.category) p.set('category', opts.category);
    if (opts.sort)     p.set('sort',     opts.sort);
    if (opts.page)     p.set('page',     String(opts.page));
    if (opts.limit)    p.set('limit',    String(opts.limit));
    return request<{ items: import('./types').InventoryItem[]; total: number; page: number; pages: number }>(`/inventory?${p}`);
  },
  updateInventory: (id: string, data: { stock?: number; low_stock_threshold?: number; variants?: any[]; change_type?: string; note?: string }) =>
    request<import('./types').InventoryItem>(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  bulkUpdateInventory: (ids: string[], mode: 'set' | 'add' | 'subtract', value: number, note?: string) =>
    request<{ updated: number; results: any[] }>('/inventory/bulk', { method: 'POST', body: JSON.stringify({ ids, mode, value, note }) }),
  getInventoryLogs: (productId: string) =>
    request<import('./types').InventoryLog[]>(`/inventory/${productId}/logs`),
  getAllInventoryLogs: (opts: { page?: number; limit?: number }) => {
    const p = new URLSearchParams();
    if (opts.page)  p.set('page',  String(opts.page));
    if (opts.limit) p.set('limit', String(opts.limit));
    return request<{ logs: import('./types').InventoryLog[]; total: number; page: number; pages: number }>(`/inventory/logs?${p}`);
  },

  // Leads CRM
  getLeads: (opts: { search?: string; status?: string; date?: string; page?: number; limit?: number }) => {
    const p = new URLSearchParams();
    if (opts.search)  p.set('search', opts.search);
    if (opts.status)  p.set('status', opts.status);
    if (opts.date)    p.set('date', opts.date);
    if (opts.page)    p.set('page', String(opts.page));
    if (opts.limit)   p.set('limit', String(opts.limit));
    return request<{
      leads: any[]; total: number; page: number; pages: number;
      stats: { total: number; new: number; contacted: number; qualified: number; converted: number; lost: number };
    }>(`/leads?${p}`);
  },
  getLead: (id: string) => request<any>(`/leads/${id}`),
  createLead: (data: { name?: string; mobile?: string; email?: string; source?: string; notes?: string }) =>
    request<any>('/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id: string, data: { name?: string; mobile?: string; email?: string; status?: string; notes?: string }) =>
    request<any>(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLead: (id: string) => request<any>(`/leads/${id}`, { method: 'DELETE' }),
  exportLeadsCSV: (opts: { search?: string; status?: string; date?: string }) => {
    const p = new URLSearchParams();
    if (opts.search)  p.set('search', opts.search);
    if (opts.status)  p.set('status', opts.status);
    if (opts.date)    p.set('date', opts.date);
    return requestBlob(`/leads/export/csv?${p}`);
  },

  // Settings
  getSetting: (key: string) => request<{ key: string; value: string }>(`/settings/${key}`),
  getSettings: () => request<{ key: string; value: string; updated_at: string }[]>('/settings'),
  updateSetting: (key: string, value: string) =>
    request<{ key: string; value: string }>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),

  // Back-In-Stock
  submitBackInStock: (data: { productId: string; name: string; mobile: string; email: string }) =>
    request<any>('/back-in-stock', { method: 'POST', body: JSON.stringify(data) }),
  getBackInStockRequests: (opts: { search?: string; status?: string; product_id?: string; page?: number; limit?: number }) => {
    const p = new URLSearchParams();
    if (opts.search)     p.set('search', opts.search);
    if (opts.status)     p.set('status', opts.status);
    if (opts.product_id) p.set('product_id', opts.product_id);
    if (opts.page)       p.set('page', String(opts.page));
    if (opts.limit)      p.set('limit', String(opts.limit));
    return request<{
      requests: any[]; total: number; page: number; pages: number;
      stats: { total: number; pending: number; notified: number; products: number };
      topProducts: { id: string; name: string; request_count: number }[];
    }>(`/back-in-stock?${p}`);
  },
  deleteBackInStockRequest: (id: string) =>
    request<{ ok: boolean }>(`/back-in-stock/${id}`, { method: 'DELETE' }),
  triggerBackInStockNotify: (productId: string) =>
    request<{ notified: number; product: string }>(`/back-in-stock/notify/${productId}`, { method: 'POST' }),

  // Brands
  getBrands: (params?: { categoryId?: string; categorySlug?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<any[]>(`/brands${qs}`);
  },
  getBrandsByCategory: (categorySlug: string) =>
    request<any[]>(`/brands/by-category/${categorySlug}`),
  getBrand: (brandSlug: string) =>
    request<any>(`/brands/${brandSlug}`),
  getModelsByBrand: (brandSlug: string) =>
    request<any[]>(`/brands/${brandSlug}/models`),
  getModel: (brandSlug: string, modelSlug: string) =>
    request<any>(`/brands/${brandSlug}/models/${modelSlug}`),

  // Banners
  getActiveBanners: () => request<any[]>('/banners'),
  adminGetAllBanners: () => request<any[]>('/banners/all'),
  createBanner: (data: any) => request<any>('/banners', { method: 'POST', body: JSON.stringify(data) }),
  updateBanner: (id: string, data: any) => request<any>(`/banners/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBanner: (id: string) => request<{ success: boolean }>(`/banners/${id}`, { method: 'DELETE' }),

  // Admin Brands
  adminGetAllBrands: () => request<any[]>('/brands/admin/all'),
  adminGetAllModels: () => request<any[]>('/brands/admin/models'),
  createBrand: (data: { name: string; logo?: string; categoryId?: string; active?: boolean; sortOrder?: number }) =>
    request<any>('/brands', { method: 'POST', body: JSON.stringify(data) }),
  updateBrand: (id: string, data: { name?: string; logo?: string; categoryId?: string | null; active?: boolean; sortOrder?: number }) =>
    request<any>(`/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBrand: (id: string) =>
    request<{ success: boolean }>(`/brands/${id}`, { method: 'DELETE' }),
  createModel: (brandId: string, data: { name: string; displayName?: string; active?: boolean; sortOrder?: number }) =>
    request<any>(`/brands/${brandId}/models`, { method: 'POST', body: JSON.stringify(data) }),
  updateModel: (modelId: string, data: { name?: string; displayName?: string; brandId?: string; active?: boolean; sortOrder?: number }) =>
    request<any>(`/brands/models/${modelId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteModel: (modelId: string) =>
    request<{ success: boolean }>(`/brands/models/${modelId}`, { method: 'DELETE' }),

  // Shipping Rates (multi-carrier)
  getShippingRates: (data: { fromPin?: string; toPin: string; weightGrams: number; lengthCm?: number; widthCm?: number; heightCm?: number; declaredValue?: number }) =>
    request<{ weights: any; carriers: any[] }>('/shipping/rates', { method: 'POST', body: JSON.stringify(data) }),

  calculateWeights: (data: { weightGrams: number; lengthCm?: number; widthCm?: number; heightCm?: number; divisor?: number }) =>
    request<any>('/shipping/calculate-weights', { method: 'POST', body: JSON.stringify(data) }),

  adminGetShippingConfig: () =>
    request<any[]>('/shipping/admin/config'),

  adminGetShippingConfigCarrier: (carrier: string) =>
    request<any>(`/shipping/admin/config/${carrier}`),

  adminUpdateShippingConfig: (carrier: string, data: any) =>
    request<{ success: boolean }>(`/shipping/admin/config/${carrier}`, { method: 'PUT', body: JSON.stringify(data) }),

  adminTestShippingRates: (data: { fromPin?: string; toPin?: string; weightGrams?: number; lengthCm?: number; widthCm?: number; heightCm?: number; declaredValue?: number }) =>
    request<{ weights: any; carriers: any[] }>('/shipping/admin/test-rates', { method: 'POST', body: JSON.stringify(data) }),

  adminFlushShippingCache: () =>
    request<{ success: boolean; message: string }>('/shipping/admin/flush-cache', { method: 'POST' }),

  // Delivery Options
  getDeliveryOptions: (params?: { subtotal?: number; pincode?: string; weightGrams?: number; deliveryType?: string }) => {
    const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== 0).map(([k, v]) => [k, String(v)]))).toString() : '';
    return request<import('./types').DeliveryOption[]>(`/delivery/options${qs}`);
  },
  getHyperlocalQuote: (data: { fromPin?: string; toPin: string; provider: 'dunzo' | 'porter' }) =>
    request<{ fee: number; live: boolean }>('/delivery/hyperlocal/quote', { method: 'POST', body: JSON.stringify(data) }),
  adminGetDeliverySettings: () =>
    request<Record<string, any>>('/delivery/admin/settings'),
  adminGetDeliverySettingByKey: (key: string) =>
    request<any>(`/delivery/admin/settings/${key}`),
  adminUpdateDeliverySetting: (key: string, value: any) =>
    request<{ success: boolean }>(`/delivery/admin/settings/${key}`, { method: 'PUT', body: JSON.stringify(value) }),
  adminCreateHyperlocalTask: (data: { orderId: string; provider: 'dunzo' | 'porter'; pickupAddress: string; dropAddress: string; packageDescription?: string }) =>
    request<any>('/delivery/admin/hyperlocal/create-task', { method: 'POST', body: JSON.stringify(data) }),
};
