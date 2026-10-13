import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { api } from '../api/client';
import { useDocumentTitle } from '../hooks';
import { Spinner, ErrorBox, EmptyState } from '../components/ui';
import { timeAgo } from '../utils';

export default function Notifications() {
  useDocumentTitle('Notifications');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    const loadNotifs = () => {
      api.get('/me/notifications').then(setItems).catch((e) => setError(e.message));
    };
    loadNotifs();
    window.addEventListener('ideaforge:nav-update', loadNotifs);
    return () => window.removeEventListener('ideaforge:nav-update', loadNotifs);
  }, []);

  const open = async (n) => {
    if (!n.is_read) {
      await api.patch(`/me/notifications/${n.id}`).catch(() => {});
      setItems(items.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
    }
    if (n.idea_id) navigate(`/ideas/${n.idea_id}`);
  };
  const readAll = async () => {
    await api.post('/me/notifications/read-all');
    setItems(items.map((x) => ({ ...x, is_read: 1 })));
    window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
  };

  if (error) return <ErrorBox message={error} />;
  if (!items) return <Spinner />;
  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div>
      <div className="page-head">
        <div><h1>Notifications</h1><p>{unread ? `${unread} unread` : 'You are all caught up.'}</p></div>
        {unread > 0 && <button className="btn btn-outline btn-sm" onClick={readAll}><CheckCheck size={15} /> Mark all as read</button>}
      </div>
      {items.length === 0 ? <EmptyState title="All quiet" text="Votes, suggestions and new versions show up here." /> : (
        <div className="panel notif-list">
          {items.map((n) => (
            <button key={n.id} className={`notif ${n.is_read ? '' : 'unread'}`} onClick={() => open(n)}>
              <span className="log-dot" />
              <span className="notif-msg">{n.message}</span>
              <time className="muted small">{timeAgo(n.created_at)}</time>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
