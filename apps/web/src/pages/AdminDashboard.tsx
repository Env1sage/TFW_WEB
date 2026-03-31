import { Link } from 'react-router-dom';
import './Admin.css';

export default function AdminDashboard() {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">TheFramedWall</div>
        <nav className="admin-nav">
          <Link to="/admin" className="admin-nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            Dashboard
          </Link>
          <Link to="/admin/products" className="admin-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>
            Products
          </Link>
          <Link to="/admin/orders" className="admin-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            Orders
          </Link>
        </nav>
        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
            Customer Portal
          </Link>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-header">
          <h1>Dashboard</h1>
          <p className="admin-subtitle">Overview of your print-on-demand business</p>
        </div>
        <div className="admin-cards">
          <div className="stat-card">
            <div className="stat-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /></svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Products</span>
              <span className="stat-value">-</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Revenue</span>
              <span className="stat-value">-</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Orders</span>
              <span className="stat-value">-</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Customers</span>
              <span className="stat-value">-</span>
            </div>
          </div>
        </div>

        <div className="admin-section">
          <h2>Quick Actions</h2>
          <div className="action-grid">
            <Link to="/admin/products" className="action-card">
              <h3>Manage Products</h3>
              <p>Add, edit, or remove products from your catalog</p>
            </Link>
            <Link to="/admin/orders" className="action-card">
              <h3>View Orders</h3>
              <p>Track and manage customer orders</p>
            </Link>
            <Link to="/" className="action-card">
              <h3>Open Designer</h3>
              <p>Create a new design using the customer portal</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
