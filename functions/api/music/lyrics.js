const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=300' } });

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const title = url.searchParams.get('title')?.trim();
  const artist = url.searchParams.get('artist')?.trim();
  const source = url.searchParams.get('source') || '';
  const id = url.searchParams.get('id') || '';
  const metaValue = url.searchParams.get('meta');
  if (!title) return json({ error: 'Missing track title' }, 400);
  try {
    const meta = metaValue && metaValue.length <= 8192 ? JSON.parse(metaValue) : {};
    const { isGDStudio, lyricsGDStudio } = await import('../../_music/gdstudio.js');
    if (id && isGDStudio(source)) {
      const result = await lyricsGDStudio(source, id, meta);
      return json({ lyrics: result?.lyric || '', translation: result?.tlyric || '', provider: 'gdstudio' });
    }
  } catch { /* Fall through to the existing title/artist lyric lookup. */ }
  const target = new URL('https://lrclib.net/api/search');
  target.searchParams.set('track_name', title);
  if (artist) target.searchParams.set('artist_name', artist);
  const album = url.searchParams.get('album')?.trim();
  if (album) target.searchParams.set('album_name', album);
  try {
    const response = await fetch(target, { headers: { Accept: 'application/json', 'User-Agent': 'luri-blog-music/1.0' } });
    const matches = response.ok ? await response.json() : [];
    const match = Array.isArray(matches) ? matches.find((item) => item.syncedLyrics || item.plainLyrics) : null;
    return json({ lyrics: match?.syncedLyrics || match?.plainLyrics || '' });
  } catch { return json({ lyrics: '' }); }
}
