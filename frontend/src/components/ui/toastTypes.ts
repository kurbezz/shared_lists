import React from 'react';

export type Toast = {
  id: string;
  message: string;
};

export type ToastContextType = {
  notify: (message: string, ms?: number) => void;
};

export const ToastContext = React.createContext<ToastContextType | undefined>(undefined);
