import { useEffect, useRef, useState } from 'react';
import './Music.css';

const EMPTY_ART = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23ece9e1"/%3E%3Ccircle cx="200" cy="200" r="106" fill="%23c8c2b7"/%3E%3Ccircle cx="200" cy="200" r="22" fill="%23111111"/%3E%3C/svg%3E';
const STORE = { queue: 'luri.music.queue.v1', likes: 'luri.music.likes.v1', search: 'luri.music.search.v1', query: 'luri.music.query.v1' };
const stored = (key, fallback = []) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
const clock = (seconds = 0) => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';
const line = (value) => { const match = /^\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/.exec(value); return match ? { time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() } : { time: -1, text: value.trim() }; };

function Icon({ name }) {
  const icon = {
    search: <><circle cx="11" cy="11" r="5.5" /><path d="m15.2 15.2 4 4" /></>, play: <path d="m9 6 8 6-8 6Z" fill="currentColor" stroke="none" />, pause: <><path d="M9 6v12M15 6v12" /></>,
    previous: <><path d="M7 6v12" /><path d="m17 6-7 6 7 6Z" fill="currentColor" stroke="none" /></>, next: <><path d="M17 6v12" /><path d="m7 6 7 6-7 6Z" fill="currentColor" stroke="none" /></>,
    queue: <><path d="M5 7h10M5 12h10M5 17h10" /><path d="M18 15v5m-2.5-2.5h5" /></>, close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    heart: <path d="M20.8 8.4c0 5.4-8.8 10.4-8.8 10.4S3.2 13.8 3.2 8.4A4.4 4.4 0 0 1 12 7.7a4.4 4.4 0 0 1 8.8.7Z" />,
  };
  return <svg className="music-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon[name]}</svg>;
}

