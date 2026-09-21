import { id, json, now } from './shared.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const fromBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const toBase64 = (value) => btoa(String.fromCharCode(...value));
const parseBody = async (request) => request.json().catch(() => ({}));

async function credentialKey(env) {
  if (!env.PROVIDER_CREDENTIAL_KEY) throw new Error('Provider 凭证加密密钥尚未配置');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(env.PROVIDER_CREDENTIAL_KEY));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptCredential(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await credentialKey(env), encoder.encode(JSON.stringify(value)));
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}

async function decryptCredential(row, env) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(row.credential_iv) }, await credentialKey(env), fromBase64(row.credential_ciphertext));
  return JSON.parse(decoder.decode(plain));
}

function normalizeProviderUrl(value) {
  const url = new URL(String(value || '').trim());
  if (url.protocol !== 'https:') throw new Error('Provider 必须使用 HTTPS');
  url.username = ''; url.password = ''; url.hash = ''; url.search = '';
  return url.href.replace(/\/$/, '');
}

function checkedEndpoint(value, providerUrl) {
  if (!value) throw new Error('Provider 缺少必要接口');
  const endpoint = new URL(value); const provider = new URL(providerUrl);
  if (endpoint.protocol !== 'https:' || endpoint.origin !== provider.origin) throw new Error('Provider 接口必须与发现地址同源并使用 HTTPS');
  return endpoint.href;
}

async function discover(providerUrl) {
  const response = await fetch(`${providerUrl}/.well-known/music-provider.json`, { headers: { accept: 'application/json' }, redirect: 'error' });
  if (!response.ok) throw new Error('无法读取 Provider 协议声明');
  const manifest = await response.json();
  if (manifest.protocol !== 'music-provider' || !String(manifest.protocolVersion || '').startsWith('1.')) throw new Error('Provider 不支持 Music Provider Protocol 1.x');
  if (!manifest.provider?.id || !manifest.endpoints?.search || !manifest.endpoints?.resolve) throw new Error('Provider 协议声明不完整');
  const authTypes = Array.isArray(manifest.authentication?.types) ? manifest.authentication.types : [];
  if (!authTypes.some((value) => ['activation_code', 'api_key', 'none'].includes(value))) throw new Error('Provider 未声明客户端支持的认证方式');
  Object.values(manifest.endpoints).filter((value) => typeof value === 'string').forEach((value) => checkedEndpoint(value.replace(/\{[^}]+\}/g, 'resource'), providerUrl));
  return manifest;
}

function providerAuth(manifest, requested) {
  const supported = Array.isArray(manifest.authentication?.types) ? manifest.authentication.types : [];
  const authType = String(requested || 'activation_code');
  if (!['activation_code', 'api_key', 'none'].includes(authType)) throw new Error('不支持的 Provider 连接方式');
  if (!supported.includes(authType)) throw new Error(`该 Provider 不支持 ${authType} 连接方式`);
  if (authType === 'activation_code' && (!manifest.endpoints?.activate || !manifest.endpoints?.refresh || !manifest.endpoints?.account)) throw new Error('Provider 的授权码认证接口不完整');
  return authType;
}

function apiKeyAuthorization(manifest) {
  const config = manifest.authentication?.apiKey || {};
  const header = String(config.header || 'Authorization').trim();
  const prefix = String(config.prefix ?? (header.toLowerCase() === 'authorization' ? 'Bearer ' : '')).slice(0, 32);
  if (!/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(header) || ['cookie', 'host', 'origin', 'referer'].includes(header.toLowerCase())) throw new Error('Provider 声明了不安全的 API Key 请求头');
  return { header, prefix };
}

function accessHeaders(authType, credential, token) {
  if (authType === 'none') return { accept: 'application/json' };
  if (authType === 'api_key') return { accept: 'application/json', [credential.authorization.header]: `${credential.authorization.prefix}${token}` };
  return { accept: 'application/json', authorization: `Bearer ${token}` };
}

const publicConfig = (row, activeId) => ({ id: row.id, providerId: row.provider_id, providerUrl: row.provider_url, displayName: row.display_name, protocolVersion: row.protocol_version, authType: row.auth_type, status: row.cached_status, expiresAt: row.cached_expires_at, lastSyncedAt: row.last_synced_at, active: row.id === activeId, createdAt: row.created_at });

