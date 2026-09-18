const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestGet({ request, env }) {
  const keyword = new URL(request.url).searchParams.get('q')?.trim();
  if (!keyword) return json({ error: 'Missing search keyword' }, 400);
  if (!env.MUSIC_SEARCH_ENDPOINT) return json({ error: 'Music search is not configured' }, 503);
  const target = new URL(env.MUSIC_SEARCH_ENDPOINT);
  target.searchParams.set('q', keyword);
  const response = await fetch(target, { headers: env.MUSIC_SOURCE_TOKEN ? { Authorization: `Bearer ${env.MUSIC_SOURCE_TOKEN}` } : {} });
  if (!response.ok) return json({ error: 'Music search provider is unavailable' }, 502);
  const payload = await response.json();
  const entries = Array.isArray(payload) ? payload : payload.tracks || payload.data || payload.result || [];
  const tracks = entries.map((item) => ({ id: String(item.id || item.songmid || item.hash || ''), source: item.source || '', title: item.title || item.name || '', artist: Array.isArray(item.artist) ? item.artist.join(', ') : item.artist || item.singer || '', album: item.album || '', art: item.art || item.pic || '' })).filter((item) => item.id && item.title);
  return json({ tracks });
}
