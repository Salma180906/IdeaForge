const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const {
  loginLimiter, loginIpLimiter, registerLimiter, passwordLimiter, otpSendLimiter, otpCheckLimiter,
} = require('../middleware/limits');
const { wrap } = require('../utils/helpers');
const v = require('../utils/validate');
const mailer = require('../utils/mailer');
const otp = require('../utils/otp');
const totp = require('../utils/totp');
const QRCode = require('qrcode');

const COST = 12; // how slow (and therefore how hard to crack) password hashing is
// Used when the email does not exist, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);

// New accounts must confirm their email with a code, but only when email sending is set up.
// (Without email, the app falls back to the old behaviour so nobody gets locked out.)
const REQUIRE_VERIFY = process.env.REQUIRE_EMAIL_VERIFY
  ? process.env.REQUIRE_EMAIL_VERIFY === 'true'
  : mailer.enabled;

const makeToken = (user) =>
  jwt.sign({ id: user.id, name: user.name, tv: user.token_version || 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });

// A short-lived pass for one specific step (2-step login or password reset). Never works as a login token.
const makeTicket = (payload, purpose) =>
  jwt.sign({ ...payload, purpose }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
function readTicket(token, purpose) {
  try {
    const p = jwt.verify(String(token || ''), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (p.purpose === purpose) return p;
  } catch { /* fall through */ }
  throw new v.ValidationError('This step has expired. Please start again.');
}
const pwFingerprint = (hash) => crypto.createHash('sha256').update(hash).digest('hex').slice(0, 16);

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, bio: u.bio, skills: u.skills, interests: u.interests,
  emailVerified: !!u.email_verified, twoFactor: !!u.two_factor || !!u.totp_enabled, totp: !!u.totp_enabled,
  hasPassword: !!u.has_password, providers: { google: !!u.google_id, github: !!u.github_id },
});

const maskEmail = (e) => e.replace(/^(.).*(@.*)$/, '$1***$2');
const cleanEmail = (x) => String(typeof x === 'string' ? x : '').toLowerCase().trim().slice(0, 150);
const BAD_CODE = 'That code is not right or has expired.';
const badCode = () => new v.ValidationError(BAD_CODE);

async function logEvent(userId, type, req) {
  try {
    await db.query('INSERT INTO security_events (user_id, type, ip, agent) VALUES (?,?,?,?)',
      [userId, type, String(req.ip || '').slice(0, 64), String(req.headers['user-agent'] || '').slice(0, 200)]);
  } catch (e) { console.warn('Could not record security event:', e.message); }
}

// Makes a code and emails it. Returns false when the 1-minute wait between codes has not passed or dispatch failed.
async function sendCode(user, purpose) {
  const code = await otp.issue(user.id, purpose);
  if (!code) {
    return { ok: false, code: null };
  }
  let sentOk = false;
  try {
    const r = await mailer.sendOtp(user.email, user.name, code, purpose);
    sentOk = !!(r && r.success);
  } catch (e) {
    console.warn(`Could not send ${purpose} code via transport:`, e.message);
  }
  return { ok: sentOk, code };
}
const notify = (user, subject, message) =>
  mailer.enabled && mailer.sendNotice(user.email, user.name, subject, message).catch((e) => console.error('Could not send notice:', e.message));

const getUserByEmail = async (email) => (await db.query('SELECT * FROM users WHERE email = ?', [email]))[0][0];
// Actions that need the password again. Accounts made with Google/GitHub have no password, so they
// type their email address instead.
async function reauth(user, body) {
  if (user.has_password) return typeof body.password === 'string' && (await bcrypt.compare(body.password.slice(0, 200), user.password_hash));
  return typeof body.confirmEmail === 'string' && body.confirmEmail.trim().toLowerCase() === user.email;
}
const NEEDS_AGAIN = (user) => (user.has_password ? 'Your password is not correct' : 'Type your email address exactly to confirm');

