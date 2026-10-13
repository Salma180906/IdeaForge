import { useEffect, useState, useCallback } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Compass, FolderKanban, PlusCircle, GitPullRequest, Heart, Bell, UserRound,
  Search, LogOut, Sun, Moon, ShieldCheck, WifiOff, Volume2, VolumeX, Bookmark,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useConsent } from '../context/ConsentContext';
import { useServerSlow, useBusy } from '../hooks';
import { api } from '../api/client';
import { Avatar, Wordmark, LogoMark } from './ui';
import CommandPalette from './CommandPalette';
import { sound } from '../utils/sound';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, auth: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/my-ideas', label: 'My ideas', icon: FolderKanban, auth: true },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark, auth: true },
  { to: '/contributions', label: 'Contributions', icon: GitPullRequest, auth: true },
  { to: '/following', label: 'Following', icon: Heart, auth: true },
  { to: '/notifications', label: 'Notifications', icon: Bell, auth: true },
];
const ACCOUNT = [
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/security', label: 'Security & privacy', icon: ShieldCheck },
];
const TABS = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/create', label: 'New', icon: PlusCircle },
  { to: '/notifications', label: 'Alerts', icon: Bell },
  { to: '/profile', label: 'Me', icon: UserRound },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { openPanel: openCookies } = useConsent();
  const slow = useServerSlow();
  const busy = useBusy();
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState({
    myIdeas: 0,
    bookmarks: 0,
    following: 0,
    notifications: 0,
    contributions: 0,
  });
  const [palette, setPalette] = useState(false);
  const [sfx, setSfx] = useState(sound.isEnabled());

  const refreshCounts = useCallback(() => {
    if (!user) return;
    api.get('/me/counts')
      .then((res) => {
        if (res) {
          setCounts({
            myIdeas: Number(res.myIdeas || 0),
            bookmarks: Number(res.bookmarks || 0),
            following: Number(res.following || 0),
            notifications: Number(res.notifications || 0),
            contributions: Number(res.contributions || 0),
          });
        }
      })
      .catch(() => {
        api.get('/me/notifications').then((rows) => {
          setCounts((prev) => ({
            ...prev,
            notifications: rows.filter((n) => !n.is_read).length,
          }));
        }).catch(() => {});
      });
  }, [user]);

  useEffect(() => {
    refreshCounts();
    const handleNavUpdate = () => refreshCounts();
    window.addEventListener('ideaforge:nav-update', handleNavUpdate);
    const interval = setInterval(refreshCounts, 15000);
    return () => {
      window.removeEventListener('ideaforge:nav-update', handleNavUpdate);
      clearInterval(interval);
    };
  }, [refreshCounts, location.pathname]);

  const openPalette = useCallback(() => setPalette(true), []);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Soft light & 3D perspective tilt that follows the pointer over cards.
  useEffect(() => {
    const move = (e) => {
      const card = e.target.closest?.('.slab, .pipe-card, .row-card, .kanban-card, .bento-bezel, .dash-hot');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const rx = ((y / r.height) - 0.5) * -6;
      const ry = ((x / r.width) - 0.5) * 6;
      card.style.setProperty('--mx', `${x}px`);
      card.style.setProperty('--my', `${y}px`);
      card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    };
    const leave = (e) => {
      const card = e.target.closest?.('.slab, .pipe-card, .row-card, .kanban-card, .bento-bezel, .dash-hot');
      if (!card) return;
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerout', leave, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerout', leave);
    };
  }, []);

  const links = NAV.filter((n) => !n.auth || user);
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

  return (
    <div className="shell">
      <a href="#content" className="skip-link">Skip to content</a>
      <div className={`loadbar ${busy ? 'on' : ''}`} aria-hidden="true" />
      <aside className="rail">
        <Link to="/" className="rail-brand" aria-label="IdeaForge home"><Wordmark /></Link>
        {user ? (
          <Link to="/create" className="btn btn-primary rail-new shimmer-sweep"><PlusCircle size={16} /> New idea</Link>
        ) : (
          <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
            <Link to="/login" className="btn btn-outline btn-block" onClick={() => sound.click()}>Log in</Link>
            <Link to="/register" className="btn btn-primary btn-block" onClick={() => sound.click()}>Sign up</Link>
          </div>
        )}
        <nav aria-label="Main">
          {links.map(({ to, label, icon: Icon }) => {
            let count = 0;
            if (label === 'Notifications') count = counts.notifications;
            else if (label === 'Bookmarks') count = counts.bookmarks;
            else if (label === 'Following') count = counts.following;
            else if (label === 'My ideas') count = counts.myIdeas;
            else if (label === 'Contributions') count = counts.contributions;

            return (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={17} aria-hidden="true" /> {label}
                {count > 0 && <span className="nav-count">{count}</span>}
              </NavLink>
            );
          })}
        </nav>
        {user && (
          <nav className="rail-account" aria-label="Account">
            {ACCOUNT.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={17} aria-hidden="true" /> {label}
              </NavLink>
            ))}
            <button className="nav-link" onClick={() => { logout(); navigate('/'); }}><LogOut size={17} aria-hidden="true" /> Log out</button>
          </nav>
        )}
        <div className="rail-status-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', margin: '12px 4px 6px', borderRadius: '6px', background: 'var(--surface-2)', fontSize: '11.5px', color: 'var(--ink-3)', border: '1px solid var(--line)' }}>
          <span className="pulse-beacon">
            <span className="beacon-ring" />
            <span className="beacon-core" />
          </span>
          <span>Atelier Lineage Active</span>
        </div>
        {(
          <div className="rail-legal small">
            <Link to="/privacy">Privacy</Link><button type="button" onClick={openCookies}>Cookies</button>
          </div>
        )}
      </aside>

      <div className="main">
        {slow && (
          <div className="slow-banner" role="status">
            <WifiOff size={15} aria-hidden="true" />
            The server is waking up after being idle. This can take up to a minute on the first visit.
          </div>
        )}
        <header className="topbar">
          <Link to="/" className="topbar-brand" aria-label="IdeaForge home"><LogoMark size={24} /></Link>
          <button className="search-trigger" onClick={openPalette} aria-label="Search and jump to">
            <Search size={15} aria-hidden="true" />
            <span>Search ideas or jump to a page</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <div className="topbar-right">
            <button
              className="icon-btn sfx-toggle"
              onClick={() => {
                const next = sound.toggle();
                setSfx(next);
              }}
              title={sfx ? 'Sound effects on (click to mute)' : 'Sound effects muted (click to enable)'}
              aria-label={sfx ? 'Disable sound effects' : 'Enable sound effects'}
            >
              {sfx ? <Volume2 size={17} /> : <VolumeX size={17} className="muted" />}
            </button>
            <button
              className="icon-btn theme-toggle"
              onClick={() => {
                sound.pop();
                toggle();
              }}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <>
                <Link to="/notifications" className="icon-btn bell" aria-label={`Notifications${counts.notifications ? `, ${counts.notifications} unread` : ''}`} onClick={() => sound.click()}>
                  <Bell size={18} />{counts.notifications > 0 && <span className="bell-dot" />}
                </Link>
                <Link to="/profile" className="user-chip" onClick={() => sound.click()}><Avatar name={user.name} size={28} /><span>{user.name.split(' ')[0]}</span></Link>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { sound.click(); logout(); navigate('/'); }}
                  title="Log out"
                >
                  <LogOut size={14} /> Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost" onClick={() => sound.click()}>Log in</Link>
                <Link to="/register" className="btn btn-primary" onClick={() => sound.click()}>Sign up</Link>
              </>
            )}
          </div>
        </header>
        <main className="page" id="content"><div className="page-enter" key={location.pathname}><Outlet /></div></main>
      </div>

      {user && (
        <nav className="tabbar" aria-label="Quick navigation">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
              <Icon size={20} aria-hidden="true" /><span>{label}</span>
              {label === 'Alerts' && counts.notifications > 0 && <i className="tab-dot" />}
            </NavLink>
          ))}
        </nav>
      )}
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}
