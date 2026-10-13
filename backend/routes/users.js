const router = require('express').Router();
const db = require('../config/db');
const { wrap, IDEA_SELECT, withProgress } = require('../utils/helpers');
const v = require('../utils/validate');

// GET /api/users/:id -> public profile with real reputation calculation
router.get('/:id', wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'User');
  const [users] = await db.query(
    'SELECT id, name, bio, skills, interests, avatar_url, created_at FROM users WHERE id = ?',
    [id]
  );
  if (!users.length) return res.status(404).json({ message: 'User not found' });
  const user = users[0];

  const [ideas] = await db.query(
    IDEA_SELECT + ' WHERE i.owner_id = ? AND i.is_published = 1 AND i.is_archived = 0 ORDER BY i.updated_at DESC',
    [id]
  );
  const [contributions] = await db.query(
    `SELECT c.id, c.type, c.content, c.status, c.created_at, i.id AS idea_id, i.title AS idea_title, i.current_version
     FROM comments c JOIN ideas i ON i.id = c.idea_id
     WHERE c.user_id = ? AND i.owner_id <> ? AND i.is_published = 1 ORDER BY c.created_at DESC LIMIT 30`,
    [id, id]
  );

  // Compute real reputation score from verified database activity
  const [[createdCount]] = await db.query('SELECT COUNT(*) AS n FROM ideas WHERE owner_id = ? AND is_published = 1', [id]);
  const [[acceptedCount]] = await db.query(
    'SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND type = ? AND status = ?',
    [id, 'suggestion', 'accepted']
  );
  const [[versionsCount]] = await db.query('SELECT COUNT(*) AS n FROM idea_versions WHERE created_by = ?', [id]);
  const [[votesReceived]] = await db.query(
    'SELECT COUNT(*) AS n FROM votes WHERE idea_id IN (SELECT id FROM ideas WHERE owner_id = ? AND is_published = 1)',
    [id]
  );

  const reputation =
    Number(createdCount.n || 0) * 10 +
    Number(acceptedCount.n || 0) * 25 +
    Number(versionsCount.n || 0) * 15 +
    Number(votesReceived.n || 0) * 5;

  res.json({
    user: {
      id: user.id,
      name: user.name,
      bio: user.bio,
      skills: user.skills,
      interests: user.interests,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      reputation,
      stats: {
        ideas: Number(createdCount.n || 0),
        acceptedSuggestions: Number(acceptedCount.n || 0),
        versionsEvolved: Number(versionsCount.n || 0),
        votesReceived: Number(votesReceived.n || 0),
      },
    },
    ideas: ideas.map(withProgress),
    contributions,
  });
}));

module.exports = router;