// An authenticator-app code, or one of the one-time backup codes.
async function checkAppCode(user, input) {
  const code = String(input || '').trim();
  if (/^\d{6}$/.test(code)) {
    const step = totp.verify(totp.open(user.totp_secret), code);
    if (step === null || step <= Number(user.totp_last)) return false;
    const [r] = await db.query('UPDATE users SET totp_last = ? WHERE id = ? AND totp_last < ?', [step, user.id, step]);
    return r.affectedRows === 1;
  }
  if (/^[0-9a-f]{5}-[0-9a-f]{5}$/i.test(code)) {
    const list = JSON.parse(user.backup_codes || '[]');
    const hash = totp.hashBackup(code.toLowerCase());
    if (!list.includes(hash)) return false;
    const [r] = await db.query('UPDATE users SET backup_codes = ? WHERE id = ? AND backup_codes = ?', [JSON.stringify(list.filter((x) => x !== hash)), user.id, user.backup_codes]);
    if (r.affectedRows === 1) await logEvent(user.id, 'backup_code_used', { ip: '', headers: {} });
    return r.affectedRows === 1;
  }
  return false;
}
const finishLogin = async (user, req, res, status = 200, event = 'login') => {
  await logEvent(user.id, event, req);
  res.status(status).json({ token: makeToken(user), user: publicUser(user) });
};

// ---------- Sign up ----------

// POST /api/auth/register
router.post('/register', registerLimiter, wrap(async (req, res) => {
  const name = v.str(req.body.name, 'Name', { required: true, min: 2, max: v.LIMITS.name });
  const email = v.email(req.body.email);
  const password = v.password(req.body.password, { email });

  const existing = await getUserByEmail(email);
  if (existing && existing.email_verified) return res.status(409).json({ message: 'This email is already registered' });

  const hash = await bcrypt.hash(password, COST);
  let user;
  if (existing) { // started sign-up before but never confirmed: let them try again
    await db.query('UPDATE users SET name = ?, password_hash = ? WHERE id = ?', [name, hash, existing.id]);
    user = { ...existing, name, password_hash: hash };
  } else {
    const [result] = await db.query('INSERT INTO users (name, email, password_hash, email_verified) VALUES (?, ?, ?, 0)',
      [name, email, hash]);
    user = (await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]))[0][0];
  }

  const outcome = await sendCode(user, 'verify');
  res.status(201).json({
    needsVerification: true,
    email,
    devCode: outcome && !outcome.ok ? outcome.code : null,
  });
}));

// POST /api/auth/verify-email  { email, code }
router.post('/verify-email', otpCheckLimiter, wrap(async (req, res) => {
  const user = await getUserByEmail(cleanEmail(req.body.email));
  if (!user || !(await otp.check(user.id, 'verify', req.body.code))) throw badCode();
  await db.query('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);
  user.email_verified = 1;
  await logEvent(user.id, 'email_verified', req);
  await finishLogin(user, req, res);
}));

// ---------- Log in ----------

// POST /api/auth/login
router.post('/login', loginIpLimiter, loginLimiter, wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password.slice(0, 200) : '';

  const user = await getUserByEmail(email);
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    console.warn(`Failed login for ${maskEmail(email || 'unknown')} from ${req.ip}`);
    if (user) await logEvent(user.id, 'login_failed', req);
    return res.status(401).json({ message: 'Wrong email or password' });
  }
  // Password is right. Two more things may be needed before a real session starts.
  if (!user.email_verified && REQUIRE_VERIFY) {
    await sendCode(user, 'verify');
    return res.status(403).json({ needsVerification: true, email: user.email, message: 'Confirm your email first. We sent you a code.' });
  }
  if (user.totp_enabled) {
    return res.json({ needs2fa: true, method: 'app', email: user.email, ticket: makeTicket({ id: user.id }, 'login2fa') });
  }
  if (user.two_factor && mailer.enabled) {
    await sendCode(user, 'login');
    return res.json({ needs2fa: true, method: 'email', email: user.email, ticket: makeTicket({ id: user.id }, 'login2fa') });
  }
  await finishLogin(user, req, res);
}));

// POST /api/auth/login-otp  { ticket, code }   (second step, only for accounts with 2-step login on)
router.post('/login-otp', otpCheckLimiter, wrap(async (req, res) => {
  const t = readTicket(req.body.ticket, 'login2fa');
  const user = (await db.query('SELECT * FROM users WHERE id = ?', [t.id]))[0][0];
  const good = user && (user.totp_enabled ? await checkAppCode(user, req.body.code) : await otp.check(user.id, 'login', req.body.code));
  if (!good) {
    if (user) await logEvent(user.id, 'login_code_failed', req);
    throw badCode();
  }
  await finishLogin(user, req, res);
}));

