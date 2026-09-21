import { useEffect, useState } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import GlobalMusicCollapse from './components/GlobalMusicCollapse';
import Home from './pages/Home';
import About from './pages/About';
import Blog from './pages/Blog';
import PostDetail from './pages/PostDetail';
import Docs from './pages/Docs';
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
    else if (location.pathname === '/docs') document.title = 'LURI MUSIC 文档';
    else if (location.pathname === '/music' || location.pathname === '/luri-music' || location.search === '?luri-music=1') document.title = 'LURI MUSIC';
    else document.title = 'LURI - 落墨留白';
  }, [location.pathname, location.search]);
  if (location.pathname === '/admin' || location.search === '?admin=1') return <Routes><Route path="*" element={<Admin />} /></Routes>;
  if (musicConfig === null) return <div className="ui-loading-screen"><span className="ui-spinner" /><p>正在加载网站配置…</p></div>;
  const isLegacyMusicPage = location.pathname === '/luri-music' || location.search === '?luri-music=1';
  const isMusicPage = location.pathname === '/music';
  const isDocsPage = location.pathname === '/docs';
  if (isLegacyMusicPage) return <Navigate to="/music" replace />;
  if (musicConfig.musicOnly && !isMusicPage && !isDocsPage) return <Navigate to="/music" replace />;
  if (isMusicPage && !musicConfig.enabled) return <Navigate to="/" replace />;
  if (!musicConfig.aboutEnabled && location.pathname === '/about') return <Navigate to="/" replace />;
  return (
    <>
      <ScrollToTop />
      {(!isMusicPage || !musicConfig.musicOnly) && <Navbar musicPageEnabled={musicConfig.enabled} musicActive={isMusicPage} aboutPageEnabled={musicConfig.aboutEnabled} />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<PostDetail />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/music" element={null} />
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
      {musicConfig.enabled && <LuriMusic active={isMusicPage} accessRequired={musicConfig.accessRequired} standalone={isMusicPage && musicConfig.musicOnly} />}
      {musicConfig.enabled && <GlobalMusicCollapse />}
      {!isMusicPage && <Footer />}
    </>
  );
}
