import { json, now } from './shared.js';

const MAX_FAVORITES = 1000;
const MAX_SNAPSHOT_BYTES = 128 * 1024;
const text = (value, limit) => String(value || '').trim().slice(0, limit);
const titleKey = (value) => text(value, 300).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ');

const sanitizeFavorites = (items) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).slice(0, MAX_FAVORITES).flatMap((item) => {
    const title = text(item?.title, 300); const key = titleKey(title);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ title, artist: text(item?.artist, 300), source: text(item?.source, 100), sourceId: text(item?.sourceId, 500) }];
  });
};

export async function handleFavoriteRequest(request, env, user) {
  if (!user) return json({ error: '请先登录' }, 401);
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const providerId = text(url.searchParams.get('providerId'), 80);
    if (!providerId) return json({ error: '缺少 Provider 配置' }, 400);
    const row = await env.LURI_MUSIC_DB.prepare('SELECT s.favorites_json,s.updated_at FROM luri_music_provider_configs p LEFT JOIN luri_music_favorite_snapshots s ON s.provider_config_id=p.id AND s.user_id=p.user_id WHERE p.id=? AND p.user_id=?').bind(providerId, user.id).first();
    if (!row) return json({ error: 'Provider 配置不存在' }, 404);
    let items = []; try { items = sanitizeFavorites(JSON.parse(row.favorites_json || '[]')); } catch { /* Invalid legacy data is treated as an empty backup. */ }
    return json({ items, updatedAt: row.updated_at || null }, 200, { 'cache-control': 'no-store' });
  }
  if (request.method === 'PUT') {
    const data = await request.json().catch(() => ({})); const providerId = text(data.providerId, 80); const items = sanitizeFavorites(data.items);
    if (!providerId) return json({ error: '缺少 Provider 配置' }, 400);
    const snapshot = JSON.stringify(items);
    if (new TextEncoder().encode(snapshot).byteLength > MAX_SNAPSHOT_BYTES) return json({ error: '收藏数据过大' }, 413);
    const timestamp = now();
    const result = await env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_favorite_snapshots(user_id,provider_config_id,favorites_json,updated_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM luri_music_provider_configs WHERE id=? AND user_id=?) ON CONFLICT(user_id,provider_config_id) DO UPDATE SET favorites_json=excluded.favorites_json,updated_at=excluded.updated_at').bind(user.id, providerId, snapshot, timestamp, providerId, user.id).run();
    if (!result.meta?.changes) return json({ error: 'Provider 配置不存在' }, 404);
    return json({ ok: true, updatedAt: timestamp, count: items.length });
  }
  return json({ error: 'Method not allowed' }, 405);
}
