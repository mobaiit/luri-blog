import { useEffect, useRef } from 'react';

const META = {
  info: { label: '提示', duration: 4200 },
  success: { label: '已完成', duration: 3600 },
  warning: { label: '请注意', duration: 5600 },
  error: { label: '操作失败', duration: 6800 },
};

function FeedbackIcon({ type }) {
  if (type === 'success') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7" /></svg>;
  if (type === 'warning') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4.5M12 17h.01" /></svg>;
  if (type === 'error') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></svg>;
}

export function Spinner({ label = '加载中' }) {
  return <span className="ui-spinner" role="status" aria-label={label} />;
}

export function LoadingScreen({ label = '加载中…' }) {
  return <div className="ui-loading"><Spinner /><span>{label}</span></div>;
}

export function Toast({ toast, onClose }) {
  const type = META[toast?.type] ? toast.type : 'info';
  const duration = toast?.duration || META[type].duration;
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => closeRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [toast, duration]);
  if (!toast) return null;
  return <div className={`ui-toast ui-toast--${type}`} role={type === 'error' || type === 'warning' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'} aria-atomic="true" style={{ '--ui-toast-duration': `${duration}ms` }}>
    <span className="ui-toast__icon"><FeedbackIcon type={type} /></span>
    <span className="ui-toast__content"><small>{META[type].label}</small><b>{toast.title}</b>{toast.message && <span>{toast.message}</span>}</span>
    <button className="ui-toast__close" type="button" onClick={onClose} aria-label="关闭通知"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8" /></svg></button>
    <i className="ui-toast__progress" aria-hidden="true" />
  </div>;
}

export function ConfirmDialog({ open, title, message, confirmLabel = '确认', cancelLabel = '取消', tone = 'warning', busy = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);
  if (!open) return null;
  const type = tone === 'error' ? 'error' : 'warning';
  return <div className="ui-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className={`ui-confirm ui-confirm--${type}`} role="alertdialog" aria-modal="true" aria-labelledby="ui-confirm-title" aria-describedby="ui-confirm-message">
      <span className="ui-confirm__icon"><FeedbackIcon type={type} /></span>
      <div><small>{META[type].label}</small><h2 id="ui-confirm-title">{title}</h2><p id="ui-confirm-message">{message}</p></div>
      <footer><button type="button" onClick={onCancel} disabled={busy} autoFocus>{cancelLabel}</button><button type="button" className="ui-confirm__primary" onClick={onConfirm} disabled={busy}>{busy ? '处理中…' : confirmLabel}</button></footer>
    </section>
  </div>;
}
