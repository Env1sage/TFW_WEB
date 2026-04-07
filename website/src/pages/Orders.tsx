import { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    Promise.all([api.getMyOrders(), api.getMyDesignOrders(), api.getProducts({})])
      .then(([o, d, p]) => {
        setOrders(o);
        setDesignOrders(d);
        const map: Record<string, Product> = {};
        p.forEach((prod: Product) => { map[prod.id] = prod; });
        setProductMap(map);
      })
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  // Build combined/grouped order entries
  type OrderEntry = {
    key: string;
    productOrder?: Order;
    designOrders: DesignOrder[];
    createdAt: string;
  };

  const entries = useMemo((): OrderEntry[] => {
    const grouped: Record<string, OrderEntry> = {};

    // Group product orders
    for (const o of orders) {
      const gid = o.groupOrderId;
      if (gid) {
        if (!grouped[gid]) grouped[gid] = { key: gid, designOrders: [], createdAt: o.createdAt };
        grouped[gid].productOrder = o;
      } else {
        grouped[`p_${o.id}`] = { key: `p_${o.id}`, productOrder: o, designOrders: [], createdAt: o.createdAt };
      }
    }

    // Group design orders
    for (const d of designOrders) {
      const gid = d.groupOrderId;
      if (gid) {
        if (!grouped[gid]) grouped[gid] = { key: gid, designOrders: [], createdAt: d.createdAt };
        grouped[gid].designOrders.push(d);
      } else {
        grouped[`d_${d.id}`] = { key: `d_${d.id}`, designOrders: [d], createdAt: d.createdAt };
      }
    }

    return Object.values(grouped).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, designOrders]);

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

  return (
    <div className="orders-page">
      <div className="container">
        <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1>My Orders</h1>
        </motion.div>

        {entries.length === 0 ? (
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
          <AnimatePresence>
            <div className="orders-list">
              {entries.map((entry, i) => {
                const { productOrder, designOrders: dOrders } = entry;
                const isCombined = !!productOrder && dOrders.length > 0;
                const displayDate = new Date(entry.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
                const overallTotal = (productOrder?.total ?? 0) + dOrders.reduce((s, d) => s + d.total, 0);
                // Single display ID: use product order ID if present, else design order ID
                const displayId = (productOrder?.id ?? dOrders[0]?.id ?? '').slice(0, 8).toUpperCase();
                const primaryStatus = productOrder?.status ?? dOrders[0]?.status;

                return (
                  <motion.div key={entry.key} className="order-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    {/* ── Header ── */}
                    <div className="order-header">
                      <div>
                        <span className="order-id" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {isCombined && <><Package size={13} style={{ color: 'var(--primary)' }} /><Palette size={13} style={{ color: 'var(--primary)' }} /></>}
                          {!isCombined && productOrder && <Package size={13} style={{ color: 'var(--primary)' }} />}
                          {!isCombined && !productOrder && <Palette size={13} style={{ color: 'var(--primary)' }} />}
                          Order #{displayId}
                        </span>
                        <span className="order-date">{displayDate}</span>
                      </div>
                      {primaryStatus && (
                        <span className={`status-badge status-${primaryStatus}`}>
                          {statusIcons[primaryStatus]} {statusLabel[primaryStatus] ?? primaryStatus}
                        </span>
                      )}
                    </div>

                    {/* ── Product Order Items ── */}
                    {productOrder && (
                      <div className={isCombined ? 'order-section-block' : ''}>
                        {isCombined && (
                          <div className="order-section-divider">
                            <Package size={13} /> Products
                          </div>
                        )}
                        <div className="order-items-grid">
                          {productOrder.items.map((item, j) => {
                            const product = productMap[item.productId];
                            const imgSrc = item.productImage || product?.image || product?.images?.[0];
                            return (
                              <div key={j} className="order-item-card">
                                <div className="order-item-thumb">
                                  {imgSrc ? <img src={imgSrc} alt={item.productName || product?.name || 'Product'} /> : <Package size={24} />}
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
                        {/* Product tracking */}
                        {productOrder.shipment && productOrder.status !== 'cancelled' && (
                          <div className="order-tracking">
                            <Truck size={14} />
                            <span>
                              {productOrder.shipment.courierName && <strong>{productOrder.shipment.courierName} </strong>}
                              {productOrder.shipment.awbCode ? <>AWB: <strong>{productOrder.shipment.awbCode}</strong></> : 'Shipment created'}
                            </span>
                            {productOrder.shipment.trackingData?.tracking_data?.shipment_track?.[0]?.current_status && (
                              <span className="track-status"><MapPin size={12} /> {productOrder.shipment.trackingData.tracking_data.shipment_track[0].current_status}</span>
                            )}
                          </div>
                        )}
                        {productOrder.status === 'cancelled' && (
                          <div className="order-tracking order-tracking-cancelled"><XCircle size={14} /><span>Products order cancelled</span></div>
                        )}
                        {(productOrder.couponCode || (productOrder.discountAmount && productOrder.discountAmount > 0)) && (
                          <div className="order-coupon-info">
                            <CreditCard size={13} />
                            {productOrder.couponCode && <span>Coupon: <strong>{productOrder.couponCode}</strong></span>}
                            {productOrder.discountAmount != null && productOrder.discountAmount > 0 && <span style={{ color: 'var(--success, #16a34a)' }}>Saved ₹{productOrder.discountAmount.toFixed(0)}</span>}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Design Orders ── */}
                    {dOrders.map((dOrder) => {
                      const firstImage = Object.entries(dOrder.designImages || {}).find(([, v]) => v)?.[1];
                      return (
                        <div key={dOrder.id} className={isCombined ? 'order-section-block' : ''}>
                          {isCombined && (
                            <div className="order-section-divider">
                              <Palette size={13} /> Custom Design
                            </div>
                          )}
                          <div className="order-design-row">
                            {firstImage && <img src={firstImage} alt="Design preview" className="order-design-thumb" />}
                            <div className="order-design-details">
                              <div className="order-item">
                                <span className="item-name" style={{ textTransform: 'capitalize' }}>
                                  {PRODUCT_LABELS[dOrder.productType] || dOrder.productType}
                                </span>
                                <span className="item-qty">×{dOrder.quantity}</span>
                              </div>
                              <div className="order-design-meta">
                                <span className="color-dot" style={{ background: dOrder.colorHex, border: dOrder.colorHex === '#ffffff' ? '1px solid #ddd' : 'none', display: 'inline-block', width: 12, height: 12, borderRadius: '50%', verticalAlign: 'middle', marginRight: 4 }} />
                                <span>{dOrder.colorName}</span>
                                <span style={{ color: 'var(--text-3)' }}>·</span>
                                <span style={{ textTransform: 'capitalize' }}>{dOrder.printSize} print</span>
                                <span style={{ color: 'var(--text-3)' }}>·</span>
                                <span>{(dOrder.sides || []).join(' + ')}</span>
                              </div>
                              <div className="order-design-downloads">
                                {Object.entries(dOrder.designImages || {}).map(([side, dataUrl]) => {
                                  if (!dataUrl) return null;
                                  return (
                                    <button key={side} className="invoice-btn" onClick={() => handleDownloadDesign(dataUrl, dOrder.id, side)}>
                                      <Download size={13} /> {side}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          {!isCombined && dOrder.status === 'cancelled' && (
                            <div className="order-tracking order-tracking-cancelled"><XCircle size={14} /><span>This order has been cancelled</span></div>
                          )}
                        </div>
                      );
                    })}

                    {/* ── Footer ── */}
                    <div className="order-footer">
                      <span className="order-address">{(productOrder?.shippingAddress ?? dOrders[0]?.shippingAddress ?? '').replace(/\n/g, ', ')}</span>
                      <div className="order-total-col">
                        {productOrder && (
                          <button className="invoice-btn" onClick={() => handleDownloadInvoice(productOrder.id)} title="Download Invoice">
                            <FileText size={16} /> Invoice
                          </button>
                        )}
                        {productOrder && ['pending', 'processing', 'shipped', 'delivered'].includes(productOrder.status) && (
                          <Link to={`/orders/${productOrder.id}/track`} state={{ order: productOrder }} className="invoice-btn" title="Track Order">
                            <MapPin size={16} /> Track
                          </Link>
                        )}
                        <span className="order-total-label">Order Total</span>
                        <span className="order-total">₹{overallTotal.toFixed(0)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
