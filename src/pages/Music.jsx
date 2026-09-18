import { useEffect, useRef, useState } from 'react';
import './Music.css';

const EMPTY_ART = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23ece9e1"/%3E%3Ccircle cx="200" cy="200" r="106" fill="%23c8c2b7"/%3E%3Ccircle cx="200" cy="200" r="22" fill="%23111111"/%3E%3C/svg%3E';
const TEXT = { title: '\u97f3\u4e50', discover: '\u53d1\u73b0\u97f3\u4e50', likes: '\u6211\u7684\u559c\u6b22', search: '\u641c\u7d22', searchHint: '\u641c\u7d22\u6b4c\u66f2\u3001\u827a\u4eba\u6216\u4e13\u8f91', searching: '\u6b63\u5728\u641c\u7d22\u2026', queue: '\u64ad\u653e\u961f\u5217', tracks: '\u9996\u6b4c\u66f2', noResult: '\u6682\u65e0\u641c\u7d22\u7ed3\u679c', noTrack: '\u6682\u65e0\u6b4c\u66f2', choose: '\u8bf7\u641c\u7d22\u540e\u9009\u62e9\u6b4c\u66f2', now: '\u6b63\u5728\u64ad\u653e', play: '\u64ad\u653e', pause: '\u6682\u505c', prev: '\u4e0a\u4e00\u9996', next: '\u4e0b\u4e00\u9996', load: '\u6b63\u5728\u83b7\u53d6\u53ef\u64ad\u653e\u6587\u4ef6\u2026', unavailable: '\u6ca1\u6709\u627e\u5230\u53ef\u76f4\u64ad\u7684\u97f3\u9891\u6587\u4ef6', source: '\u516c\u5f00\u97f3\u9891\u76ee\u5f55', disclaimer: '\u672c\u9875\u4ec5\u63d0\u4f9b\u641c\u7d22\u4e0e\u64ad\u653e\u754c\u9762\uff0c\u4e0d\u6258\u7ba1\u3001\u4e0d\u590d\u5236\u3001\u4e0d\u4ee3\u7406\u4efb\u4f55\u97f3\u9891\u6587\u4ef6\u3002\u8bf7\u4ec5\u4f7f\u7528\u5df2\u83b7\u6388\u6743\u7684\u97f3\u6e90\uff0c\u5e76\u9075\u5b88\u5176\u670d\u52a1\u6761\u6b3e\u4e0e\u9002\u7528\u6cd5\u5f8b\u3002' };
const time = (value = 0) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';

