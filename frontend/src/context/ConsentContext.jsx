import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Cookie and storage choices. IdeaForge has no ads and no analytics, so there are only two groups:
//   necessary    keeps you signed in and remembers this choice. Always on.
//   preferences  remembers your theme and smooth-scroll setting. Off unless you say yes.
const ConsentContext = createContext(null);
export const useConsent = () => useContext(ConsentContext);

const COOKIE = 'if_consent';
const PREF_KEYS = ['ideaforge_theme', 'ideaforge_smooth'];

function readCookie() {
  try {
    const m = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`));
    return m ? JSON.parse(decodeURIComponent(m.slice(COOKIE.length + 1))) : null;
  } catch { return null; }
}
function writeCookie(value) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
}

export function ConsentProvider({ children }) {
  const [choice, setChoice] = useState(readCookie); // null = not asked yet
  const [panel, setPanel] = useState(false);

  const save = useCallback((preferences) => {
    const value = { v: 1, preferences: !!preferences, at: new Date().toISOString().slice(0, 10) };
    writeCookie(value);
    setChoice(value);
    setPanel(false);
    if (!preferences) PREF_KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  }, []);

  // Used by features that want to remember something on this device.
  const canRemember = !!choice?.preferences;
  useEffect(() => {
    if (choice && !choice.preferences) PREF_KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  }, [choice]);

  return (
    <ConsentContext.Provider value={{ choice, canRemember, asked: !!choice, panel, openPanel: () => setPanel(true), closePanel: () => setPanel(false), save }}>
      {children}
    </ConsentContext.Provider>
  );
}
