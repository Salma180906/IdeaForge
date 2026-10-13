import { useRef, useMemo } from 'react';
import { useCountUp, useInView, useReducedMotion } from '../hooks';

// Fades and lifts its children in when they scroll into view.
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);
  const seen = useInView(ref);
  return (
    <Tag ref={ref} className={`reveal ${seen ? 'in' : ''} ${className}`} style={{ '--d': `${delay}ms` }}>
      {children}
    </Tag>
  );
}

export function CountNumber({ value }) {
  return <>{useCountUp(Number(value) || 0)}</>;
}

// Sparks that fly up from where it is placed. Change `burst` (any new number) to set it off.
export function Embers({ burst, count = 18, hue = 'heat' }) {
  const reduced = useReducedMotion();
  const sparks = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: (Math.random() - 0.5) * 220,
    y: -(60 + Math.random() * 120),
    size: 3 + Math.random() * 5,
    delay: Math.random() * 120,
    color: `var(--h${(i % 4) + 2})`,
  })), [burst, count]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!burst || reduced) return null;
  return (
    <span className={`embers embers-${hue}`} key={burst} aria-hidden="true">
      {sparks.map((s, i) => (
        <i key={i} style={{ '--x': `${s.x}px`, '--y': `${s.y}px`, width: s.size, height: s.size, background: s.color, animationDelay: `${s.delay}ms` }} />
      ))}
    </span>
  );
}
