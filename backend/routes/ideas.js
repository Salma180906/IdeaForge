const router = require('express').Router();
const db = require('../config/db');
const QRCode = require('qrcode');
const { auth, optionalAuth } = require('../middleware/auth');
const {
  wrap, IDEA_SELECT, withProgress, notify, notifyFollowers, createNewVersion, stageForVersion, visibleIdea,
} = require('../utils/helpers');
const v = require('../utils/validate');

const STAGES = ['concept', 'exploring', 'refining', 'prototype', 'evolved'];
const SECTION_FIELDS = ['title', 'description', 'problem', 'solution', 'target_users', 'impact'];

// GET /api/ideas?search=&category=&stage=&sort=recent|popular|contributed|trending|evolved
router.get('/', optionalAuth, wrap(async (req, res) => {
  const search = v.str(req.query.search, 'Search', { max: v.LIMITS.search });
  const category = v.CATEGORIES.includes(req.query.category) ? req.query.category : '';
  const stage = STAGES.includes(req.query.stage) ? req.query.stage : '';
  const sort = req.query.sort;

  const uid = req.user ? req.user.id : null;
  let sql = uid
    ? `
      SELECT i.*, u.name AS author_name,
        (SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id) AS votes,
        (SELECT COUNT(*) FROM comments c WHERE c.idea_id = i.id) AS comment_count,
        (SELECT COUNT(DISTINCT c2.user_id) FROM comments c2 WHERE c2.idea_id = i.id) AS contributors,
        (SELECT COUNT(*) FROM comments c3 WHERE c3.idea_id = i.id AND c3.status = 'accepted') AS accepted_count,
        ((SELECT COUNT(*) FROM votes vm WHERE vm.idea_id = i.id AND vm.user_id = ?) > 0) AS has_voted,
        ((SELECT COUNT(*) FROM bookmarks bm WHERE bm.idea_id = i.id AND bm.user_id = ?) > 0) AS is_bookmarked,
        ((SELECT COUNT(*) FROM follows fm WHERE fm.idea_id = i.id AND fm.user_id = ?) > 0) AS is_following
      FROM ideas i JOIN users u ON u.id = i.owner_id`
    : IDEA_SELECT;

  sql += ' WHERE i.is_published = 1 AND i.is_archived = 0';
  const params = uid ? [uid, uid, uid] : [];
  if (search) {
    sql += ' AND (i.title LIKE ? OR i.description LIKE ? OR i.tags LIKE ? OR u.name LIKE ?)';
    const s = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    params.push(s, s, s, s);
  }
  if (category) {
    sql += ' AND i.category = ?';
    params.push(category);
  }
  if (stage) {
    sql += ' AND i.stage = ?';
    params.push(stage);
  }

  const orders = {
    recent: 'i.updated_at DESC',
    popular: 'votes DESC',
    contributed: 'contributors DESC',
    trending: '((votes * 3) + (contributors * 5) + (accepted_count * 4) + (i.views * 0.05)) DESC',
    evolved: 'i.current_version DESC',
  };

  sql += ' ORDER BY ' + (orders[sort] || orders.recent);
  const [rows] = await db.query(sql, params);
  res.json(rows.map((r) => ({
    ...withProgress(r),
    has_voted: Boolean(r.has_voted),
    is_bookmarked: Boolean(r.is_bookmarked),
    is_following: Boolean(r.is_following),
  })));
}));

// GET /api/ideas/mine (includes drafts and archived ideas)
router.get('/mine', auth, wrap(async (req, res) => {
  const [rows] = await db.query(IDEA_SELECT + ' WHERE i.owner_id = ? ORDER BY i.updated_at DESC', [req.user.id]);
  res.json(rows.map(withProgress));
}));

