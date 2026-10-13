import { createContext, useContext, useEffect, useState } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useLocation } from 'react-router-dom';
import { useConsent } from './ConsentContext';
import { useReducedMotion } from '../hooks';

// Smooth, eased scrolling (Lenis). Can be switched off from Privacy & preferences.
const Ctx = createContext({ enabled: false, toggle: () => {} });
export const useSmooth = () => useContext(Ctx);

let current = null; // the active Lenis, so pages can ask it to scroll
export const smoothScrollTo = (target, opts) => (current ? current.scrollTo(target, opts) : window.scrollTo({ top: typeof target === 'number' ? target : 0, behavior: 'smooth' }));

export function SmoothScrollProvider({ children }) {
  const { canRemember } = useConsent();
  const reduced = useReducedMotion();
  const [on, setOn] = useState(() => { try { return localStorage.getItem('ideaforge_smooth') !== 'off'; } catch { return true; } });
  const enabled = on && !reduced;
  const { pathname } = useLocation();

  useEffect(() => {
    if (!enabled) return undefined;
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true });
    current = lenis;
    let raf;
    const loop = (time) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); current = null; };
  }, [enabled]);

  // A new page always starts at the top.
  useEffect(() => { if (current) current.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0); }, [pathname]);

  const toggle = () => {
    const next = !on;
    setOn(next);
    if (canRemember) { try { localStorage.setItem('ideaforge_smooth', next ? 'on' : 'off'); } catch { /* ignore */ } }
  };

  return <Ctx.Provider value={{ enabled: on, toggle, reduced }}>{children}</Ctx.Provider>;
}
