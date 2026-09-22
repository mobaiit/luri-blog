import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Toast } from '../luri-music/UiFeedback';
import './Music.css';

const EMPTY_ART = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23ece9e1"/%3E%3Ccircle cx="200" cy="200" r="106" fill="%23c8c2b7"/%3E%3Ccircle cx="200" cy="200" r="22" fill="%23111111"/%3E%3C/svg%3E';
const TEXT = { title: '\u97f3\u4e50', discover: '\u53d1\u73b0\u97f3\u4e50', likes: '\u6211\u7684\u559c\u6b22', search: '\u641c\u7d22', searchHint: '\u641c\u7d22\u6b4c\u66f2\u3001\u827a\u4eba\u6216\u4e13\u8f91', searching: '\u6b63\u5728\u641c\u7d22\u2026', queue: '\u64ad\u653e\u961f\u5217', tracks: '\u9996\u6b4c\u66f2', noResult: '\u6682\u65e0\u641c\u7d22\u7ed3\u679c', noTrack: '\u6682\u65e0\u6b4c\u66f2', choose: '\u8bf7\u641c\u7d22\u540e\u9009\u62e9\u6b4c\u66f2', now: '\u6b63\u5728\u64ad\u653e', play: '\u64ad\u653e', pause: '\u6682\u505c', prev: '\u4e0a\u4e00\u9996', next: '\u4e0b\u4e00\u9996', load: '\u6b63\u5728\u83b7\u53d6\u53ef\u64ad\u653e\u6587\u4ef6\u2026', unavailable: '\u6ca1\u6709\u627e\u5230\u53ef\u76f4\u64ad\u7684\u97f3\u9891\u6587\u4ef6', source: '\u516c\u5f00\u97f3\u9891\u76ee\u5f55', disclaimer: '\u672c\u9875\u4ec5\u63d0\u4f9b\u641c\u7d22\u4e0e\u64ad\u653e\u754c\u9762\uff0c\u4e0d\u6258\u7ba1\u3001\u4e0d\u590d\u5236\u3001\u4e0d\u4ee3\u7406\u4efb\u4f55\u97f3\u9891\u6587\u4ef6\u3002\u8bf7\u4ec5\u4f7f\u7528\u5df2\u83b7\u6388\u6743\u7684\u97f3\u6e90\uff0c\u5e76\u9075\u5b88\u5176\u670d\u52a1\u6761\u6b3e\u4e0e\u9002\u7528\u6cd5\u5f8b\u3002' };
const time = (value = 0) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
const lyricLine = (line) => { const match = /^\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/.exec(line); return match ? { time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() } : { time: -1, text: line }; };
const STORE_QUEUE = 'luri.music.queue.v1'; const STORE_LIKES = 'luri.music.likes.v1'; const STORE_SEARCH = 'luri.music.search.v1'; const STORE_QUERY = 'luri.music.query.v1'; const STORE_RECENT_SEARCHES = 'luri.music.recent-searches.v1';
const readStore = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const trackKey = (track, providerId = '') => { const id = String(track?.id || ''); if (id.startsWith('provider:') || id.startsWith('track:')) return id; const base = `track:${track?.source || 'default'}:${id}`; return providerId ? `provider:${providerId}:${base}` : base; };
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
    random: <><path d="M4 7h3l10 10h3" /><path d="m17 5 3 2-3 2" /><path d="M4 17h3l2.2-2.2M14.8 9.2 17 7h3" /></>,
  };
  return <svg className="music-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const QUALITY_META = {
  '128k': { label: '128K', icon: 'low' },
  '192k': { label: '192K', icon: 'medium' },
  '320k': { label: '320K', icon: 'high' },
  flac: { label: 'FLAC', icon: 'lossless' },
  flac24bit: { label: 'HI-RES', icon: 'hires' },
};

