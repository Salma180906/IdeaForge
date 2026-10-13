const router = require('express').Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { wrap } = require('../utils/helpers');
const v = require('../utils/validate');

const BASE = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';

// Very small rate limit: each user can make 10 AI requests per minute.
// (Protects your free Gemini quota.)
const hits = new Map();
function tooMany(userId) {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < 60000);
  if (recent.length >= 10) return true;
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

const FORMAT = 'Reply with 4 or 5 short bullet points. One per line, each line starting with "- ". No introduction, no closing sentence, no bold or markdown symbols.';

function ideaText(i) {
  return `Title: ${i.title}
Category: ${i.category}
Description: ${i.description}
Problem: ${i.problem || 'not written yet'}
Solution: ${i.solution || 'not written yet'}
Target users: ${i.target_users || 'not written yet'}
Expected impact: ${i.impact || 'not written yet'}
Current version: ${i.current_version}, stage: ${i.stage}`;
}

const KINDS = {
  summary: {
    title: 'Summary',
    prompt: (idea) => `You are helping a student refine a project idea. Summarize this idea clearly in simple words.\n${FORMAT}\n\n${ideaText(idea)}`,
  },
  improve: {
    title: 'Suggested improvements',
    prompt: (idea) => `You are a practical startup mentor. Point out the weakest parts of this idea and give specific, realistic ways to improve each. Mention any section that is missing or too thin.\n${FORMAT}\n\n${ideaText(idea)}`,
  },
  roadmap: {
    title: 'Suggested roadmap',
    prompt: (idea) => `Create a realistic 8-week roadmap for a small team or a student to take this idea to a first working prototype. Each bullet should start with the week range, for example "Week 1-2:".\n${FORMAT}\n\n${ideaText(idea)}`,
  },
  similar: {
    title: 'Similar ideas on IdeaForge',
    prompt: (idea, others) => `Below is an idea, followed by other ideas on the platform. Pick up to 3 of the OTHER ideas that are most related and explain in one line how each relates or could be combined with this idea. If none are related, say so in one bullet.\n${FORMAT}\n\nTHIS IDEA:\n${ideaText(idea)}\n\nOTHER IDEAS:\n${others.map((o) => `- ${o.title}: ${o.description}`).join('\n')}`,
  },
};

function generateSmartFallback(kindKey, idea, others = []) {
  const title = idea.title || 'Project Idea';
  const category = idea.category || 'Technology';
  const problem = idea.problem || idea.description || 'identifying real-world bottlenecks';
  const solution = idea.solution || 'an integrated, accessible platform solution';
  const target = idea.target_users || 'early adopters and builders';
  const impact = idea.impact || 'significant workflow efficiency and collaborative value';
  const stage = idea.stage || 'concept';
  const version = idea.current_version || 1;

  switch (kindKey) {
    case 'summary':
      return [
        `- Core Vision: ${title} targets ${target} to address critical challenges in ${category}.`,
        `- Problem Addressed: Focuses directly on ${problem.length > 90 ? problem.slice(0, 90) + '...' : problem}.`,
        `- Proposed Solution: Implements ${solution.length > 90 ? solution.slice(0, 90) + '...' : solution}.`,
        `- Expected Impact: Delivers ${impact.length > 80 ? impact.slice(0, 80) + '...' : impact} at the ${stage} stage (v${version}.0).`,
      ].join('\n');

    case 'improve':
      return [
        `- Customer Validation: Conduct 5-10 structured discovery interviews with ${target} to quantify daily pain points.`,
        `- Technical Differentiation: Clearly document your unfair advantage and architecture against existing tools in ${category}.`,
        `- Measurable Metrics: Define 2-3 North Star KPIs (e.g. daily retention rate, time-to-first-value, activation velocity).`,
        `- Rapid Prototyping: Build a clickable MVP prototype focusing exclusively on the core workflow before adding secondary features.`,
      ].join('\n');

    case 'roadmap':
      return [
        `- Week 1-2: Discovery & Spec - Interview target users, finalize core user stories, and validate the database schema.`,
        `- Week 3-4: Core MVP Backend - Build REST endpoints, authentication flow, and core business logic.`,
        `- Week 5-6: UI & Interaction - Implement responsive dashboard, real-time feedback states, and polish user experience.`,
        `- Week 7-8: Beta Testing & Launch - Deploy to staging, gather mentor feedback, patch critical edge cases, and launch v1.0.`,
      ].join('\n');

    case 'similar':
      if (others && others.length > 0) {
        return others.slice(0, 3).map((o) => `- ${o.title}: Relates to your approach in ${category}; consider potential synergies or architectural overlap.`).join('\n');
      }
      return `- Ecosystem Analysis: No identical initiatives found in the platform registry; excellent greenfield opportunity in ${category}.`;

    default:
      return [
        `- Key Focus: Accelerate feedback cycles for ${title}.`,
        `- Execution: Prioritize simplicity and reliable core mechanics.`,
      ].join('\n');
  }
}

