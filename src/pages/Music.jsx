import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Toast } from '../luri-music/UiFeedback';
import './Music.css';

const EMPTY_ART = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23ece9e1"/%3E%3Ccircle cx="200" cy="200" r="106" fill="%23c8c2b7"/%3E%3Ccircle cx="200" cy="200" r="22" fill="%23111111"/%3E%3C/svg%3E';
const TEXT = { title: '\u97f3\u4e50', discover: '\u53d1\u73b0\u97f3\u4e50', likes: '\u6211\u7684\u559c\u6b22', search: '\u641c\u7d22', searchHint: '\u641c\u7d22\u6b4c\u66f2\u3001\u827a\u4eba\u6216\u4e13\u8f91', searching: '\u6b63\u5728\u641c\u7d22\u2026', queue: '\u64ad\u653e\u961f\u5217', tracks: '\u9996\u6b4c\u66f2', noResult: '\u6682\u65e0\u641c\u7d22\u7ed3\u679c', noTrack: '\u6682\u65e0\u6b4c\u66f2', choose: '\u8bf7\u641c\u7d22\u540e\u9009\u62e9\u6b4c\u66f2', now: '\u6b63\u5728\u64ad\u653e', play: '\u64ad\u653e', pause: '\u6682\u505c', prev: '\u4e0a\u4e00\u9996', next: '\u4e0b\u4e00\u9996', load: '\u6b63\u5728\u83b7\u53d6\u53ef\u64ad\u653e\u6587\u4ef6\u2026', unavailable: '\u6ca1\u6709\u627e\u5230\u53ef\u76f4\u64ad\u7684\u97f3\u9891\u6587\u4ef6', source: '\u516c\u5f00\u97f3\u9891\u76ee\u5f55', disclaimer: '\u672c\u9875\u4ec5\u63d0\u4f9b\u641c\u7d22\u4e0e\u64ad\u653e\u754c\u9762\uff0c\u4e0d\u6258\u7ba1\u3001\u4e0d\u590d\u5236\u3001\u4e0d\u4ee3\u7406\u4efb\u4f55\u97f3\u9891\u6587\u4ef6\u3002\u8bf7\u4ec5\u4f7f\u7528\u5df2\u83b7\u6388\u6743\u7684\u97f3\u6e90\uff0c\u5e76\u9075\u5b88\u5176\u670d\u52a1\u6761\u6b3e\u4e0e\u9002\u7528\u6cd5\u5f8b\u3002' };
const time = (value = 0) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
const lyricLine = (line) => { const match = /^\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/.exec(line); return match ? { time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() } : { time: -1, text: line }; };
const STORE_QUEUE = 'luri.music.queue.v1'; const STORE_LIKES = 'luri.music.likes.v1'; const STORE_SEARCH = 'luri.music.search.v1'; const STORE_QUERY = 'luri.music.query.v1'; const STORE_RECENT_SEARCHES = 'luri.music.recent-searches.v1';
const MEDIA_LOAD_TIMEOUT_MS = 15000;
const readStore = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const readSession = (key) => { try { return JSON.parse(sessionStorage.getItem(key) || '{}'); } catch { return {}; } };
const writeSession = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Session storage may be unavailable. */ } };
const randomTextKey = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s()（）.·_-]/g, '');
const randomTrackKey = (track) => `${randomTextKey(track?.title)}:${randomTextKey(track?.artist)}`;
const trackArtists = (track) => String(track?.artist || '').split(/\s*(?:,|，|、|\/|&|feat\.?|ft\.?)\s*/i).filter(Boolean);
const trackTitleKey = (track) => String(track?.title || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const sameFavorite = (left, right) => Boolean(left && right && (left.id === right.id || (trackTitleKey(left) && trackTitleKey(left) === trackTitleKey(right))));
const trackKey = (track, providerId = '') => { const id = String(track?.id || ''); if (id.startsWith('provider:') || id.startsWith('track:')) return id; const base = `track:${track?.source || 'default'}:${id}`; return providerId ? `provider:${providerId}:${base}` : base; };
const sourceTrackId = (track) => track?.sourceId ?? String(track?.id || '').replace(/^(?:provider:[^:]+:)?track:[^:]+:/, '');
const resolvedExpiry = (payload) => { const explicit = Date.parse(payload?.expiresAt || ''); if (Number.isFinite(explicit)) return new Date(explicit).toISOString(); const seconds = Number(payload?.expiresIn); return Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null; };
const playbackUrlExpired = (track) => { const expires = Date.parse(track?.expiresAt || ''); return Boolean(track?.url && Number.isFinite(expires) && expires <= Date.now() + 5000); };
const handleArtworkError = (event) => { if (event.currentTarget.getAttribute('src') !== EMPTY_ART) event.currentTarget.src = EMPTY_ART; };
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
    download: <><path d="M12 4v11m-4-4 4 4 4-4" /><path d="M5 19h14" /></>,
    random: <><path d="M4 7h3l10 10h3" /><path d="m17 5 3 2-3 2" /><path d="M4 17h3l2.2-2.2M14.8 9.2 17 7h3" /></>,
  };
  return <svg className="music-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const QUALITY_META = {
  '128k': { label: '普通 128K', icon: 'low', mark: 'STD' },
  '192k': { label: '标准 192K', icon: 'medium', mark: 'HQ' },
  '320k': { label: '高音质 320K', icon: 'high', mark: 'HQ+' },
  flac: { label: '无损 FLAC', icon: 'lossless', mark: 'SQ' },
  flac24bit: { label: 'Hi-Res', icon: 'hires', mark: 'Hi-Res' },
};
const QUALITY_RANK = { '128k': 1, '192k': 2, '320k': 3, flac: 4, flac24bit: 5 };

