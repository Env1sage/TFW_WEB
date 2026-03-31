import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const ADMIN_ROLES = ['admin', 'super_admin', 'product_manager', 'order_manager'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill all fields'); return; }
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.requires2FA) {
        navigate(`/2fa-verify?tempToken=${res.tempToken}&redirect=${encodeURIComponent(redirect)}`);
      } else {
        toast.success('Welcome back!');
        if (res.role && ADMIN_ROLES.includes(res.role)) {
          navigate('/admin', { replace: true });
        } else {
          navigate(redirect);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-split">
        {/* Left panel - decorative */}
        <motion.div className="auth-panel" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
          <div className="auth-panel-content">
            <div className="auth-panel-brand">
              <div className="brand-icon">T</div>
              <span>TheFramedWall</span>
            </div>
            <h2>Welcome back to your creative studio</h2>
            <p>Design custom products, manage your orders, and bring your ideas to life with premium quality printing.</p>
            <div className="auth-panel-features">
              <div className="auth-feature"><Sparkles size={18} /> <span>Custom design tools</span></div>
              <div className="auth-feature"><Sparkles size={18} /> <span>Premium quality prints</span></div>
              <div className="auth-feature"><Sparkles size={18} /> <span>Fast worldwide shipping</span></div>
            </div>
          </div>
        </motion.div>

        {/* Right panel - form */}
        <motion.div className="auth-form-panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <div className="auth-form-container">
            <div className="auth-header">
              <h1>Sign In</h1>
              <p>Enter your credentials to access your account</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" />
                  <button type="button" className="toggle-pw" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? <div className="spinner-sm" /> : <>Sign In <ArrowRight size={18} /></>}
              </button>
            </form>

            <p className="auth-footer">
              Don&apos;t have an account? <Link to="/register">Create a free account</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
