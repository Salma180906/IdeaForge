import { useState, useEffect } from 'react';
import { Eye, ThumbsUp, Heart, GitBranch, MessageSquare, CheckCircle, BarChart3 } from 'lucide-react';
import { api } from '../api/client';
import { Spinner, ErrorBox } from './ui';
import { getMockIdeaAnalytics } from '../data/exploreMockIdeas';

export default function AnalyticsPanel({ ideaId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (String(ideaId).startsWith('mock-')) {
      setStats(getMockIdeaAnalytics(ideaId));
      setLoading(false);
      return;
    }
    api.get(`/ideas/${ideaId}/analytics`)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ideaId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!stats) return null;

  return (
    <div className="analytics-panel">
      <div className="section-title">
        <div>
          <h2><BarChart3 size={18} style={{ display: 'inline', marginRight: '6px' }} /> Verified Analytics</h2>
          <p className="muted small">Real-time database performance and community evolution metrics.</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ gap: '12px', marginTop: '12px' }}>
        <div className="panel stat-metric-box">
          <div className="small muted"><Eye size={13} style={{ display: 'inline', marginRight: '4px' }} /> Total Views</div>
          <div className="metric-val" style={{ fontSize: '26px', fontWeight: '800', marginTop: '4px' }}>
            {stats.views.toLocaleString()}
          </div>
          <div className="small muted">Community impressions</div>
        </div>

        <div className="panel stat-metric-box">
          <div className="small muted"><ThumbsUp size={13} style={{ display: 'inline', marginRight: '4px' }} /> Endorsements (Votes)</div>
          <div className="metric-val" style={{ fontSize: '26px', fontWeight: '800', marginTop: '4px', color: '#ff5722' }}>
            {stats.votes.toLocaleString()}
          </div>
          <div className="small muted">Peer-validated votes</div>
        </div>

        <div className="panel stat-metric-box">
          <div className="small muted"><Heart size={13} style={{ display: 'inline', marginRight: '4px' }} /> Followers</div>
          <div className="metric-val" style={{ fontSize: '26px', fontWeight: '800', marginTop: '4px' }}>
            {stats.followers.toLocaleString()}
          </div>
          <div className="small muted">Tracking evolution updates</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: '12px', marginTop: '12px' }}>
        <div className="panel">
          <h4>Evolution Velocity</h4>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--ink)' }}>v{stats.currentVersion}.0</span>
            <span className="small muted">({stats.totalVersions} iterations preserved in audit log)</span>
          </div>
          <div className="small muted" style={{ marginTop: '8px' }}>
            {stats.contributors} unique community builders contributed to this idea.
          </div>
        </div>

        <div className="panel">
          <h4>Suggestion Acceptance Rate</h4>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: '900', color: '#4caf50' }}>{stats.suggestions.rate}%</span>
            <span className="small muted">({stats.suggestions.accepted} of {stats.suggestions.total} suggestions integrated)</span>
          </div>
          <div className="small muted" style={{ marginTop: '8px' }}>
            Pending reviews: <b>{stats.suggestions.pending}</b> · Declined: <b>{stats.suggestions.declined}</b>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4>Execution Roadmap Velocity</h4>
          <span className="small font-bold" style={{ color: '#4caf50' }}>{stats.milestones.rate}% Complete</span>
        </div>
        <div style={{ height: '6px', background: 'var(--surface-3, rgba(255,255,255,0.08))', borderRadius: '3px', overflow: 'hidden', margin: '8px 0' }}>
          <div
            style={{
              height: '100%',
              width: `${stats.milestones.rate}%`,
              background: 'linear-gradient(90deg, #ff9800, #4caf50)',
            }}
          />
        </div>
        <div className="small muted" style={{ display: 'flex', gap: '16px' }}>
          <span><b>{stats.milestones.completed}</b> completed</span>
          <span><b>{stats.milestones.inProgress}</b> in progress</span>
          <span><b>{stats.milestones.todo}</b> upcoming</span>
        </div>
      </div>
    </div>
  );
}
