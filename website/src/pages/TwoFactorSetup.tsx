import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Copy, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';

export default function TwoFactorSetup() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.twoFactorEnabled) { navigate('/profile'); return; }
    api.setup2FA().then(res => {
      setQrCode(res.qrCode);
      setSecret(res.secret);
    }).catch(() => toast.error('Failed to setup 2FA'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { toast.error('Enter 6-digit code'); return; }
    setVerifying(true);
    try {
      await api.confirm2FA(code);
      await refreshUser();
      toast.success('2FA enabled successfully!');
      navigate('/profile');
    } catch (err: any) {
      toast.error(err.message || 'Invalid code');
    } finally { setVerifying(false); }
  };

  return (
    <div className="auth-page">
      <motion.div className="auth-card wide" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        <div className="auth-header">
          <motion.div className="auth-icon" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
            <Shield size={28} />
          </motion.div>
          <h1>Setup Two-Factor Auth</h1>
          <p>Scan the QR code with your authenticator app</p>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <div className="twofa-setup">
            <div className="qr-section">
              <img src={qrCode} alt="2FA QR Code" className="qr-image" />
              <div className="secret-row">
                <code>{secret}</code>
                <button className="icon-btn" onClick={handleCopy}>
                  {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <p className="help-text">Can&apos;t scan? Enter this secret manually in your authenticator app.</p>
            </div>

            <form onSubmit={handleConfirm} className="verify-section">
              <label>Enter 6-digit verification code</label>
              <input type="text" className="code-input" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" autoFocus />
              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={verifying}>
                {verifying ? <div className="spinner-sm" /> : 'Enable 2FA'}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
