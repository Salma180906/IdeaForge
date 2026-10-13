import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartOff, MessageSquare, ThumbsUp } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks';
import { Spinner, ErrorBox, EmptyState, ThermalStrip } from '../components/ui';
import { timeAgo, versionLabel } from '../utils';

export default function Following() {
  useDocumentTitle('Following');
  const toast = useToast();
  const [ideas, setIdeas] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const loadFollowing = () => {
      api.get('/me/following')
        .then(setIdeas)
        .catch((e) => setError(e.message));
    };
    loadFollowing();
    window.addEventListener('ideaforge:nav-update', loadFollowing);
    return () => window.removeEventListener('ideaforge:nav-update', loadFollowing);
  }, []);

  const unfollow = async (id) => {
    try {
      await api.post(`/ideas/${id}/follow`);
      setIdeas(ideas.filter((i) => i.id !== id));
      toast.success('Unfollowed.');
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
    } catch (e) { toast.error(e.message); }
  };

  if (error) return <ErrorBox message={error} />;
  if (!ideas) return <Spinner />;

  return (
    <div>
      <div className="page-head"><div><h1>Following</h1><p>Ideas you are keeping an eye on. You get a notification when they reach a new version.</p></div></div>
      {ideas.length === 0 ? (
        <EmptyState title="You are not following any ideas" text="Follow an idea to hear about it when it evolves."
          action={<Link to="/explore" className="btn btn-primary">Explore ideas</Link>} />
      ) : (
        <div className="rows">
          {ideas.map((i) => (
            <article key={i.id} className="row-card">
              <div className="row-ver"><ThermalStrip version={i.current_version} /><b>{versionLabel(i.current_version)}</b></div>
              <div className="row-main">
                <span className="slab-cat">{i.category}</span>
                <Link to={`/ideas/${i.id}`}><h3>{i.title}</h3></Link>
                <div className="row-meta">
                  <span>Updated {timeAgo(i.updated_at)}</span>
                  <span><MessageSquare size={13} /> {i.comment_count}</span><span><ThumbsUp size={13} /> {i.votes}</span>
                </div>
              </div>
              <div className="row-actions"><button className="btn btn-outline btn-sm" onClick={() => unfollow(i.id)}><HeartOff size={14} /> Unfollow</button></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
