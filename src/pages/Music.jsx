import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Toast } from '../luri-music/UiFeedback';
import { SINGERS } from '../data/singers';
import { songIdFor } from '../../shared/song-identity';
import './Music.css';

const EMPTY_ART = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23ece9e1"/%3E%3Ccircle cx="200" cy="200" r="106" fill="%23c8c2b7"/%3E%3Ccircle cx="200" cy="200" r="22" fill="%23111111"/%3E%3C/svg%3E';
const TEXT = { title: '\u97f3\u4e50', discover: '\u53d1\u73b0\u97f3\u4e50', likes: '\u6211\u7684\u559c\u6b22', search: '\u641c\u7d22', searchHint: '\u641c\u7d22\u6b4c\u66f2\u3001\u827a\u4eba\u6216\u4e13\u8f91', searching: '\u6b63\u5728\u641c\u7d22\u2026', queue: '\u64ad\u653e\u961f\u5217', tracks: '\u9996\u6b4c\u66f2', noResult: '\u6682\u65e0\u641c\u7d22\u7ed3\u679c', noTrack: '\u6682\u65e0\u6b4c\u66f2', choose: '\u8bf7\u641c\u7d22\u540e\u9009\u62e9\u6b4c\u66f2', now: '\u6b63\u5728\u64ad\u653e', play: '\u64ad\u653e', pause: '\u6682\u505c', prev: '\u4e0a\u4e00\u9996', next: '\u4e0b\u4e00\u9996', load: '\u6b63\u5728\u83b7\u53d6\u53ef\u64ad\u653e\u6587\u4ef6\u2026', unavailable: '\u6ca1\u6709\u627e\u5230\u53ef\u76f4\u64ad\u7684\u97f3\u9891\u6587\u4ef6', source: '\u516c\u5f00\u97f3\u9891\u76ee\u5f55', disclaimer: '\u672c\u9875\u4ec5\u63d0\u4f9b\u641c\u7d22\u4e0e\u64ad\u653e\u754c\u9762\uff0c\u4e0d\u6258\u7ba1\u3001\u4e0d\u590d\u5236\u3001\u4e0d\u4ee3\u7406\u4efb\u4f55\u97f3\u9891\u6587\u4ef6\u3002\u8bf7\u4ec5\u4f7f\u7528\u5df2\u83b7\u6388\u6743\u7684\u97f3\u6e90\uff0c\u5e76\u9075\u5b88\u5176\u670d\u52a1\u6761\u6b3e\u4e0e\u9002\u7528\u6cd5\u5f8b\u3002' };
const time = (value = 0) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
const lyricLine = (line) => { const matches = [...line.matchAll(/\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]/g)]; const text = line.replace(/\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]/g, '').trim(); return matches.length ? matches.map((match) => ({ time: Number(match[1]) * 60 + Number(match[2]), text })) : [{ time: -1, text: line }]; };
const parsedLyrics = (value) => String(value || '').split(/\r?\n/).filter(Boolean).flatMap(lyricLine).filter((line) => line.text);
const STORE_QUEUE = 'luri.music.queue.v3'; const STORE_LIKES = 'luri.music.likes.v3'; const STORE_SEARCH = 'luri.music.search.v3'; const STORE_QUERY = 'luri.music.query.v3'; const STORE_RECENT_SEARCHES = 'luri.music.recent-searches.v3';
const STORE_CHART = 'luri.music.chart.v3';
const CHART_TYPES = [{ value: 'rising', label: '飙升榜' }, { value: 'new', label: '新歌榜' }, { value: 'original', label: '原创榜' }, { value: 'hot', label: '热歌榜' }];
const CHART_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MEDIA_LOAD_TIMEOUT_MS = 20000;
const FAVORITES_SYNC_DEBOUNCE_MS = 30 * 1000;
const FAVORITES_WRITE_INTERVAL_MS = 60 * 60 * 1000;
const FAVORITES_SYNC_RETRY_MS = 30 * 1000;
const canonicalBinding = (value) => value && typeof value === 'object' && !Array.isArray(value) && typeof value.source === 'string' && value.source && typeof value.sourceId === 'string' && value.sourceId && value.meta && typeof value.meta === 'object' && !Array.isArray(value.meta) && typeof value.art === 'string'
  ? { source: String(value.source), sourceId: String(value.sourceId), meta: value.meta, art: String(value.art || '') }
  : null;
