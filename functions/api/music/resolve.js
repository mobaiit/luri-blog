const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const FALLBACK_ATTEMPT_TIMEOUT_MS = 1200;
const FALLBACK_BUDGET_MS = 3000;

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

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Music fallback attempt timed out')), timeoutMs)),
  ]);
}

async function isReachableAudio(url, timeoutMs) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort('Music fallback audio check timed out'), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-1' }, signal: controller.signal });
    await response.body?.cancel();
    return response.ok || response.status === 206;
  } catch { return false; }
  finally { clearTimeout(timer); }
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
    const { isGDStudio, resolveGDStudio } = await import('../../_music/gdstudio.js');
    if (isGDStudio(source)) {
      const musicResult = await Promise.allSettled([resolveGDStudio(source, id, musicInfo)]);
      const [result] = musicResult;
      if (result.status === 'fulfilled' && result.value?.url) {
        try {
          const response = json({ url: browserSafeUrl(result.value.url), art: '', br: result.value.br || null, size: result.value.size || null, provider: 'gdstudio' });
          response.headers.set('cache-control', 'public, max-age=60, s-maxage=60');
          await cacheResponse(cache, cacheKey, response);
          return response;
        } catch (error) { console.warn('GD Studio playback URL was rejected', error); }
      } else console.warn('GD Studio playback URL request failed', result.reason || 'No playable URL returned');
      if (!title || !artist) return json({ url: '', provider: 'gdstudio' });
      const { getMusicRuntime } = await import('../../_music/source-runtime.js');
      const runtime = await getMusicRuntime();
      const entries = await runtime.search(title, 1);
      const normalizedTitle = title.toLocaleLowerCase(); const normalizedArtist = artist?.toLocaleLowerCase();
      const candidates = [...new Map(entries.filter((item) => (item.title || item.name || '').toLocaleLowerCase() === normalizedTitle && String(item.artist || item.singer || '').toLocaleLowerCase().includes(normalizedArtist)).map((item) => [`${item.source}:${item.id || item.songmid || item.hash || ''}`, item])).values()];
      const deadline = Date.now() + FALLBACK_BUDGET_MS; const attemptedSources = [];
      for (const candidate of candidates) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        const timeout = Math.min(FALLBACK_ATTEMPT_TIMEOUT_MS, remaining);
        attemptedSources.push(candidate.source);
        try {
          const fallback = await withTimeout(runtime.invoke({ source: candidate.source, action: 'musicUrl', info: { musicInfo: candidate.musicInfo || candidate, type: '128k' } }), timeout);
          const fallbackUrl = typeof fallback === 'string' ? fallback : fallback?.url || '';
          const playableUrl = browserSafeUrl(fallbackUrl);
          if (await isReachableAudio(playableUrl, Math.min(timeout, Math.max(1, deadline - Date.now())))) return json({ url: playableUrl, provider: 'fallback', fallbackSource: candidate.source });
          console.warn('Music fallback audio endpoint is unavailable', candidate.source);
        } catch (error) { console.warn('Music fallback attempt failed', candidate.source, error); }
      }
      return json({ url: '', provider: 'fallback', attemptedSources });
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
