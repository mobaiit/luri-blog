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
import { fetchSiteConfig, readSiteConfig, writeSiteConfig } from './luri-music/siteConfig';
import './luri-music/page-titles.css';

export default function App() {
  const location = useLocation();
  const isAdminEntry = location.pathname === '/admin' || location.search === '?admin=1';
  const [musicConfig, setMusicConfig] = useState(() => initialSiteConfig(location.pathname, readSiteConfig()));
  useEffect(() => {
    if (isAdminEntry) return undefined;
    let active = true;
    fetchSiteConfig().then((data) => {
      if (active) setMusicConfig(writeSiteConfig(data));
    }).catch(() => {});
    return () => { active = false; };
  }, [isAdminEntry]);
  useEffect(() => {
    if (location.pathname === '/admin' || location.search === '?admin=1') document.title = 'LURI ADMIN';
    else if (location.pathname === '/docs') document.title = 'LURI MUSIC 文档';
    else if (location.pathname === '/music' || location.pathname === '/luri-music' || location.search === '?luri-music=1') document.title = 'LURI MUSIC';
    else document.title = 'LURI - 落墨留白';
  }, [location.pathname, location.search]);
  if (isAdminEntry) return <Routes><Route path="*" element={<Admin />} /></Routes>;
  const isLegacyMusicPage = location.pathname === '/luri-music' || location.search === '?luri-music=1';
  const isMusicPage = location.pathname === '/music';
  const isDocsPage = location.pathname === '/docs';
  const isBlogPage = location.pathname === '/' || location.pathname === '/about' || location.pathname === '/blog' || location.pathname.startsWith('/blog/');
  const showBlogNavbar = musicConfig.blogEnabled && (!isMusicPage || musicConfig.blogNavigationEnabled);
  if (isLegacyMusicPage) return <Navigate to="/music" replace />;
  if (!musicConfig.blogEnabled && isBlogPage) return musicConfig.enabled ? <Navigate to="/music" replace /> : <Routes><Route path="*" element={<main className="ui-loading-screen"><p>页面暂不可用</p></main>} /></Routes>;
  if (!musicConfig.postsEnabled && (location.pathname === '/blog' || location.pathname.startsWith('/blog/'))) return <Navigate to="/" replace />;
  if (isMusicPage && !musicConfig.enabled) return <Navigate to="/" replace />;
  if (isDocsPage && !musicConfig.docsEnabled) return <Navigate to="/" replace />;
  if (!musicConfig.aboutEnabled && location.pathname === '/about') return <Navigate to="/" replace />;
  return (
    <>
      <ScrollToTop />
      {!isDocsPage && showBlogNavbar && <Navbar musicNavigationEnabled={musicConfig.enabled && musicConfig.navigationEnabled} musicActive={isMusicPage} postsPageEnabled={musicConfig.postsEnabled} aboutPageEnabled={musicConfig.aboutEnabled} />}
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
      {musicConfig.enabled && !isDocsPage && <LuriMusic active={isMusicPage} accessRequired={musicConfig.accessRequired} standalone={isMusicPage && !showBlogNavbar} docsEnabled={musicConfig.docsEnabled} />}
      {musicConfig.enabled && !isDocsPage && <GlobalMusicCollapse />}
      {musicConfig.blogEnabled && !isMusicPage && <Footer />}
    </>
  );
}

function initialSiteConfig(pathname, cached) {
  const music = pathname === '/music' || pathname === '/luri-music';
  const docs = pathname === '/docs';
  const blog = pathname === '/' || pathname === '/about' || pathname === '/blog' || pathname.startsWith('/blog/');
  const config = cached || {
    blogEnabled: !music && !docs,
    postsEnabled: true,
    enabled: music,
    navigationEnabled: false,
    blogNavigationEnabled: false,
    accessRequired: true,
    aboutEnabled: true,
    docsEnabled: docs,
  };
  return {
    ...config,
    blogEnabled: blog || config.blogEnabled,
    postsEnabled: pathname.startsWith('/blog') || config.postsEnabled,
    enabled: music || config.enabled,
    aboutEnabled: pathname === '/about' || config.aboutEnabled,
    docsEnabled: docs || config.docsEnabled,
  };
}