function QualityBadge({ track }) {
  const meta = QUALITY_META[track?.quality]; if (!meta) return null;
  const detail = track.qualityVerified ? '实际音质' : 'Provider 解析档位';
  const requested = track.requestedQuality === 'auto' ? '128k' : track.requestedQuality;
  const degraded = QUALITY_RANK[track.quality] && QUALITY_RANK[requested] ? QUALITY_RANK[track.quality] < QUALITY_RANK[requested] : Boolean(track.degraded);
  return <i className={`music-quality music-quality--${meta.icon}${degraded ? ' is-degraded' : ''}`} title={`${detail}：${meta.label}${degraded ? '（已降级）' : ''}`} aria-label={`${detail} ${meta.label}${degraded ? '，已降级' : ''}`}><span className="music-quality__mark" aria-hidden="true">{meta.mark}</span>{degraded && <b aria-hidden="true">↓</b>}</i>;
}

function DownloadButton({ track }) {
  const href = track?.url;
  const extension = track?.quality === 'flac' || track?.quality === 'flac24bit' ? 'flac' : 'mp3';
  const filename = `${String(track?.title || 'music').replace(/[\\/:*?"<>|]/g, '_')}.${extension}`;
  if (!href) return <button className="music-download-button" type="button" disabled aria-label="暂无可下载的音频" title="播放地址加载后可下载"><MusicIcon name="download" /></button>;
  return <a className="music-download-button" href={href} download={filename} target="_blank" rel="noreferrer" aria-label={`下载 ${track.title}`} title="直接打开 Provider 音频源"><MusicIcon name="download" /></a>;
}

