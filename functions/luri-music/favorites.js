import { json, now } from './shared.js';

const MAX_FAVORITES = 1000;
const MAX_SNAPSHOT_BYTES = 128 * 1024;
const text = (value, limit) => String(value || '').slice(0, limit);

const binding = (value) => {
  if (!value?.source || !value?.sourceId) return null;
  return {
    source: text(value.source, 100),
    sourceId: text(value.sourceId, 500),
    meta: value.meta && typeof value.meta === 'object' && !Array.isArray(value.meta) ? value.meta : {},
    art: text(value.art, 2000)
  };
};

const sanitizeFavorites = (items) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).slice(0, MAX_FAVORITES).flatMap((item) => {
    const id = text(item?.id, 64); const sourceBinding = binding(item?.binding);
    if (!id || !sourceBinding || seen.has(id)) return [];
    seen.add(id);
    return [{ id, title: text(item?.title, 300), artist: text(item?.artist, 300), binding: sourceBinding }];
  });
};

export async function handleFavoriteRequest(request, env, user) {
  if (!user) return json({ error: '请先登录' }, 401);
  if (request.method === 'GET') {
    const row = await env.LURI_MUSIC_DB.prepare('SELECT favorites_json,favorites_updated_at FROM luri_music_users WHERE id=?').bind(user.id).first();
    let items = []; try { items = sanitizeFavorites(JSON.parse(row?.favorites_json || '[]')); } catch { /* Invalid legacy data is treated as an empty backup. */ }
    return json({ items, updatedAt: row?.favorites_updated_at || null }, 200, { 'cache-control': 'no-store' });
  }
  if (request.method === 'PUT') {
    const data = await request.json().catch(() => ({})); const items = sanitizeFavorites(data.items);
    const snapshot = JSON.stringify(items);
    if (new TextEncoder().encode(snapshot).byteLength > MAX_SNAPSHOT_BYTES) return json({ error: '收藏数据过大' }, 413);
    const timestamp = now();
    await env.LURI_MUSIC_DB.prepare('UPDATE luri_music_users SET favorites_json=?,favorites_updated_at=?,updated_at=? WHERE id=?').bind(snapshot, timestamp, timestamp, user.id).run();
    return json({ ok: true, items, updatedAt: timestamp, count: items.length }, 200, { 'cache-control': 'no-store' });
  }
  return json({ error: 'Method not allowed' }, 405);
}