export default function Music() {
  const audio = useRef(null); const lyricsRef = useRef(null);
  const [query, setQuery] = useState(() => localStorage.getItem(STORE.query) || '');
  const [results, setResults] = useState(() => stored(STORE.search));
  const [tracks, setTracks] = useState(() => stored(STORE.queue));
  const [likes, setLikes] = useState(() => stored(STORE.likes));
  const [currentId, setCurrentId] = useState(null); const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState(''); const [lyricStatus, setLyricStatus] = useState('');
  const [status, setStatus] = useState(''); const [panel, setPanel] = useState(null);
  const current = tracks.find((track) => track.id === currentId) || likes.find((track) => track.id === currentId);
  const lyricLines = lyrics.split(/\r?\n/).map(line).filter((item) => item.text);
  const activeLine = lyricLines.reduce((active, item, index) => item.time >= 0 && item.time <= progress ? index : active, -1);
  const shown = results.length ? results : tracks;
  const liked = current && likes.some((track) => track.id === current.id);

  useEffect(() => { try { localStorage.setItem(STORE.query, query); localStorage.setItem(STORE.search, JSON.stringify(results)); } catch {} }, [query, results]);
  useEffect(() => { try { localStorage.setItem(STORE.queue, JSON.stringify(tracks.map(({ url: _url, ...track }) => track))); } catch {} }, [tracks]);
  useEffect(() => { try { localStorage.setItem(STORE.likes, JSON.stringify(likes.map(({ url: _url, ...track }) => track))); } catch {} }, [likes]);
  useEffect(() => { if (!audio.current || !current?.url) return; setProgress(0); audio.current.src = current.url; audio.current.load(); audio.current.play().catch(() => setPlaying(false)); }, [currentId, current?.url]);
  useEffect(() => {
    if (!current || current.url) return undefined;
    const controller = new AbortController();
    const rawId = current.id.replace(/^track:[^:]+:/, '');
    const meta = current.meta ? `&meta=${encodeURIComponent(JSON.stringify(current.meta))}` : '';
    fetch(`/api/music/resolve?id=${encodeURIComponent(rawId)}&source=${encodeURIComponent(current.source || '')}&title=${encodeURIComponent(current.title || '')}&artist=${encodeURIComponent(current.artist || '')}${meta}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : {})
      .then((payload) => {
        if (!payload.url || controller.signal.aborted) return;
        const update = (items) => items.map((track) => track.id === current.id ? { ...track, url: payload.url, art: payload.art || track.art } : track);
        if (tracks.some((track) => track.id === current.id)) setTracks(update);
        else setLikes(update);
      }).catch(() => { if (!controller.signal.aborted) setStatus('加载失败，请尝试其他歌曲'); });
    return () => controller.abort();
  }, [current, tracks]);
  useEffect(() => {
    if (!current) { setLyrics(''); setLyricStatus(''); return undefined; }
    const controller = new AbortController(); setLyrics(''); setLyricStatus('正在加载歌词…');
    const params = new URLSearchParams({ title: current.title, artist: current.artist || '', album: current.album || '', source: current.source || '', id: current.id.replace(/^track:[^:]+:/, ''), meta: current.meta ? JSON.stringify(current.meta) : '' });
    fetch(`/api/music/lyrics?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : {}).then((payload) => { if (!controller.signal.aborted) { setLyrics(payload.lyrics || ''); setLyricStatus(payload.lyrics ? '' : '暂无匹配歌词'); } }).catch(() => { if (!controller.signal.aborted) setLyricStatus('暂无匹配歌词'); });
    return () => controller.abort();
  }, [current]);
  useEffect(() => { if (lyricsRef.current) lyricsRef.current.scrollTop = 0; }, [current?.id, lyrics]);
  useEffect(() => { const body = lyricsRef.current; const active = body?.querySelectorAll('p')[activeLine]; if (active && active.offsetTop > body.scrollTop + body.clientHeight / 2) body.scrollTo({ top: Math.max(0, active.offsetTop - body.clientHeight / 2), behavior: 'smooth' }); }, [activeLine]);

  const search = async (event) => {
    event.preventDefault(); const keyword = query.trim(); if (!keyword) return; setStatus('正在搜索…');
    try { const response = await fetch(`/api/music/search?q=${encodeURIComponent(keyword)}&page=1`); if (!response.ok) throw Error(); const payload = await response.json(); setResults(payload.tracks || []); setStatus(''); }
    catch { setStatus('搜索服务暂时不可用'); }
  };
  const play = async (result) => {
    if (String(result.id).startsWith('track:')) { setCurrentId(result.id); return; }
    setStatus('正在获取可播放文件…');
    try {
      const rawId = String(result.id).replace(/^track:[^:]+:/, ''); const meta = result.meta ? `&meta=${encodeURIComponent(JSON.stringify(result.meta))}` : '';
      const response = await fetch(`/api/music/resolve?id=${encodeURIComponent(rawId)}&source=${encodeURIComponent(result.source || '')}&title=${encodeURIComponent(result.title || '')}&artist=${encodeURIComponent(result.artist || '')}${meta}`); const payload = response.ok ? await response.json() : {}; if (!payload.url) throw Error();
      const track = { ...result, id: `track:${result.source || 'default'}:${rawId}`, url: payload.url, art: payload.art || result.art || '' };
      setTracks((items) => [track, ...items.filter((item) => item.id !== track.id)].slice(0, 50)); setCurrentId(track.id); setStatus('');
    } catch { setStatus('加载失败，请尝试其他歌曲'); }
  };
  const toggle = () => { if (!current && tracks[0]) setCurrentId(tracks[0].id); else if (playing) audio.current?.pause(); else audio.current?.play().catch(() => setPlaying(false)); };
  const jump = (offset) => { const index = tracks.findIndex((track) => track.id === currentId); if (tracks.length) setCurrentId(tracks[(index + offset + tracks.length) % tracks.length].id); };
  const like = () => { if (!current) return; setLikes((items) => items.some((item) => item.id === current.id) ? items.filter((item) => item.id !== current.id) : [...items, current]); };
  const seek = (event) => { const index = [...event.currentTarget.querySelectorAll('p')].indexOf(event.target.closest('p')); const item = lyricLines[index]; if (item?.time >= 0 && audio.current) { audio.current.currentTime = item.time; setProgress(item.time); } };
  const list = (sheet = false) => <div className={`music-list${sheet ? ' music-list--sheet' : ''}`}>{shown.map((track, index) => <button key={`${track.source || 'queue'}:${track.id}`} className={`music-row${track.id === currentId ? ' current' : ''}`} onClick={() => { play(track); if (sheet) setPanel('lyrics'); }}><span className="track-index">{String(index + 1).padStart(2, '0')}</span><span className="track-title">{track.title}<small>{track.artist}{track.year ? ` · ${track.year}` : ''}</small></span><span className="track-action"><Icon name="play" /></span></button>)}{!shown.length && <div className="music-empty"><strong>暂无歌曲</strong><span>搜索歌曲、艺人或专辑开始播放</span></div>}</div>;
  const lyricView = (sheet = false) => <aside className={`music-lyrics${sheet ? ' music-lyrics--sheet' : ''}`}><div className="lyrics-track"><img src={current?.art || EMPTY_ART} alt="" /><div><p>{playing ? '正在播放' : '歌词'}</p><h2>{current?.title || '暂无歌曲'}</h2><span>{current?.artist || '播放歌曲后显示歌词'}</span></div><button className={`like-button${liked ? ' liked' : ''}`} disabled={!current} onClick={like} aria-label="喜欢"><Icon name="heart" /></button></div><div ref={sheet ? lyricsRef : null} className="lyrics-body" onClick={seek}>{lyrics ? lyricLines.map((item, index) => <p className={index === activeLine ? 'active' : ''} key={`${item.time}:${item.text}:${index}`}>{item.text}</p>) : <p className="lyrics-empty">{lyricStatus || '播放歌曲后显示歌词'}</p>}</div></aside>;

  return <main className="music-page"><audio ref={audio} onPlay={() => { setPlaying(true); setPanel('lyrics'); }} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={() => jump(1)} />
    <section className="music-shell"><header className="music-header"><div><p className="music-kicker">LURI MUSIC</p><h1>音乐</h1></div><form className="music-search" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索歌曲、艺人或专辑" /><button className="music-icon-button" type="submit" aria-label="搜索"><Icon name="search" /></button></form></header><div className="music-workspace"><section className="music-results"><div className="music-list-head"><span>播放列表</span><small>{shown.length} 首歌曲</small></div>{status && <p className="music-status">{status}</p>}{list()}</section>{lyricView()}</div></section>
    {panel && <div className="music-mobile-sheet" role="dialog" aria-modal="true" aria-label={panel === 'lyrics' ? '歌词' : '播放列表'}><div className="music-mobile-sheet__bar"><span>{panel === 'lyrics' ? '正在播放' : '播放列表与搜索'}</span><button className="music-icon-button" onClick={() => setPanel(null)} aria-label="关闭"><Icon name="close" /></button></div>{panel === 'lyrics' ? lyricView(true) : <section className="music-mobile-library"><form className="music-search" onSubmit={search}><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索歌曲、艺人或专辑" /><button className="music-icon-button" type="submit" aria-label="搜索"><Icon name="search" /></button></form>{status && <p className="music-status">{status}</p>}{list(true)}</section>}</div>}
    <footer className="music-player"><button className="music-player__song" onClick={() => current && setPanel('lyrics')} aria-label="打开歌词"><img src={current?.art || EMPTY_ART} alt="" /><span>{current?.title || '暂无歌曲'}<small>{current?.artist || 'LURI MUSIC'}</small></span></button><div className="music-controls"><button className="music-icon-button skip" onClick={() => jump(-1)} aria-label="上一首"><Icon name="previous" /></button><button className="music-icon-button play-button" onClick={toggle} aria-label={playing ? '暂停' : '播放'}><Icon name={playing ? 'pause' : 'play'} /></button><button className="music-icon-button skip" onClick={() => jump(1)} aria-label="下一首"><Icon name="next" /></button><div className="timeline"><span>{clock(progress)}</span><input type="range" min="0" max={duration || 0} value={Math.min(progress, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audio.current) audio.current.currentTime = value; setProgress(value); }} /><span>{clock(duration)}</span></div></div><button className="music-player__queue music-icon-button" onClick={() => setPanel('library')} aria-label="打开播放列表和搜索"><Icon name="queue" /></button></footer>
  </main>;
}
