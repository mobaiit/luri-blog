/**
 * iTunes public preview source.
 * It searches Apple’s public catalog and returns the HTTPS preview URL supplied
 * by the catalog. Audio is played by the browser directly, never proxied.
 */
const { EVENT_NAMES, request, on, send } = globalThis.lx;

const getJson = (url) => new Promise((resolve, reject) => {
  request(url, { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'luri-blog-music/1.0' } }, (error, response) => {
    if (error || response.statusCode < 200 || response.statusCode >= 300) return reject(error || new Error(response.statusMessage));
    resolve(response.body);
  });
});

on(EVENT_NAMES.request, async ({ source, action, info }) => {
  if (source !== 'itunes') return undefined;
  if (action === 'musicUrl') return info.musicInfo?.previewUrl || '';
  if (action !== 'search' || !info?.keyword) return undefined;
  const target = new URL('https://itunes.apple.com/search');
  target.searchParams.set('term', info.keyword);
  target.searchParams.set('entity', 'song');
  target.searchParams.set('limit', String(Math.min(Number(info.limit) || 30, 50)));
  const payload = await getJson(target);
  return (payload.results || []).filter((item) => item.previewUrl).map((item) => ({
    id: String(item.trackId), source: 'itunes', title: item.trackName || '', artist: item.artistName || '', album: item.collectionName || '',
    art: item.artworkUrl100 || '', musicInfo: { previewUrl: item.previewUrl },
  }));
});

send(EVENT_NAMES.inited, { openDevTools: false, sources: { itunes: { name: 'iTunes Preview', type: 'music', actions: ['search', 'musicUrl'], qualitys: ['128k'] } } });
