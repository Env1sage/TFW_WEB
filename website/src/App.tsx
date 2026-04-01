import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

const ADMIN_ROLES = ['admin', 'super_admin', 'product_manager', 'order_manager'];

import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Login from './pages/Login';
import Register from './pages/Register';
import TwoFactorSetup from './pages/TwoFactorSetup';
import TwoFactorVerify from './pages/TwoFactorVerify';
import Profile from './pages/Profile';
import Orders from './pages/Orders';
import Admin from './pages/Admin';
import About from './pages/About';
import Contact from './pages/Contact';
import FAQ from './pages/FAQ';
import CorporateInquiry from './pages/CorporateInquiry';
import Customizer from './pages/Customizer';
import DesignStudioCart from './pages/DesignStudioCart';
import Payment from './pages/Payment';
import PaymentSuccess from './pages/PaymentSuccess';
import OrderTracking from './pages/OrderTracking';

function AppContent() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isDesignStudio = location.pathname.startsWith('/design-studio');
  const isAdmin = location.pathname.startsWith('/admin');

  // Redirect admin users away from public pages to the admin dashboard
  if (!isAdmin && !isDesignStudio && !authLoading && user && ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{
        style: { borderRadius: '10px', background: '#1e293b', color: '#fff' },
      }} />
      {isDesignStudio ? (
        <Routes>
          <Route path="/design-studio" element={<Customizer />} />
          <Route path="/design-studio/cart" element={<DesignStudioCart />} />
          <Route path="/design-studio/:id" element={<Customizer />} />
        </Routes>
      ) : isAdmin ? (
        <ErrorBoundary>
          <Routes>
            <Route path="/admin/*" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
          </Routes>
        </ErrorBoundary>
      ) : (
        <div className="app-layout">
          <Navbar />
          <main className="main-content">
            <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
              <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
              <Route path="/orders/:id/track" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/2fa-verify" element={<TwoFactorVerify />} />
              <Route path="/2fa-setup" element={<ProtectedRoute><TwoFactorSetup /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/corporate" element={<CorporateInquiry />} />
            </Routes>
            </ErrorBoundary>
          </main>
          <Footer />
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
