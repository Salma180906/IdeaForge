import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { sound } from '../utils/sound';
import AuthenticOAuthModal from './AuthenticOAuthModal';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const GoogleIcon = () => (
  <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

const GitHubIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.3 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
  </svg>
);

export default function OAuthButtons({ verb = 'Continue' }) {
  const [providers, setProviders] = useState({ google: false, github: false });
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState(null); // { provider: 'google'|'github' }

  const refreshProviders = () => {
    api.get('/auth/providers')
      .then((res) => {
        setProviders(res || { google: false, github: false });
      })
      .catch(() => {
        setProviders({ google: false, github: false });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshProviders();
  }, []);

  const handleProviderClick = (providerKey, isLive, e) => {
    e.preventDefault();
    sound.click();
    if (isLive) {
      window.location.href = `${API_BASE}/auth/oauth/${providerKey}/start`;
      return;
    }
    setModalState({ provider: providerKey });
  };

  return (
    <div className="oauth-container">
      <div className="oauth-btns">
        <button
          type="button"
          className="btn btn-outline btn-block oauth-provider-btn oauth-google-btn"
          onClick={(e) => handleProviderClick('google', providers.google, e)}
          disabled={loading}
          aria-label={`${verb} with Google`}
        >
          <GoogleIcon />
          <span>{verb} with Google</span>
        </button>

        <button
          type="button"
          className="btn btn-outline btn-block oauth-provider-btn oauth-github-btn"
          onClick={(e) => handleProviderClick('github', providers.github, e)}
          disabled={loading}
          aria-label={`${verb} with GitHub`}
        >
          <GitHubIcon />
          <span>{verb} with GitHub</span>
        </button>
      </div>

      <div className="oauth-or">
        <span>or continue with email &amp; password</span>
      </div>

      {modalState && (
        <AuthenticOAuthModal
          provider={modalState.provider}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
