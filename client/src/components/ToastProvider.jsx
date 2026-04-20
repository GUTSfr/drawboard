import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  const icons = { success: '✓', error: '✕', info: 'ℹ' };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span style={{ fontSize: 16 }}>{icons[t.type]}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
