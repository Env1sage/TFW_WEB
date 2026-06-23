import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  FunnelChart, Funnel, LabelList,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, IndianRupee, Package,
  RefreshCw, Download, Filter, BarChart3, Eye, Target, AlertTriangle,
  ArrowLeft, Shirt, Tag, Ruler, Star, Calendar, ChevronDown,
} from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────────────
interface DashboardData {
  totalRevenue: number; totalOrders: number; avgOrderValue: number;
  uniqueVisitors: number; conversionRate: number; cartAbandonmentRate: number;
  revenueTimeline: { date: string; revenue: number; orders: number }[];
  mostViewedProducts: { productId: string; name: string; category: string; views: number }[];
  mostAddedToCart: { productId: string; name: string; addCount: number; totalQty: number }[];
  mostSelectedBrands: { brandId: string; brandName: string; selectCount: number }[];
  mostSelectedSizes: { size: string; selectCount: number }[];
  funnel: { views: number; addedToCart: number; checkoutStarted: number; purchased: number };
  categoryRevenue: { category: string; revenue: number; orders: number }[];
  mostCustomizedProducts: { productType: string; count: number; revenue: number }[];
  productPerformance: { productId: string; name: string; category: string; views: number; addToCart: number; purchases: number; conversionRate: string }[];
  from: string; to: string; groupBy: string;
}

// ── Chart colour palettes ────────────────────────────────────────────────────
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const GREEN = '#10b981';
const INDIGO = '#6366f1';

