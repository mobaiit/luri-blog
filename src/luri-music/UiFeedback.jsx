import { useEffect } from 'react';

export function Spinner({ label = '加载中' }) {
  return <span className="ui-spinner" role="status" aria-label={label} />;
}

export function LoadingScreen({ label = '加载中…' }) {
  return <div className="ui-loading"><Spinner /><span>{label}</span></div>;
}

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);
  if (!toast) return null;
  return <div className={`ui-toast ${toast.type || 'info'}`} role="status"><b>{toast.title}</b>{toast.message && <span>{toast.message}</span>}<button onClick={onClose} aria-label="关闭">×</button></div>;
}
