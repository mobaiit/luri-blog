import { id, json, now } from './shared.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const fromBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const toBase64 = (value) => btoa(String.fromCharCode(...value));
const parseBody = async (request) => request.json().catch(() => ({}));

async function providerFetch(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) throw new Error('Provider 接口不允许重定向');
  return response;
}

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
  const response = await providerFetch(`${providerUrl}/.well-known/music-provider.json`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('无法读取 Provider 协议声明');
  const manifest = await response.json();
  if (manifest.protocol !== 'music-provider' || !String(manifest.protocolVersion || '').startsWith('1.')) throw new Error('Provider 不支持 Music Provider Protocol 1.x');
  if (!manifest.provider?.id || !manifest.endpoints?.search || !manifest.endpoints?.resolve) throw new Error('Provider 协议声明不完整');
  if (!manifest.endpoints?.terms || !manifest.endpoints?.privacy) throw new Error('Provider 必须公开服务条款和隐私政策');
  const authTypes = Array.isArray(manifest.authentication?.types) ? manifest.authentication.types : [];
  if (!authTypes.some((value) => ['activation_code', 'api_key', 'none'].includes(value))) throw new Error('Provider 未声明客户端支持的认证方式');
  Object.values(manifest.endpoints).filter((value) => typeof value === 'string').forEach((value) => checkedEndpoint(value.replace(/\{[^}]+\}/g, 'resource'), providerUrl));
  return manifest;
}

const CONNECTION_TYPES = ['official', 'private_https', 'activation_code'];

function providerAuth(manifest, requested, hasApiKey) {
  const connectionType = String(requested || 'official');
  if (!CONNECTION_TYPES.includes(connectionType)) throw new Error('不支持的 Provider 连接方式');
  const authType = connectionType === 'activation_code' ? 'activation_code' : hasApiKey ? 'api_key' : 'none';
  const supported = Array.isArray(manifest.authentication?.types) ? manifest.authentication.types : [];
  if (!supported.includes(authType)) throw new Error(`该 Provider 不支持 ${authType} 认证方式`);
  if (authType === 'activation_code' && (!manifest.endpoints?.activate || !manifest.endpoints?.refresh || !manifest.endpoints?.account)) throw new Error('Provider 的激活码认证接口不完整');
  return { connectionType, authType };
}

function apiKeyAuthorization(manifest, data) {
  const config = manifest.authentication?.apiKey || {};
  const credentialMode = data.credentialMode === 'authorization' ? 'authorization' : 'api_key';
  const defaultHeader = credentialMode === 'authorization' ? 'Authorization' : config.header || 'X-API-Key';
  const header = String(credentialMode === 'authorization' ? 'Authorization' : data.credentialHeader || defaultHeader).trim();
  const defaultPrefix = credentialMode === 'authorization' ? 'Bearer ' : config.prefix || '';
  const prefix = String(data.credentialPrefix ?? defaultPrefix).slice(0, 32);
  if (!/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(header) || ['cookie', 'host', 'origin', 'referer'].includes(header.toLowerCase())) throw new Error('Provider 声明了不安全的 API Key 请求头');
  return { header, prefix };
}

function accessHeaders(authType, credential, token) {
  if (authType === 'none') return { accept: 'application/json' };
  if (authType === 'api_key') return { accept: 'application/json', [credential.authorization.header]: `${credential.authorization.prefix}${token}` };
  return { accept: 'application/json', authorization: `Bearer ${token}` };
}

