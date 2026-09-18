/**
 * Keyword catalog adapter for the `kw` identifier used by the authorised
 * resolver scripts. It retrieves metadata only; it never requests, stores,
 * or proxies audio bytes.
 */
const { EVENT_NAMES, request, on, send } = globalThis.lx;

const getJson = (url) => new Promise((resolve, reject) => {
  request(url, { method: 'GET', headers: { Accept: 'application/json' } }, (error, response) => {
    if (error || response.statusCode < 200 || response.statusCode >= 300) return reject(error || new Error(response.statusMessage));
    try { resolve(typeof response.body === 'string' ? JSON.parse(response.body) : response.body); }
    catch { reject(new Error('Music catalog returned invalid JSON')); }
  });
});

const clean = (value) => String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();

on(EVENT_NAMES.request, async ({ source, action, info }) => {
  if (source !== 'kw' || action !== 'search' || !info?.keyword) return undefined;
  const endpoint = new URL('http://search.kuwo.cn/r.s');
  Object.entries({ client: 'kt', all: info.keyword, pn: String(Math.max(0, (Number(info.page) || 1) - 1)), rn: String(Math.min(Math.max(Number(info.limit) || 30, 1), 30)), uid: '794762570', ver: 'kwplayer_ar_9.2.2.1', vipver: '1', show_copyright_off: '1', newver: '1', ft: 'music', cluster: '0', strategy: '2012', encoding: 'utf8', rformat: 'json', vermerge: '1', mobi: '1', issubtitle: '1' }).forEach(([key, value]) => endpoint.searchParams.set(key, value));
  const payload = await getJson(endpoint);
  return (payload.abslist || []).map((item) => {
    const songmid = String(item.MUSICRID || '').replace(/^MUSIC_/, '');
    return {
      id: songmid,
      source: 'kw',
      title: clean(item.SONGNAME || item.NAME),
      artist: clean(item.ARTIST),
      album: clean(item.ALBUM),
      duration: Number(item.DURATION) || 0,
      art: String(item.web_albumpic_short || item.hts_MVPIC || item.albumpic || '').replace(/^http:/, 'https:'),
      // The resolver requires this identifier, not an audio URL.
      musicInfo: { songmid },
    };
  }).filter((track) => track.id && track.title);
});

send(EVENT_NAMES.inited, { openDevTools: false, sources: { kw: { name: 'KW Catalog', type: 'music', actions: ['search'], qualitys: [] } } });