// POST /api/auth/resend-code  { purpose: 'verify' | 'login', email?, ticket? }
router.post('/resend-code', otpSendLimiter, wrap(async (req, res) => {
  let user;
  let purpose;
  if (req.body.purpose === 'login') {
    purpose = 'login';
    user = (await db.query('SELECT * FROM users WHERE id = ?', [readTicket(req.body.ticket, 'login2fa').id]))[0][0];
  } else {
    purpose = 'verify';
    user = await getUserByEmail(cleanEmail(req.body.email));
    if (user && user.email_verified) user = null;
  }
  if (user) await sendCode(user, purpose);
  res.json({ ok: true, message: 'If that is possible, a new code is on its way.' });
}));

// ---------- Forgot password ----------

// POST /api/auth/forgot  { email }
router.post('/forgot', otpSendLimiter, wrap(async (req, res) => {
  const email = v.email(req.body.email);
  const user = await getUserByEmail(email);
  if (user) await sendCode(user, 'reset');
  const latest = mailer.getLatestCode(email, 'reset');
  res.json({
    ok: true,
    message: 'If an account exists for that email, a code has been sent.',
    previewCode: latest ? latest.code : null,
    previewUrl: latest ? latest.previewUrl : null,
    provider: latest ? latest.provider : null,
  });
}));

// GET /api/auth/recent-emails
router.get('/recent-emails', wrap(async (req, res) => {
  res.json({
    emails: mailer.getRecentEmails(),
    status: mailer.getMailStatus(),
  });
}));

// GET /api/auth/mail-status
router.get('/mail-status', wrap(async (req, res) => {
  res.json(mailer.getMailStatus());
}));

// POST /api/auth/test-email { email }
router.post('/test-email', wrap(async (req, res) => {
  const email = v.email(req.body.email);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const record = await mailer.sendOtp(email, 'IdeaForge User', code, 'verify');
  res.json({
    ok: true,
    message: `Test email dispatched to ${email}`,
    code,
    provider: record?.provider || 'in-app',
    previewUrl: record?.previewUrl || null,
  });
}));

// POST /api/auth/save-gmail-config { gmailUser, gmailPass }
router.post('/save-gmail-config', wrap(async (req, res) => {
  const gmailUser = v.email(req.body.gmailUser);
  const rawPass = String(req.body.gmailPass || '').trim().replace(/\s+/g, '');
  if (!rawPass || rawPass.length < 8) {
    return res.status(400).json({ message: 'Please provide a valid 16-character Google App Password.' });
  }

  // 1. Verify credentials with Google SMTP first
  const testTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: rawPass },
  });

  try {
    await testTransporter.verify();
  } catch (err) {
    console.error('Gmail authentication verification failed:', err.message);
    return res.status(400).json({
      message: `Google rejected credentials: ${err.message}. Make sure 2-Step Verification is enabled and you generated a 16-character App Password at myaccount.google.com/apppasswords.`,
    });
  }

  // 2. Set in runtime environment
  process.env.GMAIL_USER = gmailUser;
  process.env.GMAIL_PASS = rawPass;
  process.env.MAIL_PROVIDER = 'smtp';
  process.env.MAIL_FROM = gmailUser;
  mailer.initConfiguredTransporter();

  // 3. Persist into backend/.env
  try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (/^MAIL_PROVIDER=/m.test(content)) content = content.replace(/^MAIL_PROVIDER=.*$/m, 'MAIL_PROVIDER=smtp');
      else content += '\nMAIL_PROVIDER=smtp';

      if (/^GMAIL_USER=/m.test(content)) content = content.replace(/^GMAIL_USER=.*$/m, `GMAIL_USER=${gmailUser}`);
      else content += `\nGMAIL_USER=${gmailUser}`;

      if (/^GMAIL_PASS=/m.test(content)) content = content.replace(/^GMAIL_PASS=.*$/m, `GMAIL_PASS=${rawPass}`);
      else content += `\nGMAIL_PASS=${rawPass}`;

      if (/^MAIL_FROM=/m.test(content)) content = content.replace(/^MAIL_FROM=.*$/m, `MAIL_FROM=${gmailUser}`);
      else content += `\nMAIL_FROM=${gmailUser}`;

      fs.writeFileSync(envPath, content, 'utf8');
    }
  } catch (e) {
    console.warn('Could not write to .env:', e.message);
  }

  // 4. Send a real test email to the user's Gmail
  const testCode = String(Math.floor(100000 + Math.random() * 900000));
  await mailer.sendOtp(gmailUser, 'IdeaForge User', testCode, 'verify');

  res.json({
    ok: true,
    message: `Gmail connected successfully! A live verification email with code ${testCode} has been sent directly to ${gmailUser}. Check your phone/Gmail inbox!`,
    gmailUser,
    code: testCode,
  });
}));

