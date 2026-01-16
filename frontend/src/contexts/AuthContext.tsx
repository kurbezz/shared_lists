import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

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
      } catch (e) {
        console.error('Failed to decode stored token:', e);
        localStorage.removeItem('auth_token');
      }
    }
    return null;
  });
  const isLoading = false;

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
  }), [user, token, login, logout, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};