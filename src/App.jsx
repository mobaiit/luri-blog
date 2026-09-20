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
      if (active) setMusicConfig({ enabled: data.musicPageEnabled !== false, accessRequired: data.musicAccessRequired !== false });
    }).catch(() => { if (active) setMusicConfig({ enabled: true, accessRequired: true }); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (location.pathname === '/admin' || location.search === '?admin=1') document.title = 'LURI ADMIN';
    else if (location.pathname === '/luri-music' || location.search === '?luri-music=1') document.title = 'LURI MUSIC';
    else document.title = 'LURI - 落墨留白';
  }, [location.pathname, location.search]);
  if (location.pathname === '/admin' || location.search === '?admin=1') return <Routes><Route path="*" element={<Admin />} /></Routes>;
  if (musicConfig === null) return <div className="ui-loading-screen"><span className="ui-spinner" /><p>正在加载网站配置…</p></div>;
  if (location.pathname === '/luri-music' || location.search === '?luri-music=1') return musicConfig.enabled ? <Routes><Route path="*" element={<LuriMusic accessRequired={musicConfig.accessRequired} />} /></Routes> : <Navigate to="/" replace />;
  return (
    <>
      <ScrollToTop />
      <Navbar musicPageEnabled={musicConfig.enabled} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<PostDetail />} />
        <Route path="/music" element={<Navigate to={musicConfig.enabled ? '/luri-music' : '/'} replace />} />
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
