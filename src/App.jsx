import { useEffect, useState } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import About from './pages/About';
import Blog from './pages/Blog';
import PostDetail from './pages/PostDetail';
import LuriMusic from './luri-music/LuriMusic';
import Admin from './luri-music/Admin';
import './luri-music/page-titles.css';

export default function App() {
  const location = useLocation();
  const [musicConfig, setMusicConfig] = useState(null);
  useEffect(() => {
    let active = true;
    fetch('/api/luri-music/site-config').then((response) => response.ok ? response.json() : Promise.reject()).then((data) => {
      if (active) setMusicConfig({ enabled: data.musicPageEnabled !== false, accessRequired: data.musicAccessRequired !== false, musicOnly: data.musicOnlyMode === true, aboutEnabled: data.aboutPageEnabled !== false });
    }).catch(() => { if (active) setMusicConfig({ enabled: true, accessRequired: true, musicOnly: false, aboutEnabled: true }); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (location.pathname === '/admin' || location.search === '?admin=1') document.title = 'LURI ADMIN';
    else if (location.pathname === '/music' || location.pathname === '/luri-music' || location.search === '?luri-music=1') document.title = 'LURI MUSIC';
    else document.title = 'LURI - 落墨留白';
  }, [location.pathname, location.search]);
  if (location.pathname === '/admin' || location.search === '?admin=1') return <Routes><Route path="*" element={<Admin />} /></Routes>;
  if (musicConfig === null) return <div className="ui-loading-screen"><span className="ui-spinner" /><p>正在加载网站配置…</p></div>;
  const isLegacyMusicPage = location.pathname === '/luri-music' || location.search === '?luri-music=1';
  const isMusicPage = location.pathname === '/music';
  if (isLegacyMusicPage) return <Navigate to="/music" replace />;
  if (musicConfig.musicOnly && !isMusicPage) return <Navigate to="/music" replace />;
  if (isMusicPage) return musicConfig.enabled ? <><ScrollToTop /><Navbar musicPageEnabled musicActive musicOnly={musicConfig.musicOnly} aboutPageEnabled={musicConfig.aboutEnabled} /><Routes><Route path="*" element={<LuriMusic accessRequired={musicConfig.accessRequired} />} /></Routes></> : <Navigate to="/" replace />;
  if (!musicConfig.aboutEnabled && location.pathname === '/about') return <Navigate to="/" replace />;
  return (
    <>
      <ScrollToTop />
      <Navbar musicPageEnabled={musicConfig.enabled} aboutPageEnabled={musicConfig.aboutEnabled} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<PostDetail />} />
        {/* 404 */}
        <Route
          path="*"
          element={
            <main style={{ paddingTop: 'var(--nav-height)', minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
              <div className="container">
                <p style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</p>
                <p>这个页面还不存在，或者已经消失了。</p>
              </div>
            </main>
          }
        />
      </Routes>
      <Footer />
    </>
  );
}