// GET /api/auth/dev-latest-code (Disabled for production security)
router.get('/dev-latest-code', (req, res) => {
  res.status(404).json({ message: 'Debug inbox endpoints are disabled.' });
});

// POST /api/auth/reset/verify  { email, code } -> a 10-minute pass to choose a new password
router.post('/reset/verify', otpCheckLimiter, wrap(async (req, res) => {
  const user = await getUserByEmail(cleanEmail(req.body.email));
  if (!user || !(await otp.check(user.id, 'reset', req.body.code))) throw badCode();
  res.json({ resetToken: makeTicket({ id: user.id, ph: pwFingerprint(user.password_hash) }, 'reset') });
}));

// POST /api/auth/reset  { resetToken, newPassword }
router.post('/reset', otpCheckLimiter, wrap(async (req, res) => {
  const t = readTicket(req.body.resetToken, 'reset');
  const user = (await db.query('SELECT * FROM users WHERE id = ?', [t.id]))[0][0];
  // The pass stops working once the password has changed, so it can only be used once.
  if (!user || pwFingerprint(user.password_hash) !== t.ph) throw new v.ValidationError('This step has expired. Please start again.');
  const next = v.password(req.body.newPassword, { email: user.email });
  await db.query('UPDATE users SET password_hash = ?, token_version = token_version + 1, email_verified = 1 WHERE id = ?',
    [await bcrypt.hash(next, COST), user.id]);
  await logEvent(user.id, 'password_reset', req);
  notify(user, 'Your IdeaForge password was reset', 'Your password was just reset and you were signed out everywhere.');
  res.json({ ok: true });
}));

// ---------- Signed-in account security ----------

// GET /api/auth/me  (used by the frontend to restore login after refresh)
router.get('/me', auth, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!rows.length) return res.status(401).json({ message: 'Please log in again' });
  res.json(publicUser(rows[0]));
}));

// GET /api/auth/security  -> settings and the latest account activity
router.get('/security', auth, wrap(async (req, res) => {
  const user = (await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]))[0][0];
  const [events] = await db.query(
    'SELECT id, type, ip, agent, created_at FROM security_events WHERE user_id = ? ORDER BY id DESC LIMIT 12', [req.user.id]);
  res.json({
    twoFactor: !!user.two_factor, totp: !!user.totp_enabled, backupLeft: JSON.parse(user.backup_codes || '[]').length,
    emailVerified: !!user.email_verified, mailConfigured: mailer.enabled, hasPassword: !!user.has_password,
    providers: { google: !!user.google_id, github: !!user.github_id }, events,
  });
}));

// PUT /api/auth/password  { currentPassword, newPassword }
// Wrong current password answers 400 (not 401) so the app does not treat it as an expired session.
router.put('/password', auth, passwordLimiter, wrap(async (req, res) => {
  const current = typeof req.body.currentPassword === 'string' ? req.body.currentPassword.slice(0, 200) : '';
  const user = (await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]))[0][0];
  if (!user) return res.status(401).json({ message: 'Please log in again' });

  if (user.has_password && !(await bcrypt.compare(current, user.password_hash))) {
    console.warn(`Wrong current password during change for user ${user.id}`);
    return res.status(400).json({ message: 'Your current password is not correct' });
  }
  const next = v.password(req.body.newPassword, { email: user.email });
  if (next === current) return res.status(400).json({ message: 'Choose a password that is different from the current one' });

  await db.query('UPDATE users SET password_hash = ?, has_password = 1, token_version = token_version + 1 WHERE id = ?', [await bcrypt.hash(next, COST), user.id]);
  user.token_version += 1;
  await logEvent(user.id, user.has_password ? 'password_changed' : 'password_set', req);
  notify(user, 'Your IdeaForge password was changed', 'Your password was just changed. Other devices were signed out.');
  res.json({ ok: true, token: makeToken(user) }); // this device stays signed in, all others are signed out
}));

