import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, MessageSquare, Users, Bookmark, Heart } from 'lucide-react';
import { Avatar, StagePill, ThermalStrip } from './ui';
import { splitTags, timeAgo, versionLabel } from '../utils';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { sound } from '../utils/sound';

export default function IdeaCard({ idea, onUpdate }) {
  const { user } = useAuth();
  const toast = useToast();
  const [votes, setVotes] = useState(Number(idea.votes || 0));
  const [hasVoted, setHasVoted] = useState(Boolean(idea.has_voted));
  const [isBookmarked, setIsBookmarked] = useState(Boolean(idea.is_bookmarked));
  const [isFollowing, setIsFollowing] = useState(Boolean(idea.is_following));
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    setVotes(Number(idea.votes || 0));
    setHasVoted(Boolean(idea.has_voted));
    setIsBookmarked(Boolean(idea.is_bookmarked));
    setIsFollowing(Boolean(idea.is_following));
  }, [idea.votes, idea.has_voted, idea.is_bookmarked, idea.is_following]);

  const requireAuth = () => {
    if (!user) {
      sound.pop();
      toast.info('Please sign in to vote, bookmark, or follow.');
      return false;
    }
    return true;
  };

  const handleVote = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!requireAuth()) return;
    sound.success();
    const nextVoted = !hasVoted;
    setHasVoted(nextVoted);
    setVotes((v) => v + (nextVoted ? 1 : -1));
    setBurst(true);
    setTimeout(() => setBurst(false), 500);

    try {
      const res = await api.post(`/ideas/${idea.id}/vote`);
      setHasVoted(res.voted);
      setVotes(res.votes);
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
      toast.success(res.voted ? `Voted for "${idea.title}"` : 'Vote removed');
      onUpdate?.();
    } catch (err) {
      setHasVoted(hasVoted);
      setVotes(Number(idea.votes || 0));
      toast.error(err.message);
    }
  };

  const handleBookmark = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!requireAuth()) return;
    sound.pop();
    const nextBm = !isBookmarked;
    setIsBookmarked(nextBm);

    try {
      const res = await api.post(`/ideas/${idea.id}/bookmark`);
      setIsBookmarked(res.bookmarked);
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
      toast.success(res.bookmarked ? 'Saved to Bookmarks' : 'Removed from Bookmarks');
      onUpdate?.();
    } catch (err) {
      setIsBookmarked(isBookmarked);
      toast.error(err.message);
    }
  };

  const handleFollow = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!requireAuth()) return;
    sound.pop();
    const nextFollow = !isFollowing;
    setIsFollowing(nextFollow);

    try {
      const res = await api.post(`/ideas/${idea.id}/follow`);
      setIsFollowing(res.following);
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
      toast.success(res.following ? 'Following idea for version updates' : 'Unfollowed');
      onUpdate?.();
    } catch (err) {
      setIsFollowing(isFollowing);
      toast.error(err.message);
    }
  };

  return (
    <Link to={`/ideas/${idea.id}`} className="slab">
      <div className="slab-version">
        <ThermalStrip version={idea.current_version} />
        <b>{versionLabel(idea.current_version)}</b>
      </div>
      <div className="slab-top">
        <span className="slab-cat">{idea.category}</span>
        <StagePill stage={idea.stage} />
      </div>
      <h3>{idea.title}</h3>
      <p className="prose clamp-2">{idea.description}</p>
      <div className="tags">{splitTags(idea.tags).slice(0, 4).map((t) => <span key={t} className="tag">#{t}</span>)}</div>
      <div className="slab-foot">
        <span className="author"><Avatar name={idea.author_name} size={22} />{idea.author_name}</span>
        <div className="slab-actions-cluster" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <button
            type="button"
            className={`card-action-btn ${hasVoted ? 'active vote-active' : ''} ${burst ? 'pop-anim' : ''}`}
            onClick={handleVote}
            title={hasVoted ? 'Voted' : 'Vote'}
            aria-label="Vote"
          >
            <ThumbsUp size={12} className={hasVoted ? 'fill-current' : ''} />
            <span>{votes}</span>
          </button>
          <button
            type="button"
            className={`card-action-btn ${isBookmarked ? 'active bookmark-active' : ''}`}
            onClick={handleBookmark}
            title={isBookmarked ? 'Saved to Bookmarks' : 'Bookmark this idea'}
            aria-label="Bookmark"
          >
            <Bookmark size={12} className={isBookmarked ? 'fill-current' : ''} />
          </button>
          <button
            type="button"
            className={`card-action-btn ${isFollowing ? 'active follow-active' : ''}`}
            onClick={handleFollow}
            title={isFollowing ? 'Following' : 'Follow for updates'}
            aria-label="Follow"
          >
            <Heart size={12} className={isFollowing ? 'fill-current' : ''} />
          </button>
          <span className="slab-stat-tag" title="Comments">
            <MessageSquare size={12} />
            <span>{idea.comment_count || 0}</span>
          </span>
          <span className="slab-stat-tag" title="Contributors">
            <Users size={12} />
            <span>{idea.contributors || 0}</span>
          </span>
        </div>
      </div>
      <div className="slab-meta muted small">Updated {timeAgo(idea.updated_at)}</div>
      <span className="slab-progress" style={{ '--p': `${idea.progress}%` }} aria-hidden="true" />
    </Link>
  );
}