// ── Preset date ranges ───────────────────────────────────────────────────────
type Preset = '7d' | '30d' | '90d' | 'custom';
function presetRange(p: Preset): { from: string; to: string } {
  const to = new Date(); to.setHours(23, 59, 59, 999);
  const from = new Date();
  if (p === '7d')  from.setDate(from.getDate() - 7);
  if (p === '30d') from.setDate(from.getDate() - 30);
  if (p === '90d') from.setDate(from.getDate() - 90);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

// ── Small helpers ────────────────────────────────────────────────────────────
const fmt  = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtK = (n: number) => n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : fmt(n);
const pct  = (n: number) => `${n.toFixed(1)}%`;

function KpiCard({ label, value, sub, icon, color, trend }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="an-kpi-card"
      style={{ '--kpi-color': color } as React.CSSProperties}
    >
      <div className="an-kpi-icon" style={{ background: `${color}18`, color }}>{icon}</div>
      <div className="an-kpi-body">
        <p className="an-kpi-value">{value}</p>
        <p className="an-kpi-label">{label}</p>
        {sub && (
          <p className="an-kpi-sub">
            {trend === 'up'   && <TrendingUp size={11} style={{ color: GREEN }} />}
            {trend === 'down' && <TrendingDown size={11} style={{ color: '#ef4444' }} />}
            {sub}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function SectionCard({ title, icon, children, className = '' }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`an-section-card ${className}`}>
      <div className="an-section-header">
        <span className="an-section-icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Custom tooltip for revenue chart
const RevenueTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tooltip">
      <p className="an-tooltip-date">{new Date(label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
      <p style={{ color: INDIGO }}>{fmt(payload[0]?.value ?? 0)} revenue</p>
      <p style={{ color: GREEN }}>{payload[1]?.value ?? 0} orders</p>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function Analytics() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [exportLoading, setExportLoading] = useState(false);
  const [activePerf, setActivePerf] = useState<'views' | 'addToCart' | 'purchases'>('views');

  const { from, to } = preset === 'custom'
    ? { from: customFrom || presetRange('30d').from, to: customTo || presetRange('30d').to }
    : presetRange(preset);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getAdvancedAnalytics({ from, to, groupBy });
      setData(d);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async (type: 'orders' | 'events' | 'products') => {
    setExportLoading(true);
    try {
      const url = api.exportAnalytics({ from, to, type });
      const a = document.createElement('a'); a.href = url; a.click();
    } catch { toast.error('Export failed'); }
    finally { setExportLoading(false); }
  };

  // ── Funnel data ──────────────────────────────────────────────────────────
  const funnelData = data ? [
    { name: 'Product Views',    value: data.funnel.views,           fill: '#6366f1' },
    { name: 'Added to Cart',    value: data.funnel.addedToCart,     fill: '#8b5cf6' },
    { name: 'Checkout Started', value: data.funnel.checkoutStarted, fill: '#a78bfa' },
    { name: 'Purchased',        value: data.funnel.purchased,       fill: '#10b981' },
  ] : [];

  return (
    <div className="an-page">
      {/* ── Header ── */}
      <div className="an-header">
        <div className="an-header-left">
          <Link to="/admin" className="an-back-btn"><ArrowLeft size={16} /> Admin</Link>
          <div>
            <h1><BarChart3 size={22} /> Analytics Dashboard</h1>
            <p className="an-header-sub">
              {data && `${new Date(data.from).toLocaleDateString('en-IN', { day:'numeric', month:'short' })} – ${new Date(data.to).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`}
            </p>
          </div>
        </div>

        <div className="an-header-right">
          {/* Date range presets */}
          <div className="an-preset-group">
            {(['7d','30d','90d','custom'] as Preset[]).map(p => (
              <button key={p} className={`an-preset-btn ${preset === p ? 'active' : ''}`} onClick={() => setPreset(p)}>
                {p === 'custom' ? <><Calendar size={13} /> Custom</> : p}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {preset === 'custom' && (
            <div className="an-custom-dates">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <span>–</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          )}

          {/* Group by */}
          <div className="an-select-wrap">
            <Filter size={13} />
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} className="an-select">
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
            <ChevronDown size={13} />
          </div>

          <button className="an-btn an-btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>

          {/* Export dropdown */}
          <div className="an-export-group">
            <button className="an-btn an-btn-primary" disabled={exportLoading} onClick={() => handleExport('orders')}>
              <Download size={14} /> Orders CSV
            </button>
            <button className="an-btn an-btn-ghost an-btn-sm" onClick={() => handleExport('products')}>Products</button>
            <button className="an-btn an-btn-ghost an-btn-sm" onClick={() => handleExport('events')}>Events</button>
          </div>
        </div>
      </div>

      {loading && !data && (
        <div className="an-loading-state">
          <div className="spinner" />
          <p>Loading analytics…</p>
        </div>
      )}

      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="an-body">

          {/* ── KPI Row ── */}
          <div className="an-kpi-grid">
            <KpiCard label="Total Revenue"     value={fmt(data.totalRevenue)}    icon={<IndianRupee size={20}/>}  color="#10b981" sub={`AOV: ${fmt(data.avgOrderValue)}`} />
            <KpiCard label="Total Orders"      value={String(data.totalOrders)}  icon={<ShoppingCart size={20}/>} color="#6366f1" />
            <KpiCard label="Unique Visitors"   value={String(data.uniqueVisitors)} icon={<Users size={20}/>}     color="#f59e0b" sub="tracked sessions" />
            <KpiCard label="Conversion Rate"   value={pct(data.conversionRate)}  icon={<Target size={20}/>}      color="#8b5cf6" sub="views → purchases" trend={data.conversionRate >= 2 ? 'up' : 'down'} />
            <KpiCard label="Cart Abandonment"  value={pct(data.cartAbandonmentRate)} icon={<AlertTriangle size={20}/>} color="#ef4444" sub="checkout → no purchase" trend={data.cartAbandonmentRate > 60 ? 'down' : 'up'} />
            <KpiCard label="Avg Order Value"   value={fmt(data.avgOrderValue)}   icon={<Star size={20}/>}        color="#06b6d4" />
          </div>

          {/* ── Revenue Timeline ── */}
          <SectionCard title="Revenue & Orders Over Time" icon={<TrendingUp size={16}/>} className="an-card-wide">
            {data.revenueTimeline.length === 0 ? (
              <p className="an-empty">No orders in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.revenueTimeline} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={INDIGO} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={INDIGO} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={GREEN} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={GREEN} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short' })} tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
                  <YAxis yAxisId="rev" tickFormatter={fmtK} tick={{ fontSize: 11, fill: 'var(--text-3)' }} width={56} />
                  <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-3)' }} width={30} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Legend />
                  <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke={INDIGO} fill="url(#revGrad)" strokeWidth={2} dot={false} />
                  <Area yAxisId="ord" type="monotone" dataKey="orders"  name="Orders"     stroke={GREEN}  fill="url(#ordGrad)"  strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* ── Conversion Funnel ── */}
          <div className="an-row-2">
            <SectionCard title="Conversion Funnel" icon={<Target size={16}/>}>
              {funnelData.every(f => f.value === 0) ? (
                <p className="an-empty">No event data yet. Browse products to start tracking.</p>
              ) : (
                <div className="an-funnel">
                  {funnelData.map((f, i) => {
                    const pctOfTop = funnelData[0].value > 0 ? (f.value / funnelData[0].value) * 100 : 0;
                    return (
                      <div key={f.name} className="an-funnel-step">
                        <div className="an-funnel-bar-wrap">
                          <div
                            className="an-funnel-bar"
                            style={{ width: `${Math.max(pctOfTop, 4)}%`, background: f.fill }}
                          />
                        </div>
                        <div className="an-funnel-meta">
                          <span className="an-funnel-label">{f.name}</span>
                          <span className="an-funnel-count">{f.value.toLocaleString()}</span>
                          {i > 0 && funnelData[i-1].value > 0 && (
                            <span className="an-funnel-drop" style={{ color: '#ef4444' }}>
                              {((1 - f.value / funnelData[i-1].value) * 100).toFixed(0)}% drop
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {/* Category Revenue Donut */}
            <SectionCard title="Revenue by Category" icon={<IndianRupee size={16}/>}>
              {data.categoryRevenue.length === 0 ? (
                <p className="an-empty">No category data in this period.</p>
              ) : (
                <div className="an-donut-wrap">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data.categoryRevenue} dataKey="revenue" nameKey="category"
                        cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                        paddingAngle={2} label={({ name, percent }: any) => (percent ?? 0) > 0.06 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ''}
                        labelLine={false}
                      >
                        {data.categoryRevenue.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="an-legend-list">
                    {data.categoryRevenue.map((c, i) => (
                      <div key={c.category} className="an-legend-item">
                        <span className="an-legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                        <span className="an-legend-name">{c.category}</span>
                        <span className="an-legend-val">{fmt(c.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* ── Most Viewed & Most Customized ── */}
          <div className="an-row-2">
            <SectionCard title="Most Viewed Products" icon={<Eye size={16}/>}>
              {data.mostViewedProducts.length === 0 ? (
                <p className="an-empty">No view events yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.mostViewedProducts.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: 'var(--text-2)' }} tickFormatter={n => n.length > 16 ? n.slice(0, 14) + '…' : n} />
                    <Tooltip formatter={(v: any) => [`${v} views`, 'Views']} />
                    <Bar dataKey="views" fill={INDIGO} radius={[0, 4, 4, 0]}>
                      {data.mostViewedProducts.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard title="Most Customized Products" icon={<Shirt size={16}/>}>
              {data.mostCustomizedProducts.length === 0 ? (
                <p className="an-empty">No custom orders in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.mostCustomizedProducts} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
                    <YAxis type="category" dataKey="productType" width={110} tick={{ fontSize: 11, fill: 'var(--text-2)' }} tickFormatter={n => n.length > 16 ? n.slice(0, 14) + '…' : n} />
                    <Tooltip formatter={(v: any, name: any) => [name === 'revenue' ? fmt(v) : v, name === 'revenue' ? 'Revenue' : 'Count']} />
                    <Bar dataKey="count" name="Orders" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                      {data.mostCustomizedProducts.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>

          {/* ── Brands & Sizes ── */}
          <div className="an-row-2">
            <SectionCard title="Most Selected Brands" icon={<Tag size={16}/>}>
              {data.mostSelectedBrands.length === 0 ? (
                <p className="an-empty">No brand data yet. Data appears when customers add branded products to cart.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.mostSelectedBrands} margin={{ left: 0, right: 16, top: 4, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="brandName" tick={{ fontSize: 11, fill: 'var(--text-2)' }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
                    <Tooltip formatter={(v: any) => [v, 'Add-to-carts']} />
                    <Bar dataKey="selectCount" name="Add-to-carts" radius={[4, 4, 0, 0]}>
                      {data.mostSelectedBrands.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard title="Most Selected Sizes" icon={<Ruler size={16}/>}>
              {data.mostSelectedSizes.length === 0 ? (
                <p className="an-empty">No size data yet. Data appears when customers add sized products to cart.</p>
              ) : (
                <div className="an-sizes-wrap">
                  <ResponsiveContainer width="60%" height={200}>
                    <PieChart>
                      <Pie data={data.mostSelectedSizes} dataKey="selectCount" nameKey="size"
                        cx="50%" cy="50%" outerRadius={80}
                        label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {data.mostSelectedSizes.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`${v} selects`, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="an-size-list">
                    {data.mostSelectedSizes.map((s, i) => (
                      <div key={s.size} className="an-size-row">
                        <span className="an-size-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                        <span className="an-size-label">{s.size}</span>
                        <div className="an-size-bar-wrap">
                          <div className="an-size-bar" style={{ width: `${(s.selectCount / data.mostSelectedSizes[0].selectCount) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
                        </div>
                        <span className="an-size-count">{s.selectCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* ── Product Performance Table ── */}
          <SectionCard title="Product Performance" icon={<BarChart3 size={16}/>} className="an-card-wide">
            <div className="an-perf-tabs">
              {(['views', 'addToCart', 'purchases'] as const).map(t => (
                <button key={t} className={`an-perf-tab ${activePerf === t ? 'active' : ''}`} onClick={() => setActivePerf(t)}>
                  {t === 'views' ? 'By Views' : t === 'addToCart' ? 'By Add-to-Cart' : 'By Purchases'}
                </button>
              ))}
            </div>
            {data.productPerformance.length === 0 ? (
              <p className="an-empty">No product event data in this period.</p>
            ) : (
              <div className="an-table-wrap">
                <table className="an-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Views</th>
                      <th style={{ textAlign: 'right' }}>Add to Cart</th>
                      <th style={{ textAlign: 'right' }}>Purchases</th>
                      <th style={{ textAlign: 'right' }}>Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.productPerformance]
                      .sort((a, b) => b[activePerf] - a[activePerf])
                      .map((p, i) => (
                        <tr key={p.productId}>
                          <td className="an-rank">{i + 1}</td>
                          <td className="an-prod-name">{p.name}</td>
                          <td><span className="an-cat-badge">{p.category || '—'}</span></td>
                          <td style={{ textAlign: 'right' }}>{p.views.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>{p.addToCart.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>{p.purchases.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`an-cr-badge ${parseFloat(p.conversionRate) >= 2 ? 'good' : parseFloat(p.conversionRate) >= 0.5 ? 'ok' : 'low'}`}>
                              {p.conversionRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

        </motion.div>
      )}
    </div>
  );
}