// GET /api/ideas/:id -> idea + versions + comments + contributors + my vote/follow/bookmark state
router.get('/:id', optionalAuth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const [rows] = await db.query(IDEA_SELECT + ' WHERE i.id = ?', [id]);
  if (!rows.length) return res.status(404).json({ message: 'Idea not found' });
  const idea = rows[0];
  const isOwner = req.user && req.user.id === idea.owner_id;
  if (!idea.is_published && !isOwner) return res.status(404).json({ message: 'Idea not found' });

  if (!isOwner) {
    await db.query('UPDATE ideas SET views = views + 1 WHERE id = ?', [id]);
  }

  const [versions] = await db.query(
    `SELECT v.*, u.name AS created_by_name FROM idea_versions v
     JOIN users u ON u.id = v.created_by WHERE v.idea_id = ? ORDER BY v.version_no ASC`,
    [id]
  );
  const [comments] = await db.query(
    `SELECT c.*, u.name AS user_name FROM comments c
     JOIN users u ON u.id = c.user_id WHERE c.idea_id = ? ORDER BY c.created_at DESC, c.id DESC`,
    [id]
  );
  const [contributors] = await db.query(
    `SELECT id, name, bio, avatar_url FROM users WHERE id IN (SELECT user_id FROM comments WHERE idea_id = ?)
     OR id IN (SELECT created_by FROM idea_versions WHERE idea_id = ?)`,
    [id, id]
  );

  let hasVoted = false;
  let isFollowing = false;
  let isBookmarked = false;
  if (req.user) {
    const [vt] = await db.query('SELECT 1 FROM votes WHERE user_id = ? AND idea_id = ?', [req.user.id, id]);
    const [f] = await db.query('SELECT 1 FROM follows WHERE user_id = ? AND idea_id = ?', [req.user.id, id]);
    const [b] = await db.query('SELECT 1 FROM bookmarks WHERE user_id = ? AND idea_id = ?', [req.user.id, id]);
    hasVoted = vt.length > 0;
    isFollowing = f.length > 0;
    isBookmarked = b.length > 0;
  }

  res.json({
    idea: withProgress(idea),
    versions,
    comments,
    contributors,
    hasVoted,
    isFollowing,
    isBookmarked,
    isOwner: !!isOwner,
  });
}));

// GET /api/ideas/:id/qr -> mobile scan QR Code DataURL
router.get('/:id/qr', wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
  const ideaUrl = `${clientUrl}/ideas/${id}`;
  const dataUrl = await QRCode.toDataURL(ideaUrl, {
    width: 280,
    margin: 2,
    color: { dark: '#0C0B12', light: '#FFFFFF' },
  });
  res.json({ url: ideaUrl, qr: dataUrl });
}));

