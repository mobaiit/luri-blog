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

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url); const id = url.searchParams.get('id'); const source = url.searchParams.get('source'); const meta = url.searchParams.get('meta'); const title = url.searchParams.get('title')?.trim(); const artist = url.searchParams.get('artist')?.trim();
  if (!id) return json({ error: 'Missing track id' }, 400);
  if (!source) return json({ error: 'Missing music source' }, 400);
  try {
    let musicInfo = { songmid: id, hash: id };
    if (meta && meta.length <= 8192) {
      const parsed = JSON.parse(meta);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) musicInfo = parsed;
    }
    const { isGDStudio, resolveGDStudio, artworkGDStudio } = await import('../../_music/gdstudio.js');
    if (isGDStudio(source)) {
      try {
        const [musicResult, artworkResult] = await Promise.allSettled([resolveGDStudio(source, id, musicInfo), artworkGDStudio(source, musicInfo)]);
        const result = musicResult.status === 'fulfilled' ? musicResult.value : null;
        const artwork = artworkResult.status === 'fulfilled' ? artworkResult.value?.url || '' : '';
        if (result?.url) return json({ url: browserSafeUrl(result.url), art: artwork ? browserSafeUrl(artwork) : '', br: result.br || null, size: result.size || null, provider: 'gdstudio' });
      } catch { /* Try the approved local resolvers below for this track only. */ }
      if (!title) return json({ url: '', provider: 'gdstudio' });
      const { getMusicRuntime } = await import('../../_music/source-runtime.js');
      const runtime = await getMusicRuntime();
      const entries = await runtime.search(title, 1);
      const normalizedTitle = title.toLocaleLowerCase(); const normalizedArtist = artist?.toLocaleLowerCase();
      const match = entries.find((item) => (item.title || item.name || '').toLocaleLowerCase() === normalizedTitle && (!normalizedArtist || String(item.artist || item.singer || '').toLocaleLowerCase().includes(normalizedArtist))) || entries.find((item) => (item.title || item.name || '').toLocaleLowerCase() === normalizedTitle) || entries[0];
      if (!match?.source) return json({ url: '', provider: 'gdstudio' });
      const fallback = await runtime.invoke({ source: match.source, action: 'musicUrl', info: { musicInfo: match.musicInfo || match, type: '128k' } });
      const fallbackUrl = typeof fallback === 'string' ? fallback : fallback?.url || '';
      return json({ url: fallbackUrl ? browserSafeUrl(fallbackUrl) : '', provider: 'fallback', fallbackSource: match.source });
    }
    const { getMusicRuntime } = await import('../../_music/source-runtime.js');
    const runtime = await getMusicRuntime();
    const result = await runtime.invoke({ source, action: 'musicUrl', info: { musicInfo, type: '128k' } });
    const value = typeof result === 'string' ? result : result?.url || '';
    return json({ url: value ? browserSafeUrl(value) : '' });
  } catch {
    return json({ error: 'Music resolver is unavailable' }, 502);
  }
}
