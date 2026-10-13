require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { globalLimiter } = require('./middleware/limits');

// ---- Refuse to start with a weak or missing signing secret ----
const secret = process.env.JWT_SECRET || '';
if (!secret) {
  console.error('JWT_SECRET is missing. Add a long random text to your .env file (or Render environment).');
  process.exit(1);
}
if (secret.length < 32) {
  const message = 'JWT_SECRET is too short. Use at least 32 random characters.';
  if (process.env.NODE_ENV === 'production') { console.error(message); process.exit(1); }
  console.warn('Warning: ' + message);
}

const app = express();

// Render and Vercel sit behind a proxy. This makes req.ip the visitor's real address,
// which the rate limits depend on.
app.set('trust proxy', 1);

// Security headers (blocks sniffing, framing, forces HTTPS in browsers, and more).
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Only the websites listed in CLIENT_URL may call this API from a browser.
// Several are allowed when separated by commas. A trailing slash is ignored.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
app.use(cors({
  origin: (origin, done) => done(null, !origin || allowedOrigins.includes(origin)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

app.use(express.json({ limit: '20kb' })); // nobody needs to send more than this

app.get('/', (req, res) => res.json({ message: 'IdeaForge API is running' }));

// Everything under /api: rate limited, and never stored in a shared cache.
app.use('/api', globalLimiter, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ideas', require('./routes/ideas'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/me', require('./routes/me'));
app.use('/api/users', require('./routes/users'));
app.use('/api/ai', require('./routes/ai'));

// Anything else -> 404
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Last safety net: always answer with JSON, never an HTML error page or a stack trace.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'That request is too large' });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  require('./database/migrate')()
    .then(() => {
      console.log('Permanent cloud database verified & ready.');
    })
    .catch((err) => {
      console.warn('Database migration check warning:', err.message);
    });
  app.listen(PORT, () => console.log(`IdeaForge API running on http://localhost:${PORT}`));
}

module.exports = app;