// POST /api/ideas { title, description, category, tags, problem, solution, target_users, impact, publish }
router.post('/', auth, wrap(async (req, res) => {
  const b = req.body;
  const title = v.ideaField('title', b.title);
  const description = v.ideaField('description', b.description);
  const category = v.category(b.category);
  const tags = v.tags(b.tags);
  const problem = v.ideaField('problem', b.problem);
  const solution = v.ideaField('solution', b.solution);
  const targetUsers = v.ideaField('target_users', b.target_users);
  const impact = v.ideaField('impact', b.impact);

  const [result] = await db.query(
    `INSERT INTO ideas (owner_id, title, description, category, tags, problem, solution, target_users, impact, is_published)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [req.user.id, title, description, category, tags, problem, solution, targetUsers, impact, (b.publish || b.is_published) ? 1 : 0]
  );

  await db.query(
    `INSERT INTO idea_versions (idea_id, version_no, title, description, problem, solution, target_users, impact, change_summary, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [result.insertId, 1, title, description, problem, solution, targetUsers, impact, 'Initial concept', req.user.id]
  );

  res.status(201).json({ id: result.insertId });
}));

// PUT /api/ideas/:id { ...changed fields, change_summary, publish }
router.put('/:id', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const [rows] = await db.query('SELECT * FROM ideas WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).json({ message: 'Idea not found' });
  const idea = rows[0];
  if (idea.owner_id !== req.user.id) return res.status(403).json({ message: 'Only the owner can edit this idea' });

  const b = req.body;
  const updates = {};
  SECTION_FIELDS.forEach((f) => {
    if (b[f] !== undefined) updates[f] = v.ideaField(f, b[f]);
  });
  if (b.category) await db.query('UPDATE ideas SET category = ? WHERE id = ?', [v.category(b.category), idea.id]);
  if (b.tags !== undefined) await db.query('UPDATE ideas SET tags = ? WHERE id = ?', [v.tags(b.tags), idea.id]);

  // Draft mode: update in place
  if (!idea.is_published) {
    const m = { ...idea, ...updates };
    await db.query(
      `UPDATE ideas SET title=?, description=?, problem=?, solution=?, target_users=?, impact=?, is_published=? WHERE id=?`,
      [m.title, m.description, m.problem, m.solution, m.target_users, m.impact, (b.publish || b.is_published) ? 1 : 0, idea.id]
    );
    await db.query(
      `UPDATE idea_versions SET title=?, description=?, problem=?, solution=?, target_users=?, impact=?
       WHERE idea_id=? AND version_no=1`,
      [m.title, m.description, m.problem, m.solution, m.target_users, m.impact, idea.id]
    );
    return res.json({ id: idea.id, version: 1, current_version: 1 });
  }

  // Published mode: creates next version
  if (!Object.keys(updates).length) return res.json({ id: idea.id, version: idea.current_version, current_version: idea.current_version });
  const summary = v.str(b.change_summary, 'Change summary', { max: v.LIMITS.summary }) || 'Updated by the author';
  const version = await createNewVersion(idea, updates, summary, req.user.id);
  await notifyFollowers(idea.id, `"${idea.title}" evolved to Version ${version}`, req.user.id);
  res.json({ id: idea.id, version, current_version: version, stage: stageForVersion(version) });
}));

// POST /api/ideas/:id/restore-version { versionNo }
router.post('/:id/restore-version', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const versionNo = v.intId(req.body.versionNo, 'Version Number');
  const [rows] = await db.query('SELECT * FROM ideas WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).json({ message: 'Idea not found' });
  const idea = rows[0];
  if (idea.owner_id !== req.user.id) return res.status(403).json({ message: 'Only the idea owner can restore versions' });

  const [versions] = await db.query('SELECT * FROM idea_versions WHERE idea_id = ? AND version_no = ?', [id, versionNo]);
  if (!versions.length) return res.status(404).json({ message: 'Target version not found' });
  const target = versions[0];

  const updates = {
    title: target.title,
    description: target.description,
    problem: target.problem,
    solution: target.solution,
    target_users: target.target_users,
    impact: target.impact,
  };
  const summary = `Restored from Version ${versionNo}`;
  const newVersion = await createNewVersion(idea, updates, summary, req.user.id);
  await notifyFollowers(idea.id, `"${idea.title}" was restored from Version ${versionNo} to Version ${newVersion}`, req.user.id);
  res.json({ id: idea.id, version: newVersion, version_no: newVersion, stage: stageForVersion(newVersion) });
}));

// PATCH /api/ideas/:id/archive { archived: boolean }
router.patch('/:id/archive', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const [rows] = await db.query('SELECT * FROM ideas WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).json({ message: 'Idea not found' });
  const idea = rows[0];
  if (idea.owner_id !== req.user.id) return res.status(403).json({ message: 'Only the idea owner can archive it' });

  const isArchived = req.body.archived !== false ? 1 : 0;
  await db.query('UPDATE ideas SET is_archived = ? WHERE id = ?', [isArchived, id]);
  res.json({ ok: true, isArchived: !!isArchived });
}));

// DELETE /api/ideas/:id
router.delete('/:id', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const [rows] = await db.query('SELECT * FROM ideas WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).json({ message: 'Idea not found' });
  if (rows[0].owner_id !== req.user.id) return res.status(403).json({ message: 'Only the idea owner can delete it' });

  await db.query('DELETE FROM ideas WHERE id = ?', [id]);
  res.json({ ok: true });
}));

