const query = 'lx-music-source in:name,description';
export async function onRequestGet({ env }) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=900' };
  const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=20`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'luri-music-catalog', ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) } });
  if (!response.ok) return new Response(JSON.stringify({ error: 'GitHub catalog is unavailable' }), { status: 502, headers });
  const payload = await response.json();
  const sources = (payload.items || []).map((item) => ({ name: item.full_name, url: item.html_url, description: item.description || '', updatedAt: item.updated_at, stars: item.stargazers_count }));
  return new Response(JSON.stringify({ checkedAt: new Date().toISOString(), sources }), { headers });
}