export async function handleProviderRequest(request, env, action, user) {
  if (!user) return json({ error: '请先登录' }, 401);
  if (action === 'providers' && request.method === 'GET') {
    const [configs, preference] = await Promise.all([
      env.LURI_MUSIC_DB.prepare('SELECT * FROM luri_music_provider_configs WHERE user_id=? ORDER BY updated_at DESC').bind(user.id).all(),
      env.LURI_MUSIC_DB.prepare('SELECT active_provider_config_id,provider_revision FROM luri_music_preferences WHERE user_id=?').bind(user.id).first(),
    ]);
    return json({ items: configs.results.map((row) => publicConfig(row, preference?.active_provider_config_id)), activeProviderId: preference?.active_provider_config_id || null, revision: preference?.provider_revision || 0 });
  }

  if (action === 'providers/discover' && request.method === 'POST') {
    try { const providerUrl = normalizeProviderUrl((await parseBody(request)).providerUrl); const manifest = await discover(providerUrl); return json({ providerUrl, manifest }); }
    catch (error) { return json({ error: error.message || 'Provider 验证失败' }, 400); }
  }

  if (action === 'providers' && request.method === 'POST') {
    const data = await parseBody(request);
    try {
      const providerUrl = normalizeProviderUrl(data.providerUrl); const manifest = await discover(providerUrl);
      const authType = providerAuth(manifest, data.authType); let credential; let account = null; let initialAccess = null;
      if (authType === 'activation_code') {
        const deviceId = String(data.deviceId || '').trim().slice(0, 100);
        if (!deviceId || !String(data.activationCode || '').trim()) return json({ error: '请填写 Provider 授权码并提供设备标识' }, 400);
        const response = await fetch(checkedEndpoint(manifest.endpoints.activate, providerUrl), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ activationCode: String(data.activationCode).trim(), deviceId, deviceName: String(data.deviceName || '').slice(0, 80) }), redirect: 'error' });
        const activated = await response.json().catch(() => ({}));
        if (!response.ok || !activated.refreshToken) return json({ error: activated.error?.message || 'Provider 授权失败' }, response.status >= 400 && response.status < 500 ? response.status : 502);
        credential = { refreshToken: activated.refreshToken, refreshEndpoint: checkedEndpoint(manifest.endpoints.refresh, providerUrl), accountEndpoint: checkedEndpoint(manifest.endpoints.account, providerUrl), manifest };
        account = activated.account || null; initialAccess = { accessToken: activated.accessToken, expiresIn: activated.expiresIn };
      } else if (authType === 'api_key') {
        const apiKey = String(data.apiKey || '').trim(); if (!apiKey) return json({ error: '请填写 Provider API Key' }, 400);
        const authorization = apiKeyAuthorization(manifest); credential = { apiKey, authorization, accountEndpoint: manifest.endpoints.account ? checkedEndpoint(manifest.endpoints.account, providerUrl) : null, manifest };
        if (credential.accountEndpoint) {
          const response = await fetch(credential.accountEndpoint, { headers: accessHeaders(authType, credential, apiKey), redirect: 'error' });
          if (!response.ok) return json({ error: response.status === 401 || response.status === 403 ? 'Provider API Key 无效或无权访问' : 'Provider 账号校验失败' }, response.status >= 400 && response.status < 500 ? response.status : 502);
          account = await response.json().catch(() => null);
        }
        initialAccess = { accessToken: apiKey, expiresIn: 900, authorization };
      } else {
        credential = { manifest }; initialAccess = { accessToken: '', expiresIn: 3600, authorization: null };
      }
      const encrypted = await encryptCredential(credential, env);
      const configId = id(); const timestamp = now(); const displayName = String(data.displayName || manifest.provider.name || 'Music Provider').trim().slice(0, 60);
      await env.LURI_MUSIC_DB.batch([
        env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_provider_configs(id,user_id,provider_id,provider_url,display_name,protocol_version,auth_type,credential_ciphertext,credential_iv,cached_status,cached_expires_at,last_synced_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(configId, user.id, String(manifest.provider.id), providerUrl, displayName, String(manifest.protocolVersion), authType, encrypted.ciphertext, encrypted.iv, account?.status || 'active', account?.expiresAt || null, timestamp, timestamp, timestamp),
        env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_preferences(user_id,active_provider_config_id,provider_revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET active_provider_config_id=CASE WHEN active_provider_config_id IS NULL THEN excluded.active_provider_config_id ELSE active_provider_config_id END,provider_revision=provider_revision+1,updated_at=excluded.updated_at').bind(user.id, configId, timestamp),
      ]);
      return json({ config: { id: configId, providerId: manifest.provider.id, providerUrl, displayName, protocolVersion: manifest.protocolVersion, authType, status: account?.status || 'active', expiresAt: account?.expiresAt || null }, access: { ...initialAccess, endpoints: manifest.endpoints } }, 201, { 'cache-control': 'no-store' });
    } catch (error) { return json({ error: error.message || 'Provider 配置失败' }, 400); }
  }

  const configMatch = action.match(/^providers\/([^/]+)(?:\/(activate|token))?$/);
  if (!configMatch) return json({ error: 'Not found' }, 404);
  const config = await env.LURI_MUSIC_DB.prepare('SELECT * FROM luri_music_provider_configs WHERE id=? AND user_id=?').bind(configMatch[1], user.id).first();
  if (!config) return json({ error: 'Provider 配置不存在' }, 404);
  if (request.method === 'DELETE' && !configMatch[2]) {
    const timestamp = now();
    await env.LURI_MUSIC_DB.batch([
      env.LURI_MUSIC_DB.prepare('UPDATE luri_music_preferences SET active_provider_config_id=CASE WHEN active_provider_config_id=? THEN NULL ELSE active_provider_config_id END,provider_revision=provider_revision+1,updated_at=? WHERE user_id=?').bind(config.id, timestamp, user.id),
      env.LURI_MUSIC_DB.prepare('DELETE FROM luri_music_provider_configs WHERE id=? AND user_id=?').bind(config.id, user.id),
    ]);
    return json({ ok: true });
  }
  if (configMatch[2] === 'activate' && request.method === 'POST') {
    await env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_preferences(user_id,active_provider_config_id,provider_revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET active_provider_config_id=excluded.active_provider_config_id,provider_revision=provider_revision+1,updated_at=excluded.updated_at').bind(user.id, config.id, now()).run();
    return json({ ok: true, activeProviderId: config.id });
  }
  if (configMatch[2] === 'token' && request.method === 'POST') {
    try {
      const credential = await decryptCredential(config, env); const authType = config.auth_type || 'activation_code'; let accessToken = ''; let expiresIn = 900; let authorization = null; let account = null;
      if (authType === 'activation_code') {
        const response = await fetch(checkedEndpoint(credential.refreshEndpoint, config.provider_url), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ refreshToken: credential.refreshToken }), redirect: 'error' }); const refreshed = await response.json().catch(() => ({}));
        if (!response.ok || !refreshed.accessToken) { await env.LURI_MUSIC_DB.prepare("UPDATE luri_music_provider_configs SET cached_status='inactive',last_synced_at=?,updated_at=? WHERE id=?").bind(now(), now(), config.id).run(); return json({ error: refreshed.error?.message || 'Provider 凭证已失效' }, 401); }
        accessToken = refreshed.accessToken; expiresIn = refreshed.expiresIn;
        const accountResponse = await fetch(checkedEndpoint(credential.accountEndpoint, config.provider_url), { headers: accessHeaders(authType, credential, accessToken), redirect: 'error' }); account = accountResponse.ok ? await accountResponse.json() : null;
      } else if (authType === 'api_key') {
        accessToken = credential.apiKey; authorization = credential.authorization; expiresIn = 900;
        if (credential.accountEndpoint) { const accountResponse = await fetch(checkedEndpoint(credential.accountEndpoint, config.provider_url), { headers: accessHeaders(authType, credential, accessToken), redirect: 'error' }); if (accountResponse.status === 401 || accountResponse.status === 403) return json({ error: 'Provider API Key 已失效' }, 401); account = accountResponse.ok ? await accountResponse.json() : null; }
      } else if (authType === 'none') { expiresIn = 3600; }
      else return json({ error: 'Provider 认证类型不受支持' }, 400);
      const timestamp = now(); await env.LURI_MUSIC_DB.prepare("UPDATE luri_music_provider_configs SET cached_status=?,cached_expires_at=COALESCE(?,cached_expires_at),last_synced_at=?,updated_at=? WHERE id=?").bind(account?.status || 'active', account?.expiresAt || null, timestamp, timestamp, config.id).run();
      return json({ accessToken, expiresIn, authorization, endpoints: credential.manifest.endpoints, account }, 200, { 'cache-control': 'no-store' });
    } catch (error) { return json({ error: error.message || 'Provider 同步失败' }, 502); }
  }
  return json({ error: 'Not found' }, 404);
}
