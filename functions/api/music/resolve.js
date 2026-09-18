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
  const url = new URL(request.url); const id = url.searchParams.get('id'); const source = url.searchParams.get('source'); const meta = url.searchParams.get('meta');
  if (!id) return json({ error: 'Missing track id' }, 400);
  if (!source) return json({ error: 'Missing music source' }, 400);
  try {
    let musicInfo = { songmid: id, hash: id };
    if (meta && meta.length <= 8192) {
      const parsed = JSON.parse(meta);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) musicInfo = parsed;
    }
    const { isGDStudio, resolveGDStudio } = await import('../../_music/gdstudio.js');
    if (isGDStudio(source)) {
      const result = await resolveGDStudio(source, id, musicInfo);
      return json({ url: result?.url ? browserSafeUrl(result.url) : '', br: result?.br || null, size: result?.size || null, provider: 'gdstudio' });
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
