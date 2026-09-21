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
  const endpoint = new URL(value); const provider = new URL(providerUrl);
  if (endpoint.protocol !== 'https:' || endpoint.origin !== provider.origin) throw new Error('Provider 接口必须与发现地址同源并使用 HTTPS');
  return endpoint.href;
}

async function discover(providerUrl) {
  const response = await fetch(`${providerUrl}/.well-known/music-provider.json`, { headers: { accept: 'application/json' }, redirect: 'error' });
  if (!response.ok) throw new Error('无法读取 Provider 协议声明');
  const manifest = await response.json();
  if (manifest.protocol !== 'music-provider' || !String(manifest.protocolVersion || '').startsWith('1.')) throw new Error('Provider 不支持 Music Provider Protocol 1.x');
  if (!manifest.provider?.id || !manifest.endpoints?.activate || !manifest.endpoints?.refresh || !manifest.endpoints?.account) throw new Error('Provider 协议声明不完整');
  Object.values(manifest.endpoints).filter((value) => typeof value === 'string' && !value.includes('{')).forEach((value) => checkedEndpoint(value, providerUrl));
  return manifest;
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
      const activationEndpoint = checkedEndpoint(manifest.endpoints.activate, providerUrl); const deviceId = String(data.deviceId || '').trim().slice(0, 100);
      if (!deviceId || !data.activationCode) return json({ error: '请填写 Provider 激活码并提供设备标识' }, 400);
      const response = await fetch(activationEndpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ activationCode: data.activationCode, deviceId, deviceName: String(data.deviceName || '').slice(0, 80) }), redirect: 'error' });
      const activated = await response.json().catch(() => ({}));
      if (!response.ok || !activated.refreshToken) return json({ error: activated.error?.message || 'Provider 激活失败' }, response.status >= 400 && response.status < 500 ? response.status : 502);
      const encrypted = await encryptCredential({ refreshToken: activated.refreshToken, refreshEndpoint: checkedEndpoint(manifest.endpoints.refresh, providerUrl), accountEndpoint: checkedEndpoint(manifest.endpoints.account, providerUrl), manifest }, env);
      const configId = id(); const timestamp = now(); const displayName = String(data.displayName || manifest.provider.name || 'Music Provider').trim().slice(0, 60);
      await env.LURI_MUSIC_DB.batch([
        env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_provider_configs(id,user_id,provider_id,provider_url,display_name,protocol_version,auth_type,credential_ciphertext,credential_iv,cached_status,cached_expires_at,last_synced_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(configId, user.id, String(manifest.provider.id), providerUrl, displayName, String(manifest.protocolVersion), 'activation_code', encrypted.ciphertext, encrypted.iv, activated.account?.status || 'active', activated.account?.expiresAt || null, timestamp, timestamp, timestamp),
        env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_preferences(user_id,active_provider_config_id,provider_revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET active_provider_config_id=CASE WHEN active_provider_config_id IS NULL THEN excluded.active_provider_config_id ELSE active_provider_config_id END,provider_revision=provider_revision+1,updated_at=excluded.updated_at').bind(user.id, configId, timestamp),
      ]);
      return json({ config: { id: configId, providerId: manifest.provider.id, providerUrl, displayName, protocolVersion: manifest.protocolVersion, status: activated.account?.status || 'active', expiresAt: activated.account?.expiresAt || null }, access: { accessToken: activated.accessToken, expiresIn: activated.expiresIn, endpoints: manifest.endpoints } }, 201);
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
      const credential = await decryptCredential(config, env); const response = await fetch(checkedEndpoint(credential.refreshEndpoint, config.provider_url), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ refreshToken: credential.refreshToken }), redirect: 'error' }); const refreshed = await response.json().catch(() => ({}));
      if (!response.ok || !refreshed.accessToken) { await env.LURI_MUSIC_DB.prepare("UPDATE luri_music_provider_configs SET cached_status='inactive',last_synced_at=?,updated_at=? WHERE id=?").bind(now(), now(), config.id).run(); return json({ error: refreshed.error?.message || 'Provider 凭证已失效' }, 401); }
      const accountResponse = await fetch(checkedEndpoint(credential.accountEndpoint, config.provider_url), { headers: { authorization: `Bearer ${refreshed.accessToken}`, accept: 'application/json' }, redirect: 'error' }); const account = accountResponse.ok ? await accountResponse.json() : null; const timestamp = now();
      await env.LURI_MUSIC_DB.prepare("UPDATE luri_music_provider_configs SET cached_status=?,cached_expires_at=COALESCE(?,cached_expires_at),last_synced_at=?,updated_at=? WHERE id=?").bind(account?.status || 'active', account?.expiresAt || null, timestamp, timestamp, config.id).run();
      return json({ accessToken: refreshed.accessToken, expiresIn: refreshed.expiresIn, endpoints: credential.manifest.endpoints, account }, 200, { 'cache-control': 'no-store' });
    } catch (error) { return json({ error: error.message || 'Provider 同步失败' }, 502); }
  }
  return json({ error: 'Not found' }, 404);
}
