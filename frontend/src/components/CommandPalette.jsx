import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, CornerDownLeft, LayoutDashboard, Compass, FolderKanban, PlusCircle,
  GitPullRequest, Heart, Bell, UserRound, ShieldCheck, Lightbulb, Sun, Moon, Volume2, Sparkles
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { sound } from '../utils/sound';

const PAGES = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, auth: true },
  { label: 'Explore ideas', to: '/explore', icon: Compass },
  { label: 'My ideas', to: '/my-ideas', icon: FolderKanban, auth: true },
  { label: 'Create a new idea', to: '/create', icon: PlusCircle, auth: true },
  { label: 'Contributions', to: '/contributions', icon: GitPullRequest, auth: true },
  { label: 'Following', to: '/following', icon: Heart, auth: true },
  { label: 'Notifications', to: '/notifications', icon: Bell, auth: true },
  { label: 'Profile', to: '/profile', icon: UserRound, auth: true },
  { label: 'Security & privacy', to: '/security', icon: ShieldCheck, auth: true },
];

export default function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [q, setQ] = useState('');
  const [ideas, setIdeas] = useState([]);
  const [active, setActive] = useState(0);
  const input = useRef(null);

  useEffect(() => {
    input.current?.focus();
    sound.pop();
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setIdeas([]);
      return undefined;
    }
    const t = setTimeout(() => {
      api.get(`/ideas?search=${encodeURIComponent(term)}`)
        .then((r) => setIdeas(r.slice(0, 5)))
        .catch(() => setIdeas([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();

    // System commands
    const actions = [
      {
        key: 'action-theme',
        label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`,
        icon: theme === 'dark' ? Sun : Moon,
        group: 'Quick Actions',
        run: () => {
          sound.pop();
          toggleTheme();
          onClose();
        },
      },
      {
        key: 'action-sound',
        label: `Toggle sound effects (${sound.isEnabled() ? 'Mute' : 'Enable'})`,
        icon: Volume2,
        group: 'Quick Actions',
        run: () => {
          sound.toggle();
          onClose();
        },
      },
      {
        key: 'action-oauth',
        label: 'Open OAuth Sandbox & Fast Pass',
        icon: Sparkles,
        to: '/oauth/sandbox',
        group: 'Quick Actions',
      },
    ].filter((a) => a.label.toLowerCase().includes(term));

    const pages = PAGES.filter((p) => (!p.auth || user) && p.label.toLowerCase().includes(term))
      .map((p) => ({ key: p.to, label: p.label, to: p.to, icon: p.icon, group: 'Navigation' }));

    const found = ideas.map((i) => ({
      key: `i${i.id}`,
      label: i.title,
      to: `/ideas/${i.id}`,
      icon: Lightbulb,
      group: 'Ideas Found',
    }));

    const all = [...actions, ...pages, ...found];
    if (term.length >= 2) {
      all.push({
        key: 'search-all',
        label: `Search all ideas for "${q.trim()}"`,
        to: `/explore?search=${encodeURIComponent(q.trim())}`,
        icon: Search,
        group: 'Search',
      });
    }
    return all;
  }, [q, ideas, user, theme, toggleTheme, onClose]);

  useEffect(() => setActive(0), [q]);

  const go = (item) => {
    if (!item) return;
    sound.click();
    if (item.run) {
      item.run();
    } else if (item.to) {
      navigate(item.to);
      onClose();
    }
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      sound.click();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      go(items[active]);
    }
  };

  let lastGroup = '';

  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette and search"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="palette-input">
          <Search size={18} aria-hidden="true" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a command, search ideas, or jump to page..."
            aria-label="Command search"
            maxLength={100}
          />
          <kbd className="palette-esc" onClick={onClose}>ESC</kbd>
        </div>

        <ul className="palette-list" data-lenis-prevent>
          {items.length === 0 && (
            <li className="palette-empty">No matching commands or ideas found.</li>
          )}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            const Icon = it.icon;
            return (
              <li key={it.key}>
                {head && <div className="palette-group">{head}</div>}
                <button
                  type="button"
                  className={`palette-item ${i === active ? 'active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{it.label}</span>
                  {i === active && <CornerDownLeft size={13} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="palette-footer">
          <span>Navigate with <kbd>↑</kbd> <kbd>↓</kbd></span>
          <span>Select with <kbd>↵</kbd></span>
        </div>
      </div>
    </div>
  );
}
