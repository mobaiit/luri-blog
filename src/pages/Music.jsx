import { useEffect, useRef, useState } from 'react';
import './Music.css';

const EMPTY_ART = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23ece9e1"/%3E%3Ccircle cx="200" cy="200" r="106" fill="%23c8c2b7"/%3E%3Ccircle cx="200" cy="200" r="22" fill="%23111111"/%3E%3C/svg%3E';
const TEXT = { title: '\u97f3\u4e50', discover: '\u53d1\u73b0\u97f3\u4e50', likes: '\u6211\u7684\u559c\u6b22', search: '\u641c\u7d22', searchHint: '\u641c\u7d22\u6b4c\u66f2\u3001\u827a\u4eba\u6216\u4e13\u8f91', searching: '\u6b63\u5728\u641c\u7d22\u2026', queue: '\u64ad\u653e\u961f\u5217', tracks: '\u9996\u6b4c\u66f2', noResult: '\u6682\u65e0\u641c\u7d22\u7ed3\u679c', noTrack: '\u6682\u65e0\u6b4c\u66f2', choose: '\u8bf7\u641c\u7d22\u540e\u9009\u62e9\u6b4c\u66f2', now: '\u6b63\u5728\u64ad\u653e', play: '\u64ad\u653e', pause: '\u6682\u505c', prev: '\u4e0a\u4e00\u9996', next: '\u4e0b\u4e00\u9996', load: '\u6b63\u5728\u83b7\u53d6\u53ef\u64ad\u653e\u6587\u4ef6\u2026', unavailable: '\u6ca1\u6709\u627e\u5230\u53ef\u76f4\u64ad\u7684\u97f3\u9891\u6587\u4ef6', source: '\u516c\u5f00\u97f3\u9891\u76ee\u5f55', disclaimer: '\u672c\u9875\u4ec5\u63d0\u4f9b\u641c\u7d22\u4e0e\u64ad\u653e\u754c\u9762\uff0c\u4e0d\u6258\u7ba1\u3001\u4e0d\u590d\u5236\u3001\u4e0d\u4ee3\u7406\u4efb\u4f55\u97f3\u9891\u6587\u4ef6\u3002\u8bf7\u4ec5\u4f7f\u7528\u5df2\u83b7\u6388\u6743\u7684\u97f3\u6e90\uff0c\u5e76\u9075\u5b88\u5176\u670d\u52a1\u6761\u6b3e\u4e0e\u9002\u7528\u6cd5\u5f8b\u3002' };
const time = (value = 0) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
const lyricLine = (line) => { const match = /^\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/.exec(line); return match ? { time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() } : { time: -1, text: line }; };
const STORE_QUEUE = 'luri.music.queue.v1'; const STORE_LIKES = 'luri.music.likes.v1'; const STORE_SEARCH = 'luri.music.search.v1'; const STORE_QUERY = 'luri.music.query.v1';
const readStore = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
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
  const [query, setQuery] = useState(() => localStorage.getItem(STORE_QUERY) || ''); const [results, setResults] = useState(() => readStore(STORE_SEARCH)); const [cachedResults, setCachedResults] = useState(() => readStore(STORE_SEARCH)); const [searchState, setSearchState] = useState('');
  const [listView, setListView] = useState('search');
  const [activeQueue, setActiveQueue] = useState('normal');
  const [resultPage, setResultPage] = useState(0); const [hasMoreResults, setHasMoreResults] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const [tracks, setTracks] = useState(() => readStore(STORE_QUEUE)); const [likedTracks, setLikedTracks] = useState(() => readStore(STORE_LIKES)); const [currentId, setCurrentId] = useState(null); const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); const [duration, setDuration] = useState(0); const [liked, setLiked] = useState(() => new Set(readStore(STORE_LIKES).map((track) => track.id)));
  const [volume, setVolume] = useState(0.8); const [muted, setMuted] = useState(false);
  const [lyrics, setLyrics] = useState(''); const [lyricsState, setLyricsState] = useState('');
  const lyricsRef = useRef(null);
  const playlistRef = useRef(null); const lyricsPanelRef = useRef(null);
  const activeTracks = activeQueue === 'favorites' ? likedTracks : tracks;
  const current = activeTracks.find((track) => track.id === currentId);
  const lyricLines = lyrics.split(/\r?\n/).filter(Boolean).map(lyricLine).filter((line) => line.text);
  const activeLyric = lyricLines.reduce((active, line, index) => line.time >= 0 && line.time <= progress ? index : active, -1);

  useEffect(() => {
    if (!currentId) return;
    if (activeQueue === 'favorites' && !likedTracks.some((track) => track.id === currentId) && tracks.some((track) => track.id === currentId)) setActiveQueue('normal');
    if (activeQueue === 'normal' && !tracks.some((track) => track.id === currentId) && likedTracks.some((track) => track.id === currentId)) setActiveQueue('favorites');
  }, [currentId, activeQueue, tracks, likedTracks]);

  useEffect(() => { if (!audio.current || !current?.url) return; setProgress(0); setDuration(0); audio.current.src = current.url; audio.current.load(); audio.current.play().catch(() => setPlaying(false)); }, [currentId, current?.url]);
  useEffect(() => { if (listView === 'search') setCachedResults(results); }, [listView, results]);
  useEffect(() => { try { localStorage.setItem(STORE_SEARCH, JSON.stringify(cachedResults)); localStorage.setItem(STORE_QUERY, query); } catch { /* Storage is unavailable in private browsing. */ } }, [cachedResults, query]);
  useEffect(() => {
    if (!current || current.url) return undefined;
    const controller = new AbortController(); const meta = current.meta ? `&meta=${encodeURIComponent(JSON.stringify(current.meta))}` : '';
    fetch(`/api/music/resolve?id=${encodeURIComponent(current.id.replace(/^track:[^:]+:/, ''))}&source=${encodeURIComponent(current.source || '')}&title=${encodeURIComponent(current.title || '')}&artist=${encodeURIComponent(current.artist || '')}${meta}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : {}).then((payload) => { if (payload.url && !controller.signal.aborted) (activeQueue === 'favorites' ? setLikedTracks : setTracks)((items) => items.map((track) => track.id === current.id ? { ...track, url: payload.url, art: payload.art || track.art } : track)); }).catch(() => {});
    return () => controller.abort();
  }, [activeQueue, current]);
  useEffect(() => {
    if (!current || (current.art && current.art !== EMPTY_ART) || !current.source) return undefined;
    const controller = new AbortController(); const meta = current.meta ? `&meta=${encodeURIComponent(JSON.stringify(current.meta))}` : '';
    fetch(`/api/music/art?source=${encodeURIComponent(current.source)}&title=${encodeURIComponent(current.title || '')}&artist=${encodeURIComponent(current.artist || '')}${meta}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : {}).then((payload) => {
      if (payload.url && !controller.signal.aborted) (activeQueue === 'favorites' ? setLikedTracks : setTracks)((items) => items.map((track) => track.id === current.id ? { ...track, art: payload.url } : track));
    }).catch(() => {});
    return () => controller.abort();
  }, [activeQueue, current]);
  useEffect(() => { try { localStorage.setItem(STORE_QUEUE, JSON.stringify(tracks.slice(0, 50).map(({ url: _url, ...track }) => track))); } catch { /* Storage is unavailable in private browsing. */ } }, [tracks]);
  useEffect(() => { try { localStorage.setItem(STORE_LIKES, JSON.stringify(likedTracks)); } catch { /* Storage is unavailable in private browsing. */ } }, [likedTracks]);
  useEffect(() => { if (!audio.current) return; audio.current.volume = volume; audio.current.muted = muted; }, [volume, muted]);
  useEffect(() => {
    const body = lyricsRef.current; if (!body) return;
    lyricsRef.current = body;
    const nodes = body.querySelectorAll('p'); nodes.forEach((node, index) => node.classList.toggle('active', index === activeLyric));
    const active = nodes[activeLyric]; if (!active) return;
    // Begin at the top; follow only after the active line reaches mid-panel.
    if (active.offsetTop > body.scrollTop + body.clientHeight / 2) body.scrollTo({ top: Math.max(0, active.offsetTop - body.clientHeight / 2 + active.offsetHeight / 2), behavior: 'smooth' });
  }, [activeLyric]);
  useEffect(() => { if (lyricsRef.current) lyricsRef.current.scrollTop = 0; }, [current?.id, lyrics]);
  useEffect(() => {
    if (!current) { setLyrics(''); setLyricsState(''); return undefined; }
    const controller = new AbortController(); setLyrics(''); setLyricsState('正在加载歌词…');
    const params = new URLSearchParams({ title: current.title, artist: current.artist || '', album: current.album || '', source: current.source || '', id: current.id.replace(/^track:[^:]+:/, ''), meta: current.meta ? JSON.stringify(current.meta) : '' });
    fetch(`/api/music/lyrics?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : {}).then((payload) => { if (!controller.signal.aborted) { setLyrics(payload.lyrics || ''); setLyricsState(payload.lyrics ? '' : '暂无匹配歌词'); } }).catch(() => { if (!controller.signal.aborted) setLyricsState('暂无匹配歌词'); });
    return () => controller.abort();
  }, [current]);
  const next = () => { const index = activeTracks.findIndex((track) => track.id === currentId); if (activeTracks.length) setCurrentId(activeTracks[(index + 1 + activeTracks.length) % activeTracks.length].id); };
  const previous = () => { const index = activeTracks.findIndex((track) => track.id === currentId); if (activeTracks.length) setCurrentId(activeTracks[(index - 1 + activeTracks.length) % activeTracks.length].id); };
  const toggle = () => { if (!current && activeTracks[0]) return setCurrentId(activeTracks[0].id); if (playing) audio.current?.pause(); else audio.current?.play().catch(() => setPlaying(false)); };
  const like = (id) => {
    const song = current || tracks.find((track) => track.id === id) || results.find((track) => track.id === id); if (!song) return;
    setLiked((items) => { const nextItems = new Set(items); const exists = nextItems.has(id); exists ? nextItems.delete(id) : nextItems.add(id); setLikedTracks((saved) => exists ? saved.filter((track) => track.id !== id) : [...saved.filter((track) => track.id !== id), { ...song, url: undefined }]); return nextItems; });
  };

  const loadResults = async (keyword, page, append = false) => {
    if (append) setLoadingMore(true); else setSearchState(TEXT.searching);
    try {
      const response = await fetch(`/api/music/search?q=${encodeURIComponent(keyword)}&page=${page}`); if (!response.ok) throw Error();
      const payload = await response.json(); const incoming = payload.tracks || [];
      if (!append) setTracks(incoming.slice(0, 50).map((track) => ({ ...track, id: `track:${track.source || 'default'}:${track.id}`, url: undefined })));
      setResults((items) => append ? [...items, ...incoming.filter((track) => !items.some((item) => item.source === track.source && item.id === track.id))] : incoming);
      setResultPage(page); setHasMoreResults(Boolean(payload.hasMore && incoming.length)); setSearchState('');
    } catch { setHasMoreResults(false); setSearchState('\u641c\u7d22\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528'); }
    finally { setLoadingMore(false); }
  };
  const search = async (event) => {
    event.preventDefault(); const keyword = query.trim(); if (!keyword) return;
    setListView('search'); setResults([]); setResultPage(0); setHasMoreResults(false); await loadResults(keyword, 1);
  };
  const loadNextPage = (event) => {
    const element = event.currentTarget;
    if (!results.length || !hasMoreResults || loadingMore || element.scrollTop + element.clientHeight < element.scrollHeight - 80) return;
    loadResults(query.trim(), resultPage + 1, true);
  };

  const playResult = async (result) => {
    setSearchState(TEXT.load);
    try {
      const rawId = String(result.id).replace(/^track:[^:]+:/, ''); const queue = listView === 'likes' ? 'favorites' : 'normal'; setActiveQueue(queue);
      const meta = result.meta ? `&meta=${encodeURIComponent(JSON.stringify(result.meta))}` : '';
      const response = await fetch(`/api/music/resolve?id=${encodeURIComponent(rawId)}&source=${encodeURIComponent(result.source || '')}&title=${encodeURIComponent(result.title || '')}&artist=${encodeURIComponent(result.artist || '')}${meta}`); if (!response.ok) throw Error();
      const payload = await response.json(); if (!payload.url) throw Error();
      const track = { ...result, id: `track:${result.source || 'default'}:${rawId}`, url: payload.url, art: payload.art || result.art || '' };
      if (queue === 'favorites') setLikedTracks((items) => items.map((item) => item.id === track.id ? track : item)); else setTracks((items) => [track, ...items.filter((item) => item.id !== track.id)].slice(0, 50)); setCurrentId(track.id); setSearchState('正在加载音频…');
    } catch { setSearchState(TEXT.unavailable); }
  };
  const seekLyric = (event) => {
    const line = event.target.closest('p');
    const index = line ? [...event.currentTarget.querySelectorAll('p')].indexOf(line) : -1;
    const lyric = lyricLines[index];
    if (lyric?.time >= 0 && audio.current) { audio.current.currentTime = lyric.time; setProgress(lyric.time); }
  };

  const scrollMobileSection = (ref) => { if (window.matchMedia('(max-width: 760px)').matches) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return <main className="music-page"><audio ref={audio} onPlay={() => { setPlaying(true); scrollMobileSection(lyricsPanelRef); }} onPause={() => setPlaying(false)} onLoadStart={() => setSearchState('正在加载音频…')} onWaiting={() => setSearchState('正在加载音频…')} onPlaying={() => setSearchState('')} onError={() => setSearchState('音频加载失败，请尝试其他歌曲')} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={next} />
  <section className="music-shell"><aside className="music-sidebar"><p className="music-brand">LURI / MUSIC</p><button className={`music-nav${listView === 'queue' ? ' active' : ''}`} onClick={() => { setListView('queue'); setResults(tracks); }}>播放列表<span>{tracks.length}</span></button><button className={`music-nav${listView === 'likes' ? ' active' : ''}`} onClick={() => { setListView('likes'); setResults(likedTracks); }}>我喜欢<span>{liked.size}</span></button><div className="music-divider" /></aside>
      <section className="music-content"><header className="music-header"><div><p className="music-kicker">LURI MUSIC</p><h1>{TEXT.title}</h1></div><form className="music-search" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={TEXT.searchHint} /><button className="music-icon-button" type="submit" aria-label={TEXT.search} title={TEXT.search}><MusicIcon name="search" /></button></form><p className="music-disclaimer music-disclaimer--search">免责声明：本页仅提供搜索与播放界面，不托管、不复制、不代理任何音频文件，资源均来源网络。音乐数据接口：<a href="https://music.gdstudio.xyz" target="_blank" rel="noreferrer">GD 音乐台</a>。</p></header>
        <div className="music-workspace"><section ref={playlistRef} className="music-results"><div className="music-list-head"><span>{results.length ? TEXT.search : TEXT.queue}</span><small>{results.length || tracks.length} {TEXT.tracks}</small></div><div className="music-list" onScroll={loadNextPage}>{(results.length ? results : tracks).map((track, index) => <button key={`${track.source || 'queue'}:${track.id}`} className={`music-row${track.id === currentId ? ' current' : ''}`} onClick={() => results.length ? playResult(track) : setCurrentId(track.id)}><span className="track-index">{String(index + 1).padStart(2, '0')}</span><img src={track.art || EMPTY_ART} alt="" /><span className="track-title">{track.title}<small>{track.artist}{track.year ? ` · ${track.year}` : ''}</small></span><span className="track-action">{results.length ? TEXT.play : liked.has(track.id) ? TEXT.likes : TEXT.play}</span></button>)}{loadingMore && <p className="music-list-status">正在加载更多…</p>}{!results.length && !tracks.length && <div className="music-empty"><strong>{TEXT.noResult}</strong><span>{TEXT.choose}</span></div>}</div><p className="source-summary">{searchState || TEXT.source}</p></section><aside ref={lyricsPanelRef} className="music-lyrics"><div className="lyrics-track" data-playback-state={searchState}><img src={current?.art || EMPTY_ART} alt="" /><div><p>歌词</p><h2>{current?.title || TEXT.noTrack}</h2><span data-playback-state={searchState}>{current?.artist || TEXT.choose}</span></div><button className={`like-button${current && liked.has(current.id) ? ' liked' : ''}`} disabled={!current} onClick={() => current && like(current.id)}>{TEXT.likes}</button></div><div ref={lyricsRef} className="lyrics-body" onClick={seekLyric}>{lyrics ? lyricLines.map((line, index) => <p key={`${line.time}:${line.text}:${index}`}>{line.text}</p>) : <p className="lyrics-empty">{lyricsState || TEXT.choose}</p>}</div></aside></div></section></section>
    <nav className="music-mobile-switch" aria-label="移动端音乐导航"><button onClick={() => scrollMobileSection(playlistRef)}>播放列表</button><button onClick={() => scrollMobileSection(lyricsPanelRef)}>歌词</button></nav><footer className="music-player"><div className="music-player__song"><img src={current?.art || EMPTY_ART} alt="" /><span>{current?.title || TEXT.noTrack}<small data-playback-state={searchState}>{current?.artist || 'LURI MUSIC'}</small></span></div><div className="music-controls"><div><button className="music-icon-button" onClick={previous} aria-label={TEXT.prev} title={TEXT.prev}><MusicIcon name="previous" /></button><button className="music-icon-button play-button" onClick={toggle} aria-label={playing ? TEXT.pause : TEXT.play} title={playing ? TEXT.pause : TEXT.play}><MusicIcon name={playing ? 'pause' : 'play'} /></button><button className="music-icon-button" onClick={next} aria-label={TEXT.next} title={TEXT.next}><MusicIcon name="next" /></button></div><div className="timeline"><span>{time(progress)}</span><input type="range" min="0" max={duration || 0} value={Math.min(progress, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audio.current) audio.current.currentTime = value; setProgress(value); }} /><span>{time(duration)}</span></div></div><div className="music-volume">{current?.url ? <a className="music-icon-button music-download" href={current.url} download={`${current.artist ? `${current.artist} - ` : ''}${current.title}.mp3`} target="_blank" rel="noopener" title="下载当前歌曲" aria-label="下载当前歌曲"><MusicIcon name="download" /></a> : <button className="music-icon-button music-download" type="button" title="下载当前歌曲" aria-label="下载当前歌曲" disabled><MusicIcon name="download" /></button>}<button className="music-icon-button" onClick={() => setMuted((value) => !value)} aria-label={muted || volume === 0 ? '取消静音' : '静音'} title={muted || volume === 0 ? '取消静音' : '静音'}><MusicIcon name={muted || volume === 0 ? 'mute' : 'volume'} /></button><input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} aria-label="音量" onChange={(event) => { const value = Number(event.target.value); setVolume(value); setMuted(value === 0); }} /></div></footer>
  </main>;
}
