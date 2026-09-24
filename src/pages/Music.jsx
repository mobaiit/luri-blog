import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Toast } from '../luri-music/UiFeedback';
import { SINGERS } from '../data/singers';
import './Music.css';

const EMPTY_ART = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23ece9e1"/%3E%3Ccircle cx="200" cy="200" r="106" fill="%23c8c2b7"/%3E%3Ccircle cx="200" cy="200" r="22" fill="%23111111"/%3E%3C/svg%3E';
const TEXT = { title: '\u97f3\u4e50', discover: '\u53d1\u73b0\u97f3\u4e50', likes: '\u6211\u7684\u559c\u6b22', search: '\u641c\u7d22', searchHint: '\u641c\u7d22\u6b4c\u66f2\u3001\u827a\u4eba\u6216\u4e13\u8f91', searching: '\u6b63\u5728\u641c\u7d22\u2026', queue: '\u64ad\u653e\u961f\u5217', tracks: '\u9996\u6b4c\u66f2', noResult: '\u6682\u65e0\u641c\u7d22\u7ed3\u679c', noTrack: '\u6682\u65e0\u6b4c\u66f2', choose: '\u8bf7\u641c\u7d22\u540e\u9009\u62e9\u6b4c\u66f2', now: '\u6b63\u5728\u64ad\u653e', play: '\u64ad\u653e', pause: '\u6682\u505c', prev: '\u4e0a\u4e00\u9996', next: '\u4e0b\u4e00\u9996', load: '\u6b63\u5728\u83b7\u53d6\u53ef\u64ad\u653e\u6587\u4ef6\u2026', unavailable: '\u6ca1\u6709\u627e\u5230\u53ef\u76f4\u64ad\u7684\u97f3\u9891\u6587\u4ef6', source: '\u516c\u5f00\u97f3\u9891\u76ee\u5f55', disclaimer: '\u672c\u9875\u4ec5\u63d0\u4f9b\u641c\u7d22\u4e0e\u64ad\u653e\u754c\u9762\uff0c\u4e0d\u6258\u7ba1\u3001\u4e0d\u590d\u5236\u3001\u4e0d\u4ee3\u7406\u4efb\u4f55\u97f3\u9891\u6587\u4ef6\u3002\u8bf7\u4ec5\u4f7f\u7528\u5df2\u83b7\u6388\u6743\u7684\u97f3\u6e90\uff0c\u5e76\u9075\u5b88\u5176\u670d\u52a1\u6761\u6b3e\u4e0e\u9002\u7528\u6cd5\u5f8b\u3002' };
const time = (value = 0) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
const lyricLine = (line) => { const match = /^\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/.exec(line); return match ? { time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() } : { time: -1, text: line }; };
const STORE_QUEUE = 'luri.music.queue.v1'; const STORE_LIKES = 'luri.music.likes.v1'; const STORE_SEARCH = 'luri.music.search.v1'; const STORE_QUERY = 'luri.music.query.v1'; const STORE_RECENT_SEARCHES = 'luri.music.recent-searches.v1';
const STORE_CHART = 'luri.music.chart.v1';
const CHART_PLATFORMS = [{ value: 'netease', label: '网易' }, { value: 'qq', label: 'QQ 音乐' }];
const CHART_TYPES = [{ value: 'rising', label: '飙升榜' }, { value: 'new', label: '新歌榜' }, { value: 'original', label: '原创榜' }, { value: 'hot', label: '热歌榜' }];
const MEDIA_LOAD_TIMEOUT_MS = 15000;
const FAVORITES_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000;
const readStore = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const readSession = (key) => { try { return JSON.parse(sessionStorage.getItem(key) || '{}'); } catch { return {}; } };
const writeSession = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Session storage may be unavailable. */ } };
const randomTextKey = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s()（）.·_-]/g, '');
const randomTrackKey = (track) => `${randomTextKey(track?.title)}:${randomTextKey(track?.artist)}`;
const trackArtists = (track) => String(track?.artist || '').split(/\s*(?:,|，|、|\/|&|feat\.?|ft\.?)\s*/i).filter(Boolean);
const trackTitleKey = (track) => String(track?.title || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const matchesTrackIdentity = (candidate, target) => {
  if (!trackTitleKey(candidate) || trackTitleKey(candidate) !== trackTitleKey(target)) return false;
  const expectedArtists = trackArtists(target).map(randomTextKey).filter(Boolean);
  const candidateArtists = trackArtists(candidate).map(randomTextKey).filter(Boolean);
  return expectedArtists.length > 0 && expectedArtists.some((expected) => candidateArtists.some((artist) => artist === expected || artist.includes(expected) || expected.includes(artist)));
};
const sameFavorite = (left, right) => Boolean(left && right && (left.id === right.id || (trackTitleKey(left) && trackTitleKey(left) === trackTitleKey(right))));
const trackKey = (track, providerId = '') => { const id = String(track?.id || ''); if (id.startsWith('provider:') || id.startsWith('track:')) return id; const base = `track:${track?.source || 'default'}:${id}`; return providerId ? `provider:${providerId}:${base}` : base; };
const sourceTrackId = (track) => track?.sourceId ?? String(track?.id || '').replace(/^(?:provider:[^:]+:)?track:[^:]+:/, '');
const chartStoreKey = (providerId, platform, chart) => `${STORE_CHART}.${providerId || 'guest'}.${platform}.${chart}`;
const readChartStore = (providerId, platform, chart) => { try { return JSON.parse(localStorage.getItem(chartStoreKey(providerId, platform, chart)) || 'null'); } catch { return null; } };
const hydrateChart = (payload, providerId) => ({ ...payload, tracks: (Array.isArray(payload?.tracks) ? payload.tracks : []).map((track, index) => ({ ...track, rank: Number(track.rank) || index + 1, sourceId: track.sourceId ?? track.id, id: trackKey(track, providerId) })) });
const chartUpdatedLabel = (value) => { const timestamp = Date.parse(value || ''); return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp) : '暂无缓存'; };
const minimalFavorites = (items) => (Array.isArray(items) ? items : []).map((track) => ({ title: track.title || '', artist: track.artist || '', source: track.source || '', sourceId: sourceTrackId(track) }));
const resolvedExpiry = (payload) => { const explicit = Date.parse(payload?.expiresAt || ''); if (Number.isFinite(explicit)) return new Date(explicit).toISOString(); const seconds = Number(payload?.expiresIn); return Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null; };
const playbackUrlExpired = (track) => { const expires = Date.parse(track?.expiresAt || ''); return Boolean(track?.url && Number.isFinite(expires) && expires <= Date.now() + 5000); };
const singerSearchKey = (value) => String(value || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
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
  const likedStoreKey = `${STORE_LIKES.replace('.v1', '.v2')}.${favoriteNamespace || 'guest'}`; const favoriteDirtyKey = `luri.music.likes-sync-dirty.v2.${favoriteNamespace || 'guest'}`; const favoriteSyncedKey = `luri.music.likes-sync-last.v2.${favoriteNamespace || 'guest'}`;
  const legacyLikedStoreKey = storeKey(STORE_LIKES);
  const favoriteInitialRef = useRef(null);
  if (!favoriteInitialRef.current) {
    let accountItems = []; let accountPresent = false; let dirty = false; let legacyItems = []; let lastSynced = 0;
    try { const value = localStorage.getItem(likedStoreKey); accountPresent = value !== null; accountItems = value === null ? [] : JSON.parse(value); dirty = Boolean(Number(localStorage.getItem(favoriteDirtyKey))); lastSynced = Number(localStorage.getItem(favoriteSyncedKey)) || 0; legacyItems = readStore(legacyLikedStoreKey); } catch { /* Use the server backup when storage is unavailable. */ }
    const backupItems = Array.isArray(favoriteBackup) ? favoriteBackup : [];
    const backupUpdated = Date.parse(favoriteBackupUpdatedAt || '') || 0;
    const source = dirty ? 'account' : !accountPresent && legacyItems.length ? 'legacy' : backupUpdated > lastSynced || (!accountItems.length && backupItems.length) ? 'backup' : 'account';
    const items = source === 'account' ? accountItems : source === 'legacy' ? legacyItems : backupItems;
    favoriteInitialRef.current = { source, items: (Array.isArray(items) ? items : []).map((track) => { const sourceId = String(track?.sourceId || ''); return { ...track, sourceId, id: trackKey({ ...track, id: sourceId || `favorite-${trackTitleKey(track)}` }, storageNamespace) }; }) };
  }
  const restoreResults = () => readStore(storeKey(STORE_SEARCH)).map((track) => ({ ...track, sourceId: sourceTrackId(track), id: trackKey(track, storageNamespace) }));
  const [query, setQuery] = useState(() => localStorage.getItem(storeKey(STORE_QUERY)) || ''); const [results, setResults] = useState(restoreResults); const [cachedResults, setCachedResults] = useState(restoreResults); const [recentSearches, setRecentSearches] = useState(() => readStore(storeKey(STORE_RECENT_SEARCHES)).filter((item) => typeof item === 'string').slice(0, 10)); const [searchFocused, setSearchFocused] = useState(false); const [activeSingerSuggestion, setActiveSingerSuggestion] = useState(-1); const [searchState, setSearchState] = useState('');
  const [listView, setListView] = useState('search');
  const [chartPlatform, setChartPlatform] = useState('netease'); const [chartType, setChartType] = useState('rising'); const [chartData, setChartData] = useState(() => hydrateChart(readChartStore(storageNamespace, 'netease', 'rising'), storageNamespace)); const [chartLoading, setChartLoading] = useState(false); const [chartState, setChartState] = useState('');
  const [mobileView, setMobileView] = useState('playlist');
  const [activeQueue, setActiveQueue] = useState('normal');
  const [resultPage, setResultPage] = useState(0); const [hasMoreResults, setHasMoreResults] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const [tracks, setTracks] = useState(() => readStore(storeKey(STORE_QUEUE))); const [likedTracks, setLikedTracks] = useState(() => favoriteInitialRef.current.items); const [playbackQueue, setPlaybackQueue] = useState([]); const [currentId, setCurrentId] = useState(null); const [playing, setPlaying] = useState(false); const [playbackState, setPlaybackState] = useState('idle'); const [playbackTrackId, setPlaybackTrackId] = useState(null); const [playbackAttempt, setPlaybackAttempt] = useState(0); const [forceLocalFallbackFor, setForceLocalFallbackFor] = useState(null); const [titleOverflows, setTitleOverflows] = useState(false);
  const [progress, setProgress] = useState(0); const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8); const [muted, setMuted] = useState(false);
  const [lyrics, setLyrics] = useState(''); const [lyricsState, setLyricsState] = useState('');
  const lyricsRef = useRef(null); const musicListRef = useRef(null); const currentRowRef = useRef(null); const searchSuggestionsRef = useRef(null); const locatedTrackRef = useRef('');
  const resolveRequestRef = useRef(null); const recoveryRequestRef = useRef(null); const chartRequestRef = useRef(null); const mediaDeadlineRef = useRef(null); const mediaDeadlineTrackRef = useRef(''); const ignoreAudioErrorRef = useRef(false); const failedPlaybackIdsRef = useRef(new Set()); const primaryResolveAttemptsRef = useRef(new Set()); const blockedResolveIdsRef = useRef(new Set()); const searchRecoveryAttemptsRef = useRef(new Set()); const pendingFavoriteRecoveryRef = useRef(null);
  const likedTracksRef = useRef(likedTracks); const favoriteMutationRef = useRef(0); const favoriteSyncRef = useRef({ syncing: false, dirtySince: (() => { try { return Number(localStorage.getItem(favoriteDirtyKey)) || 0; } catch { return 0; } })() });
  const loadingMoreRef = useRef(false); const activeSearchRef = useRef(query.trim());
  const randomHistoryKey = `luri.music.random-history.v1${storageNamespace ? `.${storageNamespace}` : ''}`; const storedRandomHistory = useRef(readSession(randomHistoryKey));
  const randomRequest = useRef(null); const randomSession = useRef(0); const playMode = useRef('manual'); const localFallbackAttempts = useRef(new Set()); const playbackListRef = useRef('');
  const randomFallbackTracks = useRef([]); const randomSingers = useRef(Array.isArray(storedRandomHistory.current.singers) ? storedRandomHistory.current.singers : []); const randomTrackKeys = useRef(Array.isArray(storedRandomHistory.current.tracks) ? storedRandomHistory.current.tracks : []);
  const [randomLoading, setRandomLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const activeTracks = activeQueue === 'favorites' ? likedTracks : tracks;
  const current = playbackQueue.find((track) => track.id === currentId) || activeTracks.find((track) => track.id === currentId);
  const singerQuery = singerSearchKey(query);
  const singerSuggestions = singerQuery ? SINGERS.filter((singer) => singerSearchKey(singer).startsWith(singerQuery)) : [];
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
    return () => { document.body.classList.remove('has-global-music-player'); resolveRequestRef.current?.abort(); recoveryRequestRef.current?.controller.abort(); chartRequestRef.current?.abort(); if (mediaDeadlineRef.current) window.clearTimeout(mediaDeadlineRef.current); };
  }, [isMusicPage]);
  useEffect(() => {
    if (activeSingerSuggestion >= 0) searchSuggestionsRef.current?.querySelector('.music-search-history__item.active')?.scrollIntoView({ block: 'nearest' });
  }, [activeSingerSuggestion]);
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
        const resolveLayer = forceLocalFallbackFor === current.id ? 'local-fallback' : 'primary';
        const attemptedSources = Array.isArray(payload.attemptedSources) ? payload.attemptedSources : [];
        if (attemptedSources.length > 0) console.debug(`[Resolve] ${resolveLayer} success, attempted sources: ${attemptedSources.join(' → ')}`);
        const resolved = { ...current, url: payload.url, expiresAt: resolvedExpiry(payload), art: payload.art || current.art, requestedQuality: payload.requestedQuality || playbackQuality, quality: payload.quality || '', bitrate: payload.bitrate || null, degraded: Boolean(payload.degraded), qualityVerified: Boolean(payload.qualityVerified), attemptedSources };
        const update = (track) => track.id === current.id ? { ...track, ...resolved } : track;
        setTracks((items) => items.map(update));
        if (pendingFavoriteRecoveryRef.current?.recoveredId !== current.id) setLikedTracks((items) => { let replaced = false; return items.flatMap((track) => { if (!sameFavorite(track, current)) return [track]; if (replaced) return []; replaced = true; return [resolved]; }); });
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
      navigator.mediaSession.setActionHandler('play', toggle);
      navigator.mediaSession.setActionHandler('pause', toggle);
      navigator.mediaSession.setActionHandler('previoustrack', previous);
      navigator.mediaSession.setActionHandler('nexttrack', next);
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
  }, [current?.id, current?.title, current?.artist, current?.album, current?.art]);
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }, [playing]);
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
  useEffect(() => { likedTracksRef.current = likedTracks; try { localStorage.setItem(likedStoreKey, JSON.stringify(likedTracks)); } catch { /* Storage is unavailable in private browsing. */ } }, [likedTracks, likedStoreKey]);
  useEffect(() => {
    if (!favoriteSyncEnabled || !favoriteNamespace) return undefined;
    const rememberDirtySince = (value) => { favoriteSyncRef.current.dirtySince = value; try { if (value) localStorage.setItem(favoriteDirtyKey, String(value)); else localStorage.removeItem(favoriteDirtyKey); } catch { /* Storage is unavailable in private browsing. */ } };
    const syncBackup = async () => {
      const state = favoriteSyncRef.current;
      try { state.dirtySince = Number(localStorage.getItem(favoriteDirtyKey)) || 0; } catch { /* Use the in-memory value when storage is unavailable. */ }
      if (state.syncing || !state.dirtySince || Date.now() - state.dirtySince < FAVORITES_SYNC_INTERVAL_MS) return;
      state.syncing = true; const mutation = favoriteMutationRef.current;
      let sourceItems = likedTracksRef.current; try { sourceItems = JSON.parse(localStorage.getItem(likedStoreKey) || '[]'); } catch { /* Fall back to the current React state. */ }
      const items = minimalFavorites(sourceItems); const snapshot = JSON.stringify(items);
      try {
        const response = await fetch('/api/luri-music/favorites', { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }) });
        let latestSnapshot = snapshot; try { latestSnapshot = JSON.stringify(minimalFavorites(JSON.parse(localStorage.getItem(likedStoreKey) || '[]'))); } catch { /* The submitted snapshot remains the comparison baseline. */ }
        if (response.ok && mutation === favoriteMutationRef.current && snapshot === latestSnapshot) { rememberDirtySince(0); try { localStorage.setItem(favoriteSyncedKey, String(Date.now())); } catch { /* Storage is unavailable in private browsing. */ } }
      } catch { /* Retry on a later interval while the dirty marker remains. */ }
      finally { state.syncing = false; }
    };
    try {
      if (favoriteInitialRef.current.source === 'backup') localStorage.setItem(favoriteSyncedKey, String(Date.now()));
      else if (likedTracksRef.current.length && !favoriteSyncRef.current.dirtySince && !localStorage.getItem(favoriteSyncedKey)) rememberDirtySince(Date.now());
    } catch { /* Storage is unavailable in private browsing. */ }
    syncBackup();
    const timer = window.setInterval(syncBackup, 60000);
    return () => window.clearInterval(timer);
  }, [favoriteSyncEnabled, favoriteDirtyKey, favoriteNamespace, favoriteSyncedKey, likedStoreKey]);
  useEffect(() => { if (!audio.current) return; audio.current.volume = volume; audio.current.muted = muted; }, [volume, muted]);
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
    if (recoveryRequestRef.current?.trackId !== id) { recoveryRequestRef.current?.controller.abort(); recoveryRequestRef.current = null; }
    if (pendingFavoriteRecoveryRef.current?.recoveredId !== id) pendingFavoriteRecoveryRef.current = null;
    const selectedTrack = queue?.find((track) => track.id === id) || playbackQueue.find((track) => track.id === id) || activeTracks.find((track) => track.id === id);
    if (!preserveFailures && selectedTrack) searchRecoveryAttemptsRef.current.delete(randomTrackKey(selectedTrack));
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
  const markFavoritesDirty = () => {
    favoriteMutationRef.current += 1;
    if (!favoriteSyncRef.current.dirtySince) { let dirtySince = Date.now(); try { dirtySince = Number(localStorage.getItem(favoriteDirtyKey)) || dirtySince; localStorage.setItem(favoriteDirtyKey, String(dirtySince)); } catch { /* Storage is unavailable in private browsing. */ } favoriteSyncRef.current.dirtySince = dirtySince; }
  };
  const like = (id) => {
    const song = current || tracks.find((track) => track.id === id) || results.find((track) => track.id === id); if (!song) return;
    markFavoritesDirty();
    setLikedTracks((saved) => saved.some((track) => sameFavorite(track, song)) ? saved.filter((track) => !sameFavorite(track, song)) : [...saved.filter((track) => !sameFavorite(track, song)), song]);
  };
  function showToast(message, type = 'error') { setToast({ title: type === 'warning' ? '需要处理' : '播放服务异常', message, type }); }
  const retryWithLocalFallback = () => {
    if (!current || localFallbackAttempts.current.has(current.id)) return false;

    // 🆕 智能降级：如果服务端已经尝试过跨音源降级，跳过本地降级
    const serverAttemptedSources = Array.isArray(current.attemptedSources) ? current.attemptedSources : [];
    if (serverAttemptedSources.length > 1) {
      console.debug(`[Resolve] Server already tried ${serverAttemptedSources.length} sources (${serverAttemptedSources.join(', ')}), skipping local fallback`);
      return false;
    }

    console.debug(`[Resolve] Triggering local fallback for track: ${current.title}`);
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
  const retryWithSearchRecovery = () => {
    if (!current?.title || !current?.artist || playMode.current === 'random') return false;
    const failedTrack = current; const recoveryKey = randomTrackKey(failedTrack);
    if (!recoveryKey || searchRecoveryAttemptsRef.current.has(recoveryKey)) return false;
    searchRecoveryAttemptsRef.current.add(recoveryKey);
    const controller = new AbortController(); recoveryRequestRef.current = { controller, trackId: failedTrack.id };
    setPlaybackTrackId(failedTrack.id); setPlaybackState('resolving');
    void (async () => {
      try {
        const response = await musicRequest('search', { q: failedTrack.title, page: 1 }, controller.signal);
        if (!response.ok) throw Error();
        const payload = await response.json();
        const match = (payload.tracks || []).find((track) => matchesTrackIdentity(track, failedTrack));
        if (!match) throw Error();
        const recovered = { ...match, url: undefined, sourceId: match.sourceId ?? match.id, id: trackKey(match, storageNamespace) };
        if (controller.signal.aborted || recoveryRequestRef.current?.controller !== controller) return;
        const isFavorite = likedTracksRef.current.some((track) => sameFavorite(track, failedTrack));
        pendingFavoriteRecoveryRef.current = isFavorite ? { original: failedTrack, recoveredId: recovered.id } : null;
        recoveryRequestRef.current = null; blockedResolveIdsRef.current.delete(recovered.id); primaryResolveAttemptsRef.current.delete(recovered.id); localFallbackAttempts.current.delete(recovered.id); setForceLocalFallbackFor(null);
        setPlaybackQueue((items) => (items.length ? items : activeTracks).map((track) => track.id === failedTrack.id ? recovered : track));
        setCurrentId(recovered.id); setPlaybackTrackId(recovered.id); setPlaybackState('resolving'); setPlaybackAttempt((attempt) => attempt + 1);
      } catch (error) {
        if (controller.signal.aborted || recoveryRequestRef.current?.controller !== controller) return;
        recoveryRequestRef.current = null; discardCurrentUrl();
        const accessDenied = error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403;
        if (accessDenied) { setPlaybackState('error'); showToast('Provider 没有访问权限，请重新配置或联系服务提供方', 'warning'); }
        else skipFailedTrack();
      }
    })();
    return true;
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
      if (retryWithSearchRecovery()) return;
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

  const loadChart = async (platform = chartPlatform, type = chartType, refresh = false) => {
    chartRequestRef.current?.abort(); chartRequestRef.current = null;
    const stored = readChartStore(storageNamespace, platform, type); const cached = Array.isArray(stored?.tracks) ? stored : null;
    if (cached && !refresh) { setChartData(hydrateChart(cached, storageNamespace)); setChartLoading(false); setChartState(''); return; }
    if (!refresh) setChartData(hydrateChart(null, storageNamespace));
    if (!hasAccess()) { setChartLoading(false); setChartState(''); return; }
    const controller = new AbortController(); chartRequestRef.current = controller; setChartLoading(true); setChartState(refresh ? '正在刷新榜单…' : '正在加载榜单…');
    try {
      const response = await musicRequest('charts', { platform, chart: type, refresh: refresh ? '1' : '' }, controller.signal);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload.tracks)) throw new Error(payload.error?.message || payload.error || '榜单服务暂时不可用');
      if (controller.signal.aborted) return;
      try { localStorage.setItem(chartStoreKey(storageNamespace, platform, type), JSON.stringify(payload)); } catch { /* Storage is unavailable in private browsing. */ }
      setChartData(hydrateChart(payload, storageNamespace)); setChartState('');
    } catch {
      if (controller.signal.aborted) return;
      if (cached) { setChartData(hydrateChart(cached, storageNamespace)); setChartState('刷新失败，正在展示上次缓存'); }
      else { setChartState('榜单暂时不可用，请稍后重试'); }
    } finally {
      if (chartRequestRef.current === controller) { chartRequestRef.current = null; setChartLoading(false); }
    }
  };
  const openNetease = () => { setChartPlatform('netease'); setListView('netease'); void loadChart('netease', chartType); };
  const openQQ = () => { setChartPlatform('qq'); setListView('qq'); void loadChart('qq', chartType); };
  const selectChartType = (type) => { setChartType(type); void loadChart(chartPlatform, type); };

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
  const chooseSearchSuggestion = (keyword) => { setQuery(keyword); setSearchFocused(false); setActiveSingerSuggestion(-1); runSearch(keyword); };
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
    if (track.id === currentId) { toggle(); return; }
    const isChartView = listView === 'netease' || listView === 'qq';
    const queue = listView === 'search' ? results : listView === 'likes' ? likedTracks : isChartView ? chartData.tracks : tracks;
    playbackListRef.current = listView === 'search' ? `search:${activeSearchRef.current}` : isChartView ? `charts:${listView}:${chartType}` : listView;
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

  const isChartView = listView === 'netease' || listView === 'qq';
  const visibleTracks = listView === 'search' ? results : listView === 'likes' ? likedTracks : isChartView ? chartData.tracks : tracks;
  const isSearching = searchState === TEXT.searching;
  const isPlaybackBusy = randomLoading || playbackState === 'resolving' || playbackState === 'loading';
  const rowPlaybackState = (id) => id === playbackTrackId ? playbackState : 'idle';
  const commitRecoveredFavorite = () => {
    const pending = pendingFavoriteRecoveryRef.current;
    if (!pending || pending.recoveredId !== currentId || !current) return;
    pendingFavoriteRecoveryRef.current = null;
    const { url: _url, expiresAt: _expiresAt, ...favorite } = current;
    markFavoritesDirty();
    setLikedTracks((items) => { let replaced = false; return items.flatMap((track) => { if (!sameFavorite(track, pending.original)) return [track]; if (replaced) return []; replaced = true; return [favorite]; }); });
  };

  return <main className={`music-page mobile-view-${mobileView}${playing ? ' is-playing' : ''}${titleOverflows ? ' has-overflowing-title' : ''}`}><audio ref={audio} onPlay={() => { setPlaying(true); setPlaybackTrackId(currentId); setPlaybackState('playing'); }} onPause={() => { setPlaying(false); setPlaybackState((state) => state === 'loading' || state === 'resolving' ? state : 'paused'); }} onLoadStart={() => setPlaybackState('loading')} onWaiting={() => { setPlaybackState('loading'); beginMediaDeadline(currentId); }} onPlaying={() => { clearMediaDeadline(); failedPlaybackIdsRef.current.clear(); primaryResolveAttemptsRef.current.delete(currentId); localFallbackAttempts.current.delete(currentId); blockedResolveIdsRef.current.delete(currentId); commitRecoveredFavorite(); setPlaybackState('playing'); }} onError={() => { if (ignoreAudioErrorRef.current) { ignoreAudioErrorRef.current = false; return; } clearMediaDeadline(); if (!retryWithPrimaryResolve()) handlePlaybackFailure(); }} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={() => { clearMediaDeadline(); next(); }} /><Toast toast={toast} onClose={() => setToast(null)} />
  <section className="music-shell">
      <section className="music-content">
        <header className="music-header">
          <div><p className="music-kicker">LURI MUSIC</p><h1>{pageTitle}</h1>{headerNotice}</div>
          <form className="music-search" onSubmit={search}><input value={query} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onChange={(event) => { setQuery(event.target.value); setActiveSingerSuggestion(-1); }} onKeyDown={handleSearchKeyDown} placeholder={TEXT.searchHint} autoComplete="off" aria-autocomplete="list" aria-expanded={searchFocused && singerSuggestions.length > 0} /><button className="music-icon-button" type="submit" onMouseDown={(event) => event.preventDefault()} disabled={isSearching} aria-label={isSearching ? '正在搜索' : TEXT.search} title={isSearching ? '正在搜索' : TEXT.search}>{isSearching ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name="search" />}</button><button className="music-random-button" type="button" onMouseDown={(event) => event.preventDefault()} onClick={startRandom} disabled={randomLoading} aria-label="随机搜索并播放音乐" title="随机发现">{randomLoading ? <span className="music-spinner" aria-hidden="true" /> : <><MusicIcon name="random" /><span>随机发现</span></>}</button>{searchFocused && (singerSuggestions.length > 0 || (!singerQuery && recentSearches.length > 0)) && <div className="music-search-history" ref={searchSuggestionsRef} onMouseDown={(event) => event.preventDefault()}>{singerSuggestions.length > 0 ? <><div className="music-search-history__head"><span>歌手</span></div>{singerSuggestions.map((singer, index) => <button className={`music-search-history__item${index === activeSingerSuggestion ? ' active' : ''}`} type="button" key={singer} onClick={() => chooseSearchSuggestion(singer)}>{singer}</button>)}</> : <><div className="music-search-history__head"><span>最近搜索</span><button type="button" onClick={() => setRecentSearches([])}>清除</button></div>{recentSearches.map((item) => <button className="music-search-history__item" type="button" key={item} onClick={() => chooseSearchSuggestion(item)}>{item}</button>)}</>}</div>}</form>
        </header>
        <aside className="music-sidebar"><p className="music-brand">LURI / MUSIC</p><button className={`music-nav${listView === 'queue' || listView === 'search' ? ' active' : ''}`} onClick={() => { setListView('queue'); }}>播放列表<span>{tracks.length}</span></button><button className={`music-nav${listView === 'likes' ? ' active' : ''}`} onClick={() => { setListView('likes'); }}>我喜欢<span>{likedTracks.length}</span></button><button className={`music-nav${listView === 'netease' ? ' active' : ''}`} onClick={openNetease}>网易<span>{listView === 'netease' ? chartData.tracks.length || '' : ''}</span></button><button className={`music-nav${listView === 'qq' ? ' active' : ''}`} onClick={openQQ}>QQ<span>{listView === 'qq' ? chartData.tracks.length || '' : ''}</span></button><div className="music-divider" /></aside>
        <div className="music-workspace"><section className="music-results">{isChartView && <div className="music-chart-controls"><div className="music-chart-switch music-chart-switch--types" aria-label="榜单类型">{CHART_TYPES.map((chart) => <button type="button" className={chartType === chart.value ? 'active' : ''} onClick={() => selectChartType(chart.value)} key={chart.value}>{chart.label}</button>)}</div><div className="music-chart-meta"><span>{chartData.title || '音乐榜单'} · 更新于 {chartUpdatedLabel(chartData.updatedAt)} · 共 {chartData.tracks.length} 首歌曲</span><button type="button" onClick={() => loadChart(chartPlatform, chartType, true)} disabled={chartLoading}>{chartLoading ? <span className="music-spinner" aria-hidden="true" /> : '刷新'}</button></div></div>}<div className="music-list-head"><span>{listView === 'search' ? TEXT.search : listView === 'likes' ? TEXT.likes : isChartView ? '' : TEXT.queue}</span></div><div className="music-list" ref={musicListRef} onScroll={handleListScroll}>{visibleTracks.map((track, index) => { const state = rowPlaybackState(track.id); const isCurrent = track.id === currentId; const isCurrentBusy = isCurrent && isPlaybackBusy; return <button ref={isCurrent ? currentRowRef : null} key={`${track.source || 'queue'}:${track.id}`} className={`music-row${isCurrent ? ' current' : ''}`} onClick={() => handleTrackAction(track)} disabled={isCurrentBusy} aria-label={`${track.title}，${isCurrentBusy ? '正在加载' : state === 'error' ? '播放失败，点击重试' : state === 'playing' ? TEXT.pause : TEXT.play}`}><span className="track-index">{String(isChartView ? track.rank || index + 1 : index + 1).padStart(2, '0')}</span><span className="track-copy"><span className="track-title"><b>{track.title}</b>{isCurrent && <QualityBadge track={current} />}</span><span className="track-artist">{track.artist}{track.year ? ` · ${track.year}` : ''}</span></span><span className={`track-action track-action--${state}`} aria-hidden="true">{state === 'error' ? '播放失败' : state === 'loading' || state === 'resolving' ? <span className="music-spinner" /> : <MusicIcon name={state === 'playing' ? 'pause' : 'play'} />}</span></button>; })}{loadingMore && <p className="music-list-status">正在加载更多…</p>}{!visibleTracks.length && <div className="music-empty"><strong>{isChartView ? chartLoading ? '正在加载榜单…' : '暂无榜单数据' : TEXT.noResult}</strong><span>{isChartView ? '请选择榜单或点击刷新' : TEXT.choose}</span></div>}</div><p className="music-search-status" aria-live="polite">{isChartView ? chartState : isSearching ? '' : searchState}</p></section><aside className="music-lyrics"><div className="lyrics-track"><img src={current?.art || EMPTY_ART} alt="" onError={handleArtworkError} /><div><h2><b>{current?.title || TEXT.noTrack}</b></h2><span>{current?.artist || TEXT.choose}</span></div><div className="lyrics-track__actions"><QualityBadge track={current} /><DownloadButton track={current} /><button className={`like-button${current && likedTracks.some((track) => sameFavorite(track, current)) ? ' liked' : ''}`} disabled={!current} onClick={() => current && like(current.id)}>{TEXT.likes}</button></div></div><div ref={lyricsRef} className="lyrics-body" onClick={seekLyric}>{lyrics ? lyricLines.map((line, index) => <p key={`${line.time}:${line.text}:${index}`}>{line.text}</p>) : <p className="lyrics-empty">{lyricsState || TEXT.choose}</p>}</div></aside></div></section></section>
    <footer className="music-player"><div className="music-player__progress"><input type="range" min="0" max={duration || 0} value={Math.min(progress, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (audio.current) audio.current.currentTime = value; setProgress(value); }} /></div><div className="music-player__song"><img src={current?.art || EMPTY_ART} alt="" onError={handleArtworkError} /><span className="music-player__copy"><b className="music-player__title">{current?.title || TEXT.noTrack}</b><small>{current?.artist || 'LURI MUSIC'}</small></span></div><div className="music-controls"><span className="music-player__time">{time(progress)} / {time(duration)}</span><button className="music-icon-button" onClick={previous} aria-label={TEXT.prev} title={TEXT.prev}><MusicIcon name="previous" /></button><button className="music-icon-button play-button" onClick={toggle} disabled={isPlaybackBusy} aria-label={isPlaybackBusy ? '正在加载' : playing ? TEXT.pause : TEXT.play} title={isPlaybackBusy ? '正在加载' : playing ? TEXT.pause : TEXT.play}>{isPlaybackBusy ? <span className="music-spinner" aria-hidden="true" /> : <MusicIcon name={playing ? 'pause' : 'play'} />}</button><button className="music-icon-button" onClick={next} aria-label={TEXT.next} title={TEXT.next}><MusicIcon name="next" /></button><QualityBadge track={current} /><DownloadButton track={current} /><div className="music-volume"><button className="music-icon-button" onClick={() => setMuted((value) => !value)} aria-label={muted || volume === 0 ? '取消静音' : '静音'} title={muted || volume === 0 ? '取消静音' : '静音'}><MusicIcon name={muted || volume === 0 ? 'mute' : 'volume'} /></button><input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} aria-label="音量" onChange={(event) => { const value = Number(event.target.value); setVolume(value); setMuted(value === 0); }} /></div></div><button className={`music-player__lyrics-button${mobileView === 'now' ? ' active' : ''}`} type="button" disabled={!current} aria-label={mobileView === 'now' ? '返回歌曲列表' : '查看歌词'} aria-pressed={mobileView === 'now'} onClick={() => setMobileView((view) => view === 'now' ? 'playlist' : 'now')}>词</button>{legalLinks === false ? null : legalLinks ? <div className="music-global-disclaimer music-legal-links">{legalLinks}</div> : <p className="music-global-disclaimer">请仅播放您依法有权访问的内容。</p>}</footer></main>;
}
