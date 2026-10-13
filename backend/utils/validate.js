// Input checks used by every route. If a check fails it throws a ValidationError,
// and the route wrapper turns that into a clean 400 message for the user.

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.expose = true;
  }
}

const CATEGORIES = ['Technology', 'Education', 'Sustainability', 'Healthcare', 'Productivity', 'Social Impact', 'Business', 'Creative'];

// Maximum lengths. The frontend uses the same numbers on its inputs.
const LIMITS = {
  name: 60, email: 150, title: 150, description: 1500, section: 1500, comment: 1500,
  summary: 300, bio: 300, skills: 300, interests: 300, search: 100,
};

// Control characters (except tab and new line) have no place in user text.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function str(value, label, { min = 0, max, required = false } = {}) {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new ValidationError(`${label} must be text`);
  }
  const clean = String(value ?? '').replace(CONTROL, '').trim();
  if (required && !clean) throw new ValidationError(`${label} is required`);
  if (clean && clean.length < min) throw new ValidationError(`${label} must be at least ${min} characters`);
  if (max && clean.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer`);
  return clean;
}

function email(value) {
  const clean = str(value, 'Email', { required: true, max: LIMITS.email }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) throw new ValidationError('Enter a valid email address');
  return clean;
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyuiop', 'iloveyou1', 'admin123', 'welcome1', 'welcome123', 'letmein123', 'abc12345',
]);

// Rules: 8 to 72 characters (bcrypt only reads the first 72), at least one letter and one number,
// and not an obviously common password.
function password(value, { email: userEmail } = {}) {
  if (typeof value !== 'string') throw new ValidationError('Password is required');
  if (value.length < 8) throw new ValidationError('Password must be at least 8 characters');
  if (value.length > 72) throw new ValidationError('Password must be 72 characters or fewer');
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) throw new ValidationError('Password needs at least one letter and one number');
  if (COMMON_PASSWORDS.has(value.toLowerCase())) throw new ValidationError('That password is too common. Choose something less guessable');
  if (userEmail && value.toLowerCase() === userEmail.toLowerCase()) throw new ValidationError('Password cannot be the same as your email');
  return value;
}

function category(value) {
  const clean = str(value, 'Category', { required: true });
  if (!CATEGORIES.includes(clean)) throw new ValidationError('Choose one of the listed categories');
  return clean;
}

// Accepts "a, b, c" or ["a", "b"] and returns "a,b,c" (max 8 tags, 24 characters each).
function tags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  const cleaned = list
    .map((t) => str(typeof t === 'string' ? t : '', 'Tag').toLowerCase().replace(/^#/, ''))
    .filter(Boolean);
  if (cleaned.length > 8) throw new ValidationError('Use 8 tags or fewer');
  if (cleaned.some((t) => t.length > 24)) throw new ValidationError('Each tag must be 24 characters or fewer');
  return cleaned.join(',');
}

function intId(value, label = 'Id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new ValidationError(`${label} is not valid`);
  return n;
}

// Checks one editable idea field (used when an owner edits, or accepts a suggestion).
function ideaField(name, value) {
  if (name === 'title') return str(value, 'Title', { required: true, max: LIMITS.title });
  if (name === 'description') return str(value, 'Description', { required: true, max: LIMITS.description });
  const labels = { problem: 'Problem', solution: 'Solution', target_users: 'Target users', impact: 'Expected impact' };
  return str(value, labels[name] || name, { max: LIMITS.section });
}

module.exports = { ValidationError, CATEGORIES, LIMITS, str, email, password, category, tags, intId, ideaField };
