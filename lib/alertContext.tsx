'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { alertApi } from './api';

interface AlertContextValue {
  unreadCount: number;
  refresh: () => void;
}

const AlertContext = createContext<AlertContextValue>({ unreadCount: 0, refresh: () => {} });

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = async () => {
    try {
      const res = await alertApi.getAll();
      const count = (res.data as any[]).filter((a: any) => !a.is_read).length;
      setUnreadCount(count);
    } catch {}
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <AlertContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </AlertContext.Provider>
  );
}

export const useAlertCount = () => useContext(AlertContext);
