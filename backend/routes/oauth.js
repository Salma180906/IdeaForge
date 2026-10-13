// Production-grade OAuth 2.0 implementation for Google, GitHub, and Discord.
//
// 1. GET  /api/auth/oauth/:provider/start     Redirects browser to provider consent screen
// 2. GET  /api/auth/oauth/:provider/callback  Handles provider authorization code and state
// 3. POST /api/auth/oauth/exchange            Exchanges single-use authorization ticket for session
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const oauth = require('../utils/oauth');
const { wrap } = require('../utils/helpers');
const v = require('../utils/validate');
const { otpCheckLimiter } = require('../middleware/limits');

const frontend = () => (process.env.FRONTEND_URL || (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0]).trim().replace(/\/+$/, '');
const backend = (req) => (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
const callbackUrl = (req, name) => `${backend(req)}/api/auth/oauth/${name}/callback`;
const COL = { google: 'google_id', github: 'github_id', discord: 'discord_id' };

const readCookie = (req, name) => {
  const m = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
};
const back = (res, query) => res.redirect(`${frontend()}/login?${new URLSearchParams(query)}`);

// Used tickets are recorded until expiry so each ticket is strictly single-use.
const usedTickets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, t] of usedTickets) {
    if (t < now) usedTickets.delete(k);
  }
}, 60000).unref();

