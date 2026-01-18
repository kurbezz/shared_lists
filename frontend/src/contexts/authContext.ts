import React from 'react';

import type { User } from '../types';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshUser?: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextType | undefined>(undefined);