export default function Music({ forceMusicPage = false, providerClient = null, playbackQuality = '128k', storageNamespace = '', onRequireAccess, pageTitle = forceMusicPage ? 'LURI MUSIC' : TEXT.title, headerNotice = null, legalLinks = null }) {
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
  const [progress, setProgress] = useState(0); const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8); const [muted, setMuted] = useState(false);
  const [lyrics, setLyrics] = useState(''); const [lyricsState, setLyricsState] = useState('');
  const lyricsRef = useRef(null); const musicListRef = useRef(null); const currentRowRef = useRef(null); const locatedTrackRef = useRef('');
  const resolveRequestRef = useRef(null); const mediaDeadlineRef = useRef(null); const mediaDeadlineTrackRef = useRef(''); const ignoreAudioErrorRef = useRef(false); const failedPlaybackIdsRef = useRef(new Set()); const primaryResolveAttemptsRef = useRef(new Set()); const blockedResolveIdsRef = useRef(new Set());
  const loadingMoreRef = useRef(false); const activeSearchRef = useRef(query.trim());
  const randomHistoryKey = `luri.music.random-history.v1${storageNamespace ? `.${storageNamespace}` : ''}`; const storedRandomHistory = useRef(readSession(randomHistoryKey));
  const randomRequest = useRef(null); const randomSession = useRef(0); const playMode = useRef('manual'); const localFallbackAttempts = useRef(new Set()); const playbackListRef = useRef('');
  const randomFallbackTracks = useRef([]); const randomSingers = useRef(Array.isArray(storedRandomHistory.current.singers) ? storedRandomHistory.current.singers : []); const randomTrackKeys = useRef(Array.isArray(storedRandomHistory.current.tracks) ? storedRandomHistory.current.tracks : []);
  const [randomLoading, setRandomLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const activeTracks = activeQueue === 'favorites' ? likedTracks : tracks;
  const current = playbackQueue.find((track) => track.id === currentId) || activeTracks.find((track) => track.id === currentId);
  const lyricLines = lyrics.split(/\r?\n/).filter(Boolean).map(lyricLine).filter((line) => line.text);
  const activeLyric = lyricLines.reduce((active, line, index) => line.time >= 0 && line.time <= progress ? index : active, -1);
  const clearMediaDeadline = () => { if (mediaDeadlineRef.current) window.clearTimeout(mediaDeadlineRef.current); mediaDeadlineRef.current = null; mediaDeadlineTrackRef.current = ''; };
  const beginMediaDeadline = (id) => {
    clearMediaDeadline(); mediaDeadlineTrackRef.current = id;
    mediaDeadlineRef.current = window.setTimeout(() => {
      if (mediaDeadlineTrackRef.current !== id) return;
      ignoreAudioErrorRef.current = true; audio.current?.pause(); audio.current?.removeAttribute('src'); audio.current?.load();
      setPlaying(false); clearMediaDeadline();
      if (!retryWithPrimaryResolve()) handlePlaybackFailure(false, '重新解析后仍无法播放，已自动播放下一首');
    }, MEDIA_LOAD_TIMEOUT_MS);
  };

  useEffect(() => {
    document.body.classList.toggle('has-global-music-player', !isMusicPage);
    return () => { document.body.classList.remove('has-global-music-player'); resolveRequestRef.current?.abort(); if (mediaDeadlineRef.current) window.clearTimeout(mediaDeadlineRef.current); };
  }, [isMusicPage]);
  useEffect(() => {
    if (!currentId) return;
    if (activeQueue === 'favorites' && !likedTracks.some((track) => track.id === currentId) && tracks.some((track) => track.id === currentId)) setActiveQueue('normal');
    if (activeQueue === 'normal' && !tracks.some((track) => track.id === currentId) && likedTracks.some((track) => track.id === currentId)) setActiveQueue('favorites');
  }, [currentId, activeQueue, tracks, likedTracks]);

  useEffect(() => {
    if (!audio.current || !current?.url) return;
    setPlaybackTrackId(current.id); setPlaybackState('loading'); setProgress(0); setDuration(0);
    ignoreAudioErrorRef.current = false; audio.current.src = current.url; audio.current.load(); beginMediaDeadline(current.id);
    audio.current.play().catch(() => { clearMediaDeadline(); setPlaying(false); setPlaybackState('error'); });
  }, [currentId, current?.id, current?.url]);
  useEffect(() => { if (listView === 'search') setCachedResults(results); }, [listView, results]);
  useEffect(() => { try { localStorage.setItem(storeKey(STORE_SEARCH), JSON.stringify(cachedResults)); localStorage.setItem(storeKey(STORE_QUERY), query); } catch { /* Storage is unavailable in private browsing. */ } }, [cachedResults, query]);
  useEffect(() => { try { localStorage.setItem(storeKey(STORE_RECENT_SEARCHES), JSON.stringify(recentSearches)); } catch { /* Storage is unavailable in private browsing. */ } }, [recentSearches]);
  useEffect(() => {
    if (!current || current.url || blockedResolveIdsRef.current.has(current.id)) return undefined;
    setPlaybackTrackId(current.id); setPlaybackState('resolving');
    const controller = new AbortController();
    resolveRequestRef.current = controller;
    if (forceLocalFallbackFor !== current.id) primaryResolveAttemptsRef.current.add(current.id);
    musicRequest('resolve', { id: sourceTrackId(current), source: current.source || '', title: current.title || '', artist: current.artist || '', quality: playbackQuality, meta: current.meta || undefined, fallbackOnly: forceLocalFallbackFor === current.id ? '1' : '' }, controller.signal).then((response) => response.ok ? response.json() : {}).then((payload) => {
      if (!payload.url) throw Error();
      if (!controller.signal.aborted) {
        const resolved = { ...current, url: payload.url, expiresAt: resolvedExpiry(payload), art: payload.art || current.art, requestedQuality: payload.requestedQuality || playbackQuality, quality: payload.quality || '', bitrate: payload.bitrate || null, degraded: Boolean(payload.degraded), qualityVerified: Boolean(payload.qualityVerified) };
        const update = (track) => track.id === current.id ? { ...track, ...resolved } : track;
        setTracks((items) => items.map(update));
        setLikedTracks((items) => { let replaced = false; return items.flatMap((track) => { if (!sameFavorite(track, current)) return [track]; if (replaced) return []; replaced = true; return [resolved]; }); });
        setPlaybackQueue((items) => items.map(update));
      }
    }).catch((error) => {
      if (controller.signal.aborted) return;
      if (error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403) { playMode.current = 'manual'; setPlaying(false); showToast('Provider 没有访问权限，请重新配置或联系服务提供方', 'warning'); return; }
      handlePlaybackFailure(false);
    }).finally(() => { if (resolveRequestRef.current === controller) resolveRequestRef.current = null; });
    return () => { controller.abort(); if (resolveRequestRef.current === controller) resolveRequestRef.current = null; };
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
    if (!currentId) return undefined;
    if (window.matchMedia('(max-width: 760px)').matches && mobileView !== 'playlist') return undefined;
    const frame = window.requestAnimationFrame(() => {
      const list = musicListRef.current; const row = currentRowRef.current;
      if (!list || !row) return;
      const locationKey = `${listView}:${activeSearchRef.current}:${currentId}:${mobileView}`;
      if (locatedTrackRef.current === locationKey) return;
      locatedTrackRef.current = locationKey;
      const listBounds = list.getBoundingClientRect(); const rowBounds = row.getBoundingClientRect();
      const top = list.scrollTop + rowBounds.top - listBounds.top - (list.clientHeight - rowBounds.height) / 2;
      list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentId, listView, mobileView, results, tracks, likedTracks]);
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
  const rememberRandomTrack = (track, singer = '') => {
    const singers = [...randomSingers.current, singer, ...trackArtists(track)].filter(Boolean);
    randomSingers.current = singers.filter((item, index) => singers.findLastIndex((candidate) => randomTextKey(candidate) === randomTextKey(item)) === index).slice(-30);
    const key = randomTrackKey(track); randomTrackKeys.current = [...randomTrackKeys.current.filter((item) => item !== key), key].filter(Boolean).slice(-50);
    writeSession(randomHistoryKey, { singers: randomSingers.current, tracks: randomTrackKeys.current });
  };
  const hasAccess = () => !onRequireAccess || onRequireAccess() !== false;
  const selectTrack = (id, queue = null, mode = 'manual', preserveFailures = false) => {
    if (!hasAccess()) return;
    if (!preserveFailures) { failedPlaybackIdsRef.current.clear(); primaryResolveAttemptsRef.current.delete(id); blockedResolveIdsRef.current.delete(id); }
    if (mode === 'manual') stopRandom();
    const sourceQueue = queue?.length ? queue : playbackQueue.some((track) => track.id === id) ? null : activeTracks;
    const forSelectedQuality = (track) => track.id === id && track.url && (track.requestedQuality !== playbackQuality || playbackUrlExpired(track)) ? { ...track, url: undefined } : track;
    if (sourceQueue?.length) setPlaybackQueue(sourceQueue.map(forSelectedQuality));
    else if (id !== currentId) setPlaybackQueue((items) => items.map(forSelectedQuality));
    clearMediaDeadline(); setPlaybackTrackId(id); setPlaybackState('loading');
    if (id === currentId) {
      if (current?.url) { beginMediaDeadline(id); audio.current?.play().catch(() => { clearMediaDeadline(); setPlaying(false); setPlaybackState('error'); }); }
      else { localFallbackAttempts.current.delete(id); setForceLocalFallbackFor(null); setPlaybackAttempt((attempt) => attempt + 1); }
      return;
    }
    if (audio.current) { ignoreAudioErrorRef.current = true; audio.current.pause(); audio.current.removeAttribute('src'); audio.current.load(); }
    setPlaying(false); setProgress(0); setDuration(0);
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
    if (current && (!current.url || playbackUrlExpired(current))) {
      if (current.url) { const clearUrl = (track) => track.id === current.id ? { ...track, url: undefined } : track; setPlaybackQueue((items) => (items.length ? items : activeTracks).map(clearUrl)); }
      failedPlaybackIdsRef.current.clear(); primaryResolveAttemptsRef.current.delete(current.id); blockedResolveIdsRef.current.delete(current.id); localFallbackAttempts.current.delete(current.id); setForceLocalFallbackFor(null); setPlaybackTrackId(current.id); setPlaybackState('resolving'); setPlaybackAttempt((attempt) => attempt + 1); return;
    }
    setPlaybackTrackId(currentId); setPlaybackState('loading'); beginMediaDeadline(currentId);
    if (audio.current && current?.url && !audio.current.getAttribute('src')) { ignoreAudioErrorRef.current = false; audio.current.src = current.url; audio.current.load(); }
    audio.current?.play().catch(() => { clearMediaDeadline(); setPlaying(false); setPlaybackState('error'); });
  };
  const like = (id) => {
    const song = current || tracks.find((track) => track.id === id) || results.find((track) => track.id === id); if (!song) return;
    setLikedTracks((saved) => saved.some((track) => sameFavorite(track, song)) ? saved.filter((track) => !sameFavorite(track, song)) : [...saved.filter((track) => !sameFavorite(track, song)), song]);
  };
  function showToast(message, type = 'error') { setToast({ title: type === 'warning' ? '需要处理' : '播放服务异常', message, type }); }
  const retryWithLocalFallback = () => {
    if (!current || localFallbackAttempts.current.has(current.id)) return false;
    localFallbackAttempts.current.add(current.id); setForceLocalFallbackFor(current.id);
    const clearUrl = (track) => track.id === current.id ? { ...track, url: undefined } : track;
    setPlaybackQueue((items) => (items.length ? items : activeTracks).map(clearUrl));
    clearMediaDeadline(); setPlaybackState('resolving');
    return true;
  };
  const retryWithPrimaryResolve = () => {
    if (!current || primaryResolveAttemptsRef.current.has(current.id)) return false;
    primaryResolveAttemptsRef.current.add(current.id); blockedResolveIdsRef.current.delete(current.id); localFallbackAttempts.current.delete(current.id); setForceLocalFallbackFor(null);
    const clearUrl = (track) => track.id === current.id ? { ...track, url: undefined } : track;
    setPlaybackQueue((items) => (items.length ? items : activeTracks).map(clearUrl));
    setPlaybackTrackId(current.id); setPlaybackState('resolving'); setPlaybackAttempt((attempt) => attempt + 1);
    return true;
  };
  const discardCurrentUrl = () => {
    if (!current) return;
    blockedResolveIdsRef.current.add(current.id);
    const clearUrl = (track) => track.id === current.id ? { ...track, url: undefined } : track;
    setLikedTracks((items) => items.map((track) => sameFavorite(track, current) ? { ...track, url: undefined } : track));
    setTracks((items) => items.map(clearUrl));
    setPlaybackQueue((items) => items.map(clearUrl));
  };
  function skipFailedTrack(message = '歌曲播放失败，已自动播放下一首') {
    const queue = playbackQueue.length ? playbackQueue : activeTracks;
    failedPlaybackIdsRef.current.add(currentId);
    if (queue.length <= 1 || failedPlaybackIdsRef.current.size >= queue.length) {
      setPlaybackTrackId(currentId); setPlaybackState('error'); showToast('播放列表中的歌曲均无法播放，请稍后重试', 'error'); return;
    }
    const currentIndex = queue.findIndex((track) => track.id === currentId); const startIndex = currentIndex < 0 ? -1 : currentIndex;
    const nextTrack = Array.from({ length: queue.length - 1 }, (_, offset) => queue[(startIndex + offset + 1) % queue.length]).find((track) => !failedPlaybackIdsRef.current.has(track.id));
    if (!nextTrack) { setPlaybackState('error'); return; }
    showToast(message, 'warning'); selectTrack(nextTrack.id, null, playMode.current, true);
  }
  function handlePlaybackFailure(allowLocalFallback = true, message) {
    setPlaying(false);
    if (current && primaryResolveAttemptsRef.current.has(current.id) && retryWithLocalFallback()) return;
    if (current && (primaryResolveAttemptsRef.current.has(current.id) || localFallbackAttempts.current.has(current.id))) {
      discardCurrentUrl();
      if (playMode.current === 'random') { playNextRandom(); return; }
      skipFailedTrack(message); return;
    }
    if (allowLocalFallback && retryWithLocalFallback()) return;
    if (playMode.current === 'random') { playNextRandom(); return; }
    skipFailedTrack(message);
  }
  const startRandom = async () => {
    if (!hasAccess()) return;
    const session = randomSession.current + 1;
    randomSession.current = session;
    if (randomRequest.current) randomRequest.current.abort();
    const controller = new AbortController(); randomRequest.current = controller;
    playMode.current = 'random'; setMobileView('now'); setRandomLoading(true); setSearchState('');
    try {
      const excluded = randomSingers.current.join(',');
      const response = await musicRequest('random', { exclude: excluded }, controller.signal);
      if (!response.ok) throw Error();
      const payload = await response.json();
      const seen = new Set(); const tracks = (payload.tracks || []).map((track) => ({ ...track, sourceId: track.sourceId ?? track.id, id: trackKey(track, storageNamespace) })).filter((track) => { const key = randomTrackKey(track); if (!key || seen.has(key)) return false; seen.add(key); return true; });
      if (!tracks.length) throw Error();
      if (controller.signal.aborted || session !== randomSession.current) return;
      const freshTracks = tracks.filter((track) => !randomTrackKeys.current.includes(randomTrackKey(track))); const candidates = freshTracks.length ? freshTracks : tracks;
      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      const fallbackCandidates = tracks.filter((track) => track.id !== selected.id && randomTrackKey(track) !== randomTrackKey(selected) && !randomTrackKeys.current.includes(randomTrackKey(track)));
      randomFallbackTracks.current = fallbackCandidates.length ? [fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)]] : [];
      rememberRandomTrack(selected, payload.singer || '');
      playbackListRef.current = 'random'; clearMediaDeadline(); setPlaybackQueue(tracks); setCurrentId(selected.id); setPlaybackTrackId(selected.id); setPlaybackState('resolving');
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
    rememberRandomTrack(track);
    selectTrack(track.id, null, 'random');
  }

  const loadResults = async (keyword, page, append = false) => {
    if (append) { loadingMoreRef.current = true; setLoadingMore(true); } else setSearchState(TEXT.searching);
    try {
      const response = await musicRequest('search', { q: keyword, page }); if (!response.ok) throw Error();
      const payload = await response.json(); const incoming = (payload.tracks || []).map((track) => ({ ...track, sourceId: track.sourceId ?? track.id, id: trackKey(track, storageNamespace) }));
      setTracks((items) => append ? [...items, ...incoming.filter((track) => !items.some((item) => item.id === track.id))] : incoming.map((track) => ({ ...track, url: undefined })));
      setResults((items) => append ? [...items, ...incoming.filter((track) => !items.some((item) => item.source === track.source && item.id === track.id))] : incoming);
      if (append && playbackListRef.current === `search:${activeSearchRef.current}`) setPlaybackQueue((items) => [...items, ...incoming.filter((track) => !items.some((item) => item.id === track.id))]);
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

  const handleTrackAction = (track) => {
    if (track.id === currentId) { toggle(); return; }
    const queue = listView === 'search' ? results : listView === 'likes' ? likedTracks : tracks;
    playbackListRef.current = listView === 'search' ? `search:${activeSearchRef.current}` : listView;
    setActiveQueue(listView === 'likes' ? 'favorites' : 'normal');
    selectTrack(track.id, queue);
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

  const visibleTracks = listView === 'search' ? results : listView === 'likes' ? likedTracks : tracks;
  const isSearching = searchState === TEXT.searching;
  const isPlaybackBusy = randomLoading || playbackState === 'resolving' || playbackState === 'loading';
  const rowPlaybackState = (id) => id === playbackTrackId ? playbackState : 'idle';

  return <main className={`music-page mobile-view-${mobileView}${playing ? ' is-playing' : ''}${titleOverflows ? ' has-overflowing-title' : ''}`}><audio ref={audio} onPlay={() => { setPlaying(true); setPlaybackTrackId(currentId); setPlaybackState('playing'); }} onPause={() => { setPlaying(false); setPlaybackState((state) => state === 'loading' || state === 'resolving' ? state : 'paused'); }} onLoadStart={() => setPlaybackState('loading')} onWaiting={() => { setPlaybackState('loading'); beginMediaDeadline(currentId); }} onPlaying={() => { clearMediaDeadline(); failedPlaybackIdsRef.current.clear(); primaryResolveAttemptsRef.current.delete(currentId); localFallbackAttempts.current.delete(currentId); blockedResolveIdsRef.current.delete(currentId); setPlaybackState('playing'); }} onError={() => { if (ignoreAudioErrorRef.current) { ignoreAudioErrorRef.current = false; return; } clearMediaDeadline(); if (!retryWithPrimaryResolve()) handlePlaybackFailure(); }} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={() => { clearMediaDeadline(); next(); }} /><Toast toast={toast} onClose={() => setToast(null)} /><nav className="music-mobile-tabs" aria-label="移动端音乐视图"><button className={mobileView === 'playlist' ? 'active' : ''} onClick={() => setMobileView('playlist')}>播放列表</button><button className={mobileView === 'now' ? 'active' : ''} onClick={() => setMobileView('now')}>正在播放</button></nav>
  <section className="music-shell"><aside className="music-sidebar"><p className="music-brand">LURI / MUSIC</p><button className={`music-nav${listView === 'queue' ? ' active' : ''}`} onClick={() => { setListView('queue'); }}>播放列表<span>{tracks.length}</span></button><button className={`music-nav${listView === 'likes' ? ' active' : ''}`} onClick={() => { setListView('likes'); }}>我喜欢<span>{likedTracks.length}</span></button><div className="music-divider" /></aside>
      <section className="music-content"><header className="music-header"><div><p className="music-kicker">LURI MUSIC</p><h1>{pageTitle}</h1>{headerNotice}</div><form className="music-search" onSubmit={search}><input value={query} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onChange={(event) => setQuery(event.target.value)} placeholder={TEXT.searchHint} /><button className="music-icon-button" type="submit" disabled={isSearching} aria-label={isSearching ? '正在搜索' : TEXT.search} title={isSearching ? '正在搜索' : TEXT.search}>{isSearching ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name="search" />}</button><button className="music-random-button" type="button" onMouseDown={(event) => event.preventDefault()} onClick={startRandom} disabled={randomLoading} aria-label="随机搜索并播放音乐" title="随机发现">{randomLoading ? <span className="music-spinner" aria-hidden="true" /> : <><MusicIcon name="random" /><span>随机发现</span></>}</button>{searchFocused && recentSearches.length > 0 && <div className="music-search-history" onMouseDown={(event) => event.preventDefault()}><div className="music-search-history__head"><span>最近搜索</span><button type="button" onClick={() => setRecentSearches([])}>清除</button></div>{recentSearches.map((item) => <button className="music-search-history__item" type="button" key={item} onClick={() => chooseRecentSearch(item)}>{item}</button>)}</div>}</form></header>
        <div className="music-workspace"><section className="music-results"><div className="music-list-head"><span>{listView === 'search' ? TEXT.search : listView === 'likes' ? TEXT.likes : TEXT.queue}</span><small>{visibleTracks.length} {TEXT.tracks}</small></div><div className="music-list" ref={musicListRef} onScroll={handleListScroll}>{visibleTracks.map((track, index) => { const state = rowPlaybackState(track.id); const isCurrent = track.id === currentId; const isCurrentBusy = isCurrent && isPlaybackBusy; return <button ref={isCurrent ? currentRowRef : null} key={`${track.source || 'queue'}:${track.id}`} className={`music-row${isCurrent ? ' current' : ''}`} onClick={() => handleTrackAction(track)} disabled={isCurrentBusy} aria-label={`${track.title}，${isCurrentBusy ? '正在加载' : state === 'error' ? '播放失败，点击重试' : state === 'playing' ? TEXT.pause : TEXT.play}`}><span className="track-index">{String(index + 1).padStart(2, '0')}</span><span className="track-copy"><span className="track-title"><b>{track.title}</b>{isCurrent && <QualityBadge track={current} />}</span><span className="track-artist">{track.artist}{track.year ? ` · ${track.year}` : ''}</span></span><span className={`track-action track-action--${state}`} aria-hidden="true">{state === 'error' ? '播放失败' : state === 'loading' || state === 'resolving' ? <span className="music-spinner" /> : <MusicIcon name={state === 'playing' ? 'pause' : 'play'} />}</span></button>; })}{loadingMore && <p className="music-list-status">正在加载更多…</p>}{!visibleTracks.length && <div className="music-empty"><strong>{TEXT.noResult}</strong><span>{TEXT.choose}</span></div>}</div><p className="music-search-status" aria-live="polite">{isSearching ? '' : searchState}</p></section><aside className="music-lyrics"><div className="lyrics-track"><img src={current?.art || EMPTY_ART} alt="" onError={handleArtworkError} /><div><p>歌词</p><h2><b>{current?.title || TEXT.noTrack}</b><QualityBadge track={current} /></h2><span>{current?.artist || TEXT.choose}</span></div><div className="lyrics-track__actions"><DownloadButton track={current} /><button className={`like-button${current && likedTracks.some((track) => sameFavorite(track, current)) ? ' liked' : ''}`} disabled={!current} onClick={() => current && like(current.id)}>{TEXT.likes}</button></div></div><div ref={lyricsRef} className="lyrics-body" onClick={seekLyric}>{lyrics ? lyricLines.map((line, index) => <p key={`${line.time}:${line.text}:${index}`}>{line.text}</p>) : <p className="lyrics-empty">{lyricsState || TEXT.choose}</p>}</div></aside></div></section></section>
    <footer className="music-player"><div className="music-player__song"><img src={current?.art || EMPTY_ART} alt="" onError={handleArtworkError} /><span className="music-player__copy"><span className="music-player__heading"><b className="music-player__title">{current?.title || TEXT.noTrack}</b><QualityBadge track={current} /></span><small>{current?.artist || 'LURI MUSIC'}</small></span></div><div className="music-controls"><div><button className="music-icon-button" onClick={previous} aria-label={TEXT.prev} title={TEXT.prev}><MusicIcon name="previous" /></button><button className="music-icon-button play-button" onClick={toggle} disabled={isPlaybackBusy} aria-label={isPlaybackBusy ? '正在加载' : playing ? TEXT.pause : TEXT.play} title={isPlaybackBusy ? '正在加载' : playing ? TEXT.pause : TEXT.play}>{isPlaybackBusy ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name={playing ? 'pause' : 'play'} />}</button><button className="music-icon-button" onClick={next} aria-label={TEXT.next} title={TEXT.next}><MusicIcon name="next" /></button></div><div className="timeline"><span>{time(progress)}</span><input type="range" min="0" max={duration || 0} value={Math.min(progress, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audio.current) audio.current.currentTime = value; setProgress(value); }} /><span>{time(duration)}</span></div></div><div className="music-player__actions"><DownloadButton track={current} /><div className="music-volume"><button className="music-icon-button" onClick={() => setMuted((value) => !value)} aria-label={muted || volume === 0 ? '取消静音' : '静音'} title={muted || volume === 0 ? '取消静音' : '静音'}><MusicIcon name={muted || volume === 0 ? 'mute' : 'volume'} /></button><input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} aria-label="音量" onChange={(event) => { const value = Number(event.target.value); setVolume(value); setMuted(value === 0); }} /></div></div>{legalLinks ? <div className="music-global-disclaimer music-legal-links">{legalLinks}</div> : <p className="music-global-disclaimer">请仅播放您依法有权访问的内容。</p>}</footer></main>;
}
