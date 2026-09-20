import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import GlobalMusicCollapse from './components/GlobalMusicCollapse';
import Home from './pages/Home';
import About from './pages/About';
import Blog from './pages/Blog';
import PostDetail from './pages/PostDetail';
import Music from './pages/Music';
import LuriMusic from './luri-music/LuriMusic';
import Admin from './luri-music/Admin';
import './luri-music/page-titles.css';

export default function App() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === '/admin' || location.search === '?admin=1') document.title = 'LURI ADMIN';
    else if (location.pathname === '/luri-music' || location.search === '?luri-music=1') document.title = 'LURI MUSIC';
    else document.title = 'LURI - 落墨留白';
  }, [location.pathname, location.search]);
  if (location.pathname === '/luri-music' || location.pathname === '/admin' || location.search === '?luri-music=1' || location.search === '?admin=1') return <Routes><Route path="*" element={location.search === '?admin=1' || location.pathname === '/admin' ? <Admin /> : <LuriMusic />} /></Routes>;
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<PostDetail />} />
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
      <Music />
      <GlobalMusicCollapse />
      <Footer />
    </>
  );
}
