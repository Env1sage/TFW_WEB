import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, ShoppingCart, CreditCard, Truck, MapPin, CheckCircle,
  Clock, XCircle, ArrowLeft, AlertCircle, Tag, IndianRupee, Calendar,
  Hash, Image as ImageIcon, Star,
} from 'lucide-react';
import { api } from '../api';
import type { Order } from '../types';
import toast from 'react-hot-toast';

interface TrackingEvent {
  id?: string;
  timestamp: string;
  status: string;
  message: string;
  location?: string;
  source?: 'system' | 'manual' | 'shiprocket';
}

const STATUS_STEPS = [
  { key: 'placed',           label: 'Order Placed',       icon: <ShoppingCart size={15} /> },
  { key: 'confirmed',        label: 'Payment Confirmed',  icon: <CreditCard size={15} /> },
  { key: 'processing',       label: 'Preparing',          icon: <Package size={15} /> },
  { key: 'shipped',          label: 'Shipped',            icon: <Truck size={15} /> },
  { key: 'out_for_delivery', label: 'Out for Delivery',   icon: <MapPin size={15} /> },
  { key: 'delivered',        label: 'Delivered',          icon: <Star size={15} /> },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'Order Placed', processing: 'Processing', shipped: 'Shipped',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6',
  delivered: '#10b981', cancelled: '#ef4444',
};

const STATUS_BG: Record<string, string> = {
  pending: '#fffbeb', processing: '#eff6ff', shipped: '#f5f3ff',
  delivered: '#ecfdf5', cancelled: '#fef2f2',
};