// POST /api/ideas/:id/vote (toggle)
router.post('/:id/vote', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const idea = await visibleIdea(id, req.user.id);
  if (!idea) return res.status(404).json({ message: 'Idea not found' });

  const [existing] = await db.query('SELECT 1 FROM votes WHERE user_id = ? AND idea_id = ?', [req.user.id, id]);
  if (existing.length) {
    await db.query('DELETE FROM votes WHERE user_id = ? AND idea_id = ?', [req.user.id, id]);
  } else {
    await db.query('INSERT INTO votes (user_id, idea_id) VALUES (?, ?)', [req.user.id, id]);
    if (idea.owner_id !== req.user.id) {
      await notify(idea.owner_id, `${req.user.name} voted for "${idea.title}"`, id);
    }
  }
  const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM votes WHERE idea_id = ?', [id]);
  res.json({ voted: !existing.length, votes: count });
}));

// POST /api/ideas/:id/follow (toggle)
router.post('/:id/follow', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const idea = await visibleIdea(id, req.user.id);
  if (!idea) return res.status(404).json({ message: 'Idea not found' });

  const [existing] = await db.query('SELECT 1 FROM follows WHERE user_id = ? AND idea_id = ?', [req.user.id, id]);
  if (existing.length) {
    await db.query('DELETE FROM follows WHERE user_id = ? AND idea_id = ?', [req.user.id, id]);
  } else {
    await db.query('INSERT INTO follows (user_id, idea_id) VALUES (?, ?)', [req.user.id, id]);
    if (idea.owner_id !== req.user.id) {
      await notify(idea.owner_id, `${req.user.name} started following "${idea.title}"`, id);
    }
  }
  res.json({ following: !existing.length });
}));

// POST /api/ideas/:id/bookmark (toggle)
router.post('/:id/bookmark', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const idea = await visibleIdea(id, req.user.id);
  if (!idea) return res.status(404).json({ message: 'Idea not found' });

  const [existing] = await db.query('SELECT 1 FROM bookmarks WHERE user_id = ? AND idea_id = ?', [req.user.id, id]);
  if (existing.length) {
    await db.query('DELETE FROM bookmarks WHERE user_id = ? AND idea_id = ?', [req.user.id, id]);
    return res.json({ bookmarked: false });
  } else {
    await db.query('INSERT INTO bookmarks (user_id, idea_id) VALUES (?, ?)', [req.user.id, id]);
    return res.json({ bookmarked: true });
  }
}));

// POST /api/ideas/:id/comments { type: 'comment' | 'suggestion', content }
router.post('/:id/comments', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const content = v.str(req.body.content, 'Your message', { required: true, max: v.LIMITS.comment });
  const type = req.body.type === 'suggestion' ? 'suggestion' : 'comment';

  const idea = await visibleIdea(id, req.user.id);
  if (!idea) return res.status(404).json({ message: 'Idea not found' });

  const isSuggestion = type === 'suggestion';
  const [result] = await db.query(
    'INSERT INTO comments (idea_id, user_id, type, content, status) VALUES (?,?,?,?,?)',
    [id, req.user.id, type, content, isSuggestion ? 'pending' : 'none']
  );
  if (idea.owner_id !== req.user.id) {
    await notify(
      idea.owner_id,
      `${req.user.name} ${isSuggestion ? 'suggested an improvement to' : 'commented on'} "${idea.title}"`,
      id
    );
  }
  const [rows] = await db.query(
    'SELECT c.*, u.name AS user_name, u.avatar_url FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?',
    [result.insertId]
  );
  res.status(201).json(rows[0]);
}));

