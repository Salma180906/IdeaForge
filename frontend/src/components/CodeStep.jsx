import { useEffect, useState } from 'react';
import { MailCheck, Smartphone, ArrowLeft } from 'lucide-react';
import OtpInput from './OtpInput';
import { ErrorBox } from './ui';
import { sound } from '../utils/sound';

export default function CodeStep({
  title,
  email,
  onSubmit,
  onResend,
  onBack,
  submitLabel = 'Confirm code',
  method = 'email',
}) {
  const [code, setCode] = useState('');
  const [backupMode, setBackupMode] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [wait, setWait] = useState(method === 'app' ? 0 : 60);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (value) => {
    if (busy) return;
    sound.click();
    setBusy(true);
    setError('');
    try {
      await onSubmit(value);
      sound.success();
    } catch (e) {
      setError(e.message);
      setCode('');
      setShake((n) => n + 1);
      setBusy(false);
    }
  };

  const resend = async () => {
    sound.pop();
    setError('');
    setResent(false);
    try {
      await onResend();
      setResent(true);
      setWait(60);
      sound.success();
    } catch (e) {
      setError(e.message);
    }
  };

  const Icon = method === 'app' ? Smartphone : MailCheck;

  return (
    <div className="code-step">
      <div className="code-icon"><Icon size={26} aria-hidden="true" /></div>
      <h2>{title}</h2>
      {method === 'app' ? (
        <p className="muted">
          {backupMode
            ? 'Type one of the backup codes you saved when you set up your authenticator app. Each works once.'
            : 'Open your authenticator app and type the 6-digit code shown for IdeaForge. It changes every 30 seconds.'}
        </p>
      ) : (
        <p className="muted">We sent a 6-digit code to <b>{email}</b>. It works for 10 minutes.</p>
      )}

      {error && <ErrorBox message={error} />}

      {backupMode ? (
        <form onSubmit={(e) => { e.preventDefault(); submit(backupText.trim()); }} className="backup-form">
          <input
            value={backupText}
            onChange={(e) => setBackupText(e.target.value)}
            placeholder="xxxxx-xxxxx"
            maxLength={11}
            autoFocus
            aria-label="Backup code"
            autoComplete="off"
            spellCheck="false"
          />
          <button className="btn btn-primary btn-block" disabled={busy || backupText.trim().length < 11}>
            {busy ? 'Checking...' : submitLabel}
          </button>
        </form>
      ) : (
        <>
          <OtpInput value={code} onChange={setCode} onComplete={submit} shake={shake} disabled={busy} />
          <button
            className="btn btn-primary btn-block"
            disabled={busy || code.length !== 6}
            onClick={() => submit(code)}
          >
            {busy ? 'Checking...' : submitLabel}
          </button>
        </>
      )}

      <div className="code-foot">
        {method === 'app' ? (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              sound.pop();
              setBackupMode(!backupMode);
              setError('');
            }}
          >
            {backupMode ? 'Use the app code instead' : 'Use a backup code instead'}
          </button>
        ) : (
          <>
            {wait > 0 ? (
              <span className="muted small">Send a new code in {wait}s</span>
            ) : (
              <button type="button" className="link-btn" onClick={resend}>
                Send a new code
              </button>
            )}
            {resent && <span className="small code-sent">New code sent</span>}
          </>
        )}
      </div>

      {onBack && (
        <button
          type="button"
          className="link-btn code-back"
          onClick={() => {
            sound.click();
            onBack();
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back
        </button>
      )}
    </div>
  );
}
