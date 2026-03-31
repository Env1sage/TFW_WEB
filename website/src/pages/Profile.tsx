import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Shield, ShieldOff, Lock, Save, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({ name, currentPassword: currentPw || undefined, newPassword: newPw || undefined });
      await refreshUser();
      setCurrentPw(''); setNewPw('');
      toast.success('Profile updated!');
    } catch (err: any) { toast.error(err.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const handleDisable2FA = async () => {
    if (disableCode.length !== 6) { toast.error('Enter 6-digit code'); return; }
    setDisabling2FA(true);
    try {
      await api.disable2FA(disableCode);
      await refreshUser();
      setShowDisable(false); setDisableCode('');
      toast.success('2FA disabled');
    } catch (err: any) { toast.error(err.message || 'Failed to disable 2FA'); }
    finally { setDisabling2FA(false); }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  if (!user) return null;

  return (
    <div className="profile-page">
      <div className="container">
        <motion.div className="page-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1>My Profile</h1>
        </motion.div>

        <div className="profile-grid">
          <motion.div className="profile-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="profile-avatar">
              <User size={40} />
            </div>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <span className={`badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>{user.role}</span>
          </motion.div>

          <div className="profile-sections">
            <motion.form className="section-card" onSubmit={handleSave} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h3><User size={18} /> Personal Info</h3>
              <div className="form-group">
                <label>Name</label>
                <div className="input-wrapper"><User size={18} /><input type="text" value={name} onChange={e => setName(e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <div className="input-wrapper"><Mail size={18} /><input type="email" value={user.email} disabled /></div>
              </div>

              <h3 style={{ marginTop: '1.5rem' }}><Lock size={18} /> Change Password</h3>
              <div className="form-group">
                <label>Current Password</label>
                <div className="input-wrapper"><Lock size={18} /><input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Leave blank to keep" /></div>
              </div>
              <div className="form-group">
                <label>New Password</label>
                <div className="input-wrapper"><Lock size={18} /><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters" /></div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <div className="spinner-sm" /> : <><Save size={16} /> Save Changes</>}
              </button>
            </motion.form>

            <motion.div className="section-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3><Shield size={18} /> Two-Factor Authentication</h3>
              <p className="section-desc">
                {user.twoFactorEnabled
                  ? 'Two-factor authentication is currently enabled on your account.'
                  : 'Add an extra layer of security to your account.'}
              </p>

              {user.twoFactorEnabled ? (
                <>
                  <div className="twofa-status enabled"><Shield size={18} /> Enabled</div>
                  {!showDisable ? (
                    <button className="btn btn-outline-danger" onClick={() => setShowDisable(true)}>
                      <ShieldOff size={16} /> Disable 2FA
                    </button>
                  ) : (
                    <div className="disable-2fa-form">
                      <input type="text" className="code-input" maxLength={6} value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))} placeholder="Enter 6-digit code" />
                      <div className="btn-row">
                        <button className="btn btn-danger" onClick={handleDisable2FA} disabled={disabling2FA}>
                          {disabling2FA ? <div className="spinner-sm" /> : 'Confirm Disable'}
                        </button>
                        <button className="btn btn-ghost" onClick={() => { setShowDisable(false); setDisableCode(''); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Link to="/2fa-setup" className="btn btn-primary"><Shield size={16} /> Enable 2FA</Link>
              )}
            </motion.div>

            <motion.div className="section-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <button className="btn btn-outline-danger btn-block" onClick={handleLogout}>
                <LogOut size={16} /> Sign Out
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