const canonicalTrack = (track) => {
  const title = String(track?.title || ''); const artist = String(track?.artist || ''); const binding = canonicalBinding(track?.binding);
  if (!title || !artist || !binding) return null;
  const { id: _legacyId, source: _legacySource, sourceId: _legacySourceId, ...fields } = track;
  return { ...fields, songId: songIdFor(title, artist), title, artist, album: String(track?.album || ''), binding };
};
const canonicalTracks = (items) => { const seen = new Set(); return (Array.isArray(items) ? items : []).flatMap((item) => { const track = canonicalTrack(item); if (!track || seen.has(track.songId)) return []; seen.add(track.songId); return [track]; }); };
const readStore = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const readTrackStore = (key) => canonicalTracks(readStore(key));
const readSession = (key) => { try { return JSON.parse(sessionStorage.getItem(key) || '{}'); } catch { return {}; } };
const writeSession = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Session storage may be unavailable. */ } };
const randomTextKey = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s()（）.·_-]/g, '');
const randomTrackKey = (track) => `${randomTextKey(track?.title)}:${randomTextKey(track?.artist)}`;
const shuffled = (items) => {
  const values = [...items];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
};
const trackArtists = (track) => String(track?.artist || '').split(/\s*(?:,|，|、|\/|&|feat\.?|ft\.?)\s*/i).filter(Boolean);
const sameFavorite = (left, right) => Boolean(left?.songId && right?.songId && left.songId === right.songId);
const chartStoreKey = (providerId, platform, chart) => `${STORE_CHART}.${providerId || 'guest'}.${platform}.${chart}`;
const readChartStore = (providerId, platform, chart) => { try { return JSON.parse(localStorage.getItem(chartStoreKey(providerId, platform, chart)) || 'null'); } catch { return null; } };
const hydrateChart = (payload) => ({ ...payload, tracks: canonicalTracks(payload?.tracks).map((track, index) => ({ ...track, rank: Number(track.rank) || index + 1 })) });
const chartUpdatedLabel = (value) => { const timestamp = Date.parse(value || ''); return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp) : '暂无缓存'; };
const minimalFavorites = (items) => canonicalTracks(items).map((track) => ({ songId: track.songId, title: track.title, artist: track.artist, album: track.album, binding: track.binding }));
const resolvedExpiry = (payload) => { const explicit = Date.parse(payload?.expiresAt || ''); if (Number.isFinite(explicit)) return new Date(explicit).toISOString(); const seconds = Number(payload?.expiresIn); return Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null; };
const playbackUrlExpired = (track) => { const expires = Date.parse(track?.expiresAt || ''); return Boolean(track?.url && Number.isFinite(expires) && expires <= Date.now() + 5000); };
const providerPayload = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;
  const detail = payload?.error && typeof payload.error === 'object' ? payload.error : {};
  const failure = new Error(detail.message || payload.error || 'Provider 请求失败');
  failure.code = detail.code || 'provider_request_failed'; failure.status = response.status;
  throw failure;
};
const singerSearchKey = (value) => String(value || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
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
    close: <><path d="m8 8 8 8M16 8l-8 8" /></>,
    heart: <path d="M12 20.2 4.6 13A4.8 4.8 0 0 1 11.4 6.2l.6.7.6-.7A4.8 4.8 0 0 1 19.4 13Z" />,
    back: <><path d="m14.5 6-6 6 6 6" /><path d="M9 12h10" /></>,
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
  const requested = track.requestedQuality === 'auto' ? '320k' : track.requestedQuality;
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

export default function Music({ forceMusicPage = false, providerClient = null, playbackQuality = '128k', storageNamespace = '', favoriteNamespace = '', favoriteBackup = [], favoriteBackupUpdatedAt = null, favoriteSyncEnabled = false, onRequireAccess, pageTitle = forceMusicPage ? 'LURI MUSIC' : TEXT.title, headerNotice = null, legalLinks = null }) {
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
  const likedStoreKey = `${STORE_LIKES}.${favoriteNamespace || 'guest'}`; const favoriteDirtyKey = `luri.music.likes-sync-dirty.v3.${favoriteNamespace || 'guest'}`; const favoriteSyncedKey = `luri.music.likes-sync-last.v3.${favoriteNamespace || 'guest'}`;
  const favoriteInitialRef = useRef(null);
  if (!favoriteInitialRef.current) {
    let accountItems = []; let dirty = false;
    try { accountItems = JSON.parse(localStorage.getItem(likedStoreKey) || '[]'); dirty = Boolean(Number(localStorage.getItem(favoriteDirtyKey))); } catch { /* Use the server backup when storage is unavailable. */ }
    const backupItems = Array.isArray(favoriteBackup) ? favoriteBackup : [];
    const source = favoriteSyncEnabled && !dirty ? 'backup' : 'account';
    const items = source === 'account' ? accountItems : backupItems;
    favoriteInitialRef.current = { source, items: canonicalTracks(items).filter((track) => track.binding) };
  }
  const restoreResults = () => readTrackStore(storeKey(STORE_SEARCH)).filter((track) => track.binding);
  const [query, setQuery] = useState(() => localStorage.getItem(storeKey(STORE_QUERY)) || ''); const [results, setResults] = useState(restoreResults); const [cachedResults, setCachedResults] = useState(restoreResults); const [recentSearches, setRecentSearches] = useState(() => readStore(storeKey(STORE_RECENT_SEARCHES)).filter((item) => typeof item === 'string').slice(0, 10)); const [searchFocused, setSearchFocused] = useState(false); const [activeSingerSuggestion, setActiveSingerSuggestion] = useState(-1); const [searchState, setSearchState] = useState('');
  const [listView, setListView] = useState('search');
  const [chartPlatform, setChartPlatform] = useState('netease'); const [chartType, setChartType] = useState('rising'); const [chartData, setChartData] = useState(() => hydrateChart(readChartStore(storageNamespace, 'netease', 'rising'))); const [chartLoading, setChartLoading] = useState(false); const [chartState, setChartState] = useState('');
  const [mobileView, setMobileView] = useState('playlist');
  const [activeQueue, setActiveQueue] = useState('normal');
  const [resultPage, setResultPage] = useState(0); const [hasMoreResults, setHasMoreResults] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const [tracks, setTracks] = useState(() => readTrackStore(storeKey(STORE_QUEUE)).filter((track) => track.binding)); const [likedTracks, setLikedTracks] = useState(() => favoriteInitialRef.current.items); const [playbackQueue, setPlaybackQueue] = useState([]); const [currentId, setCurrentId] = useState(null); const [playing, setPlaying] = useState(false); const [playbackState, setPlaybackState] = useState('idle'); const [playbackTrackId, setPlaybackTrackId] = useState(null); const [playbackAttempt, setPlaybackAttempt] = useState(0); const [titleOverflows, setTitleOverflows] = useState(false);
  const [progress, setProgress] = useState(0); const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8); const [muted, setMuted] = useState(false);
  const [lyrics, setLyrics] = useState(''); const [translation, setTranslation] = useState(''); const [lyricsState, setLyricsState] = useState('');
  const lyricsRef = useRef(null); const musicListRef = useRef(null); const currentRowRef = useRef(null); const searchSuggestionsRef = useRef(null); const locatedTrackRef = useRef('');
  const searchInputRef = useRef(null); const controlButtonRefs = useRef({}); const controlFeedbackTimerRef = useRef(null);
  const resolveRequestRef = useRef(null); const chartRequestRef = useRef(null); const mediaDeadlineRef = useRef(null); const mediaDeadlineTrackRef = useRef(''); const ignoreAudioErrorRef = useRef(false); const failedPlaybackIdsRef = useRef(new Set()); const playbackRefreshIdsRef = useRef(new Set()); const artworkRefreshIdsRef = useRef(new Set());
  const likedTracksRef = useRef(likedTracks); const favoriteMutationRef = useRef(0); const favoriteSyncRef = useRef({ syncing: false, pulling: false, timer: null, schedule: null, pull: null, dirtySince: (() => { try { return Number(localStorage.getItem(favoriteDirtyKey)) || 0; } catch { return 0; } })() });
  const loadingMoreRef = useRef(false); const activeSearchRef = useRef(query.trim()); const searchRequestRef = useRef(null);
  const mediaActionsRef = useRef({ play: () => {}, pause: () => {}, previous: () => {}, next: () => {} });
  const playRejectionRef = useRef(() => {});
  const randomHistoryKey = `luri.music.random-history.v1${storageNamespace ? `.${storageNamespace}` : ''}`; const storedRandomHistory = useRef(readSession(randomHistoryKey));
  const randomRequest = useRef(null); const randomSession = useRef(0); const playMode = useRef('manual'); const playbackListRef = useRef('');
  const randomFallbackTracks = useRef([]); const randomSingers = useRef(Array.isArray(storedRandomHistory.current.singers) ? storedRandomHistory.current.singers : []); const randomTrackKeys = useRef(Array.isArray(storedRandomHistory.current.tracks) ? storedRandomHistory.current.tracks : []);
  const [randomLoading, setRandomLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const activeTracks = activeQueue === 'favorites' ? likedTracks : tracks;
  const current = playbackQueue.find((track) => track.songId === currentId) || activeTracks.find((track) => track.songId === currentId);
  const lyricsTrackRef = useRef(current); lyricsTrackRef.current = current;
  const singerQuery = singerSearchKey(query);
  const singerSuggestions = singerQuery ? SINGERS.filter((singer) => singerSearchKey(singer).startsWith(singerQuery)) : [];
  const translatedByTime = new Map(parsedLyrics(translation).filter((line) => line.time >= 0).map((line) => [line.time.toFixed(3), line.text]));
  const lyricLines = parsedLyrics(lyrics || translation).map((line) => ({ ...line, translation: lyrics ? translatedByTime.get(line.time.toFixed(3)) || '' : '' }));
  const activeLyric = lyricLines.reduce((active, line, index) => line.time >= 0 && line.time <= progress ? index : active, -1);
  const clearMediaDeadline = () => { if (mediaDeadlineRef.current) window.clearTimeout(mediaDeadlineRef.current); mediaDeadlineRef.current = null; mediaDeadlineTrackRef.current = ''; };
  const pulseControl = useCallback((name) => {
    const button = controlButtonRefs.current[name];
    if (!button) return;
    if (controlFeedbackTimerRef.current) window.clearTimeout(controlFeedbackTimerRef.current);
    button.classList.remove('is-control-feedback');
    void button.offsetWidth;
    button.classList.add('is-control-feedback');
    controlFeedbackTimerRef.current = window.setTimeout(() => { button.classList.remove('is-control-feedback'); controlFeedbackTimerRef.current = null; }, 260);
  }, []);
  const beginMediaDeadline = (id) => {
    clearMediaDeadline(); mediaDeadlineTrackRef.current = id;
    mediaDeadlineRef.current = window.setTimeout(() => {
      if (mediaDeadlineTrackRef.current !== id) return;
      ignoreAudioErrorRef.current = true; audio.current?.pause(); audio.current?.removeAttribute('src'); audio.current?.load();
      setPlaying(false); clearMediaDeadline();
      handlePlaybackFailure('重新解析后仍无法播放，已自动播放下一首');
    }, MEDIA_LOAD_TIMEOUT_MS);
  };

  useEffect(() => {
    document.body.classList.toggle('has-global-music-player', !isMusicPage);
    return () => { document.body.classList.remove('has-global-music-player'); resolveRequestRef.current?.abort(); chartRequestRef.current?.abort(); searchRequestRef.current?.abort(); if (mediaDeadlineRef.current) window.clearTimeout(mediaDeadlineRef.current); if (controlFeedbackTimerRef.current) window.clearTimeout(controlFeedbackTimerRef.current); };
  }, [isMusicPage]);
  useEffect(() => {
    if (activeSingerSuggestion >= 0) searchSuggestionsRef.current?.querySelector('.music-search-history__item.active')?.scrollIntoView({ block: 'nearest' });
  }, [activeSingerSuggestion]);
  useEffect(() => {
    if (!currentId) return;
    if (activeQueue === 'favorites' && !likedTracks.some((track) => track.songId === currentId) && tracks.some((track) => track.songId === currentId)) setActiveQueue('normal');
    if (activeQueue === 'normal' && !tracks.some((track) => track.songId === currentId) && likedTracks.some((track) => track.songId === currentId)) setActiveQueue('favorites');
  }, [currentId, activeQueue, tracks, likedTracks]);

  useEffect(() => {
    if (!audio.current || !current?.url) return;
    setPlaybackTrackId(current.songId); setPlaybackState('loading'); setProgress(0); setDuration(0);
    ignoreAudioErrorRef.current = false; audio.current.src = current.url; audio.current.load(); beginMediaDeadline(current.songId);
    audio.current.play().catch((error) => playRejectionRef.current(error));
  }, [currentId, current?.songId, current?.url]);
  useEffect(() => { if (listView === 'search') setCachedResults(results); }, [listView, results]);
  useEffect(() => { try { localStorage.setItem(storeKey(STORE_SEARCH), JSON.stringify(cachedResults)); localStorage.setItem(storeKey(STORE_QUERY), query); } catch { /* Storage is unavailable in private browsing. */ } }, [cachedResults, query]);
  useEffect(() => { try { localStorage.setItem(storeKey(STORE_RECENT_SEARCHES), JSON.stringify(recentSearches)); } catch { /* Storage is unavailable in private browsing. */ } }, [recentSearches]);
  useEffect(() => {
    if (!current || current.url) return undefined;
    setPlaybackTrackId(current.songId); setPlaybackState('resolving');
    const controller = new AbortController();
    resolveRequestRef.current = controller;
    const refresh = playbackRefreshIdsRef.current.has(current.songId);
    musicRequest('resolve', { songId: current.songId, title: current.title, artist: current.artist, album: current.album, quality: playbackQuality, binding: current.binding, refresh }, controller.signal).then(providerPayload).then((payload) => {
      if (!payload.url || Date.parse(payload.expiresAt || '') <= Date.now() + 5000) { const failure = new Error('播放地址不可用'); failure.code = 'url_expired'; throw failure; }
      if (!controller.signal.aborted) {
        const attemptedSources = Array.isArray(payload.attemptedSources) ? payload.attemptedSources : [];
        const resolved = { ...current, url: payload.url, binding: canonicalBinding(payload.binding) || current.binding, expiresAt: resolvedExpiry(payload), requestedQuality: payload.requestedQuality || playbackQuality, quality: payload.quality || '', bitrate: payload.bitrate || null, degraded: Boolean(payload.degraded), qualityVerified: Boolean(payload.qualityVerified), attemptedSources };
        const update = (track) => track.songId === current.songId ? { ...track, ...resolved } : track;
        setTracks((items) => items.map(update));
        setLikedTracks((items) => items.map((track) => sameFavorite(track, current) ? { ...track, binding: resolved.binding } : track));
        setPlaybackQueue((items) => items.map(update));
      }
    }).catch((error) => {
      if (controller.signal.aborted) return;
      if (error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403) { playMode.current = 'manual'; setPlaying(false); showToast('Provider 没有访问权限，请重新配置或联系服务提供方', 'warning'); return; }
      if (['no_candidate', 'all_resolvers_failed', 'quality_unavailable'].includes(error?.code)) {
        setPlaying(false); discardCurrentUrl();
        if (playMode.current === 'random') playNextRandom(); else skipFailedTrack(error.code === 'no_candidate' ? '未找到可播放音源，已自动播放下一首' : '所有音源均解析失败，已自动播放下一首');
      } else handlePlaybackFailure();
    }).finally(() => { if (resolveRequestRef.current === controller) resolveRequestRef.current = null; });
    return () => { controller.abort(); if (resolveRequestRef.current === controller) resolveRequestRef.current = null; };
  }, [activeQueue, current, playbackAttempt, playbackQuality]);
  useEffect(() => {
    if ('mediaSession' in navigator && current) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title || '未知歌曲',
        artist: current.artist || '未知艺人',
        album: current.album || '',
        artwork: current.art && current.art !== EMPTY_ART ? [
          { src: current.art, sizes: '96x96', type: 'image/jpeg' },
          { src: current.art, sizes: '128x128', type: 'image/jpeg' },
          { src: current.art, sizes: '192x192', type: 'image/jpeg' },
          { src: current.art, sizes: '256x256', type: 'image/jpeg' },
          { src: current.art, sizes: '384x384', type: 'image/jpeg' },
          { src: current.art, sizes: '512x512', type: 'image/jpeg' },
        ] : []
      });
      navigator.mediaSession.setActionHandler('play', () => mediaActionsRef.current.play());
      navigator.mediaSession.setActionHandler('pause', () => mediaActionsRef.current.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => mediaActionsRef.current.previous());
      navigator.mediaSession.setActionHandler('nexttrack', () => mediaActionsRef.current.next());
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        if (audio.current) {
          const skipTime = details.seekOffset || 10;
          audio.current.currentTime = Math.max(audio.current.currentTime - skipTime, 0);
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (audio.current) {
          const skipTime = details.seekOffset || 10;
          audio.current.currentTime = Math.min(audio.current.currentTime + skipTime, audio.current.duration || 0);
        }
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (audio.current && details.seekTime !== null && details.seekTime !== undefined) {
          audio.current.currentTime = details.seekTime;
        }
      });
    }
    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      }
    };
  }, [current]);
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }, [playing]);
  useEffect(() => {
    if (!current || (current.art && current.art !== EMPTY_ART) || !current.binding) return undefined;
    const controller = new AbortController();
    musicRequest('artwork', { songId: current.songId, title: current.title, artist: current.artist, album: current.album, binding: current.binding }, controller.signal).then(providerPayload).then((payload) => {
      if (payload.url && !controller.signal.aborted) {
        const returnedBinding = canonicalBinding(payload.binding);
        const update = (track) => track.songId === current.songId ? { ...track, art: payload.url, binding: returnedBinding || track.binding } : track;
        (activeQueue === 'favorites' ? setLikedTracks : setTracks)((items) => items.map(update));
        setPlaybackQueue((items) => items.map(update));
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [activeQueue, current]);
  const refreshArtwork = (event) => {
    const image = event.currentTarget;
    if (!current || current.art === EMPTY_ART || artworkRefreshIdsRef.current.has(current.songId)) { image.src = EMPTY_ART; return; }
    artworkRefreshIdsRef.current.add(current.songId);
    void musicRequest('artwork', { songId: current.songId, title: current.title, artist: current.artist, album: current.album, binding: current.binding, refresh: 1 }).then(providerPayload).then((payload) => {
      if (!payload.url) throw new Error('No artwork');
      const returnedBinding = canonicalBinding(payload.binding);
      const update = (track) => track.songId === current.songId ? { ...track, art: payload.url, binding: returnedBinding || track.binding } : track;
      setTracks((items) => items.map(update)); setLikedTracks((items) => items.map(update)); setPlaybackQueue((items) => items.map(update));
    }).catch(() => { image.src = EMPTY_ART; });
  };
  const artworkLoaded = () => { if (current) artworkRefreshIdsRef.current.delete(current.songId); };
  useEffect(() => { try { localStorage.setItem(storeKey(STORE_QUEUE), JSON.stringify(tracks.slice(0, 50).map(({ url: _url, ...track }) => track))); } catch { /* Storage is unavailable in private browsing. */ } }, [tracks]);
  useEffect(() => { likedTracksRef.current = likedTracks; try { localStorage.setItem(likedStoreKey, JSON.stringify(minimalFavorites(likedTracks))); } catch { /* Storage is unavailable in private browsing. */ } }, [likedTracks, likedStoreKey]);
  useEffect(() => {
    if (!favoriteSyncEnabled || !favoriteNamespace) return undefined;
    const state = favoriteSyncRef.current; let stopped = false;
    const readDirtySince = () => { try { const stored = Number(localStorage.getItem(favoriteDirtyKey)) || 0; if (stored) state.dirtySince = stored; } catch { /* Use the in-memory value when storage is unavailable. */ } return state.dirtySince; };
    const rememberDirtySince = (value) => { state.dirtySince = value; try { if (value) localStorage.setItem(favoriteDirtyKey, String(value)); else localStorage.removeItem(favoriteDirtyKey); } catch { /* Storage is unavailable in private browsing. */ } };
    const rememberSyncedAt = (value) => { const timestamp = Date.parse(value || '') || Date.now(); try { localStorage.setItem(favoriteSyncedKey, String(timestamp)); } catch { /* Storage is unavailable in private browsing. */ } };
    const scheduleSync = (delay = FAVORITES_SYNC_DEBOUNCE_MS) => {
      if (stopped) return;
      if (state.timer) window.clearTimeout(state.timer);
      let lastSyncedAt = 0; try { lastSyncedAt = Number(localStorage.getItem(favoriteSyncedKey)) || 0; } catch { /* Sync after the debounce when storage is unavailable. */ }
      const intervalRemaining = Math.max(0, FAVORITES_WRITE_INTERVAL_MS - (Date.now() - lastSyncedAt));
      state.timer = window.setTimeout(() => { state.timer = null; void syncBackup(); }, Math.max(delay, intervalRemaining));
    };
    const syncBackup = async (keepalive = false) => {
      if (state.syncing || !readDirtySince()) return;
      state.syncing = true;
      const mutation = favoriteMutationRef.current; const items = minimalFavorites(likedTracksRef.current); const snapshot = JSON.stringify(items);
      let wrote = false; let synced = false;
      try {
        const response = await fetch('/api/luri-music/favorites', { method: 'PUT', credentials: 'same-origin', keepalive, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }) });
        const payload = response.ok ? await response.json() : null;
        if (response.ok) { rememberSyncedAt(payload?.updatedAt); wrote = true; }
        const latestSnapshot = JSON.stringify(minimalFavorites(likedTracksRef.current));
        if (response.ok && mutation === favoriteMutationRef.current && snapshot === latestSnapshot) {
          const canonical = Array.isArray(payload?.items) ? payload.items : items;
          likedTracksRef.current = canonical; setLikedTracks(canonical); rememberDirtySince(0); synced = true;
        }
      } catch { /* Keep the dirty marker and retry shortly. */ }
      finally {
        state.syncing = false;
        const changedDuringSync = mutation !== favoriteMutationRef.current || snapshot !== JSON.stringify(minimalFavorites(likedTracksRef.current));
        if (!stopped && readDirtySince()) scheduleSync(wrote || synced || changedDuringSync ? FAVORITES_SYNC_DEBOUNCE_MS : FAVORITES_SYNC_RETRY_MS);
      }
    };
    const pullBackup = async () => {
      if (stopped || state.pulling || state.syncing || readDirtySince()) return;
      state.pulling = true; const mutation = favoriteMutationRef.current;
      try {
        const response = await fetch('/api/luri-music/favorites', { credentials: 'same-origin', cache: 'no-store' });
        const payload = response.ok ? await response.json() : null;
        if (!stopped && response.ok && mutation === favoriteMutationRef.current && !readDirtySince()) {
          const items = minimalFavorites(payload?.items);
          likedTracksRef.current = items; setLikedTracks(items); rememberSyncedAt(payload?.updatedAt);
        }
      } catch { /* The local snapshot remains available while offline. */ }
      finally { state.pulling = false; }
    };
    const flushBeforeExit = () => { if (readDirtySince()) void syncBackup(true); };
    state.schedule = scheduleSync; state.pull = pullBackup;
    if (favoriteInitialRef.current.source === 'backup') rememberSyncedAt(favoriteBackupUpdatedAt);
    if (readDirtySince()) scheduleSync();
    window.addEventListener('pagehide', flushBeforeExit);
    return () => {
      stopped = true; state.schedule = null; state.pull = null; if (state.timer) window.clearTimeout(state.timer); state.timer = null;
      window.removeEventListener('pagehide', flushBeforeExit);
    };
  }, [favoriteSyncEnabled, favoriteBackupUpdatedAt, favoriteDirtyKey, favoriteNamespace, favoriteSyncedKey]);
  useEffect(() => { if (listView === 'likes') void favoriteSyncRef.current.pull?.(); }, [favoriteSyncEnabled, listView]);
  useEffect(() => { if (!audio.current) return; audio.current.volume = volume ** 2; audio.current.muted = muted; }, [volume, muted]);
  useEffect(() => { document.documentElement.style.setProperty('--music-progress', `${duration ? Math.min(100, Math.max(0, progress / duration * 100)) : 0}%`); }, [duration, progress]);
  useEffect(() => { const title = document.querySelector('.music-row.current .track-title'); setTitleOverflows(Boolean(title && title.scrollWidth > title.clientWidth)); }, [currentId, results, tracks, chartData]);
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
  }, [currentId, listView, mobileView, results, tracks, likedTracks, chartData]);
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
  useEffect(() => { if (lyricsRef.current) lyricsRef.current.scrollTop = 0; }, [current?.songId, lyrics]);
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
    const lyricTrack = lyricsTrackRef.current;
    if (!lyricTrack) { setLyrics(''); setTranslation(''); setLyricsState(''); return undefined; }
    const controller = new AbortController(); setLyrics(''); setTranslation(''); setLyricsState('正在加载歌词…');
    musicRequest('lyrics', { songId: lyricTrack.songId, title: lyricTrack.title, artist: lyricTrack.artist, album: lyricTrack.album, binding: lyricTrack.binding }, controller.signal).then(providerPayload).then((payload) => { if (!controller.signal.aborted) { const text = payload.lyrics || payload.translation || ''; setLyrics(payload.lyrics || ''); setTranslation(payload.translation || ''); setLyricsState(text ? '' : '暂无匹配歌词'); } }).catch((error) => { if (!controller.signal.aborted) { setLyricsState('暂无匹配歌词'); if (error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403) showToast('Provider 没有访问权限，请重新配置或联系服务提供方', 'warning'); } });
    return () => controller.abort();
  }, [current?.songId, musicRequest]);
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
    if (!preserveFailures) { failedPlaybackIdsRef.current.clear(); playbackRefreshIdsRef.current.delete(id); }
    if (mode === 'manual') stopRandom();
    const sourceQueue = queue?.length ? queue : playbackQueue.some((track) => track.songId === id) ? null : activeTracks;
    const forSelectedQuality = (track) => track.songId === id && track.url && (track.requestedQuality !== playbackQuality || playbackUrlExpired(track)) ? { ...track, url: undefined } : track;
    if (sourceQueue?.length) setPlaybackQueue(sourceQueue.map(forSelectedQuality));
    else if (id !== currentId) setPlaybackQueue((items) => items.map(forSelectedQuality));
    clearMediaDeadline(); setPlaybackTrackId(id); setPlaybackState('loading');
    if (id === currentId) {
      if (current?.url) { beginMediaDeadline(id); audio.current?.play().catch(handlePlayRejection); }
      else setPlaybackAttempt((attempt) => attempt + 1);
      return;
    }
    if (audio.current) { ignoreAudioErrorRef.current = true; audio.current.pause(); audio.current.removeAttribute('src'); audio.current.load(); }
    setPlaying(false); setProgress(0); setDuration(0);
    setCurrentId(id);
  };
  const next = () => {
    const queue = playbackQueue.length ? playbackQueue : activeTracks; if (!queue.length) return;
    if (playMode.current === 'random') return startRandom();
    const index = queue.findIndex((track) => track.songId === currentId);
    selectTrack(queue[index < 0 ? 0 : (index + 1) % queue.length].songId, null, playMode.current);
  };
  const previous = () => {
    const queue = playbackQueue.length ? playbackQueue : activeTracks; if (!queue.length) return;
    const index = queue.findIndex((track) => track.songId === currentId);
    selectTrack(queue[index <= 0 ? queue.length - 1 : index - 1].songId, null, playMode.current);
  };
  const toggle = () => {
    if (playbackState === 'resolving' || playbackState === 'loading') return;
    if (!playing && !hasAccess()) return;
    if (!current && activeTracks[0]) return selectTrack(activeTracks[0].songId, activeTracks);
    if (playing) { audio.current?.pause(); return; }
    if (current && (!current.url || playbackUrlExpired(current))) {
      if (current.url) { const clearUrl = (track) => track.songId === current.songId ? { ...track, url: undefined } : track; setPlaybackQueue((items) => (items.length ? items : activeTracks).map(clearUrl)); }
      failedPlaybackIdsRef.current.clear(); playbackRefreshIdsRef.current.delete(current.songId); setPlaybackTrackId(current.songId); setPlaybackState('resolving'); setPlaybackAttempt((attempt) => attempt + 1); return;
    }
    setPlaybackTrackId(currentId); setPlaybackState('loading'); beginMediaDeadline(currentId);
    if (audio.current && current?.url && !audio.current.getAttribute('src')) { ignoreAudioErrorRef.current = false; audio.current.src = current.url; audio.current.load(); }
    audio.current?.play().catch(handlePlayRejection);
  };
  const markFavoritesDirty = () => {
    favoriteMutationRef.current += 1;
    if (!favoriteSyncRef.current.dirtySince) { let dirtySince = Date.now(); try { dirtySince = Number(localStorage.getItem(favoriteDirtyKey)) || dirtySince; localStorage.setItem(favoriteDirtyKey, String(dirtySince)); } catch { /* Storage is unavailable in private browsing. */ } favoriteSyncRef.current.dirtySince = dirtySince; }
    favoriteSyncRef.current.schedule?.();
  };
  const like = (id) => {
    const song = current || tracks.find((track) => track.songId === id) || results.find((track) => track.songId === id); if (!song) return;
    const favorite = { songId: song.songId, title: song.title, artist: song.artist, album: song.album, binding: song.binding };
    const saved = likedTracksRef.current; const next = saved.some((track) => sameFavorite(track, song)) ? saved.filter((track) => !sameFavorite(track, song)) : [...saved.filter((track) => !sameFavorite(track, song)), favorite];
    likedTracksRef.current = next; setLikedTracks(next); markFavoritesDirty();
  };
  function showToast(message, type = 'error') { setToast({ title: type === 'warning' ? '需要处理' : '播放服务异常', message, type }); }
  function handlePlayRejection(error) {
    clearMediaDeadline();
    if (error?.name === 'NotAllowedError') { setPlaying(false); setPlaybackState('paused'); return; }
    ignoreAudioErrorRef.current = true;
    window.setTimeout(() => { ignoreAudioErrorRef.current = false; }, 1000);
    handlePlaybackFailure('播放地址无法加载，已尝试刷新音源');
  }
  playRejectionRef.current = handlePlayRejection;
  const retryWithRefresh = () => {
    if (!current || playbackRefreshIdsRef.current.has(current.songId)) return false;
    playbackRefreshIdsRef.current.add(current.songId);
    const clearUrl = (track) => track.songId === current.songId ? { ...track, url: undefined } : track;
    setTracks((items) => items.map(clearUrl));
    setLikedTracks((items) => items.map(clearUrl));
    setPlaybackQueue((items) => (items.length ? items : activeTracks).map(clearUrl));
    setPlaybackTrackId(current.songId); setPlaybackState('resolving'); setPlaybackAttempt((attempt) => attempt + 1);
    return true;
  };
  const discardCurrentUrl = () => {
    if (!current) return;
    const clearUrl = (track) => track.songId === current.songId ? { ...track, url: undefined } : track;
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
    const currentIndex = queue.findIndex((track) => track.songId === currentId); const startIndex = currentIndex < 0 ? -1 : currentIndex;
    const nextTrack = Array.from({ length: queue.length - 1 }, (_, offset) => queue[(startIndex + offset + 1) % queue.length]).find((track) => !failedPlaybackIdsRef.current.has(track.songId));
    if (!nextTrack) { setPlaybackState('error'); return; }
    showToast(message, 'warning'); selectTrack(nextTrack.songId, null, playMode.current, true);
  }
  function handlePlaybackFailure(message) {
    setPlaying(false);
    if (retryWithRefresh()) return;
    discardCurrentUrl();
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
      const payload = await providerPayload(response);
      const tracks = canonicalTracks(payload.tracks).filter((track) => track.binding);
      if (!tracks.length) throw Error();
      if (controller.signal.aborted || session !== randomSession.current) return;
      const freshTracks = tracks.filter((track) => !randomTrackKeys.current.includes(randomTrackKey(track))); const candidates = freshTracks.length ? freshTracks : tracks;
      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      const fallbackCandidates = tracks.filter((track) => track.songId !== selected.songId && randomTrackKey(track) !== randomTrackKey(selected) && !randomTrackKeys.current.includes(randomTrackKey(track)));
      randomFallbackTracks.current = shuffled(fallbackCandidates).slice(0, 5);
      rememberRandomTrack(selected, payload.singer || '');
      playbackListRef.current = 'random'; clearMediaDeadline(); setPlaybackQueue(tracks); setCurrentId(selected.songId); setPlaybackTrackId(selected.songId); setPlaybackState('resolving');
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
    selectTrack(track.songId, null, 'random');
  }

  const loadChart = async (platform = chartPlatform, type = chartType, refresh = false) => {
    chartRequestRef.current?.abort(); chartRequestRef.current = null;
    const stored = readChartStore(storageNamespace, platform, type); const cached = Array.isArray(stored?.tracks) ? stored : null;
    const cachedAt = Date.parse(cached?.updatedAt || ''); const cacheFresh = Number.isFinite(cachedAt) && Date.now() - cachedAt < CHART_CACHE_MAX_AGE_MS;
    if (cached && cacheFresh && !refresh) { setChartData(hydrateChart(cached)); setChartLoading(false); setChartState(''); return; }
    if (!refresh) setChartData(hydrateChart(null));
    if (!hasAccess()) { setChartLoading(false); setChartState(''); return; }
    const controller = new AbortController(); chartRequestRef.current = controller; setChartLoading(true); setChartState(refresh ? '正在刷新榜单…' : '正在加载榜单…');
    try {
      const response = await musicRequest('charts', { platform, chart: type, refresh: refresh ? '1' : '' }, controller.signal);
      const payload = await providerPayload(response);
      if (!Array.isArray(payload.tracks)) throw new Error('榜单服务暂时不可用');
      if (controller.signal.aborted) return;
      try { localStorage.setItem(chartStoreKey(storageNamespace, platform, type), JSON.stringify(payload)); } catch { /* Storage is unavailable in private browsing. */ }
      setChartData(hydrateChart(payload)); setChartState(payload.stale ? '榜单更新失败，正在展示上次成功数据' : '');
    } catch {
      if (controller.signal.aborted) return;
      if (cached) { setChartData(hydrateChart(cached)); setChartState('刷新失败，正在展示上次缓存'); }
      else { setChartState('榜单暂时不可用，请稍后重试'); }
    } finally {
      if (chartRequestRef.current === controller) { chartRequestRef.current = null; setChartLoading(false); }
    }
  };
  const openNetease = () => { setChartPlatform('netease'); setListView('netease'); void loadChart('netease', chartType); };
  const openQQ = () => { setChartPlatform('qq'); setListView('qq'); void loadChart('qq', chartType); };
  const selectChartType = (type) => { setChartType(type); void loadChart(chartPlatform, type); };

  const loadResults = async (keyword, page, append = false) => {
    searchRequestRef.current?.abort();
    const controller = new AbortController(); searchRequestRef.current = controller;
    if (append) { loadingMoreRef.current = true; setLoadingMore(true); } else { loadingMoreRef.current = false; setLoadingMore(false); setSearchState(TEXT.searching); }
    try {
      const response = await musicRequest('search', { q: keyword, page }, controller.signal);
      const payload = await providerPayload(response);
      if (controller.signal.aborted || searchRequestRef.current !== controller || activeSearchRef.current !== keyword) return;
      const incoming = canonicalTracks(payload.tracks).filter((track) => track.binding);
      setTracks((items) => append ? [...items, ...incoming.filter((track) => !items.some((item) => item.songId === track.songId))] : incoming.map((track) => ({ ...track, url: undefined })));
      setResults((items) => append ? [...items, ...incoming.filter((track) => !items.some((item) => item.songId === track.songId))] : incoming);
      if (append && playbackListRef.current === `search:${activeSearchRef.current}`) setPlaybackQueue((items) => [...items, ...incoming.filter((track) => !items.some((item) => item.songId === track.songId))]);
      setResultPage(page); setHasMoreResults(Boolean(payload.hasMore && incoming.length)); setSearchState('');
    } catch (error) {
      if (controller.signal.aborted || searchRequestRef.current !== controller || activeSearchRef.current !== keyword) return;
      const accessDenied = error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403; setHasMoreResults(false); setSearchState(''); showToast(accessDenied ? 'Provider 没有访问权限，请重新配置或联系服务提供方' : '搜索服务暂时不可用', accessDenied ? 'warning' : 'error');
    } finally {
      if (searchRequestRef.current === controller) { searchRequestRef.current = null; loadingMoreRef.current = false; setLoadingMore(false); }
    }
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
    setSearchFocused(false); setActiveSingerSuggestion(-1); await runSearch(keyword);
  };
  const chooseSearchSuggestion = (keyword) => { setQuery(keyword); setSearchFocused(false); setActiveSingerSuggestion(-1); runSearch(keyword); };
  const clearSearchInput = () => { setQuery(''); setActiveSingerSuggestion(-1); setSearchFocused(true); searchInputRef.current?.focus(); };
  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') { setSearchFocused(false); setActiveSingerSuggestion(-1); event.currentTarget.blur(); return; }
    if (!singerSuggestions.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSingerSuggestion((index) => (index + 1) % singerSuggestions.length); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSingerSuggestion((index) => index <= 0 ? singerSuggestions.length - 1 : index - 1); }
    if (event.key === 'Enter' && activeSingerSuggestion >= 0) { event.preventDefault(); chooseSearchSuggestion(singerSuggestions[activeSingerSuggestion]); }
  };
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
    if (track.songId === currentId) { toggle(); return; }
    const isChartView = listView === 'netease' || listView === 'qq';
    const queue = listView === 'search' ? results : listView === 'likes' ? likedTracks : isChartView ? chartData.tracks : tracks;
    playbackListRef.current = listView === 'search' ? `search:${activeSearchRef.current}` : isChartView ? `charts:${listView}:${chartType}` : listView;
    setActiveQueue(listView === 'likes' ? 'favorites' : 'normal');
    selectTrack(track.songId, queue);
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

  const isChartView = listView === 'netease' || listView === 'qq';
  const visibleTracks = listView === 'search' ? results : listView === 'likes' ? likedTracks : isChartView ? chartData.tracks : tracks;
  const isSearching = searchState === TEXT.searching;
  const isPlaybackBusy = randomLoading || playbackState === 'resolving' || playbackState === 'loading';
  const rowPlaybackState = (id) => id === playbackTrackId ? playbackState : 'idle';
  useEffect(() => {
    mediaActionsRef.current = {
      play: () => { pulseControl('play'); if (!playing) toggle(); },
      pause: () => { pulseControl('play'); if (playing) toggle(); },
      previous: () => { pulseControl('previous'); previous(); },
      next: () => { pulseControl('next'); next(); },
    };
  });
  return <main className={`music-page mobile-view-${mobileView}${playing ? ' is-playing' : ''}${titleOverflows ? ' has-overflowing-title' : ''}`}><audio ref={audio} onPlay={() => { setPlaying(true); setPlaybackTrackId(currentId); setPlaybackState('playing'); }} onPause={() => { setPlaying(false); setPlaybackState((state) => state === 'loading' || state === 'resolving' ? state : 'paused'); }} onLoadStart={() => setPlaybackState('loading')} onWaiting={() => { setPlaybackState('loading'); beginMediaDeadline(currentId); }} onPlaying={() => { clearMediaDeadline(); failedPlaybackIdsRef.current.clear(); playbackRefreshIdsRef.current.delete(currentId); setPlaybackState('playing'); }} onError={() => { if (ignoreAudioErrorRef.current) { ignoreAudioErrorRef.current = false; return; } clearMediaDeadline(); handlePlaybackFailure(); }} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={() => { clearMediaDeadline(); next(); }} /><Toast toast={toast} onClose={() => setToast(null)} />
  <section className="music-shell">
      <section className="music-content">
        <header className="music-header">
          {!isMusicPage && <div><p className="music-kicker">LURI MUSIC</p><h1>{pageTitle}</h1>{headerNotice}</div>}
          <form className="music-search" onSubmit={search}><input ref={searchInputRef} value={query} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onChange={(event) => { setQuery(event.target.value); setActiveSingerSuggestion(-1); }} onKeyDown={handleSearchKeyDown} placeholder={TEXT.searchHint} autoComplete="off" aria-autocomplete="list" aria-expanded={searchFocused && singerSuggestions.length > 0} />{query && <button className="music-search-clear" type="button" onMouseDown={(event) => event.preventDefault()} onClick={clearSearchInput} aria-label="清空搜索内容" title="清空"><MusicIcon name="close" /></button>}<button className="music-icon-button" type="submit" onMouseDown={(event) => event.preventDefault()} disabled={isSearching} aria-label={isSearching ? '正在搜索' : TEXT.search} title={isSearching ? '正在搜索' : TEXT.search}>{isSearching ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name="search" />}</button><button className="music-random-button" type="button" onMouseDown={(event) => event.preventDefault()} onClick={startRandom} disabled={randomLoading} aria-label="随机搜索并播放音乐" title="随机发现">{randomLoading ? <span className="music-spinner" aria-hidden="true" /> : <><MusicIcon name="random" /><span>随机发现</span></>}</button>{searchFocused && (singerSuggestions.length > 0 || (!singerQuery && recentSearches.length > 0)) && <div className="music-search-history" ref={searchSuggestionsRef} onMouseDown={(event) => event.preventDefault()}>{singerSuggestions.length > 0 ? <><div className="music-search-history__head"><span>歌手</span></div>{singerSuggestions.map((singer, index) => <button className={`music-search-history__item${index === activeSingerSuggestion ? ' active' : ''}`} type="button" key={singer} onClick={() => chooseSearchSuggestion(singer)}>{singer}</button>)}</> : <><div className="music-search-history__head"><span>最近搜索</span><button type="button" onClick={() => setRecentSearches([])}>清除</button></div>{recentSearches.map((item) => <button className="music-search-history__item" type="button" key={item} onClick={() => chooseSearchSuggestion(item)}>{item}</button>)}</>}</div>}</form>
        </header>
        <aside className="music-sidebar"><p className="music-brand">LURI / MUSIC</p><button className={`music-nav${listView === 'queue' || listView === 'search' ? ' active' : ''}`} onClick={() => { setListView('queue'); }}>播放列表<span>{tracks.length}</span></button><button className={`music-nav${listView === 'likes' ? ' active' : ''}`} onClick={() => { setListView('likes'); }}>我喜欢<span>{likedTracks.length}</span></button><button className={`music-nav${listView === 'netease' ? ' active' : ''}`} onClick={openNetease}>网易<span>{listView === 'netease' ? chartData.tracks.length || '' : ''}</span></button><button className={`music-nav${listView === 'qq' ? ' active' : ''}`} onClick={openQQ}>QQ<span>{listView === 'qq' ? chartData.tracks.length || '' : ''}</span></button><div className="music-divider" /></aside>
        <div className="music-workspace"><section className="music-results">{isChartView && <div className="music-chart-controls"><div className="music-chart-switch music-chart-switch--types" aria-label="榜单类型">{CHART_TYPES.map((chart) => <button type="button" className={chartType === chart.value ? 'active' : ''} onClick={() => selectChartType(chart.value)} key={chart.value}>{chart.label}</button>)}</div><div className="music-chart-meta"><span>{chartData.title || '音乐榜单'} · 更新于 {chartUpdatedLabel(chartData.updatedAt)} · 共 {chartData.tracks.length} 首歌曲</span><button type="button" onClick={() => loadChart(chartPlatform, chartType, true)} disabled={chartLoading}>{chartLoading ? <span className="music-spinner" aria-hidden="true" /> : '刷新'}</button></div></div>}<div className="music-list-head"><span>{listView === 'search' ? TEXT.search : listView === 'likes' ? TEXT.likes : isChartView ? '' : TEXT.queue}</span></div><div className="music-list" ref={musicListRef} onScroll={handleListScroll}>{visibleTracks.map((track, index) => { const state = rowPlaybackState(track.songId); const isCurrent = track.songId === currentId; const isCurrentBusy = isCurrent && isPlaybackBusy; return <button ref={isCurrent ? currentRowRef : null} key={track.songId} className={`music-row${isCurrent ? ' current' : ''}`} onClick={() => handleTrackAction(track)} disabled={isCurrentBusy} aria-label={`${track.title}，${isCurrentBusy ? '正在加载' : state === 'error' ? '播放失败，点击重试' : state === 'playing' ? TEXT.pause : TEXT.play}`}><span className="track-index">{String(isChartView ? track.rank || index + 1 : index + 1).padStart(2, '0')}</span><span className="track-copy"><span className="track-title"><b>{track.title}</b>{isCurrent && <QualityBadge track={current} />}</span><span className="track-artist">{track.artist}{track.year ? ` · ${track.year}` : ''}</span></span><span className={`track-action track-action--${state}`} aria-hidden="true">{state === 'error' ? '播放失败' : state === 'loading' || state === 'resolving' ? <span className="music-spinner" /> : <MusicIcon name={state === 'playing' ? 'pause' : 'play'} />}</span></button>; })}{loadingMore && <p className="music-list-status">正在加载更多…</p>}{!visibleTracks.length && <div className="music-empty"><strong>{isChartView ? chartLoading ? '正在加载榜单…' : '暂无榜单数据' : TEXT.noResult}</strong><span>{isChartView ? '请选择榜单或点击刷新' : TEXT.choose}</span></div>}</div><p className="music-search-status" aria-live="polite">{isChartView ? chartState : isSearching ? '' : searchState}</p></section><aside className="music-lyrics"><div className="lyrics-track"><img src={current?.art || EMPTY_ART} alt="" onLoad={artworkLoaded} onError={refreshArtwork} /><div><h2><b>{current?.title || TEXT.noTrack}</b></h2><span>{current?.artist || TEXT.choose}</span></div><div className="lyrics-track__actions"><QualityBadge track={current} /><DownloadButton track={current} /><button className={`like-button${current && likedTracks.some((track) => sameFavorite(track, current)) ? ' liked' : ''}`} type="button" disabled={!current} aria-label={current && likedTracks.some((track) => sameFavorite(track, current)) ? '取消收藏' : '收藏歌曲'} aria-pressed={Boolean(current && likedTracks.some((track) => sameFavorite(track, current)))} title={current && likedTracks.some((track) => sameFavorite(track, current)) ? '取消收藏' : '收藏'} onClick={() => current && like(current.songId)}><MusicIcon name="heart" /></button></div></div><div ref={lyricsRef} className="lyrics-body" onClick={seekLyric}>{lyricLines.length ? lyricLines.map((line, index) => <p key={`${line.time}:${line.text}:${index}`}><span>{line.text}</span>{line.translation && <small>{line.translation}</small>}</p>) : <p className="lyrics-empty">{lyricsState || TEXT.choose}</p>}</div></aside></div></section></section>
    <footer className="music-player">
      <div className="music-player__progress"><input type="range" min="0" max={duration || 0} value={Math.min(progress, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audio.current) audio.current.currentTime = value; setProgress(value); }} /></div>
      <div className="music-player__song"><img src={current?.art || EMPTY_ART} alt="" onLoad={artworkLoaded} onError={refreshArtwork} /><span className="music-player__copy"><b className="music-player__title">{current?.title || TEXT.noTrack}</b><small>{current?.artist || 'LURI MUSIC'}</small></span></div>
      <div className="music-controls"><span className="music-player__time">{time(progress)} / {time(duration)}</span><button ref={(node) => { controlButtonRefs.current.previous = node; }} className="music-icon-button" onClick={() => { pulseControl('previous'); previous(); }} aria-label={TEXT.prev} title={TEXT.prev}><MusicIcon name="previous" /></button><button ref={(node) => { controlButtonRefs.current.play = node; }} className="music-icon-button play-button" onClick={() => { pulseControl('play'); toggle(); }} disabled={isPlaybackBusy} aria-label={isPlaybackBusy ? '正在加载' : playing ? TEXT.pause : TEXT.play} title={isPlaybackBusy ? '正在加载' : playing ? TEXT.pause : TEXT.play}>{isPlaybackBusy ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name={playing ? 'pause' : 'play'} />}</button><button ref={(node) => { controlButtonRefs.current.next = node; }} className="music-icon-button" onClick={() => { pulseControl('next'); next(); }} aria-label={TEXT.next} title={TEXT.next}><MusicIcon name="next" /></button><QualityBadge track={current} /><DownloadButton track={current} /><div className="music-volume"><button className="music-icon-button" onClick={() => setMuted((value) => !value)} aria-label={muted || volume === 0 ? '取消静音' : '静音'} title={muted || volume === 0 ? '取消静音' : '静音'}><MusicIcon name={muted || volume === 0 ? 'mute' : 'volume'} /></button><input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} aria-label="音量" onChange={(event) => { const value = Number(event.target.value); setVolume(value); setMuted(value === 0); }} /></div></div>
      <button className={`music-player__lyrics-button${mobileView === 'now' ? ' active' : ''}`} type="button" disabled={!current} aria-label={mobileView === 'now' ? '返回歌曲列表' : '查看歌词'} aria-pressed={mobileView === 'now'} onClick={() => setMobileView((view) => view === 'now' ? 'playlist' : 'now')}>词</button>{legalLinks === false ? null : legalLinks ? <div className="music-global-disclaimer music-legal-links">{legalLinks}</div> : <p className="music-global-disclaimer">请仅播放您依法有权访问的内容。</p>}
    </footer></main>;
}
