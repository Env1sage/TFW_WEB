import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '../api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<{ sessionId: string }>;
  verifyOtp: (sessionId: string, otp: string) => Promise<{ isNewUser: boolean; role?: string }>;
  login: (email: string, password: string) => Promise<{ role?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('tfw_token');
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const u = await api.getProfile();
      setUser(u);
    } catch {
      localStorage.removeItem('tfw_token');
      setUser(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const sendOtp = async (phone: string) => {
    return api.sendOtp(phone);
  };

  const verifyOtp = async (sessionId: string, otp: string) => {
    const res = await api.verifyOtp(sessionId, otp);
    localStorage.setItem('tfw_token', res.token);
    setUser(res.user);
    return { isNewUser: res.isNewUser, role: res.user?.role };
  };

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem('tfw_token', res.token);
    setUser(res.user);
    return { role: res.user?.role };
  };

  const logout = () => {
    localStorage.removeItem('tfw_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, sendOtp, verifyOtp, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
