/** Metadata-only KG catalog. It supplies the hash required by the authorised
 * KG resolver; no audio data is requested or proxied here. */
const { EVENT_NAMES, request, on, send } = globalThis.lx;

const getJson = (url) => new Promise((resolve, reject) => {
  request(url, { method: 'GET', headers: { Accept: 'application/json' }, timeout: 2000 }, (error, response) => {
    if (error || response.statusCode < 200 || response.statusCode >= 300) return reject(error || new Error(response.statusMessage));
    try { resolve(typeof response.body === 'string' ? JSON.parse(response.body) : response.body); }
    catch { reject(new Error('KG catalog returned invalid JSON')); }
  });
});

const clean = (value) => String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();

on(EVENT_NAMES.request, async ({ source, action, info }) => {
  if (source !== 'kg' || action !== 'search' || !info?.keyword) return undefined;
  const url = new URL('https://songsearch.kugou.com/song_search_v2');
  Object.entries({ keyword: info.keyword, page: String(Math.max(1, Number(info.page) || 1)), pagesize: String(Math.min(Math.max(1, Number(info.limit) || 30), 30)), userid: '0', platform: 'WebFilter', filter: '2', iscorrection: '1', privilege_filter: '0', area_code: '1' }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await getJson(url);
  if (payload.error_code !== 0) throw new Error('KG catalog rejected the query');
  return (payload.data?.lists || []).map((item) => {
    const hash = item.FileHash || item.HQFileHash || item.SQFileHash || '';
    const songmid = String(item.Audioid || '');
    return {
      id: songmid || hash,
      source: 'kg',
      title: clean(item.SongName),
      artist: clean(Array.isArray(item.Singers) ? item.Singers.map((singer) => singer.name).join(', ') : item.SingerName),
      album: clean(item.AlbumName),
      duration: Number(item.Duration) || 0,
      art: '',
      musicInfo: { hash, songmid },
    };
  }).filter((track) => track.id && track.title && track.musicInfo.hash);
});

send(EVENT_NAMES.inited, { openDevTools: false, sources: { kg: { name: 'KG Catalog', type: 'music', actions: ['search'], qualitys: [] } } });
