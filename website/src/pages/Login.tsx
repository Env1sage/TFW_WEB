import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ArrowRight, RotateCcw, Sparkles, Shield, Truck, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ADMIN_ROLES = ['admin', 'super_admin', 'product_manager', 'order_manager'];

export default function Login() {
  const { sendOtp, verifyOtp, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [bypassOtp, setBypassOtp] = useState<string | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      toast.error('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await sendOtp(cleaned);
      setSessionId(res.sessionId);
      setPhone(cleaned);
      setStep('otp');
      setResendCooldown(30);
      if (res.bypassOtp) {
        setBypassOtp(res.bypassOtp);
        setOtp(res.bypassOtp.split(''));
        toast.success('Use OTP: ' + res.bypassOtp + ' (test mode)');
      } else {
        toast.success('OTP sent to +91 ' + cleaned);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (idx: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (digits.length === 6) {
      setOtp(digits.split(''));
      otpRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await verifyOtp(sessionId, code);
      if (res.isNewUser) toast.success('Welcome to TheFramedWall!');
      else toast.success('Welcome back!');
      if (res.role && ADMIN_ROLES.includes(res.role)) {
        navigate('/admin', { replace: true });
      } else {
        navigate(redirect, { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || 'Incorrect OTP');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const res = await sendOtp(phone);
      setSessionId(res.sessionId);
      setResendCooldown(30);
      if (res.bypassOtp) {
        setBypassOtp(res.bypassOtp);
        setOtp(res.bypassOtp.split(''));
        toast.success('Use OTP: ' + res.bypassOtp + ' (test mode)');
      } else {
        setOtp(['', '', '', '', '', '']);
        toast.success('New OTP sent');
        otpRefs.current[0]?.focus();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-split">
        {/* Left decorative panel */}
        <motion.div className="auth-panel" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55 }}>
          <div className="auth-panel-content">
            <div className="auth-panel-brand">
              <div className="brand-icon">T</div>
              <span>TheFramedWall</span>
            </div>
            <h2>Your creative studio awaits</h2>
            <p>Design custom products, manage your orders, and bring your ideas to life with premium quality printing.</p>
            <div className="auth-panel-features">
              <div className="auth-feature"><Sparkles size={18} /> <span>Live design preview</span></div>
              <div className="auth-feature"><Shield size={18} /> <span>Secure OTP login — no passwords</span></div>
              <div className="auth-feature"><Truck size={18} /> <span>Pan-India delivery</span></div>
            </div>
          </div>
        </motion.div>

        {/* Right form panel */}
        <motion.div className="auth-form-panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, delay: 0.1 }}>
          <div className="auth-form-container">
            <AnimatePresence mode="wait">
              {step === 'phone' ? (
                <motion.div key="phone" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
                  <div className="auth-header">
                    <div className="auth-otp-icon"><Phone size={28} /></div>
                    <h1>Sign In</h1>
                    <p>Enter your mobile number to receive a one-time password</p>
                  </div>

                  <form onSubmit={handleSendOtp} className="auth-form">
                    <div className="form-group">
                      <label htmlFor="phone">Mobile Number</label>
                      <div className="input-wrapper">
                        <span className="input-prefix">+91</span>
                        <input
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={phone}
                          onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="98765 43210"
                          autoFocus
                          className="phone-input"
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading || phone.replace(/\D/g, '').length !== 10}>
                      {loading ? <div className="spinner-sm" /> : <>Get OTP <ArrowRight size={18} /></>}
                    </button>
                  </form>

                  <p className="auth-footer" style={{ marginTop: 24 }}>
                    By continuing, you agree to our <a href="/terms" target="_blank">Terms</a> &amp; <a href="/privacy" target="_blank">Privacy Policy</a>
                  </p>
                </motion.div>
              ) : (
                <motion.div key="otp" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
                  <div className="auth-header">
                    <div className="auth-otp-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary)' }}>
                      <Shield size={28} />
                    </div>
                    <h1>Enter OTP</h1>
                    <p>
                      Sent to <strong>+91 {phone}</strong>{' '}
                      <button type="button" className="change-phone-btn" onClick={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); }}>
                        Change
                      </button>
                    </p>
                  </div>

                  {bypassOtp && (
                    <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#854d0e', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Lock size={14} /> Test mode — OTP auto-filled: <strong>{bypassOtp}</strong>
                    </div>
                  )}

                  <form onSubmit={handleVerify} className="auth-form">
                    <div className="otp-boxes" onPaste={handleOtpPaste}>
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          ref={el => { otpRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={e => handleOtpChange(i, e.target.value)}
                          onKeyDown={e => handleOtpKeyDown(i, e)}
                          className="otp-box"
                          autoComplete="one-time-code"
                        />
                      ))}
                    </div>

                    <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading || otp.join('').length !== 6}>
                      {loading ? <div className="spinner-sm" /> : <>Verify &amp; Continue <ArrowRight size={18} /></>}
                    </button>
                  </form>

                  <div className="resend-row">
                    {resendCooldown > 0 ? (
                      <span className="resend-timer">Resend OTP in {resendCooldown}s</span>
                    ) : (
                      <button type="button" className="resend-btn" onClick={handleResend} disabled={loading}>
                        <RotateCcw size={14} /> Resend OTP
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
