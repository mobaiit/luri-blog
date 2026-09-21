import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const BASE_NAV_ITEMS = [
  { label: '首页', to: '/' },
  { label: '随笔', to: '/blog' },
  { label: '关于', to: '/about' },
];

export default function Navbar({ musicNavigationEnabled = true, musicActive = false, musicOnly = false, aboutPageEnabled = true }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // 监听滚动，给导航栏加底部分割线
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 路由切换时关闭移动菜单
  const closeMenu = () => setMenuOpen(false);

  const musicItem = { label: 'LURI MUSIC', to: '/music' };
  const navItems = musicOnly ? [musicItem] : [BASE_NAV_ITEMS[0], BASE_NAV_ITEMS[1], ...(musicNavigationEnabled ? [musicItem] : []), ...(aboutPageEnabled ? [BASE_NAV_ITEMS[2]] : [])];

  return (
    <header className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <div className="container navbar__inner">
        <NavLink to="/" className="navbar__logo" onClick={closeMenu}>
          <img src="/images/luri-logo.png" alt="LURI" className="navbar__logo-img" />
          落墨留白
        </NavLink>

        {/* 移动端汉堡按钮 */}
        <button
          className={`navbar__toggle${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        {/* 导航链接 */}
        <ul className={`navbar__links${menuOpen ? ' open' : ''}`}>
          {navItems.map(({ label, to }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) => ((musicActive ? to === '/music' : isActive) ? 'active' : '')}
                onClick={closeMenu}
                end={to === '/'}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
