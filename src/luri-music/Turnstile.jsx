import { useEffect, useRef } from 'react';
import './turnstile.css';

export default function Turnstile({ siteKey, onVerify, onExpire, resetSignal = 0 }) {
  const containerRef = useRef(null); const widgetIdRef = useRef(null);
  useEffect(() => {
    if (!siteKey) return undefined;
    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current !== null) { window.turnstile.reset(widgetIdRef.current); return; }
      widgetIdRef.current = window.turnstile.render(containerRef.current, { sitekey: siteKey, theme: 'auto', callback: onVerify, 'error-callback': () => onVerify(''), 'expired-callback': () => { onVerify(''); onExpire?.(); } });
    };
    const existing = document.querySelector('script[data-turnstile="true"]');
    if (window.turnstile) renderWidget();
    else if (existing) { if (existing.dataset.loaded === 'true') renderWidget(); else existing.addEventListener('load', renderWidget); }
    else { const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.defer = true; script.dataset.turnstile = 'true'; script.addEventListener('load', () => { script.dataset.loaded = 'true'; renderWidget(); }, { once: true }); document.head.appendChild(script); }
    return () => { if (existing) existing.removeEventListener('load', renderWidget); if (widgetIdRef.current !== null && window.turnstile) { window.turnstile.remove(widgetIdRef.current); widgetIdRef.current = null; } };
  }, [siteKey, onVerify, onExpire]);
  useEffect(() => { if (widgetIdRef.current !== null && window.turnstile) window.turnstile.reset(widgetIdRef.current); }, [resetSignal]);
  return <div className="luri-turnstile"><div ref={containerRef} /></div>;
}
