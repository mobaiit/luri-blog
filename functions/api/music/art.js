const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=86400, s-maxage=86400' } });

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const source = requestUrl.searchParams.get('source') || '';
  const metaValue = requestUrl.searchParams.get('meta');
  const title = requestUrl.searchParams.get('title')?.trim() || '';
  const artist = requestUrl.searchParams.get('artist')?.trim() || '';
  if (metaValue && metaValue.length > 8192) return json({ error: 'Artwork metadata is too large' }, 400);
  try {
    const meta = metaValue ? JSON.parse(metaValue) : {};
    const { isGDStudio, artworkGDStudio } = await import('../../_music/gdstudio.js');
    const cache = caches.default;
    const cacheId = isGDStudio(source) ? `${meta.source || ''}:${meta.picId || ''}` : `${source}:${title}:${artist}`;
    const cacheKey = new Request(`https://luri-music-cache.internal/art/v2?id=${encodeURIComponent(cacheId)}`);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    let artworkUrl = '';
    if (isGDStudio(source) && meta?.picId) artworkUrl = (await artworkGDStudio(source, meta))?.url || '';
    else if (source && title && artist) {
      const { getMusicRuntime } = await import('../../_music/source-runtime.js');
      const entries = await (await getMusicRuntime()).search(title, 1);
      const normalizedTitle = title.toLocaleLowerCase(); const normalizedArtist = artist.toLocaleLowerCase();
      const match = entries.find((item) => item.source === source && (item.title || item.name || '').toLocaleLowerCase() === normalizedTitle && String(item.artist || item.singer || '').toLocaleLowerCase().includes(normalizedArtist));
      artworkUrl = match?.art || match?.pic || '';
    }
    const imageUrl = new URL(artworkUrl);
    if (imageUrl.protocol === 'http:') imageUrl.protocol = 'https:';
    if (imageUrl.protocol !== 'https:') throw new Error('Artwork URL is not HTTPS');
    const response = json({ url: imageUrl.href });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch { return json({ error: 'Artwork is unavailable' }, 502); }
}
