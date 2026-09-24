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
    if (!['resolve', 'lyrics', 'artwork'].includes(kind) || !params.songId && !params.id) return '';
    return `luri.provider-cache.v1:${this.config.id}:${kind}:${params.songId || params.id}:${kind === 'resolve' ? params.quality || 'auto' : ''}`;
  }

  cachedResponse(key, refresh) {
    if (!key) return null;
    try {
      if (refresh) { sessionStorage.removeItem(key); return null; }
      const entry = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (!entry || entry.expiresAt <= Date.now()) { sessionStorage.removeItem(key); return null; }
      return new Response(JSON.stringify(entry.body), { status: 200, headers: { 'content-type': 'application/json', 'x-luri-cache': 'session' } });
    } catch { return null; }
  }

  rememberResponse(key, kind, response) {
    if (!key || !response.ok) return;
    response.clone().json().then((payload) => {
      const useful = kind === 'resolve' ? payload.url : kind === 'artwork' ? payload.url : payload.lyrics || payload.translation;
      if (!useful) return;
      const ttl = kind === 'resolve' ? Math.max(5, Number(payload.expiresIn) || 60) : 3600;
      try { sessionStorage.setItem(key, JSON.stringify({ expiresAt: Date.now() + ttl * 1000, body: payload })); } catch { /* Session storage may be unavailable. */ }
    }).catch(() => {});
  }

  async authorization() {
    if (this.access && this.access.expiresAt > Date.now() + 15000) return this.access;
    if (!this.pending) this.pending = api(`providers/${this.config.id}/token`, { method: 'POST', body: '{}' }).then((data) => { if (this.config.status !== (data.account?.status || 'active')) this.onStatusChange?.(); return { token: data.accessToken || '', authorization: data.authorization || null, endpoints: data.endpoints, expiresAt: Date.now() + Math.max(30, Number(data.expiresIn) || 900) * 1000 }; }).finally(() => { this.pending = null; });
    this.access = await this.pending; return this.access;
  }

  async request(kind, params = {}, signal) {
    const cacheKey = this.cacheKey(kind, params);
    const cached = this.cachedResponse(cacheKey, params.refresh === true || params.refresh === 1 || params.refresh === '1');
    if (cached) return cached;
    const access = await this.authorization(); const endpoints = access.endpoints || {}; let target; const headers = { accept: 'application/json' };
    const endpoint = endpoints[kind] || (kind === 'charts' ? new URL('/v1/catalog/charts', this.config.providerUrl).href : '');
    if (!endpoint) return new Response(JSON.stringify({ error: `当前 Provider 不支持 ${kind} 能力` }), { status: 501, headers: { 'content-type': 'application/json' } });
    if (access.authorization?.header) headers[access.authorization.header] = `${access.authorization.prefix || ''}${access.token}`;
    else if (access.token) headers.authorization = `Bearer ${access.token}`;
    let options = { signal, headers };
    if (kind === 'search' || kind === 'random' || kind === 'charts') { target = new URL(endpoint); Object.entries(params).forEach(([key, value]) => value !== undefined && value !== '' && target.searchParams.set(key, String(value))); }
    else if (kind === 'resolve') { target = new URL(endpoints.resolve); options = { ...options, method: 'POST', headers: { ...options.headers, 'content-type': 'application/json' }, body: JSON.stringify(params) }; }
    else {
      target = new URL(endpoints[kind].replace('{id}', encodeURIComponent(params.id || '')));
      Object.entries(params).filter(([key]) => key !== 'id').forEach(([key, value]) => value !== undefined && value !== '' && target.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value)));
    }
    let response = await fetch(target, options);
    if (response.status === 401) { this.access = null; const renewed = await this.authorization(); delete options.headers.authorization; if (renewed.authorization?.header) options.headers[renewed.authorization.header] = `${renewed.authorization.prefix || ''}${renewed.token}`; else if (renewed.token) options.headers.authorization = `Bearer ${renewed.token}`; response = await fetch(target, options); }
    response = await throwProviderError(response);
    this.rememberResponse(cacheKey, kind, response);
    return response;
  }
}
