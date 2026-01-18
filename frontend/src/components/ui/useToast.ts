import { useContext } from 'react';

import type { ToastContextType } from './toastTypes';
import { ToastContext } from './toastTypes';

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
