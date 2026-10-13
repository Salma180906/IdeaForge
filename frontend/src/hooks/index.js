import { useEffect, useState } from 'react';
import { subscribeSlow, subscribeBusy } from '../api/status';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | IdeaForge` : 'IdeaForge';
  }, [title]);
}

// True while any request has been waiting for more than 4 seconds.
export function useServerSlow() {
  const [slow, setSlow] = useState(false);
  useEffect(() => subscribeSlow(setSlow), []);
  return slow;
}

export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

// True while any request is in flight (shown as the loading bar).
export function useBusy() {
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeBusy(setBusy), []);
  return busy;
}

// Counts up from 0 to `value` once. Skips the animation for people who asked for less motion.
export function useCountUp(value, duration = 900) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setN(value); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setN(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);
  return n;
}

// True once the element has scrolled into view (and stays true).
export function useInView(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    if (!('IntersectionObserver' in window)) { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}
