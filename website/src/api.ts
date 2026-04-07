const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('tfw_token');
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

// Auth
export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  login: (email: string, password: string) =>
    request<{ token?: string; user?: any; requires2FA?: boolean; tempToken?: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  verify2FA: (tempToken: string, code: string) =>
    request<{ token: string; user: any }>('/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ tempToken, code }) }),

  setup2FA: () =>
    request<{ secret: string; qrCode: string }>('/auth/setup-2fa', { method: 'POST' }),

  confirm2FA: (code: string) =>
    request<{ success: boolean }>('/auth/confirm-2fa', { method: 'POST', body: JSON.stringify({ code }) }),

  disable2FA: (code: string) =>
    request<{ success: boolean }>('/auth/disable-2fa', { method: 'POST', body: JSON.stringify({ code }) }),

  getProfile: () => request<any>('/auth/me'),

  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
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

  // Orders
  createOrder: (items: any[], shippingAddress: string, extra?: { razorpayOrderId?: string; paymentId?: string; couponCode?: string; discountAmount?: number }) =>
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

  // Analytics
  getAnalytics: () => request<any>('/products/analytics'),

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
};
