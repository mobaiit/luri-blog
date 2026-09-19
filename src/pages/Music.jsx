import { useEffect, useRef, useState } from 'react';
import './Music.css';

const EMPTY_ART = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23ece9e1"/%3E%3Ccircle cx="200" cy="200" r="106" fill="%23c8c2b7"/%3E%3Ccircle cx="200" cy="200" r="22" fill="%23111111"/%3E%3C/svg%3E';
const TEXT = { title: '\u97f3\u4e50', discover: '\u53d1\u73b0\u97f3\u4e50', likes: '\u6211\u7684\u559c\u6b22', search: '\u641c\u7d22', searchHint: '\u641c\u7d22\u6b4c\u66f2\u3001\u827a\u4eba\u6216\u4e13\u8f91', searching: '\u6b63\u5728\u641c\u7d22\u2026', queue: '\u64ad\u653e\u961f\u5217', tracks: '\u9996\u6b4c\u66f2', noResult: '\u6682\u65e0\u641c\u7d22\u7ed3\u679c', noTrack: '\u6682\u65e0\u6b4c\u66f2', choose: '\u8bf7\u641c\u7d22\u540e\u9009\u62e9\u6b4c\u66f2', now: '\u6b63\u5728\u64ad\u653e', play: '\u64ad\u653e', pause: '\u6682\u505c', prev: '\u4e0a\u4e00\u9996', next: '\u4e0b\u4e00\u9996', load: '\u6b63\u5728\u83b7\u53d6\u53ef\u64ad\u653e\u6587\u4ef6\u2026', unavailable: '\u6ca1\u6709\u627e\u5230\u53ef\u76f4\u64ad\u7684\u97f3\u9891\u6587\u4ef6', source: '\u516c\u5f00\u97f3\u9891\u76ee\u5f55', disclaimer: '\u672c\u9875\u4ec5\u63d0\u4f9b\u641c\u7d22\u4e0e\u64ad\u653e\u754c\u9762\uff0c\u4e0d\u6258\u7ba1\u3001\u4e0d\u590d\u5236\u3001\u4e0d\u4ee3\u7406\u4efb\u4f55\u97f3\u9891\u6587\u4ef6\u3002\u8bf7\u4ec5\u4f7f\u7528\u5df2\u83b7\u6388\u6743\u7684\u97f3\u6e90\uff0c\u5e76\u9075\u5b88\u5176\u670d\u52a1\u6761\u6b3e\u4e0e\u9002\u7528\u6cd5\u5f8b\u3002' };
const time = (value = 0) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
const lyricLine = (line) => { const match = /^\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/.exec(line); return match ? { time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() } : { time: -1, text: line }; };
const STORE_QUEUE = 'luri.music.queue.v1'; const STORE_LIKES = 'luri.music.likes.v1'; const STORE_SEARCH = 'luri.music.search.v1'; const STORE_QUERY = 'luri.music.query.v1'; const STORE_RECENT_SEARCHES = 'luri.music.recent-searches.v1';
const readStore = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const trackKey = (track) => { const id = String(track?.id || ''); return id.startsWith('track:') ? id : `track:${track?.source || 'default'}:${id}`; };
const sourceTrackId = (track) => track?.sourceId ?? String(track?.id || '').replace(/^track:[^:]+:/, '');
// The source status is shown only while an operation is in progress.
TEXT.source = '';
TEXT.unavailable = '加载失败，请重新播放';

