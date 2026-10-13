const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const tooMany = (message) => (req, res) => res.status(429).json({ message });

// Every API route: 300 requests per 15 minutes per IP (override with GLOBAL_RATE_MAX).
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.GLOBAL_RATE_MAX) || 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany('Too many requests. Please wait a few minutes and try again.'),
});

// Login: 10 wrong attempts per 15 minutes for the same email from the same IP.
// Successful logins do not count, so normal users are never locked out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_MAX) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || '').toLowerCase().slice(0, 150)}`,
  handler: tooMany('Too many failed logins for this account. Try again in 15 minutes.'),
});

// Also limit wrong attempts per IP across all emails (stops password guessing on many accounts).
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: tooMany('Too many failed logins from this network. Try again in 15 minutes.'),
});

// Sign-ups: 30 attempts per hour per IP. (Generous on purpose: a whole class on one campus
// network shares a single IP address.)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.REGISTER_RATE_MAX) || 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany('Too many sign-ups from this network. Try again later.'),
});

// Actions that ask for your password while signed in (change password, 2-step login, sign out others):
// 10 per hour per user, so a stolen session cannot be used to guess the password.
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `user-${req.user?.id || ipKeyGenerator(req.ip)}`,
  handler: tooMany('Too many password change attempts. Try again in an hour.'),
});

// Asking for codes (forgot password, resend): 5 per 15 minutes per email and network.
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.OTP_SEND_MAX) || 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || '').toLowerCase().slice(0, 150)}`,
  handler: tooMany('Too many code requests. Please wait 15 minutes and try again.'),
});

// Typing codes: 15 tries per 15 minutes per email and network (each code also allows only 5 wrong tries).
const otpCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.OTP_CHECK_MAX) || 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || '').toLowerCase().slice(0, 150)}`,
  handler: tooMany('Too many wrong codes. Please wait 15 minutes and try again.'),
});

module.exports = { globalLimiter, loginLimiter, loginIpLimiter, registerLimiter, passwordLimiter, otpSendLimiter, otpCheckLimiter };