async function activateCredential(manifest, providerUrl, data, user) {
  const activationCode = String(data.activationCode || '').trim();
  const idempotencyKey = String(data.idempotencyKey || '').trim().slice(0, 100);
  if (!activationCode || !idempotencyKey) throw new Error('请填写 Provider 激活码');
  const response = await providerFetch(checkedEndpoint(manifest.endpoints.activate, providerUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      activationCode,
      idempotencyKey,
      clientAccount: {
        id: String(user.id || '').slice(0, 100),
        name: String(user.display_name || '').slice(0, 80),
        email: String(user.email || '').slice(0, 160),
      },
    }),
  });
  const activated = await response.json().catch(() => ({}));
  if (!response.ok || !activated.refreshToken) {
    const failure = new Error(activated.error?.message || 'Provider 激活失败');
    failure.status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw failure;
  }
  return {
    credential: {
      refreshToken: activated.refreshToken,
      refreshEndpoint: checkedEndpoint(manifest.endpoints.refresh, providerUrl),
      accountEndpoint: checkedEndpoint(manifest.endpoints.account, providerUrl),
      manifest,
    },
    account: activated.account || null,
    initialAccess: { accessToken: activated.accessToken, expiresIn: activated.expiresIn },
  };
}

async function prepareCredential(manifest, providerUrl, data, user) {
  const credentialValue = String(data.credentialValue || data.apiKey || '').trim();
  const credentialMode = ['api_key', 'authorization'].includes(data.credentialMode) ? data.credentialMode : 'none';
  if (credentialMode !== 'none' && !credentialValue) throw new Error('请填写 Provider 认证凭证');
  const { connectionType, authType } = providerAuth(manifest, data.connectionType || data.authType, credentialMode !== 'none');
  if (authType === 'activation_code') return { connectionType, authType, ...(await activateCredential(manifest, providerUrl, data, user)) };
  if (authType === 'api_key') {
    const authorization = apiKeyAuthorization(manifest, data);
    const accountEndpoint = manifest.endpoints.account ? checkedEndpoint(manifest.endpoints.account, providerUrl) : null;
    let account = null;
    if (accountEndpoint) {
      const response = await providerFetch(accountEndpoint, { headers: accessHeaders(authType, { authorization }, credentialValue) });
      if (!response.ok) { const failure = new Error(response.status === 401 || response.status === 403 ? 'Provider API Key 无效或无权访问' : 'Provider 账号校验失败'); failure.status = response.status >= 400 && response.status < 500 ? response.status : 502; throw failure; }
      account = await response.json().catch(() => null);
    }
    return { connectionType, authType, credential: { apiKey: credentialValue, authorization, accountEndpoint, manifest }, account, initialAccess: { accessToken: credentialValue, expiresIn: 900, authorization } };
  }
  return { connectionType, authType, credential: { manifest }, account: null, initialAccess: { accessToken: '', expiresIn: 3600, authorization: null } };
}

const publicConfig = (row, activeId) => ({ id: row.id, providerId: row.provider_id, providerUrl: row.provider_url, displayName: row.display_name, protocolVersion: row.protocol_version, connectionType: row.connection_type || (row.auth_type === 'none' ? 'private_https' : row.auth_type), authType: row.auth_type, status: row.cached_status, expiresAt: row.cached_expires_at, lastSyncedAt: row.last_synced_at, active: row.id === activeId, createdAt: row.created_at });