function QualityBadge({ track }) {
  const meta = QUALITY_META[track?.quality]; if (!meta) return null;
  const detail = track.qualityVerified ? '实际音质' : 'Provider 解析档位';
  const degraded = Boolean(track.degraded);
  return <i className={`music-quality music-quality--${meta.icon}${degraded ? ' is-degraded' : ''}`} title={`${detail}：${meta.label}${degraded ? '（已降级）' : ''}`} aria-label={`${detail} ${meta.label}${degraded ? '，已降级' : ''}`}><svg viewBox="0 0 20 20" aria-hidden="true">{meta.icon === 'lossless' ? <><path d="m10 2.5 6.5 7.5-6.5 7.5L3.5 10 10 2.5Z" /><path d="M7 10h6" /></> : meta.icon === 'hires' ? <><path d="M4 14V9m4 5V6m4 8V3m4 11v-4" /><path d="m15.5 3 .5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2Z" /></> : <>{[0, 1, 2].slice(0, meta.icon === 'low' ? 1 : meta.icon === 'medium' ? 2 : 3).map((bar) => <path key={bar} d={`M${5 + bar * 5} ${13 - bar * 3}v${3 + bar * 3}`} />)}</>}</svg><span>{meta.label}</span>{degraded && <b aria-hidden="true">↓</b>}</i>;
}

