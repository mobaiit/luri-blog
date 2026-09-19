import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './GlobalMusicCollapse.css';

const AUTO_COLLAPSE_DELAY = 6000;

export default function GlobalMusicCollapse() {
  const { pathname } = useLocation();
  const isGlobalPlayer = pathname !== '/music';
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 761px)').matches;
    if (!isGlobalPlayer || !isDesktop) { setCollapsed(false); return undefined; }

    let timer;
    const clearTimer = () => window.clearTimeout(timer);
    const reveal = () => { clearTimer(); setCollapsed(false); };
    const schedule = () => { clearTimer(); timer = window.setTimeout(() => setCollapsed(true), AUTO_COLLAPSE_DELAY); };
    const player = document.querySelector('.music-player');
    player?.addEventListener('pointerenter', reveal);
    player?.addEventListener('pointerleave', schedule);
    schedule();
    return () => { clearTimer(); player?.removeEventListener('pointerenter', reveal); player?.removeEventListener('pointerleave', schedule); };
  }, [isGlobalPlayer]);

  useEffect(() => {
    document.body.classList.toggle('global-music-player-collapsed', isGlobalPlayer && collapsed);
    return () => document.body.classList.remove('global-music-player-collapsed');
  }, [collapsed, isGlobalPlayer]);

  if (!isGlobalPlayer) return null;
  return <button className="global-music-collapse" type="button" onMouseEnter={() => collapsed && setCollapsed(false)} onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? '展开播放器' : '收起播放器'} title={collapsed ? '展开播放器' : '收起播放器'}>{collapsed ? '⌃' : '⌄'}</button>;
}
