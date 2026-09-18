const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url); const id = url.searchParams.get('id'); const source = url.searchParams.get('source');
  if (!id) return json({ error: 'Missing track id' }, 400);
  if (!env.MUSIC_RESOLVE_ENDPOINT) return json({ error: 'Music resolver is not configured' }, 503);
  const target = new URL(env.MUSIC_RESOLVE_ENDPOINT); target.searchParams.set('id', id); if (source) target.searchParams.set('source', source);
  const response = await fetch(target, { headers: env.MUSIC_SOURCE_TOKEN ? { Authorization: `Bearer ${env.MUSIC_SOURCE_TOKEN}` } : {} });
  if (!response.ok) return json({ error: 'Music resolver is unavailable' }, 502);
  const payload = await response.json(); return json({ url: payload.url || payload.data?.url || payload.data || '' });
}
