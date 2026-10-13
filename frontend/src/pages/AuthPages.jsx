import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Sparkles, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks';
import { ErrorBox, PasswordField, Wordmark, ThermalStrip, passwordProblems } from '../components/ui';
import CodeStep from '../components/CodeStep';
import OAuthButtons from '../components/OAuthButtons';
import { LIMITS } from '../utils';

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" aria-label="IdeaForge home"><Wordmark /></Link>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ gap: '6px' }}>
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
        <div className="auth-pitch">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', fontWeight: 700 }}>
            <Sparkles size={13} /> Enterprise Creative Atelier
          </div>
          <ThermalStrip version={5} size="lg" />
          <h1>Ideas should grow, not sit still.</h1>
          <p>Share a rough problem thesis, collect peer suggestions, and watch it evolve into a white-hot prototype with permanent attribution.</p>
          <div style={{ display: 'grid', gap: '10px', marginTop: '16px', fontSize: '13px', color: 'var(--ink-2)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={15} style={{ color: 'var(--lime)' }} /> 100% Verifiable Revision History
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={15} style={{ color: 'var(--lime)' }} /> Google &amp; GitHub Single Sign-On
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={15} style={{ color: 'var(--lime)' }} /> Bank-Grade TOTP Authenticator 2FA
            </span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
          IDEA FORGE OPEN ATELIER // ENCRYPTED TRANSIT
        </div>
      </aside>
      <main className="auth-form">
        <div className="auth-box">
          {title && <><h2>{title}</h2><p className="muted">{subtitle}</p></>}
          {children}
          <p className="auth-legal small muted">By continuing you agree to our <Link to="/privacy">terms &amp; privacy policy</Link>.</p>
        </div>
      </main>
    </div>
  );
}

export function Login() {
  useDocumentTitle('Log in');
  const { login, verifyEmail, loginWithCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [step, setStep] = useState({ name: 'form' }); // form | verify | twofa
  const [error, setError] = useState(new URLSearchParams(location.search).get('oauth_error') || '');
  const [busy, setBusy] = useState(false);
  const goHome = () => navigate(location.state?.from || '/dashboard');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await login(form.email, form.password);
      if (r.done) goHome();
      else if (r.needs2fa) setStep({ name: 'twofa', email: r.email, ticket: r.ticket, method: r.method });
      else if (r.needsVerification) setStep({ name: 'verify', email: r.email });
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  if (step.name === 'verify') {
    return (
      <AuthShell>
        <CodeStep title="Confirm your email" email={step.email} submitLabel="Confirm email"
          onSubmit={async (code) => { await verifyEmail(step.email, code); goHome(); }}
          onResend={() => api.post('/auth/resend-code', { purpose: 'verify', email: step.email })}
          onBack={() => setStep({ name: 'form' })} />
      </AuthShell>
    );
  }
  if (step.name === 'twofa') {
    return (
      <AuthShell>
        <CodeStep title="Enter your login code" email={step.email} submitLabel="Log in" method={step.method}
          onSubmit={async (code) => { await loginWithCode(step.ticket, code); goHome(); }}
          onResend={() => api.post('/auth/resend-code', { purpose: 'login', ticket: step.ticket })}
          onBack={() => setStep({ name: 'form' })} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to keep developing your ideas.">
      <OAuthButtons />
      {error && <ErrorBox message={error} />}
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" maxLength={150} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <PasswordField id="password" label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        <div className="forgot-row"><Link to="/forgot">Forgot your password?</Link></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p className="alt">New here? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}

export function Register() {
  useDocumentTitle('Create account');
  const { register, verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [verify, setVerify] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const p = passwordProblems(form.password);
    if (!(p.length && p.letter && p.number)) { setError('Choose a password with at least 8 characters, a letter and a number.'); return; }
    setBusy(true); setError('');
    try {
      const r = await register(form.name, form.email, form.password);
      if (r.done) navigate('/dashboard');
      else if (r.needsVerification) setVerify(r.email);
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  if (verify) {
    return (
      <AuthShell>
        <CodeStep title="Confirm your email" email={verify} submitLabel="Confirm and continue"
          onSubmit={async (code) => { await verifyEmail(verify, code); navigate('/dashboard'); }}
          onResend={() => api.post('/auth/resend-code', { purpose: 'verify', email: verify })}
          onBack={() => setVerify(null)} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="It takes less than a minute.">
      <OAuthButtons verb="Sign up" />
      {error && <ErrorBox message={error} />}
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="name">Full name</label>
          <input id="name" required autoComplete="name" maxLength={LIMITS.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="remail">Email</label>
          <input id="remail" type="email" required autoComplete="email" maxLength={150} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <PasswordField id="rpassword" label="Password" showMeter autoComplete="new-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
      </form>
      <p className="alt">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthShell>
  );
}
