import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks';
import { Spinner, ErrorBox } from '../components/ui';
import { CATEGORIES, LIMITS } from '../utils';

const EMPTY = { title: '', description: '', category: 'Technology', tags: '', problem: '', solution: '', target_users: '', impact: '' };
const CHECK = [['title', 'A title'], ['description', 'A short description'], ['problem', 'The problem'], ['solution', 'The solution'], ['target_users', 'Who it is for'], ['impact', 'The impact']];

function Counter({ value, max }) {
  return <span className="hint"><span /> <span>{value.length}/{max}</span></span>;
}

export default function IdeaForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocumentTitle(editing ? 'Edit idea' : 'New idea');
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [summary, setSummary] = useState('');
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;
    api.get(`/ideas/${id}`).then((d) => {
      if (!d.isOwner) { setError('Only the owner can edit this idea.'); setLoading(false); return; }
      const i = d.idea;
      setForm({ title: i.title, description: i.description, category: i.category, tags: i.tags || '',
        problem: i.problem || '', solution: i.solution || '', target_users: i.target_users || '', impact: i.impact || '' });
      setPublished(!!i.is_published);
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, [id, editing]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (publish) => {
    setError('');
    if (!form.title.trim() || !form.description.trim()) { setError('Add a title and a short description first.'); return; }
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/ideas/${id}`, { ...form, publish: published || publish, change_summary: summary });
        toast.success(published ? 'Saved as a new version.' : 'Changes saved.');
        window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
        navigate(`/ideas/${id}`);
      } else {
        const r = await api.post('/ideas', { ...form, publish });
        toast.success(publish ? 'Idea published.' : 'Draft saved. Only you can see it.');
        window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
        navigate(publish ? `/ideas/${r.id}` : '/my-ideas');
      }
    } catch (e) { setError(e.message); setBusy(false); }
  };

  if (loading) return <Spinner />;
  const done = CHECK.filter(([k]) => form[k].trim()).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{editing ? 'Edit idea' : 'Create a new idea'}</h1>
          <p>{editing && published ? 'Saving creates a new version in the history.' : 'Start rough. The community will help you shape it.'}</p>
        </div>
      </div>
      <div className="form-layout">
        <div className="panel">
          {error && <ErrorBox message={error} />}
          <div className="field"><label htmlFor="f-title">Idea title *</label>
            <input id="f-title" value={form.title} onChange={set('title')} maxLength={LIMITS.title} placeholder="e.g. Smart campus resource sharing" /></div>
          <div className="field"><label htmlFor="f-desc">Description *</label>
            <textarea id="f-desc" value={form.description} onChange={set('description')} maxLength={LIMITS.description} placeholder="Explain the idea in two or three sentences." />
            <Counter value={form.description} max={LIMITS.description} /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="f-cat">Category</label>
              <select id="f-cat" value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label htmlFor="f-tags">Tags</label>
              <input id="f-tags" value={form.tags} onChange={set('tags')} maxLength={150} placeholder="campus, sharing, students" />
              <span className="hint">Separate with commas</span></div>
          </div>
          <div className="field"><label htmlFor="f-prob">Problem being solved</label>
            <textarea id="f-prob" value={form.problem} onChange={set('problem')} maxLength={LIMITS.section} placeholder="Who struggles with what, and why does it matter?" /></div>
          <div className="field"><label htmlFor="f-sol">Proposed solution</label>
            <textarea id="f-sol" value={form.solution} onChange={set('solution')} maxLength={LIMITS.section} placeholder="How would your idea fix it?" /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="f-users">Target users</label>
              <textarea id="f-users" value={form.target_users} onChange={set('target_users')} maxLength={LIMITS.section} /></div>
            <div className="field"><label htmlFor="f-impact">Expected impact</label>
              <textarea id="f-impact" value={form.impact} onChange={set('impact')} maxLength={LIMITS.section} /></div>
          </div>
          {editing && published && (
            <div className="field"><label htmlFor="f-sum">What changed in this version?</label>
              <input id="f-sum" value={summary} maxLength={LIMITS.summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Added offline support after community feedback" />
              <span className="hint">Shown in the version history</span></div>
          )}
          <div className="form-actions">
            {editing && published ? (
              <button className="btn btn-primary" disabled={busy} onClick={() => save(true)}>Save as new version</button>
            ) : (
              <>
                <button className="btn btn-outline" disabled={busy} onClick={() => save(false)}>Save draft</button>
                <button className="btn btn-primary" disabled={busy} onClick={() => save(true)}>Publish idea</button>
              </>
            )}
            <button className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </div>

        <aside className="panel checklist">
          <h3>{done} of {CHECK.length} filled in</h3>
          <div className="check-bar"><i style={{ width: `${(done / CHECK.length) * 100}%` }} /></div>
          <ul>
            {CHECK.map(([k, label]) => (
              <li key={k} className={form[k].trim() ? 'ok' : ''}><Check size={14} aria-hidden="true" />{label}</li>
            ))}
          </ul>
          <p className="muted small">Fuller ideas get better suggestions. You can always add more later.</p>
        </aside>
      </div>
    </div>
  );
}
