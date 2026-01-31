import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { User } from '../types';
import { AuthContext, type AuthContextType } from './auth-context';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Token is no longer stored in localStorage (httpOnly cookie flow). Keep token state null.
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiClient.getCurrentUser();
      setUser(data);
    } catch (e) {
      console.error('Failed to refresh user:', e);
    }
  }, []);

  // On mount, try to refresh user (backend will check cookie)
  useEffect(() => {
    (async () => {
      await refreshUser();
    })();
  }, [refreshUser]);

  // login no longer accepts token; backend sets cookie during OAuth flow. Provide a no-op login to satisfy callers.
  const login = useCallback(() => {
    // no-op: token is set via httpOnly cookie by backend
    (async () => {
      try {
        await refreshUser();
      } catch {
        // ignore
      }
    })();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token,
    isLoading,
    refreshUser,
  }), [user, token, login, logout, isLoading, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