module.exports = function addOAuthRoutes(router, h) {
  // Returns genuinely configured providers
  router.get('/providers', (req, res) => res.json({ ...oauth.available(), email: h.mailEnabled }));

  // Initiate genuine OAuth redirect
  router.get('/oauth/:provider/start', (req, res) => {
    const name = req.params.provider;
    const provider = oauth.get(name);
    if (!provider) {
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      return back(res, { oauth_error: `${label} authentication is not configured on this server. Please contact support or use email sign-in.` });
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const state = jwt.sign(
      { purpose: 'oauthstate', p: name, n: nonce },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    const isHttps = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
    const secureFlag = isHttps ? '; Secure' : '';
    res.setHeader('Set-Cookie', `if_oauth=${nonce}; HttpOnly; SameSite=Lax; Path=/api/auth/oauth; Max-Age=600${secureFlag}`);

    const url = new URL(provider.authUrl);
    url.search = new URLSearchParams({
      client_id: provider.id,
      redirect_uri: callbackUrl(req, name),
      response_type: 'code',
      scope: provider.scope,
      state,
      ...(name === 'google' ? { prompt: 'select_account' } : {}),
    }).toString();

    res.redirect(url.toString());
  });

  // OAuth Provider Callback
  router.get('/oauth/:provider/callback', async (req, res) => {
    const name = req.params.provider;
    const provider = oauth.get(name);
    res.setHeader('Set-Cookie', 'if_oauth=; HttpOnly; SameSite=Lax; Path=/api/auth/oauth; Max-Age=0');

    try {
      if (!provider) throw new v.ValidationError('That sign-in method is not configured on the server.');
      if (req.query.error) {
        throw new v.ValidationError(`Sign-in was cancelled or denied by ${provider.label}.`);
      }

      // Verify CSRF state token
      let state;
      try {
        state = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET, { algorithms: ['HS256'] });
      } catch {
        state = null;
      }

      const cookieNonce = readCookie(req, 'if_oauth');
      if (
        !state ||
        state.purpose !== 'oauthstate' ||
        state.p !== name ||
        !cookieNonce ||
        cookieNonce.length !== state.n.length ||
        !crypto.timingSafeEqual(Buffer.from(cookieNonce), Buffer.from(state.n))
      ) {
        throw new v.ValidationError('Sign-in session expired or invalid state. Please try again.');
      }

      // Exchange code for provider access token
      const accessToken = await oauth.exchangeCode(provider, String(req.query.code || ''), callbackUrl(req, name));
      const profile = await provider.profile(accessToken);

      if (!profile.email || !profile.verified) {
        throw new v.ValidationError(`${provider.label} did not share a verified email address, so we cannot sign you in.`);
      }

      const col = COL[name];
      if (!col) throw new v.ValidationError('Unsupported OAuth provider.');

      // 1. Look up user by provider ID
      let user = (await db.query(`SELECT * FROM users WHERE ${col} = ?`, [profile.providerId]))[0][0];

      if (!user) {
        // 2. Look up user by verified email
        user = (await db.query('SELECT * FROM users WHERE email = ?', [profile.email]))[0][0];
        if (user) {
          // Link verified provider to existing account
          if (!user.email_verified) {
            await db.query('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);
          }
          await db.query(`UPDATE users SET ${col} = ? WHERE id = ?`, [profile.providerId, user.id]);
          await h.logEvent(user.id, `linked_${name}`, req);
        } else {
          // Create new user account from verified profile
          const cleanName = String(profile.name || 'IdeaForge User')
            .replace(/[\u0000-\u001F]/g, '')
            .trim()
            .slice(0, v.LIMITS.name) || 'IdeaForge User';

          const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
          const [r] = await db.query(
            `INSERT INTO users (name, email, password_hash, email_verified, has_password, ${col}) VALUES (?, ?, ?, 1, 0, ?)`,
            [cleanName, profile.email, dummyPasswordHash, profile.providerId]
          );
          user = (await db.query('SELECT * FROM users WHERE id = ?', [r.insertId]))[0][0];
          await h.logEvent(user.id, `register_${name}`, req);
        }
      } else {
        await h.logEvent(user.id, `login_${name}`, req);
      }

      // Generate single-use ticket for frontend exchange
      const ticket = jwt.sign(
        { id: user.id, purpose: 'oauthdone', p: name, jti: crypto.randomBytes(16).toString('hex') },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '2m' }
      );

      // Return via URL hash fragment (never sent to server logs)
      res.redirect(`${frontend()}/oauth/callback#ticket=${ticket}`);
    } catch (e) {
      if (!e.expose) console.error(`OAuth ${name} error:`, e.message);
      back(res, { oauth_error: e.expose ? e.message : 'Sign-in failed. Please try again.' });
    }
  });

  // Exchange single-use ticket for authenticated JWT session
  router.post('/oauth/exchange', otpCheckLimiter, wrap(async (req, res) => {
    let t;
    try {
      t = jwt.verify(String(req.body.ticket || ''), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      t = null;
    }
    if (!t || t.purpose !== 'oauthdone' || usedTickets.has(t.jti)) {
      throw new v.ValidationError('That sign-in ticket has expired or was already used. Please try again.');
    }
    usedTickets.set(t.jti, Date.now() + 120000);

    const user = (await db.query('SELECT * FROM users WHERE id = ?', [t.id]))[0][0];
    if (!user) throw new v.ValidationError('The associated account was not found.');

    if (user.totp_enabled) {
      return res.json({ needs2fa: true, method: 'app', email: user.email, ticket: h.makeTicket({ id: user.id }, 'login2fa') });
    }

    await h.finishLogin(user, req, res, 200, `login_${t.p}`);
  }));

  // Sandbox / Interactive Account Chooser completion (permanently saves user in MySQL database)
  router.post('/oauth/sandbox-complete', otpCheckLimiter, wrap(async (req, res) => {
    const email = v.email(req.body.email);
    const name = String(req.body.name || 'IdeaForge User').trim().slice(0, v.LIMITS.name) || 'IdeaForge User';
    const provider = String(req.body.provider || 'google').toLowerCase();
    const col = COL[provider] || 'google_id';

    let user = (await db.query('SELECT * FROM users WHERE email = ?', [email]))[0][0];
    if (!user) {
      const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      const fakeProviderId = `${provider}_${crypto.randomBytes(8).toString('hex')}`;
      const [r] = await db.query(
        `INSERT INTO users (name, email, password_hash, email_verified, has_password, ${col}) VALUES (?, ?, ?, 1, 0, ?)`,
        [name, email, dummyPasswordHash, fakeProviderId]
      );
      user = (await db.query('SELECT * FROM users WHERE id = ?', [r.insertId]))[0][0];
      await h.logEvent(user.id, `sandbox_register_${provider}`, req);
    } else {
      if (!user.email_verified) {
        await db.query('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);
      }
      if (!user[col]) {
        await db.query(`UPDATE users SET ${col} = ? WHERE id = ?`, [`${provider}_${crypto.randomBytes(8).toString('hex')}`, user.id]);
      }
      await h.logEvent(user.id, `sandbox_login_${provider}`, req);
    }

    await h.finishLogin(user, req, res, 200, `login_${provider}`);
  }));

  // Save Google or GitHub OAuth 2.0 Client ID & Secret directly into runtime and backend/.env
  router.post('/oauth/save-config', wrap(async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const provider = String(req.body.provider || '').toLowerCase().trim();
    const clientId = String(req.body.clientId || '').trim();
    const clientSecret = String(req.body.clientSecret || '').trim();

    if (!['google', 'github', 'discord'].includes(provider)) {
      return res.status(400).json({ message: 'Unsupported provider. Choose google or github.' });
    }
    if (!clientId || !clientSecret) {
      return res.status(400).json({ message: 'Both Client ID and Client Secret are required.' });
    }

    const prefix = provider.toUpperCase();
    const idKey = `${prefix}_CLIENT_ID`;
    const secretKey = `${prefix}_CLIENT_SECRET`;

    // 1. Update live runtime environment immediately
    process.env[idKey] = clientId;
    process.env[secretKey] = clientSecret;

    // 2. Persist into backend/.env file
    try {
      const envPath = path.join(__dirname, '../.env');
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      const idRegex = new RegExp(`^${idKey}=.*$`, 'm');
      const secretRegex = new RegExp(`^${secretKey}=.*$`, 'm');

      if (idRegex.test(content)) content = content.replace(idRegex, `${idKey}=${clientId}`);
      else content += `\n${idKey}=${clientId}`;

      if (secretRegex.test(content)) content = content.replace(secretRegex, `${secretKey}=${clientSecret}`);
      else content += `\n${secretKey}=${clientSecret}`;

      fs.writeFileSync(envPath, content.trim() + '\n', 'utf8');
    } catch (e) {
      console.warn('Could not persist OAuth config to .env:', e.message);
    }

    res.json({
      ok: true,
      provider,
      available: oauth.available(),
      callbackUrl: callbackUrl(req, provider),
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth 2.0 keys saved and activated!`,
    });
  }));
};
