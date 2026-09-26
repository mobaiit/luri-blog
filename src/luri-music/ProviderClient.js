const api = async (path, options = {}) => {
  const response = await fetch(`/api/luri-music/${path}`, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Provider 凭证同步失败');
    error.status = response.status;
    error.code = data.code || (response.status === 401 || response.status === 403 ? 'provider_access_denied' : 'provider_request_failed');
    throw error;
  }
  return data;
};

const PROVIDER_REQUEST_TIMEOUT_MS = 60 * 1000;
const PLAYBACK_CACHE_SAFETY_MS = 5 * 1000;
const isRefreshRequest = (value) => value === true || value === 1 || value === '1' || value === 'url' || value === 'decode';
const providerCache = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const requestDeadline = (signal) => {
  const controller = new AbortController(); let timedOut = false;
  const relayAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) relayAbort(); else signal?.addEventListener('abort', relayAbort, { once: true });
  const timer = globalThis.setTimeout(() => { timedOut = true; controller.abort(); }, PROVIDER_REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    clear: () => { globalThis.clearTimeout(timer); signal?.removeEventListener('abort', relayAbort); },
  };
};
const waitForSignal = (promise, signal) => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason || new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const aborted = () => { cleanup(); reject(signal.reason || new DOMException('Aborted', 'AbortError')); };
    const cleanup = () => signal.removeEventListener('abort', aborted);
    signal.addEventListener('abort', aborted, { once: true });
    promise.then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
};

const throwProviderError = async (response) => {
  if (response.status !== 401 && response.status !== 403) return response;
  const data = await response.clone().json().catch(() => ({}));
  const error = new Error(data.error?.message || data.error || 'Provider 没有访问权限');
  error.status = response.status;
  error.code = 'provider_access_denied';
  throw error;
};

export default class ProviderClient {
  constructor(config, onStatusChange) { this.config = config; this.onStatusChange = onStatusChange; this.access = null; this.pending = null; }

  cacheKey(kind, params) {
    if (!['resolve', 'lyrics', 'artwork'].includes(kind) || !params.songId) return '';
    return `luri.provider-cache.v2:${this.config.id}:${kind}:${params.songId}:${kind === 'resolve' ? params.quality || 'auto' : ''}`;
  }

  cachedResponse(key, refresh) {
    if (!key) return null;
    try {
      const storage = providerCache();
      if (!storage) return null;
      if (refresh) { storage.removeItem(key); return null; }
      const entry = JSON.parse(storage.getItem(key) || 'null');
      if (!entry || entry.expiresAt <= Date.now()) { storage.removeItem(key); return null; }
      const body = { ...entry.body };
      if (entry.kind === 'resolve' && body.url) body.expiresIn = Math.max(1, Math.floor((entry.expiresAt - Date.now()) / 1000));
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', 'x-luri-cache': 'local' } });
    } catch { return null; }
  }

  rememberResponse(key, kind, response) {
    if (!key || !response.ok) return;
    response.clone().json().then((payload) => {
      const useful = kind === 'resolve' ? payload.url : kind === 'artwork' ? payload.url : payload.lyrics || payload.translation;
      if (!useful) return;
      const now = Date.now();
      let expiresAt = now + 3600 * 1000;
      if (kind === 'resolve') {
        const reportedExpiry = Date.parse(payload.expiresAt || '');
        const ttlExpiry = now + Math.max(1, Number(payload.expiresIn) || 60) * 1000;
        expiresAt = Math.min(Number.isFinite(reportedExpiry) && reportedExpiry > now ? reportedExpiry : ttlExpiry, ttlExpiry) - PLAYBACK_CACHE_SAFETY_MS;
        if (expiresAt <= now) return;
      }
      try { providerCache()?.setItem(key, JSON.stringify({ kind, expiresAt, body: payload })); } catch { /* Local storage may be unavailable. */ }
    }).catch(() => {});
  }

  async authorization(signal) {
    if (this.access && this.access.expiresAt > Date.now() + 15000) return this.access;
    if (!this.pending) {
      const deadline = requestDeadline();
      this.pending = api(`providers/${this.config.id}/token`, { method: 'POST', body: '{}', signal: deadline.signal })
        .then((data) => { if (this.config.status !== (data.account?.status || 'active')) this.onStatusChange?.(); const access = { token: data.accessToken || '', authorization: data.authorization || null, endpoints: data.endpoints, capabilities: Array.isArray(data.capabilities) ? data.capabilities : [], expiresAt: Date.now() + Math.max(30, Number(data.expiresIn) || 900) * 1000 }; this.access = access; return access; })
        .catch((error) => { if (!deadline.timedOut()) throw error; const timeout = new Error('Provider 授权请求超时（60 秒）'); timeout.code = 'provider_timeout'; timeout.status = 504; throw timeout; })
        .finally(() => { deadline.clear(); this.pending = null; });
    }
    this.access = await waitForSignal(this.pending, signal); return this.access;
  }

  async request(kind, params = {}, signal) {
    const cacheKey = this.cacheKey(kind, params);
    const cached = this.cachedResponse(cacheKey, isRefreshRequest(params.refresh));
    if (cached) return cached;
    const deadline = requestDeadline(signal);
    try {
      const access = await this.authorization(deadline.signal); const endpoints = access.endpoints || {}; let target; const headers = { accept: 'application/json' };
      const endpoint = endpoints[kind] || '';
      if (!endpoint) return new Response(JSON.stringify({ error: `当前 Provider 不支持 ${kind} 能力` }), { status: 501, headers: { 'content-type': 'application/json' } });
      if (access.authorization?.header) headers[access.authorization.header] = `${access.authorization.prefix || ''}${access.token}`;
      else if (access.token) headers.authorization = `Bearer ${access.token}`;
      let options = { signal: deadline.signal, headers };
      if (kind === 'search' || kind === 'random' || kind === 'charts') { target = new URL(endpoint); Object.entries(params).forEach(([key, value]) => value !== undefined && value !== '' && target.searchParams.set(key, String(value))); }
      else if (kind === 'resolve') { target = new URL(endpoints.resolve); options = { ...options, method: 'POST', headers: { ...options.headers, 'content-type': 'application/json' }, body: JSON.stringify(params) }; }
      else {
        target = new URL(endpoints[kind].replace(/\{(?:songId|id)\}/, encodeURIComponent(params.songId || '')));
        Object.entries(params).filter(([key]) => key !== 'songId').forEach(([key, value]) => value !== undefined && target.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value)));
      }
      let response = await fetch(target, options);
      if (response.status === 401) { this.access = null; const renewed = await this.authorization(deadline.signal); delete options.headers.authorization; if (renewed.authorization?.header) options.headers[renewed.authorization.header] = `${renewed.authorization.prefix || ''}${renewed.token}`; else if (renewed.token) options.headers.authorization = `Bearer ${renewed.token}`; response = await fetch(target, options); }
      response = await throwProviderError(response);
      this.rememberResponse(cacheKey, kind, response);
      return response;
    } catch (error) {
      if (!deadline.timedOut()) throw error;
      const timeout = new Error('Provider 请求超时（60 秒）'); timeout.code = 'provider_timeout'; timeout.status = 504; throw timeout;
    } finally { deadline.clear(); }
  }
}
