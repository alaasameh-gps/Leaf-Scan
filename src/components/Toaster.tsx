"use client";
import React, { createContext, useContext, useState, useCallback } from 'react';

type Toast = { id: string; title: string; message?: string; type?: 'info'|'success'|'error' };

const ToasterContext = createContext<any>(null);

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast,'id'>) => {
    const toast: Toast = { id: String(Date.now()) + Math.random().toString(36).slice(2), ...t };
    setToasts((s) => [...s, toast]);
    setTimeout(() => setToasts((s) => s.filter(x => x.id !== toast.id)), 5000);
  }, []);

  return (
    <ToasterContext.Provider value={{ push }}>
      {children}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`p-4 rounded-xl shadow-xl text-white text-sm animate-[fadeIn_.2s_ease] ${
              t.type === 'error' ? 'bg-red-600' : t.type === 'success' ? 'bg-green-600' : 'bg-gray-800'
            }`}
          >
            <div className="font-semibold mb-0.5">{t.title}</div>
            {t.message && <div className="opacity-90 text-xs leading-relaxed">{t.message}</div>}
          </div>
        ))}
      </div>
    </ToasterContext.Provider>
  );
}

export function useToaster() {
  return useContext(ToasterContext);
}

export default ToasterProvider;