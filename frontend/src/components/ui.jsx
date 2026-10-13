import { useEffect, useRef, useState } from 'react';
import { X, Lightbulb, Eye, EyeOff, Check } from 'lucide-react';
import { CountNumber } from './Motion';
import { STAGES, stageIndex, stageLabel, heatVar, heatForStage, heatForVersion } from '../utils';

// ---- Brand ----
export function LogoMark({ size = 26 }) {
  const heights = [8, 12, 16, 20, 25];
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      {heights.map((h, i) => (
        <rect key={i} x={1 + i * 5.5} y={27 - h} width="4" height={h} rx="1.2" fill={`var(--h${i + 1})`} />
      ))}
    </svg>
  );
}

export function Wordmark() {
  return <span className="wordmark"><LogoMark /><span>IdeaForge</span></span>;
}

// ---- People ----
const AVATAR_TONES = ['#4B3FD1', '#C93D12', '#0B7A6B', '#A83266', '#2766C9', '#8A5A00'];
export function Avatar({ name = '?', size = 36 }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const tone = AVATAR_TONES[name.length % AVATAR_TONES.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: tone, fontSize: Math.max(10, size * 0.38) }} aria-hidden="true">
      {initials}
    </span>
  );
}

// ---- Heat language ----
export function StagePill({ stage }) {
  return <span className="stage-pill"><i style={{ background: heatForStage(stage) }} />{stageLabel(stage)}</span>;
}

// One tick per version, colored by how hot that version is. Cold on the left, hot on the right.
export function ThermalStrip({ version, size = 'md' }) {
  const total = Math.max(5, Math.min(version, 8));
  return (
    <span className={`thermal thermal-${size}`} role="img" aria-label={`${version} version${version > 1 ? 's' : ''}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} style={{ '--i': i, background: i < version ? heatForVersion(i + 1) : undefined }} className={i < version ? 'on' : ''} />
      ))}
    </span>
  );
}

// The five stages as one bar. Everything up to the current stage is lit.
export function StageLadder({ stage }) {
  const current = stageIndex(stage);
  return (
    <ol className="ladder" aria-label={`Stage: ${stageLabel(stage)}`}>
      {STAGES.map((s, i) => (
        <li key={s} className={`ladder-step ${i <= current ? 'lit' : ''} ${i === current ? 'now' : ''}`}>
          <span className="ladder-bar" style={{ background: i <= current ? heatVar(i) : undefined }} />
          <span className="ladder-name">{stageLabel(s)}</span>
        </li>
      ))}
    </ol>
  );
}

export function ProgressRing({ value, size = 132, label = 'evolved' }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(value), 60); return () => clearTimeout(t); }, [value]);
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${value} percent evolved`}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <defs>
          <linearGradient id="ringHeat" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--h1)" />
            <stop offset="0.45" stopColor="var(--h3)" />
            <stop offset="1" stopColor="var(--h5)" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} className="ring-track" />
        <circle cx="60" cy="60" r={r} className="ring-value" stroke="url(#ringHeat)"
          strokeDasharray={c} strokeDashoffset={c - (c * shown) / 100} transform="rotate(-90 60 60)" />
      </svg>
      <div className="ring-text"><b>{value}<small>%</small></b><span>{label}</span></div>
    </div>
  );
}

export function StatLedger({ items }) {
  return (
    <dl className="ledger">
      {items.map((it) => (
        <div key={it.label}><dd><CountNumber value={it.value} /></dd><dt>{it.label}</dt></div>
      ))}
    </dl>
  );
}

// ---- Controls ----
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([val, text]) => (
        <button key={val} type="button" className={value === val ? 'on' : ''} aria-pressed={value === val} onClick={() => onChange(val)}>{text}</button>
      ))}
    </div>
  );
}

// ---- Password field with a strength meter (rules match the server exactly) ----
export function passwordProblems(pw) {
  return {
    length: pw.length >= 8,
    letter: /[A-Za-z]/.test(pw),
    number: /\d/.test(pw),
  };
}
function strengthScore(pw) {
  if (!pw) return 0;
  const p = passwordProblems(pw);
  if (!(p.length && p.letter && p.number)) return 1;
  let score = 2;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  return Math.min(score, 4);
}
const STRENGTH_NAMES = ['', 'Too weak', 'Okay', 'Good', 'Strong'];

export function PasswordField({ id, label, value, onChange, showMeter = false, autoComplete = 'current-password', hint }) {
  const [visible, setVisible] = useState(false);
  const score = strengthScore(value);
  const rules = passwordProblems(value);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete} maxLength={72} required />
        <button type="button" className="input-eye" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && <span className="hint">{hint}</span>}
      {showMeter && (
        <div className="pw-meter">
          <div className="pw-bars" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => <i key={n} style={{ background: n <= score ? heatVar(n - 1) : undefined }} />)}
          </div>
          <span className="pw-name">{value ? STRENGTH_NAMES[score] : ''}</span>
          <ul className="pw-rules">
            {[['length', '8 or more characters'], ['letter', 'A letter'], ['number', 'A number']].map(([k, t]) => (
              <li key={k} className={rules[k] ? 'ok' : ''}><Check size={12} aria-hidden="true" /> {t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- States ----
export function EmptyState({ title, text, action }) {
  return (
    <div className="empty">
      <Lightbulb size={26} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export const ErrorBox = ({ message }) => <div className="error-box" role="alert">{message}</div>;
export const Spinner = () => <div className="spinner-wrap" role="status" aria-label="Loading"><div className="spinner" /></div>;

export function SlabSkeletons({ count = 4 }) {
  return (
    <div className="grid grid-slabs" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="slab skeleton-slab">
          <div className="sk sk-strip" /><div className="sk sk-line w60" /><div className="sk sk-title" />
          <div className="sk sk-line" /><div className="sk sk-line w80" /><div className="sk sk-line w40" />
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  const box = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const first = box.current?.querySelector('select, input, textarea, button:not(.icon-btn)');
    first?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);

  return (
    <div className="modal-backdrop" data-lenis-prevent onMouseDown={onClose}>
      <div className="modal" ref={box} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
