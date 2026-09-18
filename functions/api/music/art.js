const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=86400, s-maxage=86400' } });

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const source = requestUrl.searchParams.get('source') || '';
  const metaValue = requestUrl.searchParams.get('meta');
  if (!metaValue || metaValue.length > 8192) return json({ error: 'Missing artwork metadata' }, 400);
  try {
    const meta = JSON.parse(metaValue);
    const { isGDStudio, artworkGDStudio } = await import('../../_music/gdstudio.js');
    if (!isGDStudio(source) || !meta?.picId) return json({ error: 'Artwork source is unavailable' }, 400);
    const cache = caches.default;
    const cacheKey = new Request(`https://luri-music-cache.internal/gdstudio/art?source=${encodeURIComponent(meta.source || '')}&id=${encodeURIComponent(meta.picId)}`);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    const result = await artworkGDStudio(source, meta);
    const imageUrl = new URL(result?.url || '');
    if (imageUrl.protocol !== 'https:') throw new Error('Artwork URL is not HTTPS');
    const response = json({ url: imageUrl.href });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch { return json({ error: 'Artwork is unavailable' }, 502); }
}
