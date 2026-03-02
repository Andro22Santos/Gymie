import React, { createContext, useContext, useState, useCallback } from 'react';
import { Check, X, Info, AlertTriangle } from 'lucide-react';

const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success', duration = 2800) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p.slice(-3), { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), duration);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-0 right-0 z-[300] flex flex-col items-center gap-2 pointer-events-none px-4">
          {toasts.map(t => <ToastBubble key={t.id} {...t} />)}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

const CFG = {
  success: { Icon: Check,         cls: 'border-gymie/50 bg-gymie/15 text-gymie' },
  error:   { Icon: X,             cls: 'border-danger/50 bg-danger/15 text-danger' },
  info:    { Icon: Info,          cls: 'border-info/50 bg-info/15 text-info' },
  warning: { Icon: AlertTriangle, cls: 'border-warning/50 bg-warning/15 text-warning' },
};

function ToastBubble({ message, type }) {
  const { Icon, cls } = CFG[type] || CFG.success;
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-gymie border backdrop-blur-xl shadow-2xl animate-slide-down ${cls}`}>
      <Icon size={14} />
      <span className="text-sm font-medium text-txt-primary">{message}</span>
    </div>
  );
}
