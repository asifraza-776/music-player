import React from 'react';
import { useUI } from '../context/UIContext';

export default function ToastContainer() {
  const { toasts } = useUI();

  if (!toasts || toasts.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return 'fa-check-circle';
      case 'warning':
        return 'fa-door-open';
      case 'error':
        return 'fa-times-circle';
      default:
        return 'fa-info-circle';
    }
  };

  return (
    <div id="toastContainer" className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item toast-${toast.type || 'info'} ${toast.leaving ? 'toast-leave' : ''}`}
        >
          <i className={`fas ${getIcon(toast.type)}`}></i>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.3 }}>{toast.title}</span>
            {toast.subtitle && (
              <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px', color: 'rgba(255, 255, 255, 0.85)' }}>
                {toast.subtitle}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
