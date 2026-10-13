import { useEffect, useState } from 'react';
import { Bookmark, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { useDocumentTitle } from '../hooks';
import IdeaCard from '../components/IdeaCard';
import { Spinner, ErrorBox, EmptyState } from '../components/ui';

export default function Bookmarks() {
  useDocumentTitle('Bookmarks');
  const [bookmarks, setBookmarks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBookmarks = () => {
      api.get('/me/bookmarks')
        .then(setBookmarks)
        .catch((e) => setError(e.message));
    };
    loadBookmarks();
    window.addEventListener('ideaforge:nav-update', loadBookmarks);
    return () => window.removeEventListener('ideaforge:nav-update', loadBookmarks);
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!bookmarks) return <Spinner />;

  return (
    <div className="bookmarks-page">
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Bookmark size={24} style={{ color: 'var(--c-accent, #ff5722)' }} />
            <h1 style={{ margin: 0 }}>Bookmarked Ideas</h1>
          </div>
          <p>
            Ideas you have saved for tracking progress, studying evolution histories, or contributing later.
          </p>
        </div>
        <div className="stat-pill" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '100px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <Sparkles size={14} style={{ color: 'var(--c-accent, #ff5722)' }} />
          <span><b>{bookmarks.length}</b> saved {bookmarks.length === 1 ? 'idea' : 'ideas'}</span>
        </div>
      </div>

      {bookmarks.length === 0 ? (
        <EmptyState
          title="No bookmarked ideas yet"
          text="When browsing ideas in Explore, click the Bookmark icon to save them to your personal collection."
        />
      ) : (
        <div className="grid grid-slabs">
          {bookmarks.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  );
}
