// One-time codes. Only a keyed hash of each code is stored, never the code itself.
const crypto = require('crypto');
const db = require('../config/db');

const TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const COOLDOWN_SEC = 60;

const hashCode = (code, userId, purpose) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${userId}|${purpose}|${code}`).digest('hex');

// Makes a fresh 6-digit code and cancels any older unused code for the same purpose.
// Returns null when the previous code was sent less than a minute ago.
async function issue(userId, purpose) {
  const [last] = await db.query(
    'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age_sec FROM otp_codes WHERE user_id = ? AND purpose = ? ORDER BY id DESC LIMIT 1', [userId, purpose]);
  if (last.length && last[0].age_sec !== null && last[0].age_sec >= 0 && last[0].age_sec < COOLDOWN_SEC) return null;
  await db.query('UPDATE otp_codes SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [userId, purpose]);
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await db.query(
    'INSERT INTO otp_codes (user_id, purpose, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
    [userId, purpose, hashCode(code, userId, purpose), TTL_MIN]);
  return code;
}

// Checks a code. Right code: used up and returns true. Wrong code: counts an attempt.
async function check(userId, purpose, code) {
  const [rows] = await db.query(
    `SELECT * FROM otp_codes WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`, [userId, purpose]);
  const row = rows[0];
  if (!row || !/^\d{6}$/.test(String(code))) return false;
  if (row.attempts >= MAX_ATTEMPTS) return false;
  const a = Buffer.from(hashCode(String(code), userId, purpose));
  const b = Buffer.from(row.code_hash);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    const [r] = await db.query('UPDATE otp_codes SET used_at = NOW() WHERE id = ? AND used_at IS NULL', [row.id]);
    return r.affectedRows === 1; // two requests with the same code cannot both succeed
  }
  await db.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [row.id]);
  return false;
}

module.exports = { issue, check, TTL_MIN, COOLDOWN_SEC };
