const router = require('express').Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { wrap, IDEA_SELECT, withProgress } = require('../utils/helpers');
const v = require('../utils/validate');
const bcrypt = require('bcryptjs');

router.use(auth); // every route below needs login

// GET /api/me/counts - Fast live summary of menubar badges
router.get('/counts', wrap(async (req, res) => {
  const uid = req.user.id;
  const [[created]] = await db.query('SELECT COUNT(*) AS n FROM ideas WHERE owner_id = ?', [uid]);
  const [[following]] = await db.query('SELECT COUNT(*) AS n FROM follows WHERE user_id = ?', [uid]);
  const [[bookmarked]] = await db.query('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?', [uid]);
  const [[unread]] = await db.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [uid]);
  const [[contrib]] = await db.query(
    'SELECT COUNT(*) AS n FROM comments c JOIN ideas i ON i.id = c.idea_id WHERE c.user_id = ? AND i.owner_id <> ?',
    [uid, uid]
  );
  res.json({
    myIdeas: Number(created?.n || 0),
    following: Number(following?.n || 0),
    bookmarks: Number(bookmarked?.n || 0),
    notifications: Number(unread?.n || 0),
    contributions: Number(contrib?.n || 0),
  });
}));

// GET /api/me/dashboard
router.get('/dashboard', wrap(async (req, res) => {
  const uid = req.user.id;
  const [[created]] = await db.query('SELECT COUNT(*) AS n FROM ideas WHERE owner_id = ?', [uid]);
  const [[evolved]] = await db.query('SELECT COUNT(*) AS n FROM ideas WHERE owner_id = ? AND current_version > 1', [uid]);
  const [[contrib]] = await db.query(
    `SELECT COUNT(*) AS n FROM comments c JOIN ideas i ON i.id = c.idea_id
     WHERE c.user_id = ? AND i.owner_id <> ?`,
    [uid, uid]
  );
  const [[following]] = await db.query('SELECT COUNT(*) AS n FROM follows WHERE user_id = ?', [uid]);
  const [[bookmarked]] = await db.query('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?', [uid]);

  const [active] = await db.query(
    IDEA_SELECT + ' WHERE i.owner_id = ? AND i.is_published = 1 ORDER BY i.updated_at DESC LIMIT 6',
    [uid]
  );
  const [recommended] = await db.query(
    IDEA_SELECT + ' WHERE i.is_published = 1 AND i.owner_id <> ? ORDER BY votes DESC LIMIT 4',
    [uid]
  );
  const [activity] = await db.query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 8',
    [uid]
  );

  // Daily contributions over past 12 weeks
  const [days] = await db.query(
    `SELECT d, COUNT(*) AS n FROM (
       SELECT DATE(created_at) AS d FROM idea_versions WHERE created_by = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 83 DAY)
       UNION ALL SELECT DATE(created_at) FROM comments WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 83 DAY)
     ) x GROUP BY d`,
    [uid, uid]
  );
  const [[votesIn]] = await db.query('SELECT COUNT(*) AS n FROM votes WHERE idea_id IN (SELECT id FROM ideas WHERE owner_id = ?)', [uid]);
  const [[versions]] = await db.query('SELECT COUNT(*) AS n FROM idea_versions WHERE created_by = ?', [uid]);
  const [[heat]] = await db.query('SELECT COALESCE(AVG(current_version), 0) AS a, COALESCE(MAX(current_version), 0) AS m FROM ideas WHERE owner_id = ? AND is_published = 1', [uid]);

  const pad = (x) => String(x).padStart(2, '0');
  const calendar = days.map((r) => {
    const d = new Date(r.d);
    return { day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, n: Number(r.n) };
  });

  res.json({
    calendar,
    pulse: { votesReceived: votesIn.n, versions: versions.n, hottest: Number(heat.m) },
    stats: {
      ideasCreated: created.n,
      contributions: contrib.n,
      following: following.n,
      evolved: evolved.n,
      bookmarks: bookmarked.n,
    },
    activeIdeas: active.map(withProgress),
    recommended: recommended.map(withProgress),
    activity,
  });
}));

// GET /api/me/following
router.get('/following', wrap(async (req, res) => {
  const [rows] = await db.query(
    IDEA_SELECT + ' WHERE i.id IN (SELECT idea_id FROM follows WHERE user_id = ?) ORDER BY i.updated_at DESC',
    [req.user.id]
  );
  res.json(rows.map(withProgress));
}));

// GET /api/me/bookmarks
router.get('/bookmarks', wrap(async (req, res) => {
  const [rows] = await db.query(
    IDEA_SELECT + ' WHERE i.id IN (SELECT idea_id FROM bookmarks WHERE user_id = ?) ORDER BY i.updated_at DESC',
    [req.user.id]
  );
  res.json(rows.map(withProgress));
}));