export async function handleProviderRequest(request, env, action, user) {
  if (!user) return json({ error: '请先登录' }, 401);
  if (action === 'providers' && request.method === 'GET') {
    const [configs, preference] = await Promise.all([
      env.LURI_MUSIC_DB.prepare('SELECT * FROM luri_music_provider_configs WHERE user_id=? ORDER BY updated_at DESC').bind(user.id).all(),
      env.LURI_MUSIC_DB.prepare('SELECT active_provider_config_id,provider_revision,playback_quality FROM luri_music_preferences WHERE user_id=?').bind(user.id).first(),
    ]);
    return json({ items: configs.results.map((row) => publicConfig(row, preference?.active_provider_config_id)), activeProviderId: preference?.active_provider_config_id || null, revision: preference?.provider_revision || 0, preferences: { playbackQuality: preference?.playback_quality || 'auto' } });
  }

  if (action === 'providers/discover' && request.method === 'POST') {
    try { const providerUrl = normalizeProviderUrl((await parseBody(request)).providerUrl); const manifest = await discover(providerUrl); return json({ providerUrl, manifest }); }
    catch (error) { return json({ error: error.message || 'Provider 验证失败' }, 400); }
  }

  if (action === 'providers' && request.method === 'POST') {
    const data = await parseBody(request);
    try {
      const providerUrl = normalizeProviderUrl(data.providerUrl); const manifest = await discover(providerUrl);
      const duplicate = await env.LURI_MUSIC_DB.prepare('SELECT id FROM luri_music_provider_configs WHERE user_id=? AND provider_url=? AND provider_id=?').bind(user.id, providerUrl, String(manifest.provider.id)).first();
      if (duplicate) return json({ error: '该 Provider 已存在，请编辑现有配置' }, 409);
      const prepared = await prepareCredential(manifest, providerUrl, data, user); const encrypted = await encryptCredential(prepared.credential, env);
      const configId = id(); const timestamp = now(); const displayName = String(data.displayName || manifest.provider.name || 'Music Provider').trim().slice(0, 60);
      await env.LURI_MUSIC_DB.batch([
        env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_provider_configs(id,user_id,provider_id,provider_url,display_name,protocol_version,auth_type,connection_type,credential_ciphertext,credential_iv,cached_status,cached_expires_at,last_synced_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(configId, user.id, String(manifest.provider.id), providerUrl, displayName, String(manifest.protocolVersion), prepared.authType, prepared.connectionType, encrypted.ciphertext, encrypted.iv, prepared.account?.status || 'active', prepared.account?.expiresAt || null, timestamp, timestamp, timestamp),
        env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_preferences(user_id,active_provider_config_id,provider_revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET active_provider_config_id=CASE WHEN active_provider_config_id IS NULL THEN excluded.active_provider_config_id ELSE active_provider_config_id END,provider_revision=provider_revision+1,updated_at=excluded.updated_at').bind(user.id, configId, timestamp),
      ]);
      return json({ config: { id: configId, providerId: manifest.provider.id, providerUrl, displayName, protocolVersion: manifest.protocolVersion, connectionType: prepared.connectionType, authType: prepared.authType, status: prepared.account?.status || 'active', expiresAt: prepared.account?.expiresAt || null }, access: { ...prepared.initialAccess, endpoints: manifest.endpoints } }, 201, { 'cache-control': 'no-store' });
    } catch (error) { return json({ error: error.message || 'Provider 配置失败' }, error.status || 400); }
  }

  const configMatch = action.match(/^providers\/([^/]+)(?:\/(activate|token))?$/);
  if (!configMatch) return json({ error: 'Not found' }, 404);
  const config = await env.LURI_MUSIC_DB.prepare('SELECT * FROM luri_music_provider_configs WHERE id=? AND user_id=?').bind(configMatch[1], user.id).first();
  if (!config) return json({ error: 'Provider 配置不存在' }, 404);

  if (request.method === 'PATCH' && !configMatch[2]) {
    const data = await parseBody(request);
    try {
      const providerUrl = normalizeProviderUrl(data.providerUrl); const manifest = await discover(providerUrl);
      const duplicate = await env.LURI_MUSIC_DB.prepare('SELECT id FROM luri_music_provider_configs WHERE user_id=? AND provider_url=? AND provider_id=? AND id<>?').bind(user.id, providerUrl, String(manifest.provider.id), config.id).first();
      if (duplicate) return json({ error: '该 Provider 已存在，请编辑对应配置' }, 409);
      const prepared = await prepareCredential(manifest, providerUrl, data, user); const encrypted = await encryptCredential(prepared.credential, env);
      const timestamp = now(); const displayName = String(data.displayName || manifest.provider.name || 'Music Provider').trim().slice(0, 60);
      await env.LURI_MUSIC_DB.batch([
        env.LURI_MUSIC_DB.prepare('UPDATE luri_music_provider_configs SET provider_id=?,provider_url=?,display_name=?,protocol_version=?,auth_type=?,connection_type=?,credential_ciphertext=?,credential_iv=?,cached_status=?,cached_expires_at=?,last_synced_at=?,updated_at=? WHERE id=? AND user_id=?').bind(String(manifest.provider.id), providerUrl, displayName, String(manifest.protocolVersion), prepared.authType, prepared.connectionType, encrypted.ciphertext, encrypted.iv, prepared.account?.status || 'active', prepared.account?.expiresAt || null, timestamp, timestamp, config.id, user.id),
        env.LURI_MUSIC_DB.prepare('UPDATE luri_music_preferences SET provider_revision=provider_revision+1,updated_at=? WHERE user_id=?').bind(timestamp, user.id),
      ]);
      return json({ config: { id: config.id, providerId: manifest.provider.id, providerUrl, displayName, protocolVersion: manifest.protocolVersion, connectionType: prepared.connectionType, authType: prepared.authType, status: prepared.account?.status || 'active', expiresAt: prepared.account?.expiresAt || null }, access: { ...prepared.initialAccess, endpoints: manifest.endpoints } }, 200, { 'cache-control': 'no-store' });
    } catch (error) { return json({ error: error.message || 'Provider 更新失败' }, error.status || 400); }
  }

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
      const credential = await decryptCredential(config, env); const authType = config.auth_type || 'none'; let accessToken = ''; let expiresIn = 900; let authorization = null; let account = null;
      if (authType === 'activation_code') {
        const response = await providerFetch(checkedEndpoint(credential.refreshEndpoint, config.provider_url), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ refreshToken: credential.refreshToken }) }); const refreshed = await response.json().catch(() => ({}));
        if (!response.ok || !refreshed.accessToken) { await env.LURI_MUSIC_DB.prepare("UPDATE luri_music_provider_configs SET cached_status='inactive',last_synced_at=?,updated_at=? WHERE id=?").bind(now(), now(), config.id).run(); return json({ error: 'Provider 没有访问权限，请编辑配置并更新凭证', code: 'provider_access_denied' }, 401); }
        accessToken = refreshed.accessToken; expiresIn = refreshed.expiresIn;
        const accountResponse = await providerFetch(checkedEndpoint(credential.accountEndpoint, config.provider_url), { headers: accessHeaders(authType, credential, accessToken) }); account = accountResponse.ok ? await accountResponse.json() : null;
      } else if (authType === 'api_key') {
        accessToken = credential.apiKey; authorization = credential.authorization; expiresIn = 900;
        if (credential.accountEndpoint) { const accountResponse = await providerFetch(checkedEndpoint(credential.accountEndpoint, config.provider_url), { headers: accessHeaders(authType, credential, accessToken) }); if (accountResponse.status === 401 || accountResponse.status === 403) return json({ error: 'Provider 认证凭证已失效', code: 'provider_access_denied' }, 401); account = accountResponse.ok ? await accountResponse.json() : null; }
      } else if (authType === 'none') { expiresIn = 3600; }
      else return json({ error: 'Provider 认证类型不受支持' }, 400);
      const timestamp = now(); await env.LURI_MUSIC_DB.prepare("UPDATE luri_music_provider_configs SET cached_status=?,cached_expires_at=COALESCE(?,cached_expires_at),last_synced_at=?,updated_at=? WHERE id=?").bind(account?.status || 'active', account?.expiresAt || null, timestamp, timestamp, config.id).run();
      return json({ accessToken, expiresIn, authorization, endpoints: credential.manifest.endpoints, account }, 200, { 'cache-control': 'no-store' });
    } catch (error) { return json({ error: error.message || 'Provider 同步失败' }, 502); }
  }
  return json({ error: 'Not found' }, 404);
}