// POST /api/auth/logout-others  { password }  Signs out every other device.
router.post('/logout-others', auth, passwordLimiter, wrap(async (req, res) => {
  const user = (await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]))[0][0];
  if (!user || !(await reauth(user, req.body))) return res.status(400).json({ message: NEEDS_AGAIN(user || {}) });
  await db.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [user.id]);
  user.token_version += 1;
  await logEvent(user.id, 'sessions_revoked', req);
  res.json({ ok: true, token: makeToken(user) });
}));

// PUT /api/auth/2fa  { enabled, password }  Turns 2-step login (a code by email at every login) on or off.
router.put('/2fa', auth, passwordLimiter, wrap(async (req, res) => {
  const user = (await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]))[0][0];
  if (!user || !(await reauth(user, req.body))) return res.status(400).json({ message: NEEDS_AGAIN(user || {}) });
  const enabled = req.body.enabled === true;
  if (enabled && !mailer.enabled) return res.status(503).json({ message: 'Email is not set up on this server, so 2-step login is not available.' });
  await db.query('UPDATE users SET two_factor = ? WHERE id = ?', [enabled ? 1 : 0, user.id]);
  await logEvent(user.id, enabled ? 'two_factor_on' : 'two_factor_off', req);
  notify(user, `2-step login turned ${enabled ? 'on' : 'off'}`, `2-step login was just turned ${enabled ? 'on' : 'off'} for your account.`);
  res.json({ ok: true, twoFactor: enabled });
}));

// ---------- Authenticator app (TOTP) ----------

// POST /api/auth/totp/setup  { password | confirmEmail }  -> QR code to scan. Nothing is switched on yet.
router.post('/totp/setup', auth, passwordLimiter, wrap(async (req, res) => {
  const user = (await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]))[0][0];
  if (!user || !(await reauth(user, req.body))) return res.status(400).json({ message: NEEDS_AGAIN(user || {}) });
  if (user.totp_enabled) return res.status(400).json({ message: 'An authenticator app is already set up. Turn it off first to set up a new one.' });
  const secret = totp.newSecret();
  await db.query('UPDATE users SET totp_secret = ? WHERE id = ?', [totp.seal(secret), user.id]);
  res.json({ secret, qr: await QRCode.toDataURL(totp.uri(secret, user.email), { margin: 1, width: 220 }) });
}));

// POST /api/auth/totp/enable  { code }  Proves the app works, then turns it on and returns backup codes (shown once).
router.post('/totp/enable', auth, otpCheckLimiter, wrap(async (req, res) => {
  const user = (await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]))[0][0];
  if (!user || !user.totp_secret || user.totp_enabled) return res.status(400).json({ message: 'Start the setup again.' });
  const step = totp.verify(totp.open(user.totp_secret), req.body.code);
  if (step === null) return res.status(400).json({ message: 'That code is not right. Check the code in your app and try again.' });
  const codes = totp.newBackupCodes();
  await db.query('UPDATE users SET totp_enabled = 1, totp_last = ?, backup_codes = ? WHERE id = ?',
    [step, JSON.stringify(codes.map((c) => totp.hashBackup(c))), user.id]);
  await logEvent(user.id, 'totp_on', req);
  notify(user, 'Authenticator app turned on', 'An authenticator app was just set up for your account.');
  res.json({ ok: true, backupCodes: codes });
}));

// POST /api/auth/totp/disable  { password | confirmEmail, code }
router.post('/totp/disable', auth, passwordLimiter, wrap(async (req, res) => {
  const user = (await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]))[0][0];
  if (!user || !(await reauth(user, req.body))) return res.status(400).json({ message: NEEDS_AGAIN(user || {}) });
  if (user.totp_enabled && !(await checkAppCode(user, req.body.code))) return res.status(400).json({ message: 'Enter a current code from your app (or a backup code) to turn it off.' });
  await db.query('UPDATE users SET totp_enabled = 0, totp_secret = NULL, backup_codes = NULL, totp_last = 0 WHERE id = ?', [user.id]);
  await logEvent(user.id, 'totp_off', req);
  notify(user, 'Authenticator app turned off', 'The authenticator app was just removed from your account.');
  res.json({ ok: true });
}));

require('./oauth')(router, { makeTicket, logEvent, finishLogin, mailEnabled: mailer.enabled });

module.exports = router;
