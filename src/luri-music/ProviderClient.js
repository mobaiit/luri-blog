const api = async (path, options = {}) => {
  const response = await fetch(`/api/luri-music/${path}`, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error && typeof data.error === 'object' ? data.error : null;
    const error = new Error(detail?.message || data.error || 'Provider 配置读取失败');
    error.status = response.status;
    error.code = detail?.code || data.code || (response.status === 401 || response.status === 403 ? 'provider_access_denied' : 'provider_request_failed');
    throw error;
  }
  return data;
};

const PROVIDER_REQUEST_TIMEOUT_MS = 60 * 1000;
const PLAYBACK_CACHE_SAFETY_MS = 5 * 1000;
const FORBIDDEN_HEADERS = new Set(['cookie', 'host', 'origin', 'referer', 'user-agent', 'content-length', 'connection']);
const isRefreshRequest = (value) => value === true || value === 1 || value === '1' || value === 'url' || value === 'decode';
const providerCache = () => { try { return globalThis.localStorage || null; } catch { return null; } };

const requestDeadline = (signal) => {
  const controller = new AbortController();
  let timedOut = false;
  const relayAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) relayAbort();
  else signal?.addEventListener('abort', relayAbort, { once: true });
  const timer = globalThis.setTimeout(() => { timedOut = true; controller.abort(); }, PROVIDER_REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    clear: () => {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener('abort', relayAbort);
    },
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

const providerError = async (response) => {
  if (response.ok) return response;
  const data = await response.clone().json().catch(() => ({}));
  const detail = data.error && typeof data.error === 'object' ? data.error : null;
  const error = new Error(detail?.message || data.error || `Provider 请求失败（${response.status}）`);
  error.status = response.status;
  error.code = detail?.code || (response.status === 401 || response.status === 403 ? 'provider_access_denied' : 'provider_request_failed');
  throw error;
};

export function normalizeProviderConnection(value) {
  const input = typeof value === 'string' ? JSON.parse(value) : value;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Provider 配置必须是 JSON 对象');
  const url = new URL(String(input.url || '').trim());
  if (url.protocol !== 'https:') throw new Error('Provider 必须使用 HTTPS');
  if (url.username || url.password) throw new Error('Provider URL 不允许包含用户名或密码');
  url.hash = '';

  const headers = {};
  if (input.headers !== undefined && (!input.headers || typeof input.headers !== 'object' || Array.isArray(input.headers))) throw new Error('headers 必须是 JSON 对象');
  for (const [rawName, rawValue] of Object.entries(input.headers || {})) {
    const name = String(rawName).trim();
    const lower = name.toLowerCase();
    if (!/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(name) || FORBIDDEN_HEADERS.has(lower) || lower.startsWith('sec-') || lower.startsWith('proxy-')) throw new Error(`不支持请求头 ${name}`);
    const headerValue = String(rawValue);
    if (headerValue.length > 2048 || /[\r\n]/.test(headerValue)) throw new Error(`请求头 ${name} 的值不合法`);
    headers[name] = headerValue;
  }
  if (Object.keys(headers).length > 20) throw new Error('自定义请求头不能超过 20 个');

  const credentials = input.credentials || 'omit';
  if (!['omit', 'same-origin', 'include'].includes(credentials)) throw new Error('credentials 仅支持 omit、same-origin 或 include');
  return { url: url.href, headers, credentials };
}

const connectionOptions = (connection, signal, extra = {}) => ({
  credentials: connection.credentials,
  redirect: 'error',
  signal,
  ...extra,
  headers: { accept: 'application/json', ...connection.headers, ...(extra.headers || {}) },
});

const applyConnectionQuery = (target, connection) => {
  const configured = new URL(connection.url);
  configured.searchParams.forEach((value, key) => {
    if (!target.searchParams.has(key)) target.searchParams.append(key, value);
  });
  return target;
};

const checkedEndpoint = (value, connection) => {
  const endpoint = new URL(String(value || ''));
  const provider = new URL(connection.url);
  if (endpoint.protocol !== 'https:' || endpoint.origin !== provider.origin) throw new Error('Provider 端点必须与连接地址同源并使用 HTTPS');
  if (endpoint.username || endpoint.password) throw new Error('Provider 端点不允许包含用户名或密码');
  return endpoint;
};

const validatePresentation = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('presentation 必须是对象');
  const text = (input, max) => input === undefined || input === null ? '' : String(input).slice(0, max);
  const tone = ['neutral', 'positive', 'warning', 'negative'].includes(value.badge?.tone) ? value.badge.tone : 'neutral';
  const items = Array.isArray(value.items)
    ? value.items.slice(0, 12).map((item) => ({ label: text(item?.label, 60), value: text(item?.value, 200) })).filter((item) => item.label || item.value)
    : [];
  const presentation = {
    title: text(value.title, 80),
    badge: value.badge?.text ? { text: text(value.badge.text, 40), tone } : null,
    description: text(value.description, 300),
    items,
    notice: text(value.notice, 300),
  };
  return presentation.title || presentation.badge || presentation.description || presentation.items.length || presentation.notice ? presentation : null;
};

