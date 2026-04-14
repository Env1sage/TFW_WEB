import { BrowserRouter, Routes, Route, useLocation, Navigate, useEffect } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
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
      <ScrollToTop />
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
          {/* WhatsApp Floater */}
          <a
            href="https://wa.me/918983301235?text=Hi%2C%20I%20need%20help%20with%20my%20order%20on%20TheFramedWall"
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-floater"
            aria-label="Chat on WhatsApp"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
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
