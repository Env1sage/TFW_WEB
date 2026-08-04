import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Save, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) { setName(user.name); setEmail(user.email ?? ''); }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({ name, email: email || undefined, currentPassword: currentPw || undefined, newPassword: newPw || undefined });
      await refreshUser();
      setCurrentPw(''); setNewPw('');
      toast.success('Profile updated!');
    } catch (err: any) {
      const msg = err.message || 'Update failed';
      if (msg.includes('email_key') || msg.includes('unique') || msg.includes('duplicate')) {
        toast.error('This email is already linked to another account.');
      } else {
        toast.error(msg);
      }
    }
    finally { setSaving(false); }
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
            <p>{user.phone ? `+91 ${user.phone}` : user.email || ''}</p>
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
                <div className="input-wrapper"><Mail size={18} /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
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
