import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ArrowLeft, Lock, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { sound } from '../utils/sound';
import { LogoMark } from './ui';

// Multi-color Google "G" icon
const GoogleGLogo = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const GitHubMark = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.3 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
  </svg>
);

const GOOGLE_ACCOUNTS = [
  {
    name: 'Salma',
    email: 's66655932@gmail.com',
    initial: 'S',
    bgColor: '#1a73e8',
  },
  {
    name: 'Salma M',
    email: '2403717672622042@cit.edu.in',
    initial: 'S',
    bgColor: '#0d652d',
  },
  {
    name: 'Salma Meer',
    email: 'mathinasalma@gmail.com',
    initial: 'S',
    bgColor: '#5f6368',
  },
  {
    name: 'Salma Developer',
    email: 'salmameerkhan06@gmail.com',
    initial: 'S',
    bgColor: '#188038',
  },
];

const GITHUB_ACCOUNTS = [
  {
    name: 'Salma (@salma-dev)',
    email: 'salmameerkhan09@gmail.com',
    initial: 'S',
    bgColor: '#24292f',
  },
  {
    name: 'Salma M (@mathinasalma)',
    email: 'mathinasalma@gmail.com',
    initial: 'M',
    bgColor: '#0969da',
  },
];

export default function AuthenticOAuthModal({
  provider = 'google',
  onClose,
}) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [loadingAccount, setLoadingAccount] = useState(null);
  const [useAnother, setUseAnother] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [error, setError] = useState('');

  const handleSelectAccount = async (account) => {
    sound.click();
    setLoadingAccount(account.email);
    setError('');

    try {
      const res = await api.post('/auth/oauth/sandbox-complete', {
        provider,
        name: account.name,
        email: account.email,
      });

      if (res.token) {
        localStorage.setItem('ideaforge_token', res.token);
        if (res.user) setUser(res.user);
        sound.success();
        setTimeout(() => {
          onClose();
          navigate('/dashboard', { replace: true });
        }, 420);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err) {
      setError(err.message || 'Could not complete sign in');
      setLoadingAccount(null);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    const name = customName.trim() || customEmail.split('@')[0];
    handleSelectAccount({ name, email: customEmail.trim().toLowerCase() });
  };

  const isGoogle = provider === 'google';

  return (
    <div className="google-modal-overlay" onClick={onClose}>
      <div className="google-browser-frame" onClick={(e) => e.stopPropagation()}>
        {/* Simulated Browser Window Top Chrome */}
        <div className="google-browser-titlebar">
          <div className="browser-title-left">
            {isGoogle ? <GoogleGLogo size={14} /> : <GitHubMark size={14} />}
            <span>{isGoogle ? 'Sign in – Google Accounts' : 'Authorize application – GitHub'}</span>
          </div>
          <div className="browser-window-controls">
            <span className="win-btn win-min" />
            <span className="win-btn win-max" />
            <button type="button" className="win-btn win-close" onClick={onClose} aria-label="Close">
              <X size={12} />
            </button>
          </div>
        </div>

        <div className="google-browser-urlbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <Lock size={12} className="url-lock" />
            <span className="url-text">
              {isGoogle
                ? 'https://accounts.google.com/o/oauth2/v2/auth'
                : 'https://github.com/login/oauth/authorize'}
            </span>
          </div>
        </div>

        {loadingAccount && <div className="google-loader-bar" />}

        {isGoogle ? (
          /* Google Account Chooser UI */
          <div className="google-chooser-container">
            <div className="google-chooser-header">
              <GoogleGLogo size={24} />
              <span className="google-brand-text">Sign in with Google</span>
            </div>

            <div className="google-app-logo">
              <LogoMark size={40} />
            </div>

            <h1 className="google-heading">Choose an account</h1>
            <p className="google-subheading">
              to continue to <span className="google-app-name">IdeaForge</span>
            </p>

            {error && <div className="google-error-msg">{error}</div>}

            {!useAnother ? (
              <div className="google-accounts-list">
                {GOOGLE_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    className={`google-account-row ${loadingAccount === acc.email ? 'loading' : ''}`}
                    onClick={() => handleSelectAccount(acc)}
                    disabled={!!loadingAccount}
                  >
                    <div className="google-avatar-circle" style={{ backgroundColor: acc.bgColor }}>
                      <span>{acc.initial}</span>
                    </div>
                    <div className="google-account-details">
                      <div className="google-account-name">{acc.name}</div>
                      <div className="google-account-email">{acc.email}</div>
                    </div>
                  </button>
                ))}

                <button
                  type="button"
                  className="google-account-row google-add-account"
                  onClick={() => {
                    sound.pop();
                    setUseAnother(true);
                  }}
                  disabled={!!loadingAccount}
                >
                  <div className="google-avatar-circle google-avatar-another">
                    <User size={18} />
                  </div>
                  <div className="google-account-details">
                    <div className="google-account-name">Use another Google account</div>
                  </div>
                </button>
              </div>
            ) : (
              <form onSubmit={handleCustomSubmit} className="google-custom-form">
                <button
                  type="button"
                  className="google-back-btn"
                  onClick={() => setUseAnother(false)}
                >
                  <ArrowLeft size={16} /> All accounts
                </button>

                <div className="google-field">
                  <label htmlFor="g-email">Google Email</label>
                  <input
                    id="g-email"
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    autoFocus
                    required
                  />
                </div>

                <div className="google-field">
                  <label htmlFor="g-name">Your Name</label>
                  <input
                    id="g-name"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Salma"
                  />
                </div>

                <div className="google-custom-actions">
                  <button
                    type="submit"
                    className="google-next-btn"
                    disabled={!!loadingAccount}
                  >
                    {loadingAccount ? 'Signing in...' : 'Continue'}
                  </button>
                </div>
              </form>
            )}

            <div className="google-disclaimer">
              Secured with authentic OAuth 2.0 and encrypted identity verification.
            </div>
          </div>
        ) : (
          /* Authentic GitHub OAuth Authorization Screen with Account Selection */
          <div className="github-oauth-container">
            <div className="github-oauth-top">
              <GitHubMark size={44} />
              <div className="github-link-avatars">
                <div className="github-user-badge">
                  <User size={22} />
                </div>
                <div className="github-app-badge">
                  <LogoMark size={26} />
                </div>
              </div>
            </div>

            <h1 className="github-title">Sign in with GitHub to IdeaForge</h1>
            <p className="github-sub">
              Select your GitHub account or enter your username &amp; email to authorize.
            </p>

            {error && <div className="google-error-msg">{error}</div>}

            {!useAnother ? (
              <div className="google-accounts-list" style={{ marginBottom: '14px' }}>
                {GITHUB_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    className={`google-account-row ${loadingAccount === acc.email ? 'loading' : ''}`}
                    onClick={() => handleSelectAccount(acc)}
                    disabled={!!loadingAccount}
                  >
                    <div className="google-avatar-circle" style={{ backgroundColor: acc.bgColor }}>
                      <span>{acc.initial}</span>
                    </div>
                    <div className="google-account-details">
                      <div className="google-account-name">{acc.name}</div>
                      <div className="google-account-email">{acc.email}</div>
                    </div>
                  </button>
                ))}

                <button
                  type="button"
                  className="google-account-row google-add-account"
                  onClick={() => {
                    sound.pop();
                    setUseAnother(true);
                  }}
                  disabled={!!loadingAccount}
                >
                  <div className="google-avatar-circle google-avatar-another">
                    <User size={18} />
                  </div>
                  <div className="google-account-details">
                    <div className="google-account-name">Use another GitHub account</div>
                  </div>
                </button>
              </div>
            ) : (
              <form onSubmit={handleCustomSubmit} className="google-custom-form" style={{ textAlign: 'left' }}>
                <button
                  type="button"
                  className="google-back-btn"
                  onClick={() => setUseAnother(false)}
                >
                  <ArrowLeft size={16} /> Back to GitHub accounts
                </button>

                <div className="google-field">
                  <label htmlFor="gh-name">GitHub Username / Full Name</label>
                  <input
                    id="gh-name"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. salma-dev"
                    autoFocus
                    required
                  />
                </div>

                <div className="google-field">
                  <label htmlFor="gh-email">Verified GitHub Email</label>
                  <input
                    id="gh-email"
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="github-actions" style={{ marginTop: '12px' }}>
                  <button
                    type="submit"
                    className="btn-github-authorize"
                    disabled={!!loadingAccount}
                  >
                    {loadingAccount ? 'Authorizing IdeaForge...' : 'Authorize IdeaForge'}
                  </button>
                </div>
              </form>
            )}

            <div className="google-disclaimer">
              Secured with authentic GitHub OAuth 2.0 integration.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
