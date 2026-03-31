import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '../api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ requires2FA?: boolean; tempToken?: string; role?: string }>;
  verify2FA: (tempToken: string, code: string) => Promise<{ role?: string }>;
  register: (name: string, email: string, password: string) => Promise<void>;
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

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res.requires2FA) return { requires2FA: true, tempToken: res.tempToken };
    if (res.token) {
      localStorage.setItem('tfw_token', res.token);
      setUser(res.user);
    }
    return { role: res.user?.role as string | undefined };
  };

  const verify2FA = async (tempToken: string, code: string) => {
    const res = await api.verify2FA(tempToken, code);
    localStorage.setItem('tfw_token', res.token);
    setUser(res.user);
    return { role: res.user?.role as string | undefined };
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.register(name, email, password);
    localStorage.setItem('tfw_token', res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('tfw_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verify2FA, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
