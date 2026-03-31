import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types';
import { fetchAllProducts } from '../api';
import './Admin.css';

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllProducts()
      .then(setProducts)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">TheFramedWall</div>
        <nav className="admin-nav">
          <Link to="/admin" className="admin-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            Dashboard
          </Link>
          <Link to="/admin/products" className="admin-nav-item active">
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
          <h1>Products</h1>
          <p className="admin-subtitle">Manage your product catalog</p>
        </div>

        {loading ? (
          <div className="admin-loading"><div className="spinner" /></div>
        ) : products.length === 0 ? (
          <div className="admin-empty">
            <p>No products found. Use the API to create your first product.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Base Price</th>
                  <th>Colors</th>
                  <th>Print Areas</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="td-name">{p.name}</td>
                    <td className="td-mono">{p.sku}</td>
                    <td>&#8377;{p.basePrice}</td>
                    <td>
                      <div className="color-dots">
                        {p.colors.map((c) => (
                          <span key={c.id} className="mini-dot" style={{ background: c.hexCode }}
                            title={c.name} />
                        ))}
                        {p.colors.length === 0 && <span className="muted">None</span>}
                      </div>
                    </td>
                    <td>{p.printAreas.map((a) => a.side).join(', ') || 'None'}</td>
                    <td>
                      <span className={`badge ${p.isActive ? 'green' : 'gray'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
