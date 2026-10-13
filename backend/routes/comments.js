const router = require('express').Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { wrap, notify, notifyFollowers, createNewVersion, FIELDS } = require('../utils/helpers');
const v = require('../utils/validate');

// Loads a suggestion and checks that the logged-in user owns the idea.
async function loadSuggestion(req, res) {
  const [rows] = await db.query('SELECT * FROM comments WHERE id = ?', [v.intId(req.params.id, 'Suggestion')]);
  if (!rows.length) { res.status(404).json({ message: 'Suggestion not found' }); return null; }
  const comment = rows[0];
  const [ideas] = await db.query('SELECT * FROM ideas WHERE id = ?', [comment.idea_id]);
  const idea = ideas[0];
  if (idea.owner_id !== req.user.id) { res.status(403).json({ message: 'Only the idea owner can do this' }); return null; }
  if (comment.type !== 'suggestion' || comment.status !== 'pending') {
    res.status(400).json({ message: 'This suggestion is already reviewed' }); return null;
  }
  return { comment, idea };
}

// PATCH /api/comments/:id/accept   body: { updates: { solution: "new text", ... } }  (updates optional)
// Accepting a suggestion creates a NEW VERSION and gives the suggester credit.
router.patch('/:id/accept', auth, wrap(async (req, res) => {
  const found = await loadSuggestion(req, res);
  if (!found) return;
  const { comment, idea } = found;

  const updates = {};
  const given = req.body.updates || {};
  FIELDS.forEach((f) => { if (given[f] !== undefined) updates[f] = v.ideaField(f, given[f]); });

  const version = await createNewVersion(idea, updates, comment.content, comment.user_id);
  await db.query("UPDATE comments SET status = 'accepted' WHERE id = ?", [comment.id]);

  await notify(comment.user_id, `Your suggestion was accepted in "${idea.title}" (Version ${version})`, idea.id);
  await notifyFollowers(idea.id, `"${idea.title}" evolved to Version ${version}`, req.user.id);
  res.json({ ok: true, version });
}));

// PATCH /api/comments/:id/reject
router.patch('/:id/reject', auth, wrap(async (req, res) => {
  const found = await loadSuggestion(req, res);
  if (!found) return;
  await db.query("UPDATE comments SET status = 'rejected' WHERE id = ?", [found.comment.id]);
  await notify(found.comment.user_id, `Your suggestion on "${found.idea.title}" was not accepted this time`, found.idea.id);
  res.json({ ok: true });
}));

module.exports = router;
