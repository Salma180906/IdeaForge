// One-time codes. Only a keyed hash of each code is stored, never the code itself.
const crypto = require('crypto');
const db = require('../config/db');

const TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const COOLDOWN_SEC = 60;

const hashCode = (code, userId, purpose) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${userId}|${purpose}|${code}`).digest('hex');

// Makes a fresh 6-digit code.
// Returns null when the previous code was sent less than a minute ago.
async function issue(userId, purpose) {
  const [last] = await db.query(
    'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age_sec FROM otp_codes WHERE user_id = ? AND purpose = ? ORDER BY id DESC LIMIT 1', [userId, purpose]);
  if (last.length && last[0].age_sec !== null && last[0].age_sec >= 0 && last[0].age_sec < COOLDOWN_SEC) return null;
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await db.query(
    'INSERT INTO otp_codes (user_id, purpose, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
    [userId, purpose, hashCode(code, userId, purpose), TTL_MIN]);
  return code;
}

// Checks a code. If it matches any active, unexpired code for this user/purpose, verify succeeds.
async function check(userId, purpose, code) {
  const cleanCode = String(code || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) return false;

  const [rows] = await db.query(
    `SELECT * FROM otp_codes WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 5`, [userId, purpose]);
  if (!rows.length) return false;

  for (const row of rows) {
    if (row.attempts >= MAX_ATTEMPTS) continue;
    const a = Buffer.from(hashCode(cleanCode, userId, purpose));
    const b = Buffer.from(row.code_hash);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      await db.query('UPDATE otp_codes SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [userId, purpose]);
      return true;
    }
  }

  // Increment attempts on the latest active row
  await db.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [rows[0].id]);
  return false;
}

module.exports = { issue, check, TTL_MIN, COOLDOWN_SEC };