function MusicIcon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="5.5" /><path d="m15.2 15.2 4 4" /></>,
    play: <path d="m9 6 8 6-8 6Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M9 6v12M15 6v12" /></>,
    previous: <><path d="M7 6v12" /><path d="m17 6-7 6 7 6Z" fill="currentColor" stroke="none" /></>,
    next: <><path d="M17 6v12" /><path d="m7 6 7 6-7 6Z" fill="currentColor" stroke="none" /></>,
  };
  return <svg className="music-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function Music() {
  const audio = useRef(null);
  const [query, setQuery] = useState(''); const [results, setResults] = useState([]); const [searchState, setSearchState] = useState('');
  const [tracks, setTracks] = useState([]); const [currentId, setCurrentId] = useState(null); const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); const [duration, setDuration] = useState(0); const [liked, setLiked] = useState(new Set());
  const current = tracks.find((track) => track.id === currentId);

  useEffect(() => { if (!audio.current || !current?.url) return; audio.current.src = current.url; audio.current.load(); audio.current.play().catch(() => setPlaying(false)); }, [currentId, current?.url]);
  const next = () => { const index = tracks.findIndex((track) => track.id === currentId); if (tracks.length) setCurrentId(tracks[(index + 1 + tracks.length) % tracks.length].id); };
  const toggle = () => { if (!current && tracks[0]) return setCurrentId(tracks[0].id); if (playing) audio.current?.pause(); else audio.current?.play().catch(() => setPlaying(false)); };
  const like = (id) => setLiked((items) => { const nextItems = new Set(items); nextItems.has(id) ? nextItems.delete(id) : nextItems.add(id); return nextItems; });

  const search = async (event) => {
    event.preventDefault(); const keyword = query.trim(); if (!keyword) return;
    setSearchState(TEXT.searching); setResults([]);
    try {
      const response = await fetch(`/api/music/search?q=${encodeURIComponent(keyword)}`); if (!response.ok) throw Error();
      const payload = await response.json(); setResults(payload.tracks || []);
      setSearchState('');
    } catch { setSearchState('\u641c\u7d22\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528'); }
  };

  const playResult = async (result) => {
    setSearchState(TEXT.load);
    try {
      const response = await fetch(`/api/music/resolve?id=${encodeURIComponent(result.id)}&source=${encodeURIComponent(result.source || '')}`); if (!response.ok) throw Error();
      const payload = await response.json(); if (!payload.url) throw Error();
      const track = { ...result, id: `track:${result.source || 'default'}:${result.id}`, url: payload.url, art: result.art || EMPTY_ART };
      setTracks((items) => items.some((item) => item.id === track.id) ? items : [...items, track]); setCurrentId(track.id); setSearchState('');
    } catch { setSearchState(TEXT.unavailable); }
  };

  return <main className="music-page"><audio ref={audio} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={next} />
    <section className="music-shell"><aside className="music-sidebar"><p className="music-brand">LURI / MUSIC</p><button className="music-nav active">{TEXT.discover}</button><button className="music-nav">{TEXT.likes}<span>{liked.size}</span></button><div className="music-divider" /><div className="music-source-card"><span>{TEXT.source}</span><strong>{'\u5df2\u542f\u7528\u97f3\u6e90\u670d\u52a1'}</strong><small>{'\u641c\u7d22\u4e0e\u89e3\u6790\u7531\u672c\u7ad9\u63a5\u53e3\u5904\u7406'}</small></div></aside>
      <section className="music-content"><header className="music-header"><div><p className="music-kicker">LURI MUSIC</p><h1>{TEXT.title}</h1></div><form className="music-search" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={TEXT.searchHint} /><button className="music-icon-button" type="submit" aria-label={TEXT.search} title={TEXT.search}><MusicIcon name="search" /></button></form></header>
        <div className="now-playing"><img src={current?.art || EMPTY_ART} alt="" /><div className="now-playing__copy"><p>{TEXT.now}</p><h2>{current?.title || TEXT.noTrack}</h2><span>{current?.artist || TEXT.choose}</span></div><button className={`like-button${current && liked.has(current.id) ? ' liked' : ''}`} disabled={!current} onClick={() => current && like(current.id)}>{TEXT.likes}</button></div>
        <div className="music-list-head"><span>{results.length ? TEXT.search : TEXT.queue}</span><small>{results.length || tracks.length} {TEXT.tracks}</small></div><div className="music-list">{(results.length ? results : tracks).map((track, index) => <button key={track.id} className={`music-row${track.id === currentId ? ' current' : ''}`} onClick={() => results.length ? playResult(track) : setCurrentId(track.id)}><span className="track-index">{String(index + 1).padStart(2, '0')}</span><img src={track.art || EMPTY_ART} alt="" /><span className="track-title">{track.title}<small>{track.artist}{track.year ? ` · ${track.year}` : ''}</small></span><span className="track-action">{results.length ? TEXT.play : liked.has(track.id) ? TEXT.likes : TEXT.play}</span></button>)}{!results.length && !tracks.length && <div className="music-empty"><strong>{TEXT.noResult}</strong><span>{TEXT.choose}</span></div>}</div><p className="source-summary">{searchState || TEXT.source}</p><p className="music-disclaimer">{TEXT.disclaimer}</p></section></section>
    <footer className="music-player"><div className="music-player__song"><img src={current?.art || EMPTY_ART} alt="" /><span>{current?.title || TEXT.noTrack}<small>{current?.artist || 'LURI MUSIC'}</small></span></div><div className="music-controls"><div><button className="music-icon-button" onClick={() => { const index = tracks.findIndex((track) => track.id === currentId); if (tracks.length) setCurrentId(tracks[(index - 1 + tracks.length) % tracks.length].id); }} aria-label={TEXT.prev} title={TEXT.prev}><MusicIcon name="previous" /></button><button className="music-icon-button play-button" onClick={toggle} aria-label={playing ? TEXT.pause : TEXT.play} title={playing ? TEXT.pause : TEXT.play}><MusicIcon name={playing ? 'pause' : 'play'} /></button><button className="music-icon-button" onClick={next} aria-label={TEXT.next} title={TEXT.next}><MusicIcon name="next" /></button></div><div className="timeline"><span>{time(progress)}</span><input type="range" min="0" max={duration || 0} value={Math.min(progress, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audio.current) audio.current.currentTime = value; setProgress(value); }} /><span>{time(duration)}</span></div></div></footer>
  </main>;
}
