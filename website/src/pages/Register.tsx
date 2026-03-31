import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirm) {
      toast.error('Please fill all fields'); return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match'); return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      toast.success('Account created! Welcome aboard!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
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
            <h2>Start creating amazing custom products</h2>
            <p>Join thousands of creators who design and sell custom merchandise with our easy-to-use platform.</p>
            <div className="auth-panel-features">
              <div className="auth-feature"><Sparkles size={18} /> <span>Free to join — no credit card needed</span></div>
              <div className="auth-feature"><Sparkles size={18} /> <span>Access all design tools instantly</span></div>
              <div className="auth-feature"><Sparkles size={18} /> <span>Two-factor security available</span></div>
            </div>
          </div>
        </motion.div>

        {/* Right panel - form */}
        <motion.div className="auth-form-panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <div className="auth-form-container">
            <div className="auth-header">
              <h1>Create Account</h1>
              <p>Fill in your details to get started</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" autoFocus />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Email Address</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="reg-pw">Password</label>
                  <div className="input-wrapper">
                    <Lock size={18} className="input-icon" />
                    <input id="reg-pw" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 chars" />
                    <button type="button" className="toggle-pw" onClick={() => setShowPw(!showPw)}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-confirm">Confirm</label>
                  <div className="input-wrapper">
                    <Lock size={18} className="input-icon" />
                    <input id="reg-confirm" type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter" />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? <div className="spinner-sm" /> : <>Create Account <ArrowRight size={18} /></>}
              </button>
            </form>

            <div className="auth-divider"><span>or</span></div>

            <a href="/api/auth/google" className="btn btn-google btn-block">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign up with Google
            </a>

            <p className="auth-footer">
              Already have an account? <Link to="/login">Sign in instead</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
