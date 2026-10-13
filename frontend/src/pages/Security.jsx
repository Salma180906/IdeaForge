import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  KeyRound, Gauge, Timer, Lock, ShieldCheck, EyeOff, MailCheck, LogOut, ShieldAlert, CheckCircle2, MonitorSmartphone,
  Smartphone, Download, Trash2, Cookie, MoveVertical, Copy, Link2,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConsent } from '../context/ConsentContext';
import { useSmooth } from '../context/SmoothScroll';
import { useDocumentTitle } from '../hooks';
import { ErrorBox, PasswordField, passwordProblems, Modal, Spinner } from '../components/ui';
import { timeAgo } from '../utils';

const PROTECTIONS = [
  { icon: KeyRound, title: 'Passwords are hashed', text: 'Stored with bcrypt, so even the database owner cannot read them.' },
  { icon: Gauge, title: 'Brute force is slowed down', text: 'After 10 wrong attempts for one account, logging in is paused for 15 minutes.' },
  { icon: MailCheck, title: 'One-time codes', text: 'Codes work once, expire in 10 minutes and lock after 5 wrong tries.' },
  { icon: Timer, title: 'Sessions expire', text: 'A login lasts 12 hours at most, and ends after 30 minutes of no activity.' },
  { icon: Lock, title: 'Drafts stay private', text: 'The server checks ownership on every request, not just in the interface.' },
  { icon: ShieldCheck, title: 'Input is checked', text: 'Every field has a length limit and is validated before it reaches the database.' },
  { icon: EyeOff, title: 'No hints for attackers', text: 'A wrong email and a wrong password give the same answer.' },
];

const EVENT = {
  login: ['Signed in', 'ok'], login_google: ['Signed in with Google', 'ok'], login_github: ['Signed in with GitHub', 'ok'],
  login_failed: ['Wrong password entered', 'bad'], login_code_failed: ['Wrong login code entered', 'bad'],
  password_changed: ['Password changed', 'ok'], password_set: ['Password added', 'ok'], password_reset: ['Password reset by email code', 'ok'],
  two_factor_on: ['2-step login by email turned on', 'ok'], two_factor_off: ['2-step login by email turned off', 'warn'],
  totp_on: ['Authenticator app turned on', 'ok'], totp_off: ['Authenticator app turned off', 'warn'], backup_code_used: ['A backup code was used', 'warn'],
  sessions_revoked: ['Signed out other devices', 'ok'], email_verified: ['Email confirmed', 'ok'],
  linked_google: ['Google account linked', 'ok'], linked_github: ['GitHub account linked', 'ok'],
};

function device(agent = '') {
  const os = /Windows/.test(agent) ? 'Windows' : /iPhone|iPad/.test(agent) ? 'iPhone' : /Android/.test(agent) ? 'Android' : /Mac OS/.test(agent) ? 'Mac' : /Linux/.test(agent) ? 'Linux' : '';
  const br = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : '';
  return [br, os].filter(Boolean).join(' on ') || 'Unknown device';
}

const TITLES = {
  twofa: 'Confirm it is you', others: 'Sign out other devices', totpStart: 'Set up an authenticator app',
  totpOff: 'Turn off the authenticator app', delete: 'Delete your account',
};