// GET /api/ideas/:id/compare?v1=1&v2=3 -> two version snapshots for side-by-side view
router.get('/:id/compare', optionalAuth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const v1 = v.intId(req.query.v1, 'Version');
  const v2 = v.intId(req.query.v2, 'Version');
  const idea = await visibleIdea(id, req.user ? req.user.id : null);
  if (!idea) return res.status(404).json({ message: 'Idea not found' });

  const [rows] = await db.query('SELECT * FROM idea_versions WHERE idea_id = ? AND version_no IN (?, ?)', [id, v1, v2]);
  const from = rows.find((r) => r.version_no === v1);
  const to = rows.find((r) => r.version_no === v2);
  if (!from || !to) return res.status(404).json({ message: 'Version not found' });
  res.json({ from, to });
}));

// GET /api/ideas/:id/milestones -> development roadmap
router.get('/:id/milestones', optionalAuth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const idea = await visibleIdea(id, req.user ? req.user.id : null);
  if (!idea) return res.status(404).json({ message: 'Idea not found' });

  const [milestones] = await db.query(
    `SELECT m.*, u.name AS author_name FROM idea_milestones m
     JOIN users u ON u.id = m.created_by WHERE m.idea_id = ? ORDER BY m.created_at ASC`,
    [id]
  );
  res.json(milestones);
}));