export default function Music({ forceMusicPage = false, providerClient = null, playbackQuality = 'auto', storageNamespace = '', onRequireAccess, pageTitle = forceMusicPage ? 'LURI MUSIC' : TEXT.title, headerNotice = null, legalLinks = null }) {
  const location = useLocation();
  const isMusicPage = forceMusicPage || location.pathname === '/music';
  const audio = useRef(null);
  const musicRequest = useCallback((kind, params = {}, signal) => {
    if (providerClient) return providerClient.request(kind, params, signal);
    const error = new Error('请先配置并启用 Provider');
    error.status = 403;
    error.code = 'provider_access_denied';
    return Promise.reject(error);
  }, [providerClient]);
  const storeKey = (key) => storageNamespace ? `${key}.${storageNamespace}` : key;
  const restoreResults = () => readStore(storeKey(STORE_SEARCH)).map((track) => ({ ...track, sourceId: sourceTrackId(track), id: trackKey(track, storageNamespace) }));
  const [query, setQuery] = useState(() => localStorage.getItem(storeKey(STORE_QUERY)) || ''); const [results, setResults] = useState(restoreResults); const [cachedResults, setCachedResults] = useState(restoreResults); const [recentSearches, setRecentSearches] = useState(() => readStore(storeKey(STORE_RECENT_SEARCHES)).filter((item) => typeof item === 'string').slice(0, 10)); const [searchFocused, setSearchFocused] = useState(false); const [searchState, setSearchState] = useState('');
  const [listView, setListView] = useState('search');
  const [mobileView, setMobileView] = useState('playlist');
  const [activeQueue, setActiveQueue] = useState('normal');
  const [resultPage, setResultPage] = useState(0); const [hasMoreResults, setHasMoreResults] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const [tracks, setTracks] = useState(() => readStore(storeKey(STORE_QUEUE))); const [likedTracks, setLikedTracks] = useState(() => readStore(storeKey(STORE_LIKES))); const [playbackQueue, setPlaybackQueue] = useState([]); const [currentId, setCurrentId] = useState(null); const [playing, setPlaying] = useState(false); const [playbackState, setPlaybackState] = useState('idle'); const [playbackTrackId, setPlaybackTrackId] = useState(null); const [playbackAttempt, setPlaybackAttempt] = useState(0); const [forceLocalFallbackFor, setForceLocalFallbackFor] = useState(null); const [titleOverflows, setTitleOverflows] = useState(false);
  const [progress, setProgress] = useState(0); const [duration, setDuration] = useState(0); const [liked, setLiked] = useState(() => new Set(readStore(storeKey(STORE_LIKES)).map((track) => track.id)));
  const [volume, setVolume] = useState(0.8); const [muted, setMuted] = useState(false);
  const [lyrics, setLyrics] = useState(''); const [lyricsState, setLyricsState] = useState('');
  const lyricsRef = useRef(null); const musicListRef = useRef(null); const currentRowRef = useRef(null); const locatedTrackRef = useRef('');
  const loadingMoreRef = useRef(false); const activeSearchRef = useRef(query.trim());
  const randomRequest = useRef(null); const randomSession = useRef(0); const playMode = useRef('manual'); const localFallbackAttempts = useRef(new Set());
  const randomFallbackTracks = useRef([]); const randomSingers = useRef([]);
  const [randomLoading, setRandomLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const activeTracks = activeQueue === 'favorites' ? likedTracks : tracks;
  const current = playbackQueue.find((track) => track.id === currentId) || activeTracks.find((track) => track.id === currentId);
  const lyricLines = lyrics.split(/\r?\n/).filter(Boolean).map(lyricLine).filter((line) => line.text);
  const activeLyric = lyricLines.reduce((active, line, index) => line.time >= 0 && line.time <= progress ? index : active, -1);

  useEffect(() => {
    document.body.classList.toggle('has-global-music-player', !isMusicPage);
    return () => document.body.classList.remove('has-global-music-player');
  }, [isMusicPage]);
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
  useEffect(() => { try { localStorage.setItem(storeKey(STORE_SEARCH), JSON.stringify(cachedResults)); localStorage.setItem(storeKey(STORE_QUERY), query); } catch { /* Storage is unavailable in private browsing. */ } }, [cachedResults, query]);
  useEffect(() => { try { localStorage.setItem(storeKey(STORE_RECENT_SEARCHES), JSON.stringify(recentSearches)); } catch { /* Storage is unavailable in private browsing. */ } }, [recentSearches]);
  useEffect(() => {
    if (!current || current.url) return undefined;
    setPlaybackTrackId(current.id); setPlaybackState('resolving');
    const controller = new AbortController();
    musicRequest('resolve', { id: sourceTrackId(current), source: current.source || '', title: current.title || '', artist: current.artist || '', quality: playbackQuality, meta: current.meta || undefined, fallbackOnly: forceLocalFallbackFor === current.id ? '1' : '' }, controller.signal).then((response) => response.ok ? response.json() : {}).then((payload) => {
      if (!payload.url) throw Error();
      if (!controller.signal.aborted) {
        const update = (track) => track.id === current.id ? { ...track, url: payload.url, art: payload.art || track.art, requestedQuality: payload.requestedQuality || playbackQuality, quality: payload.quality || '', bitrate: payload.bitrate || null, degraded: Boolean(payload.degraded), qualityVerified: Boolean(payload.qualityVerified) } : track;
        (activeQueue === 'favorites' ? setLikedTracks : setTracks)((items) => items.map(update));
        setPlaybackQueue((items) => items.map(update));
      }
    }).catch((error) => {
      if (controller.signal.aborted) return;
      if (error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403) { playMode.current = 'manual'; setPlaying(false); showToast('Provider 没有访问权限，请重新配置或联系服务提供方', 'warning'); return; }
      if (playMode.current === 'random') playNextRandom();
      else setPlaybackState('error');
    });
    return () => controller.abort();
  }, [activeQueue, current, playbackAttempt, forceLocalFallbackFor, playbackQuality]);
  useEffect(() => {
    if (!current || (current.art && current.art !== EMPTY_ART) || !current.source) return undefined;
    const controller = new AbortController();
    musicRequest('artwork', { source: current.source, id: sourceTrackId(current), title: current.title || '', artist: current.artist || '', meta: current.meta || undefined }, controller.signal).then((response) => response.ok ? response.json() : {}).then((payload) => {
      if (payload.url && !controller.signal.aborted) {
        const update = (track) => track.id === current.id ? { ...track, art: payload.url } : track;
        (activeQueue === 'favorites' ? setLikedTracks : setTracks)((items) => items.map(update));
        setPlaybackQueue((items) => items.map(update));
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [activeQueue, current]);
  useEffect(() => { try { localStorage.setItem(storeKey(STORE_QUEUE), JSON.stringify(tracks.slice(0, 50).map(({ url: _url, ...track }) => track))); } catch { /* Storage is unavailable in private browsing. */ } }, [tracks]);
  useEffect(() => { try { localStorage.setItem(storeKey(STORE_LIKES), JSON.stringify(likedTracks)); } catch { /* Storage is unavailable in private browsing. */ } }, [likedTracks]);
  useEffect(() => { if (!audio.current) return; audio.current.volume = volume; audio.current.muted = muted; }, [volume, muted]);
  useEffect(() => { document.documentElement.style.setProperty('--music-progress', `${duration ? Math.min(100, Math.max(0, progress / duration * 100)) : 0}%`); }, [duration, progress]);
  useEffect(() => { const title = document.querySelector('.music-row.current .track-title'); setTitleOverflows(Boolean(title && title.scrollWidth > title.clientWidth)); }, [currentId, results, tracks]);
  useEffect(() => {
    if (listView !== 'search' || !currentId) return undefined;
    if (window.matchMedia('(max-width: 760px)').matches && mobileView !== 'playlist') return undefined;
    const frame = window.requestAnimationFrame(() => {
      const list = musicListRef.current; const row = currentRowRef.current;
      if (!list || !row) return;
      const locationKey = `${activeSearchRef.current}:${currentId}:${mobileView}`;
      if (locatedTrackRef.current === locationKey) return;
      locatedTrackRef.current = locationKey;
      const listBounds = list.getBoundingClientRect(); const rowBounds = row.getBoundingClientRect();
      const top = list.scrollTop + rowBounds.top - listBounds.top - (list.clientHeight - rowBounds.height) / 2;
      list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentId, listView, mobileView, results]);
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
    musicRequest('lyrics', Object.fromEntries(params), controller.signal).then((response) => response.ok ? response.json() : {}).then((payload) => { if (!controller.signal.aborted) { setLyrics(payload.lyrics || ''); setLyricsState(payload.lyrics ? '' : '暂无匹配歌词'); } }).catch((error) => { if (!controller.signal.aborted) { setLyricsState('暂无匹配歌词'); if (error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403) showToast('Provider 没有访问权限，请重新配置或联系服务提供方', 'warning'); } });
    return () => controller.abort();
  }, [current]);
  const stopRandom = () => {
    randomSession.current += 1;
    if (randomRequest.current) randomRequest.current.abort();
    randomRequest.current = null;
    playMode.current = 'manual'; setRandomLoading(false);
  };
  const hasAccess = () => !onRequireAccess || onRequireAccess() !== false;
  const selectTrack = (id, queue = null, mode = 'manual') => {
    if (!hasAccess()) return;
    if (mode === 'manual') stopRandom();
    const sourceQueue = queue?.length ? queue : playbackQueue.some((track) => track.id === id) ? null : activeTracks;
    const forSelectedQuality = (track) => track.id === id && track.url && track.requestedQuality !== playbackQuality ? { ...track, url: undefined } : track;
    if (sourceQueue?.length) setPlaybackQueue(sourceQueue.map(forSelectedQuality));
    else if (id !== currentId) setPlaybackQueue((items) => items.map(forSelectedQuality));
    setPlaybackTrackId(id); setPlaybackState('loading');
    if (id === currentId) {
      if (current?.url) audio.current?.play().catch(() => { setPlaying(false); setPlaybackState('error'); });
      else { localFallbackAttempts.current.delete(id); setForceLocalFallbackFor(null); setPlaybackAttempt((attempt) => attempt + 1); }
      return;
    }
    localFallbackAttempts.current.delete(id); setForceLocalFallbackFor(null);
    setCurrentId(id);
  };
  const next = () => {
    const queue = playbackQueue.length ? playbackQueue : activeTracks; if (!queue.length) return;
    if (playMode.current === 'random') return startRandom();
    const index = queue.findIndex((track) => track.id === currentId);
    selectTrack(queue[index < 0 ? 0 : (index + 1) % queue.length].id, null, playMode.current);
  };
  const previous = () => {
    const queue = playbackQueue.length ? playbackQueue : activeTracks; if (!queue.length) return;
    const index = queue.findIndex((track) => track.id === currentId);
    selectTrack(queue[index <= 0 ? queue.length - 1 : index - 1].id, null, playMode.current);
  };
  const toggle = () => {
    if (playbackState === 'resolving' || playbackState === 'loading') return;
    if (!playing && !hasAccess()) return;
    if (!current && activeTracks[0]) return selectTrack(activeTracks[0].id, activeTracks);
    if (playing) { audio.current?.pause(); return; }
    setPlaybackTrackId(currentId); setPlaybackState('loading');
    audio.current?.play().catch(() => { setPlaying(false); setPlaybackState('error'); });
  };
  const like = (id) => {
    const song = current || tracks.find((track) => track.id === id) || results.find((track) => track.id === id); if (!song) return;
    setLiked((items) => { const nextItems = new Set(items); const exists = nextItems.has(id); exists ? nextItems.delete(id) : nextItems.add(id); setLikedTracks((saved) => exists ? saved.filter((track) => track.id !== id) : [...saved.filter((track) => track.id !== id), { ...song, url: undefined }]); return nextItems; });
  };
  function showToast(message, type = 'error') { setToast({ title: type === 'warning' ? '需要处理' : '播放服务异常', message, type }); }
  const retryWithLocalFallback = () => {
    if (!current || localFallbackAttempts.current.has(current.id)) return false;
    localFallbackAttempts.current.add(current.id); setForceLocalFallbackFor(current.id);
    const clearUrl = (track) => track.id === current.id ? { ...track, url: undefined } : track;
    (activeQueue === 'favorites' ? setLikedTracks : setTracks)((items) => items.map(clearUrl));
    setPlaybackQueue((items) => items.map(clearUrl));
    setPlaybackState('resolving');
    return true;
  };
  const startRandom = async () => {
    if (!hasAccess()) return;
    const session = randomSession.current + 1;
    randomSession.current = session;
    if (randomRequest.current) randomRequest.current.abort();
    const controller = new AbortController(); randomRequest.current = controller;
    playMode.current = 'random'; setMobileView('now'); setRandomLoading(true); setSearchState('');
    try {
      const excluded = randomSingers.current.map(encodeURIComponent).join(',');
      const response = await musicRequest('random', { exclude: excluded }, controller.signal);
      if (!response.ok) throw Error();
      const payload = await response.json();
      const tracks = (payload.tracks || []).map((track) => ({ ...track, sourceId: track.sourceId ?? track.id, id: trackKey(track, storageNamespace) }));
      if (!tracks.length) throw Error();
      if (controller.signal.aborted || session !== randomSession.current) return;
      const selected = tracks[Math.floor(Math.random() * tracks.length)];
      randomFallbackTracks.current = tracks.filter((track) => track.id !== selected.id);
      if (payload.singer) randomSingers.current = [...randomSingers.current, payload.singer].slice(-20);
      setPlaybackQueue(tracks); setCurrentId(selected.id); setPlaybackTrackId(selected.id); setPlaybackState('resolving');
    } catch (error) {
      if (!controller.signal.aborted && session === randomSession.current) {
        const accessDenied = error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403;
        playMode.current = 'manual'; showToast(accessDenied ? 'Provider 没有访问权限，请重新配置或联系服务提供方' : '暂时没有可播放的随机歌曲，请重试', accessDenied ? 'warning' : 'error');
      }
    } finally {
      if (session === randomSession.current) { randomRequest.current = null; setRandomLoading(false); }
    }
  };
  function playNextRandom() {
    const candidates = randomFallbackTracks.current;
    if (!candidates.length) { startRandom(); return; }
    const index = Math.floor(Math.random() * candidates.length);
    const [track] = candidates.splice(index, 1);
    selectTrack(track.id, null, 'random');
  }

  const loadResults = async (keyword, page, append = false) => {
    if (append) { loadingMoreRef.current = true; setLoadingMore(true); } else setSearchState(TEXT.searching);
    try {
      const response = await musicRequest('search', { q: keyword, page }); if (!response.ok) throw Error();
      const payload = await response.json(); const incoming = (payload.tracks || []).map((track) => ({ ...track, sourceId: track.sourceId ?? track.id, id: trackKey(track, storageNamespace) }));
      if (!append) setTracks(incoming.slice(0, 50).map((track) => ({ ...track, url: undefined })));
      setResults((items) => append ? [...items, ...incoming.filter((track) => !items.some((item) => item.source === track.source && item.id === track.id))] : incoming);
      setResultPage(page); setHasMoreResults(Boolean(payload.hasMore && incoming.length)); setSearchState('');
    } catch (error) { const accessDenied = error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403; setHasMoreResults(false); setSearchState(''); showToast(accessDenied ? 'Provider 没有访问权限，请重新配置或联系服务提供方' : '搜索服务暂时不可用', accessDenied ? 'warning' : 'error'); }
    finally { loadingMoreRef.current = false; setLoadingMore(false); }
  };
  const runSearch = async (keyword) => {
    if (!hasAccess()) return;
    stopRandom();
    activeSearchRef.current = keyword;
    setRecentSearches((items) => [keyword, ...items.filter((item) => item !== keyword)].slice(0, 10));
    setListView('search'); setResults([]); setResultPage(0); setHasMoreResults(false); await loadResults(keyword, 1);
  };
  const search = async (event) => {
    event.preventDefault(); const keyword = query.trim(); if (!keyword) return;
    setSearchFocused(false); await runSearch(keyword);
  };
  const chooseRecentSearch = (keyword) => { setQuery(keyword); setSearchFocused(false); runSearch(keyword); };
  const loadNextPage = () => {
    const keyword = activeSearchRef.current;
    if (listView !== 'search' || !keyword || !results.length || !hasMoreResults || loadingMoreRef.current) return;
    loadResults(keyword, resultPage + 1, true);
  };
  const handleListScroll = (event) => {
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 80) loadNextPage();
  };

  const playResult = async (result) => {
    if (!hasAccess()) return;
    stopRandom();
    const trackId = trackKey({ ...result, id: sourceTrackId(result) }, storageNamespace);
    const sourceQueue = results.length ? results : activeTracks;
    const sessionQueue = sourceQueue.some((track) => track.id === trackId) ? sourceQueue : [result, ...sourceQueue];
    setPlaybackQueue(sessionQueue);
    setPlaybackTrackId(trackId); setPlaybackState('resolving');
    try {
      const rawId = sourceTrackId(result); const queue = listView === 'likes' ? 'favorites' : 'normal'; setActiveQueue(queue);
      const response = await musicRequest('resolve', { id: rawId, source: result.source || '', title: result.title || '', artist: result.artist || '', quality: playbackQuality, meta: result.meta || undefined }); if (!response.ok) throw Error();
      const payload = await response.json(); if (!payload.url) throw Error();
      const track = { ...result, sourceId: rawId, id: trackKey({ ...result, id: rawId }, storageNamespace), url: payload.url, art: payload.art || result.art || '', requestedQuality: payload.requestedQuality || playbackQuality, quality: payload.quality || '', bitrate: payload.bitrate || null, degraded: Boolean(payload.degraded), qualityVerified: Boolean(payload.qualityVerified) };
      if (queue === 'favorites') setLikedTracks((items) => items.map((item) => item.id === track.id ? track : item)); else setTracks((items) => [track, ...items.filter((item) => item.id !== track.id)].slice(0, 50));
      setPlaybackQueue((items) => items.some((item) => item.id === track.id) ? items.map((item) => item.id === track.id ? track : item) : [track, ...items]);
      setCurrentId(track.id); setPlaybackTrackId(track.id); setPlaybackState('loading');
    } catch (error) { const accessDenied = error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403; setPlaybackState('error'); showToast(accessDenied ? 'Provider 没有访问权限，请重新配置或联系服务提供方' : '播放失败，请稍后重试', accessDenied ? 'warning' : 'error'); }
  };
  const handleTrackAction = (track) => {
    if (track.id === currentId) { toggle(); return; }
    if (listView === 'search') playResult(track); else selectTrack(track.id, listView === 'likes' ? likedTracks : tracks);
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
  const isPlaybackBusy = randomLoading || playbackState === 'resolving' || playbackState === 'loading';
  const rowPlaybackState = (id) => id === playbackTrackId ? playbackState : 'idle';

  return <main className={`music-page mobile-view-${mobileView}${playing ? ' is-playing' : ''}${titleOverflows ? ' has-overflowing-title' : ''}`}><audio ref={audio} onPlay={() => { setPlaying(true); setPlaybackTrackId(currentId); setPlaybackState('playing'); }} onPause={() => { setPlaying(false); setPlaybackState((state) => state === 'loading' || state === 'resolving' ? state : 'paused'); }} onLoadStart={() => setPlaybackState('loading')} onWaiting={() => setPlaybackState('loading')} onPlaying={() => setPlaybackState('playing')} onError={() => { setPlaying(false); if (playMode.current === 'random') playNextRandom(); else if (!retryWithLocalFallback()) setPlaybackState('error'); }} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={next} /><Toast toast={toast} onClose={() => setToast(null)} /><nav className="music-mobile-tabs" aria-label="移动端音乐视图"><button className={mobileView === 'playlist' ? 'active' : ''} onClick={() => setMobileView('playlist')}>播放列表</button><button className={mobileView === 'now' ? 'active' : ''} onClick={() => setMobileView('now')}>正在播放</button></nav>
  <section className="music-shell"><aside className="music-sidebar"><p className="music-brand">LURI / MUSIC</p><button className={`music-nav${listView === 'queue' ? ' active' : ''}`} onClick={() => { setListView('queue'); setResults(tracks); }}>播放列表<span>{tracks.length}</span></button><button className={`music-nav${listView === 'likes' ? ' active' : ''}`} onClick={() => { setListView('likes'); setResults(likedTracks); }}>我喜欢<span>{liked.size}</span></button><div className="music-divider" /></aside>
      <section className="music-content"><header className="music-header"><div><p className="music-kicker">LURI MUSIC</p><h1>{pageTitle}</h1>{headerNotice}</div><form className="music-search" onSubmit={search}><input value={query} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onChange={(event) => setQuery(event.target.value)} placeholder={TEXT.searchHint} /><button className="music-icon-button" type="submit" disabled={isSearching} aria-label={isSearching ? '正在搜索' : TEXT.search} title={isSearching ? '正在搜索' : TEXT.search}>{isSearching ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name="search" />}</button><button className="music-random-button" type="button" onMouseDown={(event) => event.preventDefault()} onClick={startRandom} disabled={randomLoading} aria-label="随机搜索并播放音乐" title="随机发现">{randomLoading ? <span className="music-spinner" aria-hidden="true" /> : <><MusicIcon name="random" /><span>随机发现</span></>}</button>{searchFocused && recentSearches.length > 0 && <div className="music-search-history" onMouseDown={(event) => event.preventDefault()}><div className="music-search-history__head"><span>最近搜索</span><button type="button" onClick={() => setRecentSearches([])}>清除</button></div>{recentSearches.map((item) => <button className="music-search-history__item" type="button" key={item} onClick={() => chooseRecentSearch(item)}>{item}</button>)}</div>}</form></header>
        <div className="music-workspace"><section className="music-results"><div className="music-list-head"><span>{results.length ? TEXT.search : TEXT.queue}</span><small>{results.length || tracks.length} {TEXT.tracks}</small></div><div className="music-list" ref={musicListRef} onScroll={handleListScroll}>{visibleTracks.map((track, index) => { const state = rowPlaybackState(track.id); const isCurrent = track.id === currentId; const isCurrentBusy = isCurrent && isPlaybackBusy; return <button ref={isCurrent ? currentRowRef : null} key={`${track.source || 'queue'}:${track.id}`} className={`music-row${isCurrent ? ' current' : ''}`} onClick={() => handleTrackAction(track)} disabled={isCurrentBusy} aria-label={`${track.title}，${isCurrentBusy ? '正在加载' : state === 'error' ? '播放失败，点击重试' : state === 'playing' ? TEXT.pause : TEXT.play}`}><span className="track-index">{String(index + 1).padStart(2, '0')}</span><img src={track.art || EMPTY_ART} alt="" /><span className="track-copy"><span className="track-title"><b>{track.title}</b>{isCurrent && <QualityBadge track={current} />}</span><span className="track-artist">{track.artist}{track.year ? ` · ${track.year}` : ''}</span></span><span className={`track-action track-action--${state}`} aria-hidden="true">{state === 'error' ? '播放失败' : state === 'loading' || state === 'resolving' ? <span className="music-spinner" /> : <MusicIcon name={state === 'playing' ? 'pause' : 'play'} />}</span></button>; })}{loadingMore && <p className="music-list-status">正在加载更多…</p>}{!results.length && !tracks.length && <div className="music-empty"><strong>{TEXT.noResult}</strong><span>{TEXT.choose}</span></div>}</div><p className="music-search-status" aria-live="polite">{isSearching ? '' : searchState}</p></section><aside className="music-lyrics"><div className="lyrics-track"><img src={current?.art || EMPTY_ART} alt="" /><div><p>歌词</p><h2><b>{current?.title || TEXT.noTrack}</b><QualityBadge track={current} /></h2><span>{current?.artist || TEXT.choose}</span></div><button className={`like-button${current && liked.has(current.id) ? ' liked' : ''}`} disabled={!current} onClick={() => current && like(current.id)}>{TEXT.likes}</button></div><div ref={lyricsRef} className="lyrics-body" onClick={seekLyric}>{lyrics ? lyricLines.map((line, index) => <p key={`${line.time}:${line.text}:${index}`}>{line.text}</p>) : <p className="lyrics-empty">{lyricsState || TEXT.choose}</p>}</div></aside></div></section></section>
    <footer className="music-player"><div className="music-player__song"><img src={current?.art || EMPTY_ART} alt="" /><span><b className="music-player__title">{current?.title || TEXT.noTrack}</b><QualityBadge track={current} /><small>{current?.artist || 'LURI MUSIC'}</small></span></div><div className="music-controls"><div><button className="music-icon-button" onClick={previous} aria-label={TEXT.prev} title={TEXT.prev}><MusicIcon name="previous" /></button><button className="music-icon-button play-button" onClick={toggle} disabled={isPlaybackBusy} aria-label={isPlaybackBusy ? '正在加载' : playing ? TEXT.pause : TEXT.play} title={isPlaybackBusy ? '正在加载' : playing ? TEXT.pause : TEXT.play}>{isPlaybackBusy ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name={playing ? 'pause' : 'play'} />}</button><button className="music-icon-button" onClick={next} aria-label={TEXT.next} title={TEXT.next}><MusicIcon name="next" /></button></div><div className="timeline"><span>{time(progress)}</span><input type="range" min="0" max={duration || 0} value={Math.min(progress, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audio.current) audio.current.currentTime = value; setProgress(value); }} /><span>{time(duration)}</span></div></div><div className="music-volume"><button className="music-icon-button" onClick={() => setMuted((value) => !value)} aria-label={muted || volume === 0 ? '取消静音' : '静音'} title={muted || volume === 0 ? '取消静音' : '静音'}><MusicIcon name={muted || volume === 0 ? 'mute' : 'volume'} /></button><input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} aria-label="音量" onChange={(event) => { const value = Number(event.target.value); setVolume(value); setMuted(value === 0); }} /></div>{legalLinks ? <div className="music-global-disclaimer music-legal-links">{legalLinks}</div> : <p className="music-global-disclaimer">请仅播放您依法有权访问的内容。</p>}</footer></main>;
}
