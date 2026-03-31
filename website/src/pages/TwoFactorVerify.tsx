import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function TwoFactorVerify() {
  const { verify2FA } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tempToken = params.get('tempToken') || '';
  const redirect = params.get('redirect') || '/';

  const ADMIN_ROLES = ['admin', 'super_admin', 'product_manager', 'order_manager'];

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { toast.error('Enter 6-digit code'); return; }
    setLoading(true);
    try {
      const result = await verify2FA(tempToken, code);
      toast.success('Verified! Welcome back.');
      if (result?.role && ADMIN_ROLES.includes(result.role)) {
        navigate('/admin', { replace: true });
      } else {
        navigate(redirect);
      }
    } catch (err: any) {
      toast.error(err.message || 'Invalid code');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <motion.div className="auth-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        <div className="auth-header">
          <motion.div className="auth-icon" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
            <ShieldCheck size={28} />
          </motion.div>
          <h1>Two-Factor Verification</h1>
          <p>Enter the 6-digit code from your authenticator app</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <input type="text" className="code-input" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" autoFocus />
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <div className="spinner-sm" /> : 'Verify & Sign In'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