function MusicIcon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="5.5" /><path d="m15.2 15.2 4 4" /></>,
    play: <path d="m9 6 8 6-8 6Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M9 6v12M15 6v12" /></>,
    previous: <><path d="M7 6v12" /><path d="m17 6-7 6 7 6Z" fill="currentColor" stroke="none" /></>,
    next: <><path d="M17 6v12" /><path d="m7 6 7 6-7 6Z" fill="currentColor" stroke="none" /></>,
    volume: <><path d="M5 10h3l4-3v10l-4-3H5Z" fill="currentColor" stroke="none" /><path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.7a7.4 7.4 0 0 1 0 10.6" /></>,
    mute: <><path d="M5 10h3l4-3v10l-4-3H5Z" fill="currentColor" stroke="none" /><path d="m16 10 4 4m0-4-4 4" /></>,
    download: <><path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M5 20h14" /></>,
  };
  return <svg className="music-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function Music() {
  const audio = useRef(null);
  const restoreResults = () => readStore(STORE_SEARCH).map((track) => ({ ...track, sourceId: sourceTrackId(track), id: trackKey(track) }));
  const [query, setQuery] = useState(() => localStorage.getItem(STORE_QUERY) || ''); const [results, setResults] = useState(restoreResults); const [cachedResults, setCachedResults] = useState(restoreResults); const [recentSearches, setRecentSearches] = useState(() => readStore(STORE_RECENT_SEARCHES).filter((item) => typeof item === 'string').slice(0, 5)); const [searchState, setSearchState] = useState('');
  const [listView, setListView] = useState('search');
  const [mobileView, setMobileView] = useState('playlist');
  const [activeQueue, setActiveQueue] = useState('normal');
  const [resultPage, setResultPage] = useState(0); const [hasMoreResults, setHasMoreResults] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const [tracks, setTracks] = useState(() => readStore(STORE_QUEUE)); const [likedTracks, setLikedTracks] = useState(() => readStore(STORE_LIKES)); const [currentId, setCurrentId] = useState(null); const [playing, setPlaying] = useState(false); const [playbackState, setPlaybackState] = useState('idle'); const [playbackTrackId, setPlaybackTrackId] = useState(null); const [playbackAttempt, setPlaybackAttempt] = useState(0); const [titleOverflows, setTitleOverflows] = useState(false);
  const [progress, setProgress] = useState(0); const [duration, setDuration] = useState(0); const [liked, setLiked] = useState(() => new Set(readStore(STORE_LIKES).map((track) => track.id)));
  const [volume, setVolume] = useState(0.8); const [muted, setMuted] = useState(false);
  const [lyrics, setLyrics] = useState(''); const [lyricsState, setLyricsState] = useState('');
  const lyricsRef = useRef(null);
  const activeTracks = activeQueue === 'favorites' ? likedTracks : tracks;
  const current = activeTracks.find((track) => track.id === currentId);
  const lyricLines = lyrics.split(/\r?\n/).filter(Boolean).map(lyricLine).filter((line) => line.text);
  const activeLyric = lyricLines.reduce((active, line, index) => line.time >= 0 && line.time <= progress ? index : active, -1);

  useEffect(() => {
    if (!currentId) return;
    if (activeQueue === 'favorites' && !likedTracks.some((track) => track.id === currentId) && tracks.some((track) => track.id === currentId)) setActiveQueue('normal');
    if (activeQueue === 'normal' && !tracks.some((track) => track.id === currentId) && likedTracks.some((track) => track.id === currentId)) setActiveQueue('favorites');
  }, [currentId, activeQueue, tracks, likedTracks]);

  useEffect(() => {
    if (!audio.current || !current?.url) return;
    setPlaybackTrackId(current.id); setPlaybackState('loading'); setProgress(0); setDuration(0);
    audio.current.src = current.url; audio.current.load();
    audio.current.play().catch(() => { setPlaying(false); setPlaybackState('error'); });
  }, [currentId, current?.id, current?.url]);
  useEffect(() => { if (listView === 'search') setCachedResults(results); }, [listView, results]);
  useEffect(() => { try { localStorage.setItem(STORE_SEARCH, JSON.stringify(cachedResults)); localStorage.setItem(STORE_QUERY, query); } catch { /* Storage is unavailable in private browsing. */ } }, [cachedResults, query]);
  useEffect(() => { try { localStorage.setItem(STORE_RECENT_SEARCHES, JSON.stringify(recentSearches)); } catch { /* Storage is unavailable in private browsing. */ } }, [recentSearches]);
  useEffect(() => {
    if (!current || current.url) return undefined;
    setPlaybackTrackId(current.id); setPlaybackState('resolving');
    const controller = new AbortController(); const meta = current.meta ? `&meta=${encodeURIComponent(JSON.stringify(current.meta))}` : '';
    fetch(`/api/music/resolve?id=${encodeURIComponent(sourceTrackId(current))}&source=${encodeURIComponent(current.source || '')}&title=${encodeURIComponent(current.title || '')}&artist=${encodeURIComponent(current.artist || '')}${meta}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : {}).then((payload) => {
      if (!payload.url) throw Error();
      if (!controller.signal.aborted) (activeQueue === 'favorites' ? setLikedTracks : setTracks)((items) => items.map((track) => track.id === current.id ? { ...track, url: payload.url, art: payload.art || track.art } : track));
    }).catch(() => { if (!controller.signal.aborted) setPlaybackState('error'); });
    return () => controller.abort();
  }, [activeQueue, current, playbackAttempt]);
  useEffect(() => {
    if (!current || (current.art && current.art !== EMPTY_ART) || !current.source) return undefined;
    const controller = new AbortController(); const meta = current.meta ? `&meta=${encodeURIComponent(JSON.stringify(current.meta))}` : '';
    fetch(`/api/music/art?source=${encodeURIComponent(current.source)}&id=${encodeURIComponent(sourceTrackId(current))}&title=${encodeURIComponent(current.title || '')}&artist=${encodeURIComponent(current.artist || '')}${meta}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : {}).then((payload) => {
      if (payload.url && !controller.signal.aborted) (activeQueue === 'favorites' ? setLikedTracks : setTracks)((items) => items.map((track) => track.id === current.id ? { ...track, art: payload.url } : track));
    }).catch(() => {});
    return () => controller.abort();
  }, [activeQueue, current]);
  useEffect(() => { try { localStorage.setItem(STORE_QUEUE, JSON.stringify(tracks.slice(0, 50).map(({ url: _url, ...track }) => track))); } catch { /* Storage is unavailable in private browsing. */ } }, [tracks]);
  useEffect(() => { try { localStorage.setItem(STORE_LIKES, JSON.stringify(likedTracks)); } catch { /* Storage is unavailable in private browsing. */ } }, [likedTracks]);
  useEffect(() => { if (!audio.current) return; audio.current.volume = volume; audio.current.muted = muted; }, [volume, muted]);
  useEffect(() => { const title = document.querySelector('.music-row.current .track-title'); setTitleOverflows(Boolean(title && title.scrollWidth > title.clientWidth)); }, [currentId, results, tracks]);
  useEffect(() => {
    const body = lyricsRef.current; if (!body) return;
    lyricsRef.current = body;
    const nodes = body.querySelectorAll('p'); nodes.forEach((node, index) => node.classList.toggle('active', index === activeLyric));
    const active = nodes[activeLyric]; if (!active) return;
    // A manual browse is temporary: every new lyric line returns to its play anchor.
    const desktop = window.matchMedia('(min-width: 761px)').matches;
    const anchor = desktop ? body.clientHeight / 2 + active.offsetHeight : body.clientHeight / 2;
    body.scrollTo({ top: Math.max(0, active.offsetTop - anchor + active.offsetHeight / 2), behavior: 'smooth' });
  }, [activeLyric]);
  useEffect(() => { if (lyricsRef.current) lyricsRef.current.scrollTop = 0; }, [current?.id, lyrics]);
  useEffect(() => {
    const body = lyricsRef.current; if (!body) return undefined;
    let startedOnLyric = false;
    const isLyricLane = (target, point) => {
      const lines = [...body.querySelectorAll('p')];
      let line = target.closest?.('p');
      if (!line || !body.contains(line)) line = lines.find((candidate, index) => {
        const bounds = candidate.getBoundingClientRect();
        const previous = lines[index - 1]?.getBoundingClientRect(); const next = lines[index + 1]?.getBoundingClientRect();
        const top = previous ? (previous.bottom + bounds.top) / 2 : bounds.top;
        const bottom = next ? (bounds.bottom + next.top) / 2 : bounds.bottom;
        return point.clientY >= top && point.clientY <= bottom;
      });
      if (!line) return false;
      const range = document.createRange(); range.selectNodeContents(line); const text = range.getBoundingClientRect();
      return point.clientX >= text.left && point.clientX <= text.right;
    };
    const onTouchStart = (event) => { startedOnLyric = isLyricLane(event.target, event.touches[0]); };
    const onTouchMove = (event) => { if (!startedOnLyric) event.preventDefault(); };
    const onTouchEnd = () => { startedOnLyric = false; };
    const onWheel = (event) => { if (!isLyricLane(event.target, event)) event.preventDefault(); };
    body.addEventListener('touchstart', onTouchStart, { passive: true });
    body.addEventListener('touchmove', onTouchMove, { passive: false });
    body.addEventListener('touchend', onTouchEnd, { passive: true });
    body.addEventListener('touchcancel', onTouchEnd, { passive: true });
    body.addEventListener('wheel', onWheel, { passive: false });
    return () => { body.removeEventListener('touchstart', onTouchStart); body.removeEventListener('touchmove', onTouchMove); body.removeEventListener('touchend', onTouchEnd); body.removeEventListener('touchcancel', onTouchEnd); body.removeEventListener('wheel', onWheel); };
  }, [lyrics]);
  useEffect(() => {
    if (!current) { setLyrics(''); setLyricsState(''); return undefined; }
    const controller = new AbortController(); setLyrics(''); setLyricsState('正在加载歌词…');
    const params = new URLSearchParams({ title: current.title, artist: current.artist || '', album: current.album || '', source: current.source || '', id: sourceTrackId(current), meta: current.meta ? JSON.stringify(current.meta) : '' });
    fetch(`/api/music/lyrics?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : {}).then((payload) => { if (!controller.signal.aborted) { setLyrics(payload.lyrics || ''); setLyricsState(payload.lyrics ? '' : '暂无匹配歌词'); } }).catch(() => { if (!controller.signal.aborted) setLyricsState('暂无匹配歌词'); });
    return () => controller.abort();
  }, [current]);
  const selectTrack = (id) => {
    setPlaybackTrackId(id); setPlaybackState('loading');
    if (id === currentId) {
      if (current?.url) audio.current?.play().catch(() => { setPlaying(false); setPlaybackState('error'); });
      else setPlaybackAttempt((attempt) => attempt + 1);
      return;
    }
    setCurrentId(id);
  };
  const next = () => { const index = activeTracks.findIndex((track) => track.id === currentId); if (activeTracks.length) selectTrack(activeTracks[(index + 1 + activeTracks.length) % activeTracks.length].id); };
  const previous = () => { const index = activeTracks.findIndex((track) => track.id === currentId); if (activeTracks.length) selectTrack(activeTracks[(index - 1 + activeTracks.length) % activeTracks.length].id); };
  const toggle = () => {
    if (playbackState === 'resolving' || playbackState === 'loading') return;
    if (!current && activeTracks[0]) return selectTrack(activeTracks[0].id);
    if (playing) { audio.current?.pause(); return; }
    setPlaybackTrackId(currentId); setPlaybackState('loading');
    audio.current?.play().catch(() => { setPlaying(false); setPlaybackState('error'); });
  };
  const like = (id) => {
    const song = current || tracks.find((track) => track.id === id) || results.find((track) => track.id === id); if (!song) return;
    setLiked((items) => { const nextItems = new Set(items); const exists = nextItems.has(id); exists ? nextItems.delete(id) : nextItems.add(id); setLikedTracks((saved) => exists ? saved.filter((track) => track.id !== id) : [...saved.filter((track) => track.id !== id), { ...song, url: undefined }]); return nextItems; });
  };

  const loadResults = async (keyword, page, append = false) => {
    if (append) setLoadingMore(true); else setSearchState(TEXT.searching);
    try {
      const response = await fetch(`/api/music/search?q=${encodeURIComponent(keyword)}&page=${page}`); if (!response.ok) throw Error();
      const payload = await response.json(); const incoming = (payload.tracks || []).map((track) => ({ ...track, sourceId: track.sourceId ?? track.id, id: trackKey(track) }));
      if (!append) setTracks(incoming.slice(0, 50).map((track) => ({ ...track, url: undefined })));
      setResults((items) => append ? [...items, ...incoming.filter((track) => !items.some((item) => item.source === track.source && item.id === track.id))] : incoming);
      setResultPage(page); setHasMoreResults(Boolean(payload.hasMore && incoming.length)); setSearchState('');
    } catch { setHasMoreResults(false); setSearchState('\u641c\u7d22\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528'); }
    finally { setLoadingMore(false); }
  };
  const search = async (event) => {
    event.preventDefault(); const keyword = query.trim(); if (!keyword) return;
    setRecentSearches((items) => [keyword, ...items.filter((item) => item !== keyword)].slice(0, 5));
    setListView('search'); setResults([]); setResultPage(0); setHasMoreResults(false); await loadResults(keyword, 1);
  };
  const loadNextPage = (event) => {
    const element = event.currentTarget;
    if (!results.length || !hasMoreResults || loadingMore || element.scrollTop + element.clientHeight < element.scrollHeight - 80) return;
    loadResults(query.trim(), resultPage + 1, true);
  };

  const playResult = async (result) => {
    const trackId = trackKey({ ...result, id: sourceTrackId(result) });
    setPlaybackTrackId(trackId); setPlaybackState('resolving');
    try {
      const rawId = sourceTrackId(result); const queue = listView === 'likes' ? 'favorites' : 'normal'; setActiveQueue(queue);
      const meta = result.meta ? `&meta=${encodeURIComponent(JSON.stringify(result.meta))}` : '';
      const response = await fetch(`/api/music/resolve?id=${encodeURIComponent(rawId)}&source=${encodeURIComponent(result.source || '')}&title=${encodeURIComponent(result.title || '')}&artist=${encodeURIComponent(result.artist || '')}${meta}`); if (!response.ok) throw Error();
      const payload = await response.json(); if (!payload.url) throw Error();
      const track = { ...result, sourceId: rawId, id: trackKey({ ...result, id: rawId }), url: payload.url, art: payload.art || result.art || '' };
      if (queue === 'favorites') setLikedTracks((items) => items.map((item) => item.id === track.id ? track : item)); else setTracks((items) => [track, ...items.filter((item) => item.id !== track.id)].slice(0, 50)); setCurrentId(track.id); setPlaybackTrackId(track.id); setPlaybackState('loading');
    } catch { setPlaybackState('error'); }
  };
  const seekLyric = (event) => {
    const line = event.target.closest('p');
    if (!line) return;
    const range = document.createRange(); range.selectNodeContents(line); const bounds = range.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    const index = line ? [...event.currentTarget.querySelectorAll('p')].indexOf(line) : -1;
    const lyric = lyricLines[index];
    if (lyric?.time >= 0 && audio.current) { audio.current.currentTime = lyric.time; setProgress(lyric.time); }
  };

  const visibleTracks = results.length ? results : tracks;
  const isSearching = searchState === TEXT.searching;
  const isPlaybackBusy = playbackState === 'resolving' || playbackState === 'loading';
  const rowPlaybackState = (id) => id === playbackTrackId ? playbackState : 'idle';

  return <main className={`music-page mobile-view-${mobileView}${playing ? ' is-playing' : ''}${titleOverflows ? ' has-overflowing-title' : ''}`}><audio ref={audio} onPlay={() => { setPlaying(true); setPlaybackTrackId(currentId); setPlaybackState('playing'); setMobileView('now'); }} onPause={() => { setPlaying(false); setPlaybackState((state) => state === 'loading' || state === 'resolving' ? state : 'paused'); }} onLoadStart={() => setPlaybackState('loading')} onWaiting={() => setPlaybackState('loading')} onPlaying={() => setPlaybackState('playing')} onError={() => { setPlaying(false); setPlaybackState('error'); }} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={next} /><nav className="music-mobile-tabs" aria-label="移动端音乐视图"><button className={mobileView === 'playlist' ? 'active' : ''} onClick={() => setMobileView('playlist')}>播放列表</button><button className={mobileView === 'now' ? 'active' : ''} onClick={() => setMobileView('now')}>正在播放</button></nav>
  <section className="music-shell"><aside className="music-sidebar"><p className="music-brand">LURI / MUSIC</p><button className={`music-nav${listView === 'queue' ? ' active' : ''}`} onClick={() => { setListView('queue'); setResults(tracks); }}>播放列表<span>{tracks.length}</span></button><button className={`music-nav${listView === 'likes' ? ' active' : ''}`} onClick={() => { setListView('likes'); setResults(likedTracks); }}>我喜欢<span>{liked.size}</span></button><div className="music-divider" /></aside>
      <section className="music-content"><header className="music-header"><div><p className="music-kicker">LURI MUSIC</p><h1>{TEXT.title}</h1></div><form className="music-search" onSubmit={search}><input list="music-recent-searches" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={TEXT.searchHint} /><datalist id="music-recent-searches">{recentSearches.map((item) => <option key={item} value={item} />)}</datalist><button className="music-icon-button" type="submit" disabled={isSearching} aria-label={isSearching ? '正在搜索' : TEXT.search} title={isSearching ? '正在搜索' : TEXT.search}>{isSearching ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name="search" />}</button></form><p className="music-disclaimer music-disclaimer--search">免责声明：本页仅提供搜索与播放界面，不托管、不复制、不代理任何音频文件，资源均来源网络。音乐数据接口：<a href="https://music.gdstudio.xyz" target="_blank" rel="noreferrer">GD 音乐台</a>。</p></header>
        <div className="music-workspace"><section className="music-results"><div className="music-list-head"><span>{results.length ? TEXT.search : TEXT.queue}</span><small>{results.length || tracks.length} {TEXT.tracks}</small></div><div className="music-list" onScroll={loadNextPage}>{visibleTracks.map((track, index) => { const state = rowPlaybackState(track.id); return <button key={`${track.source || 'queue'}:${track.id}`} className={`music-row${track.id === currentId ? ' current' : ''}`} onClick={() => results.length ? playResult(track) : selectTrack(track.id)}><span className="track-index">{String(index + 1).padStart(2, '0')}</span><img src={track.art || EMPTY_ART} alt="" /><span className="track-copy"><span className="track-title">{track.title}</span><span className="track-artist">{track.artist}{track.year ? ` · ${track.year}` : ''}</span></span><span className={`track-action track-action--${state}`} aria-label={state === 'error' ? '播放失败，点击重试' : state === 'loading' || state === 'resolving' ? '正在加载' : state === 'playing' ? '正在播放' : TEXT.play}>{state === 'error' ? '播放失败' : state === 'loading' || state === 'resolving' ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name={state === 'playing' ? 'pause' : 'play'} />}</span></button>; })}{loadingMore && <p className="music-list-status">正在加载更多…</p>}{!results.length && !tracks.length && <div className="music-empty"><strong>{TEXT.noResult}</strong><span>{TEXT.choose}</span></div>}</div><p className="music-search-status" aria-live="polite">{isSearching ? '' : searchState}</p></section><aside className="music-lyrics"><div className="lyrics-track"><img src={current?.art || EMPTY_ART} alt="" /><div><p>歌词</p><h2>{current?.title || TEXT.noTrack}</h2><span>{current?.artist || TEXT.choose}</span></div><button className={`like-button${current && liked.has(current.id) ? ' liked' : ''}`} disabled={!current} onClick={() => current && like(current.id)}>{TEXT.likes}</button></div><div ref={lyricsRef} className="lyrics-body" onClick={seekLyric}>{lyrics ? lyricLines.map((line, index) => <p key={`${line.time}:${line.text}:${index}`}>{line.text}</p>) : <p className="lyrics-empty">{lyricsState || TEXT.choose}</p>}</div></aside></div></section></section>
    <footer className="music-player"><div className="music-player__song"><img src={current?.art || EMPTY_ART} alt="" /><span>{current?.title || TEXT.noTrack}<small>{current?.artist || 'LURI MUSIC'}</small></span></div><div className="music-controls"><div><button className="music-icon-button" onClick={previous} aria-label={TEXT.prev} title={TEXT.prev}><MusicIcon name="previous" /></button><button className="music-icon-button play-button" onClick={toggle} disabled={isPlaybackBusy} aria-label={isPlaybackBusy ? '正在加载' : playing ? TEXT.pause : TEXT.play} title={isPlaybackBusy ? '正在加载' : playing ? TEXT.pause : TEXT.play}>{isPlaybackBusy ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name={playing ? 'pause' : 'play'} />}</button><button className="music-icon-button" onClick={next} aria-label={TEXT.next} title={TEXT.next}><MusicIcon name="next" /></button></div><div className="timeline"><span>{time(progress)}</span><input type="range" min="0" max={duration || 0} value={Math.min(progress, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audio.current) audio.current.currentTime = value; setProgress(value); }} /><span>{time(duration)}</span></div></div><div className="music-volume">{current?.url ? <a className="music-icon-button music-download" href={current.url} download={`${current.artist ? `${current.artist} - ` : ''}${current.title}.mp3`} target="_blank" rel="noopener" title="下载当前歌曲" aria-label="下载当前歌曲"><MusicIcon name="download" /></a> : <button className="music-icon-button music-download" type="button" title="下载当前歌曲" aria-label="下载当前歌曲" disabled><MusicIcon name="download" /></button>}<button className="music-icon-button" onClick={() => setMuted((value) => !value)} aria-label={muted || volume === 0 ? '取消静音' : '静音'} title={muted || volume === 0 ? '取消静音' : '静音'}><MusicIcon name={muted || volume === 0 ? 'mute' : 'volume'} /></button><input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} aria-label="音量" onChange={(event) => { const value = Number(event.target.value); setVolume(value); setMuted(value === 0); }} /></div></footer>
    <p className="music-global-disclaimer">免责声明：本页仅提供搜索与播放界面，不托管、不复制、不代理任何音频文件，资源均来源网络。</p></main>;
}
