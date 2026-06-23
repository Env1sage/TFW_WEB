import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await login(email, password);
      const adminRoles = ['admin', 'super_admin', 'product_manager', 'order_manager'];
      if (res.role && adminRoles.includes(res.role)) {
        toast.success('Welcome back, Admin');
        navigate('/admin', { replace: true });
      } else {
        toast.error('Access denied — not an admin account');
      }
    } catch (err: any) {
      toast.error(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <motion.div
        className="admin-login-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="admin-login-header">
          <div className="admin-login-icon">
            <Shield size={32} />
          </div>
          <h1>Admin Portal</h1>
          <p>Sign in with your administrator credentials</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="admin-input-wrap">
              <Mail size={16} className="admin-input-icon" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@theframedwall.com"
                autoFocus
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="admin-input-wrap">
              <Lock size={16} className="admin-input-icon" />
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="admin-pwd-toggle"
                onClick={() => setShowPwd(v => !v)}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg admin-login-btn"
            disabled={loading || !email || !password}
          >
            {loading ? <div className="spinner-sm" /> : <>Sign In <ArrowRight size={18} /></>}
          </button>
        </form>

        <p className="admin-login-note">
          This page is restricted to authorised administrators only.
        </p>
      </motion.div>
    </div>
  );
}
