import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { useConsent } from '../context/ConsentContext';

// Asks once, and can be reopened from the footer or from Privacy & preferences.
export default function CookieBanner() {
  const { asked, panel, openPanel, closePanel, save, choice } = useConsent();
  const [prefs, setPrefs] = useState(choice?.preferences ?? false);
  if (asked && !panel) return null;

  return (
    <div className={`cookie ${panel ? 'cookie-open' : ''}`} role="dialog" aria-label="Cookie choices">
      <div className="cookie-head"><Cookie size={18} aria-hidden="true" /><b>Your cookie choices</b></div>
      <p className="small">
        IdeaForge has no ads and no tracking. We use storage that keeps you signed in, and optionally remember your theme and settings.{' '}
        <Link to="/privacy">Read the privacy page</Link>.
      </p>
      {panel && (
        <div className="cookie-opts">
          <label className="cookie-opt"><input type="checkbox" checked disabled /> <span><b>Necessary</b><small>Keeps you signed in and remembers this choice. Always on.</small></span></label>
          <label className="cookie-opt"><input type="checkbox" checked={prefs} onChange={(e) => setPrefs(e.target.checked)} /> <span><b>Preferences</b><small>Remembers your theme and smooth-scroll setting on this device.</small></span></label>
        </div>
      )}
      <div className="cookie-actions">
        {panel ? (
          <>
            <button className="btn btn-primary btn-sm" onClick={() => save(prefs)}>Save choices</button>
            <button className="btn btn-ghost btn-sm" onClick={closePanel}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-sm" onClick={() => save(true)}>Accept all</button>
            <button className="btn btn-outline btn-sm" onClick={() => save(false)}>Necessary only</button>
            <button className="btn btn-ghost btn-sm" onClick={openPanel}>Choose</button>
          </>
        )}
      </div>
    </div>
  );
}
