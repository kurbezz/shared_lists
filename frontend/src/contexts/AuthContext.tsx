import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';

import { AuthContext } from './authContext.types';
import type { AuthContextType } from './authContext.types';


interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<User | null>(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        return {
          id: payload.sub,
          twitch_id: payload.twitch_id,
          username: payload.username,
          created_at: '',
          updated_at: '',
        };
      } catch (error) {
        console.error('Failed to decode stored token:', error);
        localStorage.removeItem('auth_token');
      }
    }
    return null;
  });
  const isLoading = false;

  const refreshUser = async () => {
    try {
      // dynamic import to avoid circular dependency issues
      const { apiClient } = await import('../api/client');
      const data = await apiClient.getCurrentUser();
      setUser(data);
    } catch (e) {
      console.error('Failed to refresh user:', e);
    }
  };

  useEffect(() => {
    // Already initialized from localStorage in useState initializers
    // This effect is now empty or can be removed if not needed for anything else.
  }, []);

  const login = useCallback((newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);

    try {
      const payload = JSON.parse(atob(newToken.split('.')[1]));
      setUser({
        id: payload.sub,
        twitch_id: payload.twitch_id,
        username: payload.username,
        created_at: '',
        updated_at: '',
      });
    } catch (error) {
      console.error('Failed to decode token:', error);
    }

    // try to refresh full user info after login
    (async () => {
      try {
        await refreshUser();
      } catch {
        // ignore
      }
    })();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
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
  }), [user, token, login, logout, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};