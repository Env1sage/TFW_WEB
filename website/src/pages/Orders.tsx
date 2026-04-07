import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Clock, CheckCircle, Truck, XCircle, FileText, Palette, Download, MapPin, CreditCard } from 'lucide-react';
import { api } from '../api';
import type { Order, Product, DesignOrder } from '../types';
import toast from 'react-hot-toast';

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={16} />,
  processing: <Package size={16} />,
  shipped: <Truck size={16} />,
  delivered: <CheckCircle size={16} />,
  cancelled: <XCircle size={16} />,
};

const statusLabel: Record<string, string> = {
  pending: 'Order Placed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const PRODUCT_LABELS: Record<string, string> = {
  tshirt: 'Custom T-Shirt', hoodie: 'Custom Hoodie', jacket: 'Custom Jacket',
  cap: 'Custom Cap', pant: 'Custom Pants',
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [designOrders, setDesignOrders] = useState<DesignOrder[]>([]);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'products' | 'designs'>('products');

  useEffect(() => {
    Promise.all([api.getMyOrders(), api.getMyDesignOrders(), api.getProducts({})])
      .then(([o, d, p]) => {
        setOrders(o);
        setDesignOrders(d);
        // Auto-switch to designs tab if user has design orders but no regular orders
        if (d.length > 0 && o.length === 0) setTab('designs');
        const map: Record<string, Product> = {};
        p.forEach((prod: Product) => { map[prod.id] = prod; });
        setProductMap(map);
      })
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const invoice = await api.getOrderInvoice(orderId);
      const html = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Invoice - ${invoice.orderId.slice(0, 8).toUpperCase()}</title>
<style>body{font-family:Inter,Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#111}
h1{color:#0E7C61;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin:20px 0}
th,td{padding:10px 12px;border:1px solid #e5e7eb;text-align:left}th{background:#f9fafb;font-weight:600}
.total-row{font-weight:700;font-size:1.1em}.header{display:flex;justify-content:space-between;align-items:flex-start}
.meta{color:#6b7280;font-size:0.9em}</style></head><body>
<div class="header"><div><h1>TheFramedWall</h1><p class="meta">Invoice</p></div>
<div style="text-align:right"><p><strong>Order #${invoice.orderId.slice(0, 8).toUpperCase()}</strong></p>
<p class="meta">${new Date(invoice.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<p class="meta">Status: ${invoice.status}</p></div></div>
<table><thead><tr><th>Item</th><th>Size</th><th>Color</th><th>Qty</th><th>Price</th></tr></thead><tbody>
${invoice.items.map((i: any) => `<tr><td>${i.name}</td><td>${i.size || '-'}</td><td>${i.color || '-'}</td><td>${i.quantity}</td><td>₹${(i.price * i.quantity).toFixed(0)}</td></tr>`).join('')}
</tbody></table>
<div style="text-align:right;margin-top:12px;font-size:0.95em">
${invoice.discountAmount > 0 ? `<p style="color:#6b7280">Subtotal: \u20b9${(invoice.subtotal ?? invoice.total).toFixed(0)}</p>${invoice.couponCode ? `<p style="color:#16a34a">Coupon <strong>${invoice.couponCode}</strong>: -\u20b9${invoice.discountAmount.toFixed(0)}</p>` : `<p style="color:#16a34a">Discount: -\u20b9${invoice.discountAmount.toFixed(0)}</p>`}` : ''}
<p class="total-row">Total Paid: \u20b9${invoice.total.toFixed(0)}</p>
</div>
<hr><p class="meta"><strong>Shipping Address:</strong><br>${invoice.shippingAddress.replace(/\n/g, '<br>')}</p>
<p class="meta" style="margin-top:40px">Thank you for shopping with TheFramedWall!</p></body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `TFW-Invoice-${invoice.orderId.slice(0, 8).toUpperCase()}.html`;
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download invoice'); }
  };

  const handleDownloadDesign = (dataUrl: string, orderId: string, side: string) => {
    const a = document.createElement('a');
    a.download = `design-${orderId.slice(0, 8)}-${side.toLowerCase()}.png`;
    a.href = dataUrl; a.click();
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  const totalCount = orders.length + designOrders.length;

  return (
    <div className="orders-page">
      <div className="container">
        <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1>My Orders</h1>
        </motion.div>

        {totalCount === 0 ? (
          <motion.div className="empty-state" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Package size={64} strokeWidth={1} />
            <h2>No orders yet</h2>
            <p>Your order history will appear here.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/products" className="btn btn-primary">Browse Products</Link>
              <Link to="/design-studio" className="btn btn-outline"><Palette size={16} /> Design Studio</Link>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Tab switcher — only show if both types have orders */}
            {orders.length > 0 && designOrders.length > 0 && (
              <div className="orders-tabs">
                <button className={`tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
                  <Package size={15} /> Products ({orders.length})
                </button>
                <button className={`tab ${tab === 'designs' ? 'active' : ''}`} onClick={() => setTab('designs')}>
                  <Palette size={15} /> Design Studio ({designOrders.length})
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* ── Regular product orders ── */}
              {tab === 'products' && (
                <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {orders.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <Package size={48} strokeWidth={1} />
                      <p>No product orders yet. <Link to="/products">Browse Products</Link></p>
                    </div>
                  ) : (
                    <div className="orders-list">
                      {orders.map((order, i) => (
                        <motion.div key={order.id} className="order-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                          <div className="order-header">
                            <div>
                              <span className="order-id">Order #{order.id.slice(0, 8).toUpperCase()}</span>
                              <span className="order-date">{new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                            <span className={`status-badge status-${order.status}`}>
                              {statusIcons[order.status]} {statusLabel[order.status] ?? order.status}
                            </span>
                          </div>
                          <div className="order-items-grid">
                            {order.items.map((item, j) => {
                              const product = productMap[item.productId];
                              const imgSrc = item.productImage || product?.image || product?.images?.[0];
                              return (
                                <div key={j} className="order-item-card">
                                  <div className="order-item-thumb">
                                    {imgSrc ? (
                                      <img src={imgSrc} alt={item.productName || product?.name || 'Product'} />
                                    ) : (
                                      <Package size={24} />
                                    )}
                                  </div>
                                  <div className="order-item-details">
                                    {product ? (
                                      <Link to={`/products/${item.productId}`} className="order-item-name">{product.name}</Link>
                                    ) : (
                                      <span className="order-item-name">{item.productName || 'Custom Item'}</span>
                                    )}
                                    <div className="order-item-meta">
                                      {item.size && <span className="item-size">{item.size}</span>}
                                      {item.color && <span className="color-dot" style={{ background: item.color, border: item.color === '#ffffff' || item.color === '#fff' ? '1px solid #ddd' : 'none' }} />}
                                      <span className="item-qty">×{item.quantity}</span>
                                    </div>
                                  </div>
                                  <span className="order-item-price">₹{(item.price * item.quantity).toFixed(0)}</span>
                                </div>
                              );
                            })}
                          </div>
                          {/* Shipment / Tracking Info */}
                          {order.shipment && order.status !== 'cancelled' && (
                            <div className="order-tracking">
                              <Truck size={14} />
                              <span>
                                {order.shipment.courierName && <strong>{order.shipment.courierName} </strong>}
                                {order.shipment.awbCode ? (
                                  <>AWB: <strong>{order.shipment.awbCode}</strong></>
                                ) : 'Shipment created'}
                              </span>
                              {order.shipment.trackingData?.tracking_data?.shipment_track?.[0]?.current_status && (
                                <span className="track-status">
                                  <MapPin size={12} /> {order.shipment.trackingData.tracking_data.shipment_track[0].current_status}
                                </span>
                              )}
                            </div>
                          )}
                          {order.status === 'cancelled' && (
                            <div className="order-tracking order-tracking-cancelled">
                              <XCircle size={14} />
                              <span>This order has been cancelled</span>
                            </div>
                          )}
                          {/* Payment & Coupon Info */}
                          {(order.couponCode || (order.discountAmount && order.discountAmount > 0)) ? (
                            <div className="order-coupon-info">
                              <CreditCard size={13} />
                              {order.couponCode && <span>Coupon: <strong>{order.couponCode}</strong></span>}
                              {order.discountAmount != null && order.discountAmount > 0 && <span style={{ color: 'var(--success, #16a34a)' }}>Saved ₹{order.discountAmount.toFixed(0)}</span>}
                            </div>
                          ) : null}
                          <div className="order-footer">
                            <span className="order-address">{order.shippingAddress.replace(/\n/g, ', ')}</span>
                            <div className="order-total-col">
                              <button className="invoice-btn" onClick={() => handleDownloadInvoice(order.id)} title="Download Invoice">
                                <FileText size={16} /> Invoice
                              </button>
                              {['pending', 'processing', 'shipped', 'delivered'].includes(order.status) && (
                                <Link to={`/orders/${order.id}/track`} state={{ order }} className="invoice-btn" title="Track Order">
                                  <MapPin size={16} /> Track
                                </Link>
                              )}
                              <span className="order-total-label">Order Total</span>
                              <span className="order-total">₹{order.total.toFixed(0)}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Design studio orders ── */}
              {tab === 'designs' && (
                <motion.div key="designs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {designOrders.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <Palette size={48} strokeWidth={1} />
                      <p>No custom design orders yet. <Link to="/design-studio">Open Design Studio</Link></p>
                    </div>
                  ) : (
                    <div className="orders-list">
                      {designOrders.map((order, i) => {
                        const firstImage = Object.entries(order.designImages || {}).find(([, v]) => v)?.[1];
                        return (
                          <motion.div key={order.id} className="order-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                            <div className="order-header">
                              <div>
                                <span className="order-id">
                                  <Palette size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle', color: 'var(--primary)' }} />
                                  Order #{order.id.slice(0, 8).toUpperCase()}
                                </span>
                                <span className="order-date">{new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                              </div>
                              <span className={`status-badge status-${order.status}`}>
                                {statusIcons[order.status]} {statusLabel[order.status] ?? order.status}
                              </span>
                            </div>

                            <div className="order-design-row">
                              {firstImage && (
                                <img src={firstImage} alt="Design preview" className="order-design-thumb" />
                              )}
                              <div className="order-design-details">
                                <div className="order-item">
                                  <span className="item-name" style={{ textTransform: 'capitalize' }}>
                                    {PRODUCT_LABELS[order.productType] || order.productType}
                                  </span>
                                  <span className="item-qty">×{order.quantity}</span>
                                </div>
                                <div className="order-design-meta">
                                  <span className="color-dot" style={{ background: order.colorHex, border: order.colorHex === '#ffffff' ? '1px solid #ddd' : 'none', display: 'inline-block', width: 12, height: 12, borderRadius: '50%', verticalAlign: 'middle', marginRight: 4 }} />
                                  <span>{order.colorName}</span>
                                  <span style={{ color: 'var(--text-3)' }}>·</span>
                                  <span style={{ textTransform: 'capitalize' }}>{order.printSize} print</span>
                                  <span style={{ color: 'var(--text-3)' }}>·</span>
                                  <span>{(order.sides || []).join(' + ')}</span>
                                </div>
                                {/* Download design images */}
                                <div className="order-design-downloads">
                                  {Object.entries(order.designImages || {}).map(([side, dataUrl]) => {
                                    if (!dataUrl) return null;
                                    return (
                                      <button key={side} className="invoice-btn" onClick={() => handleDownloadDesign(dataUrl, order.id, side)}>
                                        <Download size={13} /> {side}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="order-footer">
                              <span className="order-address">{order.shippingAddress.replace(/\n/g, ', ')}</span>
                              <div className="order-total-col">
                                <span className="order-total-label">Order Total</span>
                                <span className="order-total">₹{order.total.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
