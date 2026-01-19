import { useContext } from 'react';
import { AuthContext } from './authContext.types';
import type { AuthContextType } from './authContext.types';

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