// POST /api/ideas/:id/milestones { title, description, priority, dueDate }
router.post('/:id/milestones', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const idea = await visibleIdea(id, req.user.id);
  if (!idea) return res.status(404).json({ message: 'Idea not found' });
  if (idea.owner_id !== req.user.id) return res.status(403).json({ message: 'Only the idea owner can create roadmap milestones' });

  const title = v.str(req.body.title, 'Milestone Title', { required: true, max: 200 });
  const description = v.str(req.body.description, 'Description', { max: 1000 }) || null;
  const priority = ['low', 'medium', 'high'].includes(req.body.priority) ? req.body.priority : 'medium';
  const dueDate = req.body.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(req.body.dueDate) ? req.body.dueDate : null;

  const [result] = await db.query(
    `INSERT INTO idea_milestones (idea_id, title, description, priority, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, title, description, priority, dueDate, req.user.id]
  );
  const [rows] = await db.query(
    'SELECT m.*, u.name AS author_name FROM idea_milestones m JOIN users u ON u.id = m.created_by WHERE m.id = ?',
    [result.insertId]
  );
  res.status(201).json(rows[0]);
}));

// PATCH /api/ideas/:id/milestones/:mId { status, title, description, priority, dueDate }
router.patch('/:id/milestones/:mId', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const mId = v.intId(req.params.mId, 'Milestone');
  const idea = await visibleIdea(id, req.user.id);
  if (!idea) return res.status(404).json({ message: 'Idea not found' });
  if (idea.owner_id !== req.user.id) return res.status(403).json({ message: 'Only the idea owner can update roadmap milestones' });

  const [mRows] = await db.query('SELECT * FROM idea_milestones WHERE id = ? AND idea_id = ?', [mId, id]);
  if (!mRows.length) return res.status(404).json({ message: 'Milestone not found' });

  const updates = [];
  const params = [];
  if (req.body.status && ['todo', 'in_progress', 'completed'].includes(req.body.status)) {
    updates.push('status = ?');
    params.push(req.body.status);
  }
  if (req.body.title) {
    updates.push('title = ?');
    params.push(v.str(req.body.title, 'Title', { max: 200 }));
  }
  if (req.body.description !== undefined) {
    updates.push('description = ?');
    params.push(v.str(req.body.description, 'Description', { max: 1000 }) || null);
  }
  if (req.body.priority && ['low', 'medium', 'high'].includes(req.body.priority)) {
    updates.push('priority = ?');
    params.push(req.body.priority);
  }
  if (req.body.dueDate !== undefined) {
    updates.push('due_date = ?');
    params.push(req.body.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(req.body.dueDate) ? req.body.dueDate : null);
  }
  if (updates.length) {
    params.push(mId);
    await db.query(`UPDATE idea_milestones SET ${updates.join(', ')} WHERE id = ?`, params);
  }
  const [rows] = await db.query(
    'SELECT m.*, u.name AS author_name FROM idea_milestones m JOIN users u ON u.id = m.created_by WHERE m.id = ?',
    [mId]
  );
  res.json(rows[0]);
}));

// DELETE /api/ideas/:id/milestones/:mId
router.delete('/:id/milestones/:mId', auth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const mId = v.intId(req.params.mId, 'Milestone');
  const idea = await visibleIdea(id, req.user.id);
  if (!idea) return res.status(404).json({ message: 'Idea not found' });
  if (idea.owner_id !== req.user.id) return res.status(403).json({ message: 'Only the idea owner can remove milestones' });

  await db.query('DELETE FROM idea_milestones WHERE id = ? AND idea_id = ?', [mId, id]);
  res.json({ ok: true });
}));

// GET /api/ideas/:id/analytics -> comprehensive idea statistics
router.get('/:id/analytics', optionalAuth, wrap(async (req, res) => {
  const id = v.intId(req.params.id, 'Idea');
  const idea = await visibleIdea(id, req.user ? req.user.id : null);
  if (!idea) return res.status(404).json({ message: 'Idea not found' });

  const [[voteCount]] = await db.query('SELECT COUNT(*) AS total FROM votes WHERE idea_id = ?', [id]);
  const [[followerCount]] = await db.query('SELECT COUNT(*) AS total FROM follows WHERE idea_id = ?', [id]);
  const [[commentCount]] = await db.query("SELECT COUNT(*) AS total FROM comments WHERE idea_id = ? AND type = 'comment'", [id]);
  const [[suggestionCount]] = await db.query(
    "SELECT COUNT(*) AS total, COALESCE(SUM(status = 'accepted'), 0) AS accepted, COALESCE(SUM(status = 'pending'), 0) AS pending, COALESCE(SUM(status = 'rejected'), 0) AS rejected FROM comments WHERE idea_id = ? AND type = 'suggestion'",
    [id]
  );
  const [[versionCount]] = await db.query('SELECT COUNT(*) AS total FROM idea_versions WHERE idea_id = ?', [id]);
  const [[contributorCount]] = await db.query('SELECT COUNT(DISTINCT user_id) AS total FROM comments WHERE idea_id = ?', [id]);
  const [[milestoneData]] = await db.query(
    "SELECT COUNT(*) AS total, COALESCE(SUM(status = 'completed'), 0) AS completed, COALESCE(SUM(status = 'in_progress'), 0) AS in_progress, COALESCE(SUM(status = 'todo'), 0) AS todo FROM idea_milestones WHERE idea_id = ?",
    [id]
  );

  const totalMilestones = Number(milestoneData.total || 0);
  const completedMilestones = Number(milestoneData.completed || 0);
  const roadmapProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  const suggTotal = Number(suggestionCount.total || 0);
  const suggAccepted = Number(suggestionCount.accepted || 0);
  const suggRate = suggTotal > 0 ? Math.round((suggAccepted / suggTotal) * 100) : 0;

  res.json({
    views: idea.views || 0,
    votes: Number(voteCount.total || 0),
    followers: Number(followerCount.total || 0),
    currentVersion: idea.current_version,
    totalVersions: Number(versionCount.total || 0),
    versions: Number(versionCount.total || 0),
    contributors: Number(contributorCount.total || 0),
    comments: Number(commentCount.total || 0),
    suggestions: {
      total: suggTotal,
      accepted: suggAccepted,
      pending: Number(suggestionCount.pending || 0),
      declined: Number(suggestionCount.rejected || 0),
      rejected: Number(suggestionCount.rejected || 0),
      rate: suggRate,
    },
    milestones: {
      total: totalMilestones,
      completed: completedMilestones,
      inProgress: Number(milestoneData.in_progress || 0),
      todo: Number(milestoneData.todo || 0),
      rate: roadmapProgress,
    },
    roadmap: {
      total: totalMilestones,
      completed: completedMilestones,
      progress: roadmapProgress,
    },
  });
}));

module.exports = router;
