const api = async (path, options = {}) => {
  const response = await fetch(`/api/luri-music/${path}`, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'Provider 凭证同步失败');
  return data;
};

export default class ProviderClient {
  constructor(config) { this.config = config; this.access = null; this.pending = null; }

  async authorization() {
    if (this.access && this.access.expiresAt > Date.now() + 15000) return this.access;
    if (!this.pending) this.pending = api(`providers/${this.config.id}/token`, { method: 'POST', body: '{}' }).then((data) => ({ token: data.accessToken, endpoints: data.endpoints, expiresAt: Date.now() + Math.max(30, Number(data.expiresIn) || 900) * 1000 })).finally(() => { this.pending = null; });
    this.access = await this.pending; return this.access;
  }

  async request(kind, params = {}, signal) {
    const access = await this.authorization(); const endpoints = access.endpoints || {}; let target; let options = { signal, headers: { authorization: `Bearer ${access.token}`, accept: 'application/json' } };
    if (kind === 'search' || kind === 'random') { target = new URL(endpoints[kind]); Object.entries(params).forEach(([key, value]) => value !== undefined && value !== '' && target.searchParams.set(key, String(value))); }
    else if (kind === 'resolve') { target = new URL(endpoints.resolve); options = { ...options, method: 'POST', headers: { ...options.headers, 'content-type': 'application/json' }, body: JSON.stringify(params) }; }
    else {
      target = new URL(endpoints[kind].replace('{id}', encodeURIComponent(params.id || '')));
      Object.entries(params).filter(([key]) => key !== 'id').forEach(([key, value]) => value !== undefined && value !== '' && target.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value)));
    }
    let response = await fetch(target, options);
    if (response.status === 401) { this.access = null; const renewed = await this.authorization(); options.headers.authorization = `Bearer ${renewed.token}`; response = await fetch(target, options); }
    return response;
  }
}