export async function discoverProvider(connectionInput, signal) {
  const connection = normalizeProviderConnection(connectionInput);
  const base = new URL(connection.url);
  const target = new URL('/.well-known/music-provider.json', base.origin);
  const response = await fetch(target, { credentials: 'omit', redirect: 'error', signal, cache: 'no-store', headers: { accept: 'application/json' } });
  await providerError(response);
  const manifest = await response.json();
  if (manifest.protocol !== 'music-provider' || manifest.protocolVersion !== '1.0') throw new Error('Provider 不支持 Music Provider Protocol 1.0');
  if (!manifest.provider?.id || !manifest.provider?.name || !manifest.endpoints?.authenticate || !Array.isArray(manifest.capabilities)) throw new Error('Provider 协议声明不完整，缺少必需的 authenticate 端点');
  for (const endpoint of Object.values(manifest.endpoints).filter((item) => typeof item === 'string')) checkedEndpoint(endpoint.replace(/\{[^}]+\}/g, 'resource'), connection);
  return { connection, manifest: { ...manifest, presentation: validatePresentation(manifest.presentation) } };
}

async function authenticateProvider(connection, manifest, clientAccount, signal) {
  if (!clientAccount?.email) throw new Error('缺少用于 Provider 认证的客户端账号邮箱');
  const target = checkedEndpoint(manifest.endpoints.authenticate, connection);
  applyConnectionQuery(target, connection);
  const response = await fetch(target, connectionOptions(connection, signal, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientAccount: {
        id: String(clientAccount.id || '').slice(0, 100),
        name: String(clientAccount.name || '').slice(0, 80),
        email: String(clientAccount.email).trim().toLowerCase().slice(0, 160),
      },
    }),
  }));
  await providerError(response);
  const authorization = await response.json().catch(() => ({}));
  if (!authorization.accessToken || (authorization.tokenType && authorization.tokenType !== 'Bearer')) throw new Error('Provider 认证响应缺少有效的 Bearer Token');
  return {
    accessToken: String(authorization.accessToken),
    expiresIn: Math.max(30, Number(authorization.expiresIn) || 900),
    presentation: validatePresentation(authorization.presentation),
  };
}

export async function verifyProviderConnection(connectionInput, clientAccount, signal) {
  const deadline = requestDeadline(signal);
  try {
    const discovered = await discoverProvider(connectionInput, deadline.signal);
    const authorization = await authenticateProvider(discovered.connection, discovered.manifest, clientAccount, deadline.signal);
    return {
      ...discovered,
      manifest: { ...discovered.manifest, presentation: authorization.presentation || discovered.manifest.presentation },
      authorization,
    };
  } catch (error) {
    if (deadline.timedOut()) {
      const timeoutError = new Error('Provider 连接验证超时（60 秒）');
      timeoutError.code = 'provider_timeout';
      throw timeoutError;
    }
    throw error;
  } finally {
    deadline.clear();
  }
}

export default class ProviderClient {
  constructor(config, onStatusChange) {
    this.config = config;
    this.onStatusChange = onStatusChange;
    this.access = null;
    this.pending = null;
  }

  cacheKey(kind, params) {
    if (!['resolve', 'lyrics', 'artwork'].includes(kind) || !params.songId) return '';
    return kind === 'resolve'
      ? `luri.song-cache.v2:${kind}:${params.songId}`
      : `luri.song-cache.v1:${kind}:${params.songId}:`;
  }

  invalidateCache(kind, params = {}) {
    const key = this.cacheKey(kind, params);
    if (!key) return;
    try { providerCache()?.removeItem(key); } catch { /* Local storage may be unavailable. */ }
  }

