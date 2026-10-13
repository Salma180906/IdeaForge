import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, ThumbsUp, Users, MessageSquare, Eye, Pencil, History } from 'lucide-react';
import { api } from '../api/client';
import { useDocumentTitle } from '../hooks';
import { Spinner, ErrorBox, EmptyState, StagePill, ThermalStrip } from '../components/ui';
import { timeAgo, versionLabel } from '../utils';

const TABS = {
  All: () => true,
  Drafts: (i) => !i.is_published,
  Published: (i) => !!i.is_published,
  Evolving: (i) => i.is_published && i.current_version > 1 && i.stage !== 'evolved',
  Evolved: (i) => i.stage === 'evolved',
};

export default function MyIdeas() {
  useDocumentTitle('My ideas');
  const [ideas, setIdeas] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('All');

  useEffect(() => { api.get('/ideas/mine').then(setIdeas).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorBox message={error} />;
  if (!ideas) return <Spinner />;
  const shown = ideas.filter(TABS[tab]);

  return (
    <div>
      <div className="page-head">
        <div><h1>My ideas</h1><p>Everything you have created, from first draft to fully evolved.</p></div>
        <Link to="/create" className="btn btn-primary"><PlusCircle size={16} /> New idea</Link>
      </div>

      <div className="chips" role="group" aria-label="Filter">
        {Object.keys(TABS).map((t) => (
          <button key={t} className={`chip ${tab === t ? 'on' : ''}`} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t} <small>{ideas.filter(TABS[t]).length}</small>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Nothing here yet" text="Ideas that match this filter will appear here." />
      ) : (
        <div className="rows">
          {shown.map((i) => (
            <article key={i.id} className="row-card">
              <div className="row-ver"><ThermalStrip version={i.current_version} /><b>{versionLabel(i.current_version)}</b></div>
              <div className="row-main">
                <div className="row-tags"><span className="slab-cat">{i.category}</span><StagePill stage={i.stage} />{!i.is_published && <span className="kind kind-pending">Draft</span>}</div>
                <Link to={`/ideas/${i.id}`}><h3>{i.title}</h3></Link>
                <div className="row-meta">
                  <span><Eye size={13} /> {i.views}</span><span><ThumbsUp size={13} /> {i.votes}</span>
                  <span><Users size={13} /> {i.contributors}</span><span><MessageSquare size={13} /> {i.comment_count}</span>
                  <span>Updated {timeAgo(i.updated_at)}</span>
                </div>
              </div>
              <div className="row-actions">
                <Link to={`/ideas/${i.id}`} className="btn btn-outline btn-sm"><History size={14} /> History</Link>
                <Link to={`/ideas/${i.id}/edit`} className="btn btn-ghost btn-sm"><Pencil size={14} /> Edit</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
