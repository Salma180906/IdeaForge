import { createContext, useContext, useState } from 'react';
import { useConsent } from './ConsentContext';

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const { canRemember } = useConsent();
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');

  const apply = (next) => {
    document.documentElement.setAttribute('data-theme', next);
    // Only remembered between visits if you allowed preference cookies.
    if (canRemember) { try { localStorage.setItem('ideaforge_theme', next); } catch { /* private mode */ } }
    setTheme(next);
  };

  // The new theme grows out of the button like a lit fuse, using the browser's View Transitions when it has them.
  const toggle = (event) => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduced) { apply(next); return; }
    const r = event?.currentTarget?.getBoundingClientRect?.();
    const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const y = r ? r.top + r.height / 2 : 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const t = document.startViewTransition(() => apply(next));
    t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
  };

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
