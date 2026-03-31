import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CustomerDesigner from './pages/CustomerDesigner';
import AdminDashboard from './pages/AdminDashboard';
import AdminProducts from './pages/AdminProducts';
import AdminOrders from './pages/AdminOrders';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Customer portal */}
        <Route path="/" element={<CustomerDesigner />} />

        {/* Admin portal */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/products" element={<AdminProducts />} />
        <Route path="/admin/orders" element={<AdminOrders />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