  cachedResponse(key, refresh) {
    if (!key) return null;
    try {
      const storage = providerCache();
      if (!storage) return null;
      if (refresh) { storage.removeItem(key); return null; }
      const entry = JSON.parse(storage.getItem(key) || 'null');
      const expiresAt = Number(entry?.expiresAt);
      const expiring = Number.isFinite(expiresAt) && expiresAt > 0;
      if (!entry || (expiring && expiresAt <= Date.now())) { storage.removeItem(key); return null; }
      const responseBody = { ...entry.body };
      if (entry.kind === 'resolve' && responseBody.url) {
        if (!expiring) { storage.removeItem(key); return null; }
        responseBody.expiresIn = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
      } else if (entry.kind === 'resolve') {
        storage.removeItem(key);
        return null;
      }
      return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'content-type': 'application/json', 'x-luri-cache': 'local' } });
    } catch { return null; }
  }

  rememberResponse(key, kind, response) {
    if (!key || !response.ok) return;
    response.clone().json().then((payload) => {
      const useful = kind === 'resolve' ? payload.url : kind === 'artwork' ? payload.url : payload.lyrics || payload.translation;
      if (!useful) return;
      const current = Date.now();
      let expiresAt = current + 3600 * 1000;
      if (kind === 'resolve') {
        const reportedExpiry = Date.parse(payload.expiresAt || '');
        const reportedTtl = Number(payload.expiresIn);
        if (Number.isFinite(reportedExpiry)) {
          expiresAt = reportedExpiry - PLAYBACK_CACHE_SAFETY_MS;
          if (expiresAt <= current) return;
        } else if (Number.isFinite(reportedTtl) && reportedTtl > 0) {
          expiresAt = current + reportedTtl * 1000 - PLAYBACK_CACHE_SAFETY_MS;
          if (expiresAt <= current) return;
        } else return;
      }
      try { providerCache()?.setItem(key, JSON.stringify({ kind, expiresAt, body: payload })); } catch { /* Local storage may be unavailable. */ }
    }).catch(() => {});
  }

  async authorization(signal) {
    if (this.access && this.access.expiresAt > Date.now() + 15000) return this.access;
    if (!this.pending) {
      const deadline = requestDeadline();
      this.pending = api(`providers/${this.config.id}/token`, { method: 'POST', body: '{}', signal: deadline.signal })
        .then(async (stored) => {
          if (stored.connection) {
            const discovered = await discoverProvider(stored.connection, deadline.signal);
            const authorization = await authenticateProvider(discovered.connection, discovered.manifest, stored.clientAccount, deadline.signal);
            const access = {
              connection: normalizeProviderConnection({
                url: new URL(discovered.connection.url).origin,
                headers: { Authorization: `Bearer ${authorization.accessToken}` },
                credentials: 'omit',
              }),
              endpoints: discovered.manifest.endpoints,
              capabilities: discovered.manifest.capabilities,
              presentation: authorization.presentation || discovered.manifest.presentation,
              expiresAt: Date.now() + authorization.expiresIn * 1000,
            };
            this.access = access;
            return access;
          }
          const headers = {};
          if (stored.authorization?.header) headers[stored.authorization.header] = `${stored.authorization.prefix || ''}${stored.accessToken || ''}`;
          else if (stored.accessToken) headers.Authorization = `Bearer ${stored.accessToken}`;
          const access = {
            connection: normalizeProviderConnection({ url: this.config.providerUrl, headers, credentials: 'omit' }),
            endpoints: stored.endpoints,
            capabilities: stored.capabilities || [],
            presentation: validatePresentation(stored.account?.presentation),
            expiresAt: Date.now() + Math.max(30, Number(stored.expiresIn) || 900) * 1000,
          };
          this.access = access;
          return access;
        })
        .catch((error) => {
          if (!deadline.timedOut()) throw error;
          const timeout = new Error('Provider 配置请求超时（60 秒）');
          timeout.code = 'provider_timeout';
          timeout.status = 504;
          throw timeout;
        })
        .finally(() => { deadline.clear(); this.pending = null; });
    }
    return waitForSignal(this.pending, signal);
  }

  async request(kind, params = {}, signal) {
    const cacheKey = this.cacheKey(kind, params);
    const cached = this.cachedResponse(cacheKey, isRefreshRequest(params.refresh));
    if (cached) return cached;
    const deadline = requestDeadline(signal);
    try {
      const access = await this.authorization(deadline.signal);
      const endpoint = access.endpoints?.[kind];
      if (!endpoint) return new Response(JSON.stringify({ error: { code: 'not_supported', message: `当前 Provider 不支持 ${kind} 能力` } }), { status: 501, headers: { 'content-type': 'application/json' } });
      const target = checkedEndpoint(endpoint.replace(/\{(?:songId|id)\}/, encodeURIComponent(params.songId || '')), access.connection);
      let options = connectionOptions(access.connection, deadline.signal, ['lyrics', 'search'].includes(kind) ? { cache: 'no-store' } : {});

      if (kind === 'search' || kind === 'random' || kind === 'charts') {
        Object.entries(params).forEach(([key, value]) => value !== undefined && value !== '' && target.searchParams.set(key, String(value)));
      } else if (kind === 'resolve') {
        options = connectionOptions(access.connection, deadline.signal, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(params),
        });
      } else {
        Object.entries(params)
          .filter(([key]) => key !== 'songId')
          .forEach(([key, value]) => value !== undefined && target.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value)));
      }

      const response = await providerError(await fetch(target, options));
      this.rememberResponse(cacheKey, kind, response);
      return response;
    } catch (error) {
      if (error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403) this.access = null;
      if (!deadline.timedOut()) throw error;
      const timeout = new Error('Provider 请求超时（60 秒）');
      timeout.code = 'provider_timeout';
      timeout.status = 504;
      throw timeout;
    } finally {
      deadline.clear();
    }
  }
}
