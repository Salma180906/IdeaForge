import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useDocumentTitle } from '../hooks';
import { ErrorBox, PasswordField, passwordProblems } from '../components/ui';
import CodeStep from '../components/CodeStep';
import { AuthShell } from './AuthPages';

// Three steps: enter email -> type the emailed code -> choose a new password.
export default function ForgotPassword() {
  useDocumentTitle('Reset password');
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [pw, setPw] = useState({ next: '', again: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendEmail = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/auth/forgot', { email });
      setStep('code');
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const choose = async (e) => {
    e.preventDefault();
    const p = passwordProblems(pw.next);
    if (!(p.length && p.letter && p.number)) { setError('The new password needs at least 8 characters, a letter and a number.'); return; }
    if (pw.next !== pw.again) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await api.post('/auth/reset', { resetToken, newPassword: pw.next }); setStep('done'); } catch (err) { setError(err.message); }
    setBusy(false);
  };

  if (step === 'code') {
    return (
      <AuthShell>
        <CodeStep
          title="Check your email"
          email={email}
          submitLabel="Continue"
          onSubmit={async (code) => { const r = await api.post('/auth/reset/verify', { email, code }); setResetToken(r.resetToken); setStep('password'); }}
          onResend={() => api.post('/auth/forgot', { email })}
          onBack={() => setStep('email')}
        />
      </AuthShell>
    );
  }
  if (step === 'password') {
    return (
      <AuthShell title="Choose a new password" subtitle="You will be signed out on every other device.">
        {error && <ErrorBox message={error} />}
        <form onSubmit={choose}>
          <PasswordField id="rp-new" label="New password" showMeter autoComplete="new-password" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} />
          <PasswordField id="rp-again" label="New password again" autoComplete="new-password" value={pw.again} onChange={(v) => setPw({ ...pw, again: v })} />
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving...' : 'Save new password'}</button>
        </form>
      </AuthShell>
    );
  }
  if (step === 'done') {
    return (
      <AuthShell>
        <div className="code-step">
          <div className="success-mark"><CheckCircle2 size={44} aria-hidden="true" /></div>
          <h2>Password changed</h2>
          <p className="muted">You can log in with your new password now.</p>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/login')}>Go to log in</button>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we will send you a 6-digit code.">
      {error && <ErrorBox message={error} />}
      <form onSubmit={sendEmail}>
        <div className="field"><label htmlFor="fp-email">Email</label>
          <input id="fp-email" type="email" required autoComplete="email" maxLength={150} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending...' : 'Send code'}</button>
      </form>
      <p className="alt"><Link to="/login">Back to log in</Link></p>
    </AuthShell>
  );
}
