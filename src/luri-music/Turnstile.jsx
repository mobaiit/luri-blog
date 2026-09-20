import { useEffect, useRef } from 'react';
import './turnstile.css';

export default function Turnstile({ siteKey, onVerify, onExpire, resetSignal }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  useEffect(() => {
    if (!siteKey) return undefined;
    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) { window.turnstile.reset(widgetIdRef.current); return; }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token) => onVerify(token),
        'error-callback': () => onVerify(''),
        'expired-callback': () => { onVerify(''); onExpire?.(); },
      });
    };
    const existingScript = document.querySelector('script[data-turnstile="true"]');
    if (window.turnstile) renderWidget();
    else if (existingScript) {
      const handleLoad = () => renderWidget();
      if (existingScript.dataset.loaded === 'true') renderWidget();
      else existingScript.addEventListener('load', handleLoad);
      return () => existingScript.removeEventListener('load', handleLoad);
    } else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true; script.dataset.turnstile = 'true';
      const handleLoad = () => { script.dataset.loaded = 'true'; renderWidget(); };
      script.addEventListener('load', handleLoad); document.head.appendChild(script);
      return () => script.removeEventListener('load', handleLoad);
    }
    return () => { if (widgetIdRef.current && window.turnstile) { window.turnstile.remove(widgetIdRef.current); widgetIdRef.current = null; } };
  }, [siteKey, onExpire, onVerify]);
  useEffect(() => {
    if (resetSignal === undefined) return;
    if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    onVerify('');
  }, [resetSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="luri-turnstile-wrap"><div ref={containerRef} /></div>;
}
