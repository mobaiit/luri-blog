const API = 'https://music-api.gdstudio.xyz/api.php';
// Keep this source name colon-free: the client prefixes track IDs as
// `track:<source>:<id>` and strips that prefix before resolving.
export const GDSTUDIO_PREFIX = 'gdstudio_';

async function request(types, parameters) {
  const target = new URL(API);
  target.searchParams.set('types', types);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== '') target.searchParams.set(key, String(value));
  }
  const response = await fetch(target, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`GD Studio returned ${response.status}`);
  return response.json();
}

export async function searchGDStudio(keyword, page) {
  const source = 'netease';
  const payload = await request('search', { source, name: keyword, count: 30, pages: page });
  if (!Array.isArray(payload)) return [];
  return payload.map((item) => {
    const id = String(item.id || '');
    return {
      id,
      source: `${GDSTUDIO_PREFIX}${item.source || source}`,
      title: item.name || '',
      artist: Array.isArray(item.artist) ? item.artist.join(', ') : item.artist || '',
      album: item.album || '',
      duration: Number(item.duration) || 0,
      art: '',
      meta: { provider: 'gdstudio', source: item.source || source, lyricId: String(item.lyric_id || id), picId: String(item.pic_id || '') },
    };
  }).filter((track) => track.id && track.title);
}

export function isGDStudio(source) {
  return source?.startsWith(GDSTUDIO_PREFIX);
}

export function gdStudioSource(source, meta) {
  return meta?.source || source.slice(GDSTUDIO_PREFIX.length) || 'netease';
}

export const resolveGDStudio = (source, id, meta) => request('url', { source: gdStudioSource(source, meta), id, br: 320 });
export const lyricsGDStudio = (source, id, meta) => request('lyric', { source: gdStudioSource(source, meta), id: meta?.lyricId || id });
export const artworkGDStudio = (source, meta) => request('pic', { source: gdStudioSource(source, meta), id: meta?.picId, size: 300 });