// GET /api/me/contributions
router.get('/contributions', wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT c.id, c.type, c.content, c.status, c.created_at, i.id AS idea_id, i.title AS idea_title, i.current_version
     FROM comments c JOIN ideas i ON i.id = c.idea_id
     WHERE c.user_id = ? AND i.owner_id <> ? ORDER BY c.created_at DESC, c.id DESC`,
    [req.user.id, req.user.id]
  );
  res.json(rows);
}));

// GET /api/me/notifications
router.get('/notifications', wrap(async (req, res) => {
  const [rows] = await db.query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50',
    [req.user.id]
  );
  res.json(rows);
}));

// POST /api/me/notifications/read-all
router.post('/notifications/read-all', wrap(async (req, res) => {
  await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ ok: true });
}));

// PATCH /api/me/notifications/:id
router.patch('/notifications/:id', wrap(async (req, res) => {
  await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [v.intId(req.params.id, 'Notification'), req.user.id]);
  res.json({ ok: true });
}));

// PUT /api/me/profile { name, bio, skills, interests, avatarUrl }
router.put('/profile', wrap(async (req, res) => {
  const name = req.body.name ? v.str(req.body.name, 'Name', { min: 2, max: v.LIMITS.name }) : null;
  const bio = v.str(req.body.bio, 'Bio', { max: v.LIMITS.bio });
  const skills = v.str(req.body.skills, 'Skills', { max: v.LIMITS.skills });
  const interests = v.str(req.body.interests, 'Interests', { max: v.LIMITS.interests });
  const avatarUrl = req.body.avatarUrl ? String(req.body.avatarUrl).trim().slice(0, 500) : null;

  if (name) {
    await db.query(
      'UPDATE users SET name = ?, bio = ?, skills = ?, interests = ?, avatar_url = ? WHERE id = ?',
      [name, bio, skills, interests, avatarUrl, req.user.id]
    );
  } else {
    await db.query(
      'UPDATE users SET bio = ?, skills = ?, interests = ?, avatar_url = ? WHERE id = ?',
      [bio, skills, interests, avatarUrl, req.user.id]
    );
  }

  const [updated] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({
    ok: true,
    user: {
      id: updated[0].id,
      name: updated[0].name,
      email: updated[0].email,
      bio: updated[0].bio,
      skills: updated[0].skills,
      interests: updated[0].interests,
      avatarUrl: updated[0].avatar_url,
    },
  });
}));

// GET /api/me/export -> comprehensive user data package
router.get('/export', wrap(async (req, res) => {
  const uid = req.user.id;
  const q = async (sql, args = [uid]) => (await db.query(sql, args))[0];
  const [profile] = await q('SELECT id, name, email, bio, skills, interests, avatar_url, email_verified, two_factor, totp_enabled, created_at FROM users WHERE id = ?');
  const ideas = await q('SELECT * FROM ideas WHERE owner_id = ?');
  const versions = await q('SELECT v.* FROM idea_versions v JOIN ideas i ON i.id = v.idea_id WHERE i.owner_id = ? ORDER BY v.idea_id, v.version_no');
  const milestones = await q('SELECT * FROM idea_milestones WHERE created_by = ?');
  res.set('Content-Disposition', 'attachment; filename="ideaforge-my-data.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    profile,
    ideas,
    ideaVersions: versions,
    milestones,
    comments: await q('SELECT id, idea_id, type, content, status, created_at FROM comments WHERE user_id = ?'),
    votes: await q('SELECT idea_id FROM votes WHERE user_id = ?'),
    follows: await q('SELECT idea_id FROM follows WHERE user_id = ?'),
    bookmarks: await q('SELECT idea_id FROM bookmarks WHERE user_id = ?'),
    notifications: await q('SELECT message, is_read, created_at FROM notifications WHERE user_id = ?'),
    securityActivity: await q('SELECT type, ip, agent, created_at FROM security_events WHERE user_id = ? ORDER BY id DESC LIMIT 200'),
  });
}));

// DELETE /api/me/account { password | confirmEmail }
router.delete('/account', wrap(async (req, res) => {
  const user = (await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]))[0][0];
  const okay = user && (user.has_password
    ? typeof req.body.password === 'string' && (await bcrypt.compare(req.body.password.slice(0, 200), user.password_hash))
    : typeof req.body.confirmEmail === 'string' && req.body.confirmEmail.trim().toLowerCase() === user.email);
  if (!okay) return res.status(400).json({ message: user && !user.has_password ? 'Type your email address exactly to confirm' : 'Your password is not correct' });
  await db.query('DELETE FROM users WHERE id = ?', [user.id]);
  console.warn(`Account ${user.id} permanently deleted by owner`);
  res.json({ ok: true });
}));

module.exports = router;