export default function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const stateOrder = (location.state as any)?.order as Order | undefined;

  const [order, setOrder] = useState<Order | null>(stateOrder || null);
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(!stateOrder);
  const [trackingLoading, setTrackingLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadOrder = async () => {
      if (!stateOrder) {
        try {
          const data = await api.getOrder(id);
          setOrder(data);
        } catch {
          toast.error('Order not found');
          navigate('/orders');
          return;
        } finally {
          setLoading(false);
        }
      }

      try {
        const td = await api.getOrderTracking(id);
        setTracking(td);
      } catch {
        // No shipment yet — OK
      } finally {
        setTrackingLoading(false);
      }
    };
    loadOrder();

    // Auto-poll for tracking updates every 30 seconds
    const interval = setInterval(async () => {
      try {
        const [orderData, td] = await Promise.all([
          api.getOrder(id),
          api.getOrderTracking(id).catch(() => null),
        ]);
        setOrder(orderData);
        if (td) setTracking(td);
      } catch {
        // silent — don't disrupt UI on poll failure
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (!order) return null;

  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';

  const isOutForDelivery =
    (tracking?.trackingData?.tracking_data?.shipment_track?.[0]?.current_status || '')
      .toLowerCase().includes('out for delivery') ||
    ((tracking?.trackingData?.manual_events || []) as TrackingEvent[]).some(
      e => e.status.toLowerCase().includes('out for delivery'),
    );

  const currentStep = (() => {
    if (order.status === 'delivered') return 5;
    if (isOutForDelivery) return 4;
    if (order.status === 'shipped') return 3;
    if (order.status === 'processing') return 2;
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'simulated') return 1;
    return 0;
  })();

  const itemsSubtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = order.discountAmount || 0;
  const shipping = Math.max(0, order.total - itemsSubtotal + discount);

  const events: TrackingEvent[] = [];
  events.push({
    timestamp: order.createdAt,
    status: 'Order Placed',
    message: `Your order #${order.id.slice(0, 8).toUpperCase()} was placed`,
    source: 'system',
  });
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'simulated') {
    events.push({
      timestamp: order.createdAt,
      status: 'Payment Confirmed',
      message: `₹${order.total.toFixed(0)} payment received`,
      source: 'system',
    });
  }
  const srActivities: any[] =
    tracking?.trackingData?.tracking_data?.shipment_track?.[0]?.shipment_track_activities || [];
  for (const act of srActivities) {
    events.push({
      timestamp: act.date || order.createdAt,
      status: act.activity || act.sr_status || '',
      message: act.activity || act.sr_status || '',
      location: act.location || '',
      source: 'shiprocket',
    });
  }
  const manualEvents: TrackingEvent[] = tracking?.trackingData?.manual_events || [];
  for (const ev of manualEvents) events.push({ ...ev, source: 'manual' });
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const courierName: string | undefined = tracking?.courierName;
  const awbCode: string | undefined = tracking?.awbCode;
  const estimatedDelivery: string | undefined = tracking?.trackingData?.estimatedDelivery;

  const statusColor = STATUS_COLOR[order.status] ?? 'var(--primary)';
  const statusBg = STATUS_BG[order.status] ?? 'var(--surface)';

  return (
    <div className="od-page">
      <div className="container">

        {/* ── Back link ── */}
        <Link to="/orders" className="od-back">
          <ArrowLeft size={15} /> Back to My Orders
        </Link>

        {/* ── Hero Status Banner ── */}
        <motion.div
          className="od-hero-banner"
          style={{ background: statusBg, borderColor: statusColor + '33' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="od-hero-left">
            <div className="od-hero-icon" style={{ background: statusColor + '18', color: statusColor }}>
              {isCancelled ? <XCircle size={26} /> : isDelivered ? <CheckCircle size={26} /> : <Truck size={26} />}
            </div>
            <div>
              <p className="od-hero-status" style={{ color: statusColor }}>
                {STATUS_LABEL[order.status] ?? order.status}
              </p>
              <h1 className="od-hero-title">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
              <div className="od-meta-row">
                <span className="od-meta-chip">
                  <Calendar size={12} />
                  {new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                <span className="od-meta-chip">
                  <Package size={12} />
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </span>
                <span className="od-meta-chip od-meta-amount">
                  <IndianRupee size={12} />
                  ₹{order.total.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
          {estimatedDelivery && !isCancelled && (
            <div className="od-hero-eta">
              <p className="od-hero-eta-label">Estimated Delivery</p>
              <p className="od-hero-eta-date">
                {new Date(estimatedDelivery).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            </div>
          )}
        </motion.div>

        <div className="od-layout">

          {/* ══ LEFT COLUMN ══ */}
          <div className="od-left">

            {/* ── Tracking Progress ── */}
            {!isCancelled && (
              <motion.div className="od-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <h2 className="od-card-title"><Truck size={16} /> Shipment Progress</h2>
                {courierName && (
                  <div className="od-shipment-badge">
                    <Truck size={13} />
                    <span>{courierName}</span>
                    {awbCode && <span className="od-awb">AWB: <strong>{awbCode}</strong></span>}
                  </div>
                )}
                <div className="od-stepper">
                  {STATUS_STEPS.map((step, idx) => {
                    const done = idx <= currentStep;
                    const active = idx === currentStep;
                    return (
                      <div key={step.key} className={`od-step${done ? ' done' : ''}${active ? ' active' : ''}`}>
                        <div className="od-step-left">
                          <div className={`od-step-circle${done ? ' done' : ''}${active ? ' active' : ''}`}>
                            {done ? <CheckCircle size={14} /> : step.icon}
                          </div>
                          {idx < STATUS_STEPS.length - 1 && (
                            <div className={`od-step-line${idx < currentStep ? ' done' : ''}`} />
                          )}
                        </div>
                        <div className="od-step-body">
                          <p className="od-step-label">{step.label}</p>
                          {active && <p className="od-step-sublabel">Current status</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Ordered Products ── */}
            <motion.div className="od-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="od-card-title"><Package size={16} /> Ordered Items</h2>
              <div className="od-items-list">
                {order.items.map((item, i) => (
                  <div key={i} className="od-item-row">
                    <div className="od-item-img">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName || 'Product'} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="od-item-no-img"><ImageIcon size={24} /></div>
                      )}
                    </div>
                    <div className="od-item-info">
                      <p className="od-item-name">{item.productName || 'Product'}</p>
                      <div className="od-item-tags">
                        {item.size && <span className="od-tag">{item.size}</span>}
                        {item.color && (
                          <span className="od-tag od-color-tag">
                            <span className="od-color-dot" style={{ background: item.color, border: item.color === '#ffffff' ? '1px solid #ccc' : 'none' }} />
                            {item.color}
                          </span>
                        )}
                        {item.customText && <span className="od-tag od-tag-text">"{item.customText}"</span>}
                      </div>
                    </div>
                    <div className="od-item-price">
                      <span className="od-price-qty">× {item.quantity}</span>
                      <strong className="od-price-total">₹{(item.price * item.quantity).toFixed(0)}</strong>
                      <span className="od-price-unit">₹{item.price.toFixed(0)} each</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── Tracking Events ── */}
            {events.length > 0 && (
              <motion.div className="od-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <h2 className="od-card-title"><Clock size={16} /> Tracking Updates</h2>
                <div className="od-events">
                  {events.map((ev, i) => (
                    <div key={i} className={`od-event${i === 0 ? ' latest' : ''}`}>
                      <div className="od-ev-dot-col">
                        <div className={`od-ev-dot${i === 0 ? ' latest' : ''}`} />
                        {i < events.length - 1 && <div className="od-ev-line" />}
                      </div>
                      <div className="od-ev-body">
                        <p className="od-ev-status">{ev.status}</p>
                        {ev.message !== ev.status && <p className="od-ev-msg">{ev.message}</p>}
                        {ev.location && (
                          <p className="od-ev-loc"><MapPin size={10} /> {ev.location}</p>
                        )}
                        <p className="od-ev-time">
                          {new Date(ev.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}
                          {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {!trackingLoading && events.length === 0 && (
              <motion.div className="od-card od-no-tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                <div className="od-no-tracking-icon"><AlertCircle size={28} /></div>
                <p>No tracking updates yet.</p>
                <p className="od-no-tracking-sub">Check back after your order is dispatched.</p>
              </motion.div>
            )}
          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div className="od-right">

            {/* ── Bill Summary ── */}
            <motion.div className="od-card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="od-card-title"><IndianRupee size={16} /> Bill Summary</h2>
              <div className="od-bill-rows">
                <div className="od-bill-row">
                  <span>Items subtotal</span>
                  <span>₹{itemsSubtotal.toFixed(0)}</span>
                </div>
                <div className={`od-bill-row${shipping === 0 ? ' green' : ''}`}>
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'FREE' : `₹${shipping.toFixed(0)}`}</span>
                </div>
                {discount > 0 && (
                  <div className="od-bill-row green">
                    <span className="od-coupon-label">
                      <Tag size={11} />
                      {order.couponCode ? <><strong>{order.couponCode}</strong> applied</> : 'Coupon discount'}
                    </span>
                    <span>−₹{discount.toFixed(0)}</span>
                  </div>
                )}
                <div className="od-bill-total">
                  <span>Total Paid</span>
                  <strong>₹{order.total.toFixed(0)}</strong>
                </div>
              </div>
            </motion.div>

            {/* ── Payment & Address combined ── */}
            <motion.div className="od-card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
              <h2 className="od-card-title"><CreditCard size={16} /> Payment</h2>
              <div className="od-info-grid">
                <div className="od-info-item">
                  <span className="od-info-label">Status</span>
                  <span className={`od-pay-status ${order.paymentStatus === 'paid' ? 'paid' : order.paymentStatus === 'simulated' ? 'simulated' : 'pending'}`}>
                    {order.paymentStatus === 'paid' ? '✓ Paid' :
                     order.paymentStatus === 'simulated' ? '✓ Demo Paid' : '⏳ Pending'}
                  </span>
                </div>
                {order.paymentId && (
                  <div className="od-info-item">
                    <span className="od-info-label">Reference</span>
                    <span className="od-pay-ref">{order.paymentId.slice(0, 20)}…</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── Shipping Address ── */}
            <motion.div className="od-card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <h2 className="od-card-title"><MapPin size={16} /> Delivery Address</h2>
              <div className="od-address-block">
                <div className="od-address-icon"><MapPin size={16} /></div>
                <p className="od-address">{order.shippingAddress}</p>
              </div>
            </motion.div>

            {/* ── Actions ── */}
            <div className="od-actions">
              <Link to="/products" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Continue Shopping
              </Link>
              <Link to="/orders" className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                <Hash size={14} /> All Orders
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
