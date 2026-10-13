import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks';
import { Spinner, ErrorBox } from '../components/ui';
import CodeStep from '../components/CodeStep';
import { AuthShell } from './AuthPages';

// Where Google / GitHub send people back to. The one-time ticket is in the address after "#".
export default function OAuthCallback() {
  useDocumentTitle('Signing in');
  const { loginWithTicket, loginWithCode } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [twofa, setTwofa] = useState(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const ticket = new URLSearchParams(window.location.hash.slice(1)).get('ticket');
    window.history.replaceState(null, '', window.location.pathname); // remove the ticket from the address bar
    if (!ticket) { navigate('/login', { replace: true }); return; }
    loginWithTicket(ticket)
      .then((r) => { if (r.done) navigate('/dashboard', { replace: true }); else setTwofa(r); })
      .catch((e) => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (twofa) {
    return (
      <AuthShell>
        <CodeStep title="Enter your login code" method="app" email={twofa.email} submitLabel="Log in"
          onSubmit={async (code) => { await loginWithCode(twofa.ticket, code); navigate('/dashboard', { replace: true }); }} />
      </AuthShell>
    );
  }
  if (error) {
    return (
      <AuthShell title="Sign-in did not finish" subtitle="Nothing was changed on your account.">
        <ErrorBox message={error} />
        <a className="btn btn-primary btn-block" href="/login">Back to log in</a>
      </AuthShell>
    );
  }
  return <Spinner />;
}
