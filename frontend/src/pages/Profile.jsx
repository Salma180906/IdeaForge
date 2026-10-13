import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, Flame, Award, CheckCircle, GitCommit, ThumbsUp } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks';
import { Avatar, Spinner, ErrorBox, EmptyState, StatLedger } from '../components/ui';
import IdeaCard from '../components/IdeaCard';
import { LIMITS, formatDate, splitTags } from '../utils';

// /profile is your own page (editable). /users/:id is anyone's public page.
export default function Profile() {
  const params = useParams();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const userId = params.id || user?.id;
  const isMe = user && Number(userId) === user.id;

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bio: '', skills: '', interests: '', avatarUrl: '' });
  useDocumentTitle(data?.user.name);

  useEffect(() => {
    setData(null); setError('');
    api.get(`/users/${userId}`).then((d) => {
      setData(d);
      setForm({
        bio: d.user.bio || '',
        skills: d.user.skills || '',
        interests: d.user.interests || '',
        avatarUrl: d.user.avatarUrl || '',
      });
    }).catch((e) => setError(e.message));
  }, [userId]);

  const save = async () => {
    try {
      await api.put('/me/profile', form);
      setUser({ ...user, ...form });
      setData({ ...data, user: { ...data.user, ...form } });
      setEditing(false);
      toast.success('Profile saved.');
    } catch (e) { toast.error(e.message); }
  };

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;
  const { user: u, ideas, contributions } = data;
  const stats = u.stats || {
    ideas: ideas.length,
    acceptedSuggestions: 0,
    versionsEvolved: 0,
    votesReceived: ideas.reduce((s, i) => s + Number(i.votes), 0),
  };

  return (
    <div>
      <section className="profile-head">
        <Avatar name={u.name} size={88} />
        <div className="profile-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>{u.name}</h1>
            <span
              className="reputation-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 12px',
                borderRadius: '100px',
                background: 'linear-gradient(135deg, rgba(255,87,34,0.15), rgba(255,152,0,0.15))',
                border: '1px solid rgba(255,87,34,0.3)',
                color: '#ff5722',
                fontSize: '13px',
                fontWeight: '700',
              }}
              title="Verified reputation score computed from created ideas, accepted suggestions, evolved versions, and received votes"
            >
              <Flame size={14} /> {u.reputation || 0} Rep
            </span>
          </div>

          {!editing && <p className="prose" style={{ marginTop: '8px' }}>{u.bio || 'No bio yet.'}</p>}
          {!editing && (
            <div className="tags">
              {splitTags(u.skills).map((s) => <span key={s} className="tag tag-skill">{s}</span>)}
              {splitTags(u.interests).map((s) => <span key={s} className="tag">#{s}</span>)}
            </div>
          )}
        </div>
        {isMe && !editing && (
          <button className="btn btn-outline" onClick={() => setEditing(true)}>
            <Pencil size={15} /> Edit profile
          </button>
        )}
      </section>

      {editing && (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="p-avatar">Avatar Image URL (Optional)</label>
            <input
              id="p-avatar"
              type="url"
              maxLength={500}
              placeholder="https://example.com/avatar.png"
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="p-bio">Bio</label>
            <textarea
              id="p-bio"
              maxLength={LIMITS.bio}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
            <span className="hint"><span /> <span>{form.bio.length}/{LIMITS.bio}</span></span>
          </div>
          <div className="field">
            <label htmlFor="p-skills">Skills</label>
            <input
              id="p-skills"
              maxLength={LIMITS.skills}
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
            />
            <span className="hint">Separate with commas</span>
          </div>
          <div className="field">
            <label htmlFor="p-int">Interests</label>
            <input
              id="p-int"
              maxLength={LIMITS.interests}
              value={form.interests}
              onChange={(e) => setForm({ ...form, interests: e.target.value })}
            />
            <span className="hint">Separate with commas</span>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={save}>Save profile</button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <StatLedger items={[
          { label: 'Ideas published', value: stats.ideas },
          { label: 'Accepted suggestions', value: stats.acceptedSuggestions },
          { label: 'Versions evolved', value: stats.versionsEvolved },
          { label: 'Votes received', value: stats.votesReceived },
          { label: 'Total reputation', value: u.reputation || 0 },
        ]} />
      </div>

      <div className="section">
        <div className="section-title"><h2>Idea portfolio</h2></div>
        {ideas.length ? (
          <div className="grid grid-slabs">{ideas.map((i) => <IdeaCard key={i.id} idea={i} />)}</div>
        ) : (
          <EmptyState title="No published ideas" text="Published ideas appear here." />
        )}
      </div>

      <div className="section">
        <div className="section-title"><h2>Contribution history</h2></div>
        <div className="panel">
          {contributions.length ? contributions.map((c) => (
            <div key={c.id} className="log-row">
              <span className={`kind kind-${c.type}`}>{c.type}</span>
              {c.type === 'suggestion' && <span className={`kind kind-${c.status}`}>{c.status}</span>}
              <Link to={`/ideas/${c.idea_id}`} className="log-title">{c.idea_title}</Link>
              <span className="vlog-tag" style={{ fontSize: '11px' }}>v{c.current_version}.0</span>
              <span className="muted small log-time">{formatDate(c.created_at)}</span>
            </div>
          )) : <p className="muted">No contributions yet.</p>}
        </div>
      </div>
    </div>
  );
}
