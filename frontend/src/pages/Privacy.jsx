import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Wordmark } from '../components/ui';
import { useConsent } from '../context/ConsentContext';
import { useDocumentTitle } from '../hooks';

const COOKIES = [
  ['if_consent', 'Cookie', 'Remembers your cookie choice', '1 year', 'Necessary'],
  ['if_oauth', 'Cookie', 'Protects the Google / GitHub sign-in from forgery. Exists for a few minutes only', '10 minutes', 'Necessary'],
  ['ideaforge_token', 'Browser storage', 'Keeps you signed in', 'Until you log out, 12 hours at most', 'Necessary'],
  ['ideaforge_theme', 'Browser storage', 'Remembers light or dark theme', 'Until cleared', 'Preferences'],
  ['ideaforge_smooth', 'Browser storage', 'Remembers the smooth-scroll setting', 'Until cleared', 'Preferences'],
];

export default function Privacy() {
  useDocumentTitle('Privacy');
  const { openPanel } = useConsent();
  return (
    <div className="legal">
      <header className="legal-nav"><Link to="/" aria-label="IdeaForge home"><Wordmark /></Link><Link to="/" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Back</Link></header>
      <article className="legal-body">
        <h1>Privacy</h1>
        <p className="prose lede">IdeaForge is a student project. It collects only what it needs to run, and it does not sell or share your data. You can download or delete everything at any time.</p>

        <h2>What we store</h2>
        <ul className="legal-list">
          <li><b>Your account:</b> name, email address, and a hashed password (never the password itself). If you sign in with Google or GitHub, we keep only your provider ID, name and verified email.</li>
          <li><b>What you write:</b> ideas, every version of them, comments, suggestions, votes, follows and notifications.</li>
          <li><b>Security activity:</b> sign-ins, failed attempts, password changes, with the IP address and browser name, so you can spot anything unusual.</li>
          <li><b>One-time codes:</b> only a scrambled version of each code, which expires in 10 minutes.</li>
        </ul>

        <h2>What we do not do</h2>
        <ul className="legal-list">
          <li>No advertising, no analytics and no tracking across other sites.</li>
          <li>Your email address is never shown to other people. Others see your name, bio, skills and published ideas.</li>
          <li>Draft ideas are visible only to you.</li>
        </ul>

        <h2>Cookies and browser storage</h2>
        <div className="legal-table" role="table" aria-label="Cookies and storage">
          <div className="legal-row legal-head" role="row"><span>Name</span><span>Type</span><span>Purpose</span><span>Lasts</span><span>Group</span></div>
          {COOKIES.map((c) => <div className="legal-row" role="row" key={c[0]}>{c.map((x, i) => <span key={i} data-label={['Name', 'Type', 'Purpose', 'Lasts', 'Group'][i]}>{x}</span>)}</div>)}
        </div>
        <p><button className="btn btn-outline btn-sm" onClick={openPanel}>Change my cookie choices</button></p>

        <h2>Other services that receive data</h2>
        <ul className="legal-list">
          <li><b>Google Fonts</b> sends the typefaces to your browser, so Google sees your IP address.</li>
          <li><b>Google Gemini</b> receives the idea text only when you press an AI assistant button.</li>
          <li><b>Brevo</b> delivers email codes, so it receives your email address and the message.</li>
          <li><b>Google and GitHub</b> only if you choose to sign in with them.</li>
          <li><b>Vercel, Render and Aiven</b> host the website, the server and the database.</li>
        </ul>

        <h2>Your control</h2>
        <ul className="legal-list">
          <li><b>Download your data</b> as a file from <Link to="/security">Security &amp; privacy</Link>.</li>
          <li><b>Delete your account</b> from the same page. Your ideas, versions, comments and votes are removed with it, and this cannot be undone.</li>
          <li><b>Sign out other devices</b> and turn on 2-step login with an email code or an authenticator app.</li>
        </ul>
        <p className="muted small">Last updated October 2026.</p>
      </article>
    </div>
  );
}
