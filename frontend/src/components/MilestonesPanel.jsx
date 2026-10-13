import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, Plus, Trash2, Calendar, Flag, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { sound } from '../utils/sound';
import { Modal, Spinner, ErrorBox } from './ui';
import { useToast } from '../context/ToastContext';
import { getMockIdeaDetail } from '../data/exploreMockIdeas';

export default function MilestonesPanel({ ideaId, isOwner = false }) {
  const toast = useToast();
  const [milestones, setMilestones] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadMilestones = () => {
    if (String(ideaId).startsWith('mock-')) {
      const mock = getMockIdeaDetail(ideaId);
      setMilestones(mock?.idea?.milestones || []);
      setLoading(false);
      return;
    }
    api.get(`/ideas/${ideaId}/milestones`)
      .then(setMilestones)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMilestones();
  }, [ideaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleStatus = async (m) => {
    if (!isOwner) return;
    sound.click();
    const nextStatus = m.status === 'completed' ? 'todo' : m.status === 'todo' ? 'in_progress' : 'completed';
    try {
      await api.patch(`/ideas/${ideaId}/milestones/${m.id}`, { status: nextStatus });
      sound.success();
      loadMilestones();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (mId) => {
    if (!isOwner) return;
    if (!window.confirm('Delete this milestone from the roadmap?')) return;
    sound.pop();
    try {
      await api.delete(`/ideas/${ideaId}/milestones/${mId}`);
      toast.success('Milestone removed');
      loadMilestones();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    sound.click();
    try {
      await api.post(`/ideas/${ideaId}/milestones`, form);
      sound.success();
      toast.success('Milestone added to roadmap');
      setForm({ title: '', description: '', priority: 'medium', due_date: '' });
      setShowAddModal(false);
      loadMilestones();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;

  const list = milestones || [];
  const completedCount = list.filter((m) => m.status === 'completed').length;
  const progressPct = list.length > 0 ? Math.round((completedCount / list.length) * 100) : 0;

  return (
    <div className="milestones-panel">
      <div className="section-title">
        <div>
          <h2>Development Roadmap</h2>
          <p className="muted small">
            Track execution milestones and development goals as this idea evolves into reality.
          </p>
        </div>
        {isOwner && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              sound.pop();
              setShowAddModal(true);
            }}
          >
            <Plus size={14} /> Add Milestone
          </button>
        )}
      </div>

      {list.length > 0 && (
        <div className="milestone-progress-card">
          <div className="progress-card-head">
            <span className="small">Roadmap Completion</span>
            <span className="small font-bold">{completedCount} of {list.length} completed ({progressPct}%)</span>
          </div>
          <div className="progress-bar-track" style={{ height: '8px', background: 'var(--surface-3, rgba(255,255,255,0.06))', borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }}>
            <div
              className="progress-bar-fill"
              style={{
                height: '100%',
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #ff5722, #4caf50)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty-milestones" style={{ padding: '24px 0', textAlign: 'center' }}>
          <p className="muted small">No milestones established for this idea yet.</p>
          {isOwner && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: '8px' }}
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={14} /> Establish First Milestone
            </button>
          )}
        </div>
      ) : (
        <div className="milestone-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
          {list.map((m) => (
            <div
              key={m.id}
              className={`milestone-item status-${m.status}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '8px',
                background: 'var(--surface-2, rgba(255,255,255,0.03))',
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                className="status-toggle-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: isOwner ? 'pointer' : 'default',
                  padding: '2px',
                  color: m.status === 'completed' ? '#4caf50' : m.status === 'in_progress' ? '#ff9800' : 'var(--muted)',
                }}
                onClick={() => handleToggleStatus(m)}
                title={isOwner ? `Click to advance status (currently: ${m.status})` : m.status}
              >
                {m.status === 'completed' ? (
                  <CheckCircle2 size={18} />
                ) : m.status === 'in_progress' ? (
                  <Clock size={18} />
                ) : (
                  <Circle size={18} />
                )}
              </button>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <b style={{ textDecoration: m.status === 'completed' ? 'line-through' : 'none', opacity: m.status === 'completed' ? 0.75 : 1 }}>
                    {m.title}
                  </b>
                  <span className={`kind kind-${m.status}`} style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                    {m.status.replace('_', ' ')}
                  </span>
                  <span className={`tag-priority priority-${m.priority}`} style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.8 }}>
                    <Flag size={10} style={{ display: 'inline', marginRight: '3px' }} />
                    {m.priority}
                  </span>
                  {m.due_date && (
                    <span className="small muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={11} /> Due {new Date(m.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {m.description && (
                  <p className="prose small" style={{ marginTop: '6px', opacity: m.status === 'completed' ? 0.7 : 0.9 }}>
                    {m.description}
                  </p>
                )}
              </div>

              {isOwner && (
                <button
                  type="button"
                  className="link-btn text-danger"
                  style={{ opacity: 0.6, padding: '4px' }}
                  onClick={() => handleDelete(m.id)}
                  title="Delete milestone"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <Modal title="Create Development Milestone" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddSubmit}>
            <div className="field">
              <label htmlFor="m-title">Milestone Title</label>
              <input
                id="m-title"
                required
                maxLength={150}
                placeholder="e.g. Prototype User Testing, Smart Contract Audit"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="m-desc">Description (Optional)</label>
              <textarea
                id="m-desc"
                maxLength={500}
                placeholder="Key deliverables and acceptance criteria for this milestone..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="m-priority">Priority</label>
                <select
                  id="m-priority"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="m-due">Target Completion Date (Optional)</label>
                <input
                  id="m-due"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: '16px' }}>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Add to Roadmap'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
