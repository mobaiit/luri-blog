const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function browserSafeUrl(value) {
  const url = new URL(value);
  // This authorised resolver returns an HTTP redirect which leads to HTTPS.
  // Upgrade its known TLS-capable origin so the browser never starts a mixed-
  // content request; audio bytes still go directly from the browser to source.
  if (url.protocol === 'http:' && url.hostname === 'yinyue.haitangw.net') url.protocol = 'https:';
  if (url.protocol !== 'https:') throw new Error('The resolved audio URL is not HTTPS');
  return url.href;
}

async function cacheResponse(cache, cacheKey, response) {
  try { await cache.put(cacheKey, response.clone()); }
  catch (error) { console.warn('Music resolver cache write failed', error); }
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url); const id = url.searchParams.get('id'); const source = url.searchParams.get('source'); const meta = url.searchParams.get('meta'); const title = url.searchParams.get('title')?.trim(); const artist = url.searchParams.get('artist')?.trim();
  if (!id) return json({ error: 'Missing track id' }, 400);
  if (!source) return json({ error: 'Missing music source' }, 400);
  try {
    const cache = caches.default;
    // Version the key so an earlier cached fallback URL cannot mask a now
    // healthy primary response during its old TTL.
    const cacheKey = new Request(`https://luri-music-cache.internal/resolve/v2?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    let musicInfo = { songmid: id, hash: id };
    if (meta && meta.length <= 8192) {
      const parsed = JSON.parse(meta);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) musicInfo = parsed;
    }
    const { isGDStudio, resolveGDStudio, artworkGDStudio } = await import('../../_music/gdstudio.js');
    if (isGDStudio(source)) {
      const [musicResult, artworkResult] = await Promise.allSettled([resolveGDStudio(source, id, musicInfo), artworkGDStudio(source, musicInfo)]);
      if (musicResult.status === 'fulfilled' && musicResult.value?.url) {
        let artwork = '';
        if (artworkResult.status === 'fulfilled' && artworkResult.value?.url) {
          try { artwork = browserSafeUrl(artworkResult.value.url); }
          catch (error) { console.warn('GD Studio artwork URL was rejected', error); }
        } else if (artworkResult.status === 'rejected') console.warn('GD Studio artwork request failed', artworkResult.reason);
        try {
          const result = musicResult.value;
          const response = json({ url: browserSafeUrl(result.url), art: artwork, br: result.br || null, size: result.size || null, provider: 'gdstudio' });
          response.headers.set('cache-control', 'public, max-age=60, s-maxage=60');
          await cacheResponse(cache, cacheKey, response);
          return response;
        } catch (error) { console.warn('GD Studio playback URL was rejected', error); }
      } else console.warn('GD Studio playback URL request failed', musicResult.reason || 'No playable URL returned');
      if (!title) return json({ url: '', provider: 'gdstudio' });
      const { getMusicRuntime } = await import('../../_music/source-runtime.js');
      const runtime = await getMusicRuntime();
      const entries = await runtime.search(title, 1);
      const normalizedTitle = title.toLocaleLowerCase(); const normalizedArtist = artist?.toLocaleLowerCase();
      const match = entries.find((item) => (item.title || item.name || '').toLocaleLowerCase() === normalizedTitle && (!normalizedArtist || String(item.artist || item.singer || '').toLocaleLowerCase().includes(normalizedArtist))) || entries.find((item) => (item.title || item.name || '').toLocaleLowerCase() === normalizedTitle) || entries[0];
      if (!match?.source) return json({ url: '', provider: 'gdstudio' });
      const fallback = await runtime.invoke({ source: match.source, action: 'musicUrl', info: { musicInfo: match.musicInfo || match, type: '128k' } });
      const fallbackUrl = typeof fallback === 'string' ? fallback : fallback?.url || '';
      const response = json({ url: fallbackUrl ? browserSafeUrl(fallbackUrl) : '', provider: 'fallback', fallbackSource: match.source });
      return response;
    }
    const { getMusicRuntime } = await import('../../_music/source-runtime.js');
    const runtime = await getMusicRuntime();
    const result = await runtime.invoke({ source, action: 'musicUrl', info: { musicInfo, type: '128k' } });
    const value = typeof result === 'string' ? result : result?.url || '';
    const response = json({ url: value ? browserSafeUrl(value) : '' });
    if (value) { response.headers.set('cache-control', 'public, max-age=60, s-maxage=60'); await cacheResponse(cache, cacheKey, response); }
    return response;
  } catch (error) {
    console.error('Music resolver failed', error);
    return json({ error: 'Music resolver is unavailable' }, 502);
  }
}
