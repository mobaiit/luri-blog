const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

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
    const { getMusicRuntime } = await import('../../_music/source-runtime.js');
    const runtime = await getMusicRuntime();
    const result = await runtime.invoke({ source, action: 'musicUrl', info: { musicInfo, type: '128k' } });
    return json({ url: typeof result === 'string' ? result : result?.url || '' });
  } catch {
    return json({ error: 'Music resolver is unavailable' }, 502);
  }
}
