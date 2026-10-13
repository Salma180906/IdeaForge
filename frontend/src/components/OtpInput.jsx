import { useEffect, useRef } from 'react';

// Six boxes for a one-time code. Handles typing, backspace, arrow keys and pasting the whole code.
export default function OtpInput({ value, onChange, onComplete, shake, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  useEffect(() => { refs.current[0]?.focus(); }, []);
  useEffect(() => { if (shake) refs.current[0]?.focus(); }, [shake]);

  const set = (next) => {
    const clean = next.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
    return clean;
  };
  const onInput = (i, e) => {
    const typed = e.target.value.replace(/\D/g, '');
    if (!typed) return;
    const clean = set(value.slice(0, i) + typed + value.slice(i + 1));
    refs.current[Math.min(i + typed.length, 5)]?.focus();
    return clean;
  };
  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) set(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) { set(value.slice(0, i - 1) + value.slice(i)); refs.current[i - 1]?.focus(); }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };
  const onPaste = (e) => {
    e.preventDefault();
    const clean = set(e.clipboardData.getData('text'));
    refs.current[Math.min(clean.length, 5)]?.focus();
  };

  return (
    <div className={`otp ${shake ? 'shake' : ''}`} key={shake || 0} role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} className={d ? 'filled' : ''} value={d}
          inputMode="numeric" pattern="[0-9]*" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={6}
          aria-label={`Digit ${i + 1}`} disabled={disabled}
          onChange={(e) => onInput(i, e)} onKeyDown={(e) => onKeyDown(i, e)} onPaste={onPaste} onFocus={(e) => e.target.select()} />
      ))}
    </div>
  );
}
