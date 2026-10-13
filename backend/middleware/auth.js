const jwt = require('jsonwebtoken');
const db = require('../config/db');

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Checks the signature, the "login" purpose, and that the user has not signed out everywhere since.
async function verifyLogin(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  if (payload.purpose) throw new Error('Not a login token'); // reset / 2-step tickets cannot be used as a login
  const [rows] = await db.query('SELECT token_version FROM users WHERE id = ?', [payload.id]);
  if (!rows.length || rows[0].token_version !== (payload.tv || 0)) throw new Error('Token revoked');
  return payload;
}

// Blocks the request if the user is not logged in.
async function auth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'Please log in first' });
  try {
    req.user = await verifyLogin(token);
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please log in again' });
  }
}

// Lets the request pass either way, but fills req.user if a valid token exists.
async function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try { req.user = await verifyLogin(token); } catch { /* treat as logged out */ }
  }
  next();
}

module.exports = { auth, optionalAuth };
