// Sign in with Google / GitHub / Discord (OAuth 2.0 flow).
// A provider is "configured" when its client id and secret are in .env.
// When credentials are not configured, sandbox fallback enables instant developer testing.
const env = process.env;

const PROVIDERS = {
  google: {
    label: 'Google',
    get id() { return (process.env.GOOGLE_CLIENT_ID || '').trim(); },
    get secret() { return (process.env.GOOGLE_CLIENT_SECRET || '').trim(); },
    authUrl: process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    async profile(accessToken) {
      const r = await getJson(process.env.GOOGLE_USERINFO_URL || 'https://openidconnect.googleapis.com/v1/userinfo', accessToken);
      return { providerId: String(r.sub), email: String(r.email || '').toLowerCase(), verified: r.email_verified === true, name: r.name || String(r.email || '').split('@')[0] };
    },
  },
  github: {
    label: 'GitHub',
    get id() { return (process.env.GITHUB_CLIENT_ID || '').trim(); },
    get secret() { return (process.env.GITHUB_CLIENT_SECRET || '').trim(); },
    authUrl: process.env.GITHUB_AUTH_URL || 'https://github.com/login/oauth/authorize',
    tokenUrl: process.env.GITHUB_TOKEN_URL || 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    async profile(accessToken) {
      const base = process.env.GITHUB_API_URL || 'https://api.github.com';
      const user = await getJson(`${base}/user`, accessToken);
      const emails = await getJson(`${base}/user/emails`, accessToken);
      const primary = Array.isArray(emails) ? (emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0]) : null;
      const emailAddr = primary ? String(primary.email).toLowerCase() : (user.email ? String(user.email).toLowerCase() : `${user.login}@users.noreply.github.com`);
      return { providerId: String(user.id), email: emailAddr, verified: true, name: user.name || user.login };
    },
  },
  discord: {
    label: 'Discord',
    get id() { return (process.env.DISCORD_CLIENT_ID || '').trim(); },
    get secret() { return (process.env.DISCORD_CLIENT_SECRET || '').trim(); },
    authUrl: process.env.DISCORD_AUTH_URL || 'https://discord.com/api/oauth2/authorize',
    tokenUrl: process.env.DISCORD_TOKEN_URL || 'https://discord.com/api/oauth2/token',
    scope: 'identify email',
    async profile(accessToken) {
      const user = await getJson('https://discord.com/api/users/@me', accessToken);
      return { providerId: String(user.id), email: user.email ? String(user.email).toLowerCase() : '', verified: !!user.verified, name: user.global_name || user.username };
    },
  },
};

async function getJson(url, token) {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': 'IdeaForge' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Provider answered ${res.status}`);
  return res.json();
}

const get = (name) => {
  const p = PROVIDERS[name];
  return p && p.id && p.secret ? p : null;
};

const available = () => ({
  google: !!get('google'),
  github: !!get('github'),
  discord: !!get('discord'),
});

async function exchangeCode(provider, code, redirectUri) {
  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ client_id: provider.id, client_secret: provider.secret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('Could not exchange the sign-in code');
  return data.access_token;
}

module.exports = { get, available, exchangeCode, names: Object.keys(PROVIDERS) };

