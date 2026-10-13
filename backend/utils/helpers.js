const db = require('../config/db');

// Wraps a route so any error returns a clean 500 instead of crashing.
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    if (err && err.expose) return res.status(err.status || 400).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: 'Something went wrong on the server' });
  });

// Base query used everywhere ideas are listed (adds author name + counts).
const IDEA_SELECT = `
  SELECT i.*, u.name AS author_name,
    (SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id) AS votes,
    (SELECT COUNT(*) FROM comments c WHERE c.idea_id = i.id) AS comment_count,
    (SELECT COUNT(DISTINCT c2.user_id) FROM comments c2 WHERE c2.idea_id = i.id) AS contributors,
    (SELECT COUNT(*) FROM comments c3 WHERE c3.idea_id = i.id AND c3.status = 'accepted') AS accepted_count
  FROM ideas i JOIN users u ON u.id = i.owner_id`;

// Evolution progress (0-100): filled sections + versions + accepted suggestions.
function withProgress(idea) {
  const sections = ['problem', 'solution', 'target_users', 'impact']
    .filter((f) => idea[f] && idea[f].trim().length > 10).length;
  const score =
    sections * 10 +                                    // up to 40
    Math.min(idea.current_version - 1, 4) * 10 +       // up to 40
    Math.min(Number(idea.accepted_count || 0), 4) * 5; // up to 20
  return { ...idea, progress: Math.min(score, 100) };
}

// The version number decides the stage automatically.
function stageForVersion(v) {
  if (v >= 5) return 'evolved';
  if (v === 4) return 'prototype';
  if (v === 3) return 'refining';
  if (v === 2) return 'exploring';
  return 'concept';
}

async function notify(userId, message, ideaId = null) {
  await db.query('INSERT INTO notifications (user_id, idea_id, message) VALUES (?, ?, ?)', [
    userId, ideaId, message,
  ]);
}

async function notifyFollowers(ideaId, message, exceptUserId) {
  const [rows] = await db.query('SELECT user_id FROM follows WHERE idea_id = ? AND user_id <> ?', [
    ideaId, exceptUserId,
  ]);
  for (const r of rows) await notify(r.user_id, message, ideaId);
}

const FIELDS = ['title', 'description', 'problem', 'solution', 'target_users', 'impact'];

// Creates the next version of an idea. `updates` holds only the fields that changed.
async function createNewVersion(idea, updates, summary, createdBy) {
  const merged = {};
  FIELDS.forEach((f) => { merged[f] = updates[f] !== undefined ? updates[f] : idea[f]; });
  const next = idea.current_version + 1;

  await db.query(
    `UPDATE ideas SET title=?, description=?, problem=?, solution=?, target_users=?, impact=?,
     current_version=?, stage=? WHERE id=?`,
    [merged.title, merged.description, merged.problem, merged.solution,
     merged.target_users, merged.impact, next, stageForVersion(next), idea.id]
  );
  await db.query(
    `INSERT INTO idea_versions
     (idea_id, version_no, title, description, problem, solution, target_users, impact, change_summary, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [idea.id, next, merged.title, merged.description, merged.problem, merged.solution,
     merged.target_users, merged.impact, summary, createdBy]
  );
  return next;
}

// Returns the idea only if it is published, or if the caller owns it. Drafts stay private.
async function visibleIdea(id, userId) {
  const [rows] = await db.query('SELECT * FROM ideas WHERE id = ?', [id]);
  const idea = rows[0];
  if (!idea) return null;
  if (!idea.is_published && idea.owner_id !== userId) return null;
  return idea;
}

module.exports = { visibleIdea, wrap, IDEA_SELECT, withProgress, stageForVersion, notify, notifyFollowers, createNewVersion, FIELDS };
