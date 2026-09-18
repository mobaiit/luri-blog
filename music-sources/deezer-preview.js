/**
 * Deezer public preview source. It returns catalog metadata and HTTPS preview
 * URLs; the browser fetches audio directly and Cloudflare never proxies it.
 */
const { EVENT_NAMES, request, on, send } = globalThis.lx;

const getJson = (url) => new Promise((resolve, reject) => {
  request(url, { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'luri-blog-music/1.0' } }, (error, response) => {
    if (error || response.statusCode < 200 || response.statusCode >= 300) return reject(error || new Error(response.statusMessage));
    resolve(response.body);
  });
});

on(EVENT_NAMES.request, async ({ source, action, info }) => {
  if (source !== 'deezer') return undefined;
  if (action === 'musicUrl') return info.musicInfo?.previewUrl || '';
  if (action !== 'search' || !info?.keyword) return undefined;
  const target = new URL('https://api.deezer.com/search');
  target.searchParams.set('q', info.keyword);
  target.searchParams.set('limit', String(Math.min(Number(info.limit) || 30, 50)));
  const payload = await getJson(target);
  return (payload.data || []).filter((item) => item.preview).map((item) => ({
    id: String(item.id), source: 'deezer', title: item.title || '', artist: item.artist?.name || '', album: item.album?.title || '',
    art: item.album?.cover_medium || item.album?.cover || '', musicInfo: { previewUrl: item.preview },
  }));
});

send(EVENT_NAMES.inited, { openDevTools: false, sources: { deezer: { name: 'Deezer Preview', type: 'music', actions: ['search', 'musicUrl'], qualitys: ['128k'] } } });
