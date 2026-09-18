const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url); const keyword = requestUrl.searchParams.get('q')?.trim();
  const page = Math.max(1, Number(requestUrl.searchParams.get('page')) || 1);
  if (!keyword) return json({ error: 'Missing search keyword' }, 400);
  if (keyword.length > 100 || page > 50) return json({ error: 'Invalid search parameters' }, 400);
  try {
    const cache = caches.default;
    const cacheKey = new Request(`https://luri-music-cache.internal/gdstudio/search?q=${encodeURIComponent(keyword)}&page=${page}`);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    const { searchGDStudio } = await import('../../_music/gdstudio.js');
    let primaryTracks = [];
    try { primaryTracks = await searchGDStudio(keyword, page); } catch { /* Use the local source chain below. */ }
    if (primaryTracks.length) {
      const result = json({ tracks: primaryTracks, page, hasMore: primaryTracks.length >= 30, provider: 'gdstudio' });
      result.headers.set('cache-control', 'public, max-age=300, s-maxage=300');
      await cache.put(cacheKey, result.clone());
      return result;
    }
    // Keep existing approved source scripts as a failure-only fallback.
    const { getMusicRuntime } = await import('../../_music/source-runtime.js');
    const runtime = await getMusicRuntime();
    const entries = await runtime.search(keyword, page);
    const tracks = entries.map((item) => ({ id: String(item.id || item.songmid || item.hash || ''), source: item.source || '', title: item.title || item.name || '', artist: Array.isArray(item.artist) ? item.artist.join(', ') : item.artist || item.singer || '', album: item.album || item.albumName || '', duration: Number(item.duration) || 0, art: item.art || item.pic || '', meta: item.musicInfo || item })).filter((item) => item.id && item.title && item.source);
    return json({ tracks, page, hasMore: tracks.length > 0 });
  } catch {
    return json({ error: 'Music source search is unavailable' }, 502);
  }
}
