import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useDocumentTitle } from '../hooks';
import { Spinner, ErrorBox, EmptyState } from '../components/ui';
import { formatDate, versionLabel } from '../utils';

export default function Contributions() {
  useDocumentTitle('Contributions');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/me/contributions').then(setRows).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorBox message={error} />;
  if (!rows) return <Spinner />;

  return (
    <div>
      <div className="page-head"><div><h1>Contributions</h1><p>Comments and suggestions you made on other people's ideas.</p></div></div>
      {rows.length === 0 ? (
        <EmptyState title="No contributions yet" text="Open an idea in Explore and suggest an improvement."
          action={<Link to="/explore" className="btn btn-primary">Explore ideas</Link>} />
      ) : (
        <div className="rows">
          {rows.map((c) => (
            <article key={c.id} className="row-card">
              <div className="row-main">
                <Link to={`/ideas/${c.idea_id}`}><h3>{c.idea_title}</h3></Link>
                <p className="prose quote-line">"{c.content}"</p>
                <div className="row-meta"><span>{formatDate(c.created_at)}</span><span>Idea is now {versionLabel(c.current_version)}</span></div>
              </div>
              <div className="row-actions">
                <span className={`kind kind-${c.type}`}>{c.type}</span>
                {c.type === 'suggestion' && <span className={`kind kind-${c.status}`}>{c.status}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
