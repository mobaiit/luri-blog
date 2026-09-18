const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestGet({ request, env }) {
  const requestUrl = new URL(request.url); const keyword = requestUrl.searchParams.get('q')?.trim();
  const page = Math.max(1, Number(requestUrl.searchParams.get('page')) || 1);
  if (!keyword) return json({ error: 'Missing search keyword' }, 400);
  try {
    const { getMusicRuntime } = await import('../../_music/source-runtime.js');
    const runtime = await getMusicRuntime();
    const entries = await runtime.search(keyword, page);
    const tracks = entries.map((item) => ({ id: String(item.id || item.songmid || item.hash || ''), source: item.source || '', title: item.title || item.name || '', artist: Array.isArray(item.artist) ? item.artist.join(', ') : item.artist || item.singer || '', album: item.album || item.albumName || '', duration: Number(item.duration) || 0, art: item.art || item.pic || '', meta: item.musicInfo || item })).filter((item) => item.id && item.title && item.source);
    return json({ tracks, page, hasMore: tracks.length > 0 });
  } catch {
    return json({ error: 'Music source search is unavailable' }, 502);
  }
}
