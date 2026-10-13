// Authenticator-app codes (TOTP, RFC 6238): the 6 digits in Google Authenticator, Authy, Microsoft Authenticator...
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30; // a new code every 30 seconds

function base32(buf) {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}
function fromBase32(str) {
  let bits = '';
  for (const c of str.replace(/=+$/, '').toUpperCase()) bits += ALPHABET.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

const newSecret = () => base32(crypto.randomBytes(20));

function codeAt(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', fromBase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, '0');
}

// Returns the time-step the code belongs to, or null. Allows one step either way for clock drift.
function verify(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code))) return null;
  const counter = Math.floor(now / 1000 / STEP);
  for (const d of [0, -1, 1]) {
    const a = Buffer.from(codeAt(secret, counter + d));
    const b = Buffer.from(String(code));
    if (crypto.timingSafeEqual(a, b)) return counter + d;
  }
  return null;
}

const uri = (secret, email) =>
  `otpauth://totp/IdeaForge:${encodeURIComponent(email)}?secret=${secret}&issuer=IdeaForge&algorithm=SHA1&digits=6&period=${STEP}`;

// The secret is stored encrypted, so a copy of the database alone cannot make codes.
const key = () => crypto.createHash('sha256').update(`totp|${process.env.JWT_SECRET}`).digest();
function seal(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
function open(sealed) {
  const [iv, tag, enc] = sealed.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

// One-time backup codes for a lost phone. Only hashes are stored.
const hashBackup = (code) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`backup|${code}`).digest('hex');
function newBackupCodes(n = 8) {
  return Array.from({ length: n }, () => {
    const a = crypto.randomBytes(5).toString('hex');
    return `${a.slice(0, 5)}-${a.slice(5)}`;
  });
}

module.exports = { codeAt, newSecret, verify, uri, seal, open, hashBackup, newBackupCodes };
