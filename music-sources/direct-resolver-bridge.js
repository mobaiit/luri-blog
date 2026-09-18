/**
 * Deterministic HTTPS resolver bridge for the authorised URL services used by
 * the supplied source scripts. It returns only a redirect URL; audio remains
 * a browser-to-source request.
 */
const { EVENT_NAMES, on, send } = globalThis.lx;

const routes = {
  kg: { path: '/kg/kg_song_kw.php', id: (info) => info.hash || info.songmid || info.id },
  tx: { path: '/qq/qq_kw.php', id: (info) => info.songmid || info.id || info.mid },
  kw: { path: '/kw/kw.php', id: (info) => info.songmid || info.id || info.mid },
  wy: { path: '/wy/wy.php', id: (info) => info.songmid || info.id || info.mid },
};
const qualityMap = { '128k': 'standard', '320k': 'higher', flac: 'sq', flac24bit: 'hires' };

on(EVENT_NAMES.request, ({ source, action, info }) => {
  if (action !== 'musicUrl' || !routes[source]) return undefined;
  const musicInfo = info?.musicInfo || {};
  const id = routes[source].id(musicInfo);
  if (!id) throw new Error(`${source} requires a song identifier`);
  const url = new URL(routes[source].path, 'https://yinyue.haitangw.net');
  url.searchParams.set('type', 'mp3');
  url.searchParams.set('id', String(id));
  url.searchParams.set('level', qualityMap[info.type] || 'standard');
  return url.href;
});

const sources = Object.fromEntries(Object.keys(routes).map((source) => [source, {
  name: `${source.toUpperCase()} Resolver`, type: 'music', actions: ['musicUrl'], qualitys: Object.keys(qualityMap),
}]));
send(EVENT_NAMES.inited, { openDevTools: false, sources });
