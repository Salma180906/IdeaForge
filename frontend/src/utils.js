export const CATEGORIES = ['Technology', 'Education', 'Sustainability', 'Healthcare', 'Productivity', 'Social Impact', 'Business', 'Creative'];
export const STAGES = ['concept', 'exploring', 'refining', 'prototype', 'evolved'];
export const stageLabel = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Same limits as the backend, used on inputs.
export const LIMITS = { title: 150, description: 1500, section: 1500, comment: 1500, summary: 300, bio: 300, skills: 300, interests: 300, name: 60 };

// ---- Heat: the colour language of IdeaForge. Cold indigo (a raw idea) up to white-hot gold (evolved). ----
export const stageIndex = (stage) => Math.max(0, STAGES.indexOf(stage));
export const heatVar = (index) => `var(--h${Math.min(Math.max(index, 0), 4) + 1})`;
export const heatForStage = (stage) => heatVar(stageIndex(stage));
// Version 1 is cold, version 5 and above is white-hot (the backend moves the stage up the same way).
export const heatForVersion = (versionNo) => heatVar(versionNo - 1);

export function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const steps = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, size] of steps) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const versionLabel = (n) => `v${n}.0`;
export const splitTags = (t) => (t ? t.split(',').map((x) => x.trim()).filter(Boolean) : []);
export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// ---- Word-level diff (longest common subsequence). Powers "what changed" between versions. ----
export function diffWords(before = '', after = '') {
  const A = before.split(/(\s+)/).filter(Boolean);
  const B = after.split(/(\s+)/).filter(Boolean);
  const n = A.length;
  const m = B.length;
  if (n * m > 400000) return [{ type: 'del', text: before }, { type: 'add', text: after }]; // too big, show a plain swap

  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = A[i] === B[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out = [];
  const push = (type, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { push('same', A[i]); i += 1; j += 1; }
    else if (table[i + 1][j] >= table[i][j + 1]) { push('del', A[i]); i += 1; }
    else { push('add', B[j]); j += 1; }
  }
  while (i < n) { push('del', A[i]); i += 1; }
  while (j < m) { push('add', B[j]); j += 1; }
  return out;
}

export const DIFF_FIELDS = [
  ['title', 'Title'], ['description', 'Description'], ['problem', 'Problem being solved'],
  ['solution', 'Proposed solution'], ['target_users', 'Target users'], ['impact', 'Expected impact'],
];

// The fields that differ between two version snapshots, each with its word diff.
export function fieldDiffs(from, to) {
  return DIFF_FIELDS
    .filter(([key]) => (from[key] || '') !== (to[key] || ''))
    .map(([key, label]) => ({ key, label, ops: diffWords(from[key] || '', to[key] || '') }));
}