export default function Security() {
  useDocumentTitle('Security & privacy');
  const { user, replaceToken, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { openPanel, choice } = useConsent();
  const smooth = useSmooth();
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ current: '', next: '', again: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [ask, setAsk] = useState(null);
  const [askPw, setAskPw] = useState('');
  const [askCode, setAskCode] = useState('');
  const [askError, setAskError] = useState('');
  const [setup, setSetup] = useState(null);     // { qr, secret }
  const [setupCode, setSetupCode] = useState('');
  const [backups, setBackups] = useState(null);

  const load = () => api.get('/auth/security').then(setInfo).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changePassword = async (e) => {
    e.preventDefault();
    setError('');
    const p = passwordProblems(form.next);
    if (!(p.length && p.letter && p.number)) { setError('The new password needs at least 8 characters, a letter and a number.'); return; }
    if (form.next !== form.again) { setError('The two new passwords do not match.'); return; }
    setBusy(true);
    try {
      const r = await api.put('/auth/password', { currentPassword: form.current, newPassword: form.next });
      replaceToken(r.token);
      setForm({ current: '', next: '', again: '' });
      toast.success(info.hasPassword ? 'Password changed. Other devices were signed out.' : 'Password added. You can now log in with it too.');
      load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const closeAsk = () => { setAsk(null); setAskPw(''); setAskCode(''); setAskError(''); setSetup(null); setSetupCode(''); setBackups(null); };
  // Password for normal accounts, typed email for accounts made with Google / GitHub.
  const proof = () => (info.hasPassword ? { password: askPw } : { confirmEmail: askPw });

  const confirmAsk = async (e) => {
    e.preventDefault();
    setAskError('');
    try {
      if (ask === 'twofa') {
        const r = await api.put('/auth/2fa', { enabled: !info.twoFactor, ...proof() });
        toast.success(r.twoFactor ? '2-step login by email is on.' : '2-step login by email is off.');
        closeAsk();
      } else if (ask === 'others') {
        const r = await api.post('/auth/logout-others', proof());
        replaceToken(r.token);
        toast.success('All other devices were signed out.');
        closeAsk();
      } else if (ask === 'totpStart') {
        if (!setup) { setSetup(await api.post('/auth/totp/setup', proof())); return; }
        const r = await api.post('/auth/totp/enable', { code: setupCode });
        setBackups(r.backupCodes);
        toast.success('Authenticator app is on.');
      } else if (ask === 'totpOff') {
        await api.post('/auth/totp/disable', { ...proof(), code: askCode });
        toast.success('Authenticator app turned off.');
        closeAsk();
      } else if (ask === 'delete') {
        await api.delete('/me/account', proof());
        logout();
        toast.success('Your account was deleted.');
        navigate('/');
        return;
      }
      load();
    } catch (err) { setAskError(err.message); }
  };

  const download = async () => {
    try {
      const data = await api.get('/me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'ideaforge-my-data.json'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Your data was downloaded.');
    } catch (e) { toast.error(e.message); }
  };

  const copyBackups = () => navigator.clipboard?.writeText(backups.join('\n')).then(() => toast.success('Backup codes copied.')).catch(() => {});

  if (!info) return <Spinner />;
  const twoFactorEmail = info.twoFactor;
  const proofField = info.hasPassword
    ? <PasswordField id="ask-pw" label="Your password" value={askPw} onChange={setAskPw} />
    : <div className="field"><label htmlFor="ask-pw">Type your email address to confirm</label><input id="ask-pw" value={askPw} onChange={(e) => setAskPw(e.target.value)} placeholder={user.email} autoComplete="off" /></div>;

  return (
    <div>
      <div className="page-head"><div><h1>Security &amp; privacy</h1><p>Signed in as {user.email}. Control how your account is protected and what we keep.</p></div></div>
      <div className="two-col sec-cols">
        <div className="stack">
          <section className="panel">
            <h2 className="panel-title">{info.hasPassword ? 'Change password' : 'Add a password'}</h2>
            {!info.hasPassword && <p className="muted small" style={{ marginBottom: 12 }}>You signed up with Google or GitHub, so this account has no password yet. Adding one lets you log in by email too.</p>}
            {error && <ErrorBox message={error} />}
            <form onSubmit={changePassword}>
              {info.hasPassword && <PasswordField id="sec-cur" label="Current password" value={form.current} onChange={(v) => setForm({ ...form, current: v })} />}
              <PasswordField id="sec-new" label="New password" showMeter autoComplete="new-password" value={form.next} onChange={(v) => setForm({ ...form, next: v })} />
              <PasswordField id="sec-again" label="New password again" autoComplete="new-password" value={form.again} onChange={(v) => setForm({ ...form, again: v })} />
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : info.hasPassword ? 'Change password' : 'Add password'}</button>
            </form>
          </section>

          <section className="panel">
            <h2 className="panel-title">Login protection</h2>
            <div className="sec-row">
              <div className={`sec-icon ${info.totp ? 'on' : ''}`}><Smartphone size={20} aria-hidden="true" /></div>
              <div className="sec-text">
                <b>Authenticator app {info.totp && <span className="kind kind-accepted">On</span>}</b>
                <p className="muted small">Use Google Authenticator, Authy or Microsoft Authenticator. A new code every 30 seconds, no email needed.{info.totp && ` ${info.backupLeft} backup codes left.`}</p>
              </div>
              <button className={`btn btn-sm ${info.totp ? 'btn-outline' : 'btn-primary'}`} onClick={() => setAsk(info.totp ? 'totpOff' : 'totpStart')}>{info.totp ? 'Turn off' : 'Set up'}</button>
            </div>
            <div className="sec-row">
              <div className={`sec-icon ${twoFactorEmail ? 'on' : ''}`}><ShieldCheck size={20} aria-hidden="true" /></div>
              <div className="sec-text">
                <b>Code by email {twoFactorEmail && <span className="kind kind-accepted">On</span>}</b>
                <p className="muted small">After your password, we email a code that you type in.</p>
                {info.totp && <p className="small muted">Not needed while the authenticator app is on.</p>}
                {!info.mailConfigured && <p className="small sec-warn">Email is not set up on this server, so this is unavailable.</p>}
              </div>
              <button className={`btn btn-sm ${twoFactorEmail ? 'btn-outline' : 'btn-primary'}`} disabled={!info.mailConfigured || (info.totp && !twoFactorEmail)} onClick={() => setAsk('twofa')}>
                {twoFactorEmail ? 'Turn off' : 'Turn on'}
              </button>
            </div>
            <div className="sec-row">
              <div className="sec-icon"><MonitorSmartphone size={20} aria-hidden="true" /></div>
              <div className="sec-text"><b>Other devices</b><p className="muted small">Lost a phone or used a shared computer? Sign out everywhere except here.</p></div>
              <button className="btn btn-sm btn-outline" onClick={() => setAsk('others')}><LogOut size={14} /> Sign out others</button>
            </div>
            <div className="sec-row">
              <div className={`sec-icon ${info.emailVerified ? 'on' : ''}`}><MailCheck size={20} aria-hidden="true" /></div>
              <div className="sec-text"><b>Email {info.emailVerified ? 'confirmed' : 'not confirmed'}</b><p className="muted small">Codes for password reset are sent to {user.email}.</p></div>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">Connected accounts</h2>
            {[['google', 'Google'], ['github', 'GitHub']].map(([k, label]) => (
              <div className="sec-row" key={k}>
                <div className={`sec-icon ${info.providers[k] ? 'on' : ''}`}><Link2 size={20} aria-hidden="true" /></div>
                <div className="sec-text"><b>{label}</b><p className="muted small">{info.providers[k] ? `You can sign in with ${label}.` : `Sign in once with ${label} using the same email (${user.email}) to link it.`}</p></div>
                {info.providers[k] && <span className="kind kind-accepted">Linked</span>}
              </div>
            ))}
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <h2 className="panel-title">Privacy &amp; preferences</h2>
            <div className="sec-row">
              <div className="sec-icon"><Cookie size={20} aria-hidden="true" /></div>
              <div className="sec-text"><b>Cookies</b><p className="muted small">{choice?.preferences ? 'Preferences are remembered on this device.' : 'Only necessary storage is used.'} <Link to="/privacy">Read the privacy page</Link>.</p></div>
              <button className="btn btn-sm btn-outline" onClick={openPanel}>Change</button>
            </div>
            <div className="sec-row">
              <div className={`sec-icon ${smooth.enabled ? 'on' : ''}`}><MoveVertical size={20} aria-hidden="true" /></div>
              <div className="sec-text"><b>Smooth scrolling</b><p className="muted small">{smooth.reduced ? 'Your device asks for less motion, so this stays off.' : 'Eased, gliding page scroll.'}</p></div>
              <button type="button" role="switch" aria-checked={smooth.enabled} aria-label="Smooth scrolling" className={`switch ${smooth.enabled ? 'on' : ''}`} onClick={smooth.toggle} disabled={smooth.reduced}><i /></button>
            </div>
            <div className="sec-row">
              <div className="sec-icon"><Download size={20} aria-hidden="true" /></div>
              <div className="sec-text"><b>Download my data</b><p className="muted small">Your profile, ideas, versions, comments and security activity as one file.</p></div>
              <button className="btn btn-sm btn-outline" onClick={download}>Download</button>
            </div>
            <div className="sec-row sec-danger">
              <div className="sec-icon"><Trash2 size={20} aria-hidden="true" /></div>
              <div className="sec-text"><b>Delete my account</b><p className="muted small">Removes your account, ideas, versions, comments and votes for good.</p></div>
              <button className="btn btn-sm btn-danger" onClick={() => setAsk('delete')}>Delete</button>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">Recent activity</h2>
            {info.events.length === 0 && <p className="muted">Nothing recorded yet.</p>}
            <ul className="activity">
              {info.events.map((ev) => {
                const [label, tone] = EVENT[ev.type] || [ev.type, 'ok'];
                const Icon = tone === 'bad' ? ShieldAlert : CheckCircle2;
                return (
                  <li key={ev.id} className={`ev ev-${tone}`}>
                    <Icon size={16} aria-hidden="true" />
                    <div><b>{label}</b><span className="muted small">{device(ev.agent)}</span></div>
                    <time className="muted small">{timeAgo(ev.created_at)}</time>
                  </li>
                );
              })}
            </ul>
            <p className="muted small">See something you do not recognise? Change your password, then sign out other devices.</p>
          </section>

          <section className="panel">
            <h2 className="panel-title">What protects your account</h2>
            <ul className="protect">
              {PROTECTIONS.map(({ icon: Icon, title, text }) => (
                <li key={title}><Icon size={18} aria-hidden="true" /><div><b>{title}</b><p className="muted small">{text}</p></div></li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {ask && (
        <Modal title={TITLES[ask]} onClose={closeAsk}>
          {backups ? (
            <div>
              <p className="muted small" style={{ marginBottom: 12 }}>Save these backup codes somewhere safe. Each one works once if you lose your phone. <b>They will not be shown again.</b></p>
              <ul className="backup-list">{backups.map((c) => <li key={c}>{c}</li>)}</ul>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={copyBackups}><Copy size={14} /> Copy codes</button>
                <button className="btn btn-primary" onClick={closeAsk}>I saved them</button>
              </div>
            </div>
          ) : (
            <form onSubmit={confirmAsk}>
              {ask === 'delete' && <p className="muted small" style={{ marginBottom: 14 }}>This permanently removes your account and everything you created. It cannot be undone.</p>}
              {ask === 'totpStart' && setup ? (
                <>
                  <p className="muted small" style={{ marginBottom: 10 }}>Scan this with your authenticator app, then type the 6-digit code it shows.</p>
                  <div className="qr"><img src={setup.qr} alt="QR code for your authenticator app" width="180" height="180" /></div>
                  <p className="small muted" style={{ textAlign: 'center', marginBottom: 12 }}>Cannot scan? Enter this key: <code className="keycode">{setup.secret}</code></p>
                  <div className="field"><label htmlFor="setup-code">6-digit code</label>
                    <input id="setup-code" value={setupCode} onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" autoFocus /></div>
                </>
              ) : (
                <>
                  {ask !== 'delete' && <p className="muted small" style={{ marginBottom: 14 }}>{info.hasPassword ? 'Enter your password to continue.' : 'Type your email address to continue.'}</p>}
                  {askError && <ErrorBox message={askError} />}
                  {proofField}
                  {ask === 'totpOff' && (
                    <div className="field"><label htmlFor="off-code">Code from your app (or a backup code)</label>
                      <input id="off-code" value={askCode} onChange={(e) => setAskCode(e.target.value)} placeholder="123456" autoComplete="off" maxLength={11} /></div>
                  )}
                </>
              )}
              {ask === 'totpStart' && setup && askError && <ErrorBox message={askError} />}
              <div className="form-actions">
                <button className={`btn ${ask === 'delete' ? 'btn-danger' : 'btn-primary'}`} disabled={ask === 'totpStart' && setup && setupCode.length !== 6}>
                  {ask === 'delete' ? 'Delete my account' : ask === 'totpStart' ? (setup ? 'Turn on' : 'Continue') : 'Confirm'}
                </button>
                <button type="button" className="btn btn-outline" onClick={closeAsk}>Cancel</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
