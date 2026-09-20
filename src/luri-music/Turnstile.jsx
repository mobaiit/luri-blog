import { useEffect, useRef, useState } from 'react';
import './turnstile.css';

export default function Turnstile() {
  const container = useRef(null); const widgetId = useRef(null); const hidden = useRef(null); const [status, setStatus] = useState('正在加载安全验证…');
  useEffect(() => {
    let disposed = false;
    const renderWidget = async () => {
      try {
        const response = await fetch('/api/luri-music/auth/me', { credentials: 'same-origin' }); const { turnstileSiteKey } = await response.json();
        if (disposed || !container.current || !turnstileSiteKey || !window.turnstile) { if (!disposed) setStatus('安全验证暂不可用，请刷新页面'); return; }
        if (widgetId.current !== null) { window.turnstile.reset(widgetId.current); return; }
        widgetId.current = window.turnstile.render(container.current, { sitekey: turnstileSiteKey, theme: 'auto', callback: (token) => { hidden.current.value = token; setStatus(''); }, 'error-callback': () => { hidden.current.value = ''; setStatus('安全验证加载失败，请刷新后重试'); }, 'expired-callback': () => { hidden.current.value = ''; setStatus('安全验证已过期，请重新完成验证'); } }); setStatus('');
      } catch { if (!disposed) setStatus('安全验证加载失败，请刷新后重试'); }
    };
    const existing = document.querySelector('script[data-turnstile="true"]');
    if (window.turnstile) renderWidget();
    else if (existing) { if (existing.dataset.loaded === 'true') renderWidget(); else existing.addEventListener('load', renderWidget, { once: true }); }
    else { const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.defer = true; script.dataset.turnstile = 'true'; script.addEventListener('load', () => { script.dataset.loaded = 'true'; renderWidget(); }, { once: true }); script.addEventListener('error', () => setStatus('安全验证加载失败，请检查网络后重试'), { once: true }); document.head.appendChild(script); }
    return () => { disposed = true; if (widgetId.current !== null && window.turnstile) window.turnstile.remove(widgetId.current); };
  }, []);
  return <div className="luri-turnstile-wrap"><input ref={hidden} type="hidden" name="turnstileToken" /><div ref={container} className="luri-turnstile" />{status && <small>{status}</small>}</div>;
}