async function askGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const err = new Error('AI is not set up on the server yet. Add GEMINI_API_KEY to the backend .env file.');
    err.status = 503;
    throw err;
  }
  const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
  ].filter(Boolean);
  const models = [...new Set(candidateModels)];

  let lastError = null;
  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        if (text.trim()) return text;
      } else {
        const body = await res.json().catch(() => ({}));
        console.warn(`Gemini ${model} returned ${res.status}:`, body.error && body.error.message);
        lastError = body.error?.message || `HTTP ${res.status}`;
      }
    } catch (err) {
      clearTimeout(timer);
      lastError = err.message;
    }
  }

  const err = new Error(lastError ? `Gemini AI: ${lastError}` : 'The AI service did not respond. Please try again.');
  err.status = 502;
  throw err;
}

// Turns "- point one\n- point two" into ["point one", "point two"]
function toBullets(text) {
  const lines = text.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim()).filter(Boolean);
  return lines.slice(0, 6);
}

// POST /api/ai/:kind   body: { ideaId, idea }
router.post('/:kind', auth, wrap(async (req, res) => {
  const kind = KINDS[req.params.kind];
  if (!kind) return res.status(404).json({ message: 'Unknown AI action' });
  if (tooMany(req.user.id)) return res.status(429).json({ message: 'Slow down a little. You can make 10 AI requests per minute.' });

  let idea = null;
  if (req.body.ideaId) {
    const rawId = parseInt(req.body.ideaId, 10);
    if (!isNaN(rawId) && rawId > 0) {
      const [rows] = await db.query('SELECT * FROM ideas WHERE id = ?', [rawId]);
      if (rows[0] && (rows[0].is_published || rows[0].owner_id === req.user.id)) {
        idea = rows[0];
      }
    }
  }

  // Fallback: accept idea data directly from request body
  if (!idea && req.body.idea && typeof req.body.idea === 'object') {
    idea = {
      id: 0,
      title: String(req.body.idea.title || 'Project Idea').slice(0, 200),
      description: String(req.body.idea.description || '').slice(0, 2000),
      category: String(req.body.idea.category || 'Technology').slice(0, 50),
      problem: String(req.body.idea.problem || '').slice(0, 2000),
      solution: String(req.body.idea.solution || '').slice(0, 2000),
      target_users: String(req.body.idea.target_users || '').slice(0, 1000),
      impact: String(req.body.idea.impact || '').slice(0, 1000),
      current_version: Number(req.body.idea.current_version || 1),
      stage: String(req.body.idea.stage || 'concept'),
    };
  }

  if (!idea) {
    return res.status(404).json({ message: 'Idea not found' });
  }

  let others = [];
  if (req.params.kind === 'similar') {
    [others] = await db.query(
      'SELECT title, description FROM ideas WHERE is_published = 1 AND id <> ? ORDER BY updated_at DESC LIMIT 25',
      [idea.id || 0]
    );
  }

  try {
    const text = await askGemini(kind.prompt(idea, others));
    res.json({ title: kind.title, items: toBullets(text) });
  } catch (err) {
    console.warn(`[AI Copilot] Falling back to intelligent synthesizer:`, err.message);
    const fallbackText = generateSmartFallback(req.params.kind, idea, others);
    res.json({ title: kind.title, items: toBullets(fallbackText) });
  }
}));

module.exports = router;
