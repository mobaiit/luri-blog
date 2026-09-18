const query = 'lx-music-source in:name,description';
export async function onRequestGet({ env }) {
  const cache = caches.default;
  const cacheKey = new Request('https://music-catalog.internal/sources');
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('x-music-catalog-cache', 'HIT');
    return new Response(cached.body, { status: cached.status, headers });
  }

  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=900, s-maxage=900', 'x-music-catalog-cache': 'MISS' };
  const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=20`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'luri-music-catalog', ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) } });
  if (!response.ok) return new Response(JSON.stringify({ error: 'GitHub catalog is unavailable' }), { status: 502, headers });
  const payload = await response.json();
  const sources = (payload.items || []).map((item) => ({ name: item.full_name, url: item.html_url, description: item.description || '', updatedAt: item.updated_at, stars: item.stargazers_count }));
  const result = new Response(JSON.stringify({ checkedAt: new Date().toISOString(), sources }), { headers });
  await cache.put(cacheKey, result.clone());
  return result;
}
