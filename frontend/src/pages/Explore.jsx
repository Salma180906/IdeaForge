import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { LayoutGrid, Columns3, Rows, Search, X, ThumbsUp, MessageSquare, Users, ArrowUpRight, Sparkles, Bookmark, Heart } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks';
import IdeaCard from '../components/IdeaCard';
import { SlabSkeletons, EmptyState, ErrorBox, Segmented, Avatar, StagePill, ThermalStrip } from '../components/ui';
import { CATEGORIES, STAGES, stageLabel, heatVar, timeAgo, versionLabel } from '../utils';
import { sound } from '../utils/sound';
import { MOCK_EXPLORE_IDEAS } from '../data/exploreMockIdeas';

function filterAndSortIdeas(list, { search, category, stage, sort }) {
  let out = [...list];
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    out = out.filter(
      (i) =>
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.tags && i.tags.toLowerCase().includes(q)) ||
        (i.author_name && i.author_name.toLowerCase().includes(q))
    );
  }
  if (category) {
    out = out.filter((i) => i.category === category);
  }
  if (stage) {
    out = out.filter((i) => i.stage === stage);
  }
  if (sort === 'popular') {
    out.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  } else if (sort === 'evolved') {
    out.sort((a, b) => (b.current_version || 1) - (a.current_version || 1));
  } else if (sort === 'contributed') {
    out.sort((a, b) => (b.contributors || 0) - (a.contributors || 0));
  } else if (sort === 'trending') {
    const score = (x) => (x.votes || 0) * 3 + (x.contributors || 0) * 5 + (x.views || 0) * 0.05;
    out.sort((a, b) => score(b) - score(a));
  } else {
    out.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  }
  return out;
}

export default function Explore() {
  useDocumentTitle('Explore');
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const searchParam = params.get('search') || '';
  const [search, setSearch] = useState(searchParam);
  const [category, setCategory] = useState('');
  const [stage, setStage] = useState('');
  const [sort, setSort] = useState('recent');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'kanban' | 'list'
  const [serverIdeas, setServerIdeas] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setSearch(searchParam);
  }, [searchParam]);

  useEffect(() => {
    setError('');
    const loadIdeas = () => {
      const q = new URLSearchParams({ search, category, stage, sort }).toString();
      api.get(`/ideas?${q}`)
        .then((rows) => setServerIdeas(Array.isArray(rows) ? rows : []))
        .catch(() => setServerIdeas([]));
    };
    loadIdeas();
    window.addEventListener('ideaforge:nav-update', loadIdeas);
    return () => window.removeEventListener('ideaforge:nav-update', loadIdeas);
  }, [search, category, stage, sort]);

  const handleQuickVote = async (item, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      sound.pop();
      toast.info('Please sign in to vote.');
      return;
    }
    sound.success();
    try {
      const res = await api.post(`/ideas/${item.id}/vote`);
      setServerIdeas((prev) =>
        prev ? prev.map((it) => (it.id === item.id ? { ...it, votes: res.votes, has_voted: res.voted } : it)) : prev
      );
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
      toast.success(res.voted ? `Voted for "${item.title}"` : 'Vote removed');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleQuickBookmark = async (item, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      sound.pop();
      toast.info('Please sign in to bookmark.');
      return;
    }
    sound.pop();
    try {
      const res = await api.post(`/ideas/${item.id}/bookmark`);
      setServerIdeas((prev) =>
        prev ? prev.map((it) => (it.id === item.id ? { ...it, is_bookmarked: res.bookmarked } : it)) : prev
      );
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
      toast.success(res.bookmarked ? 'Saved to Bookmarks' : 'Removed from Bookmarks');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Use real published ideas from the database
  const ideas = useMemo(() => {
    if (serverIdeas === null) return null;
    const source = serverIdeas.length > 0 ? serverIdeas : MOCK_EXPLORE_IDEAS;
    return filterAndSortIdeas(source, { search, category, stage, sort });
  }, [serverIdeas, search, category, stage, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    sound.click();
    if (search.trim()) setParams({ search: search.trim() });
    else setParams({});
  };

  const clearAllFilters = () => {
    sound.pop();
    setSearch('');
    setCategory('');
    setStage('');
    setSort('recent');
    setParams({});
  };

  const hasActiveFilters = Boolean(search || category || stage || sort !== 'recent');

  // Group ideas for Kanban view
  const kanbanGroups = useMemo(() => {
    if (!ideas) return {};
    const groups = {};
    STAGES.forEach((s) => {
      groups[s] = ideas.filter((i) => i.stage === s);
    });
    return groups;
  }, [ideas]);

  return (
    <div className="explore-page motion-scene">
      <div className="ambient-orb-field" aria-hidden="true">
        <i className="orb-1" />
        <i className="orb-2" />
      </div>

      <div className="page-head explore-head">
        <div>
          <span className="hero-eyebrow" style={{ marginBottom: '10px' }}>
            <Sparkles size={13} className="hero-eyebrow-icon" />
            <span>Open Community Ledger · {ideas ? ideas.length : 8} Projects</span>
          </span>
          <h1 className="text-kinetic-gradient">Explore ideas</h1>
          <p>
            Browse real-world projects evolving in the forge. Suggest improvements, vote, or start your own version.
          </p>
        </div>

        <div className="explore-controls">
          <Segmented
            label="Sort ideas"
            value={sort}
            onChange={(s) => {
              sound.pop();
              setSort(s);
            }}
            options={[
              ['recent', 'Recent'],
              ['trending', 'Trending'],
              ['evolved', 'Most evolved'],
              ['popular', 'Popular'],
              ['contributed', 'Most contributed'],
            ]}
          />

          <div className="view-mode-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => {
                sound.pop();
                setViewMode('grid');
              }}
              title="Bento Grid View"
              aria-label="Bento Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => {
                sound.pop();
                setViewMode('kanban');
              }}
              title="Pipeline Kanban View"
              aria-label="Pipeline Kanban View"
            >
              <Columns3 size={16} />
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => {
                sound.pop();
                setViewMode('list');
              }}
              title="Linear Table View"
              aria-label="Linear Table View"
            >
              <Rows size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="explore-search-bar">
        <form onSubmit={handleSearchSubmit} className="search-form">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by keywords, problems, technologies, or tags..."
            className="explore-search-input"
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                sound.click();
                setSearch('');
                setParams({});
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </form>

        {hasActiveFilters && (
          <button type="button" className="clear-filters-btn" onClick={clearAllFilters}>
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      <div className="filter-block">
        <div className="chips" role="group" aria-label="Stage">
          <button
            className={`chip ${stage === '' ? 'on' : ''}`}
            onClick={() => {
              sound.pop();
              setStage('');
            }}
          >
            All stages
          </button>
          {STAGES.map((s, i) => (
            <button
              key={s}
              className={`chip ${stage === s ? 'on' : ''}`}
              onClick={() => {
                sound.pop();
                setStage(stage === s ? '' : s);
              }}
            >
              <i style={{ background: heatVar(i) }} />
              {stageLabel(s)}
            </button>
          ))}
        </div>

        <div className="chips" role="group" aria-label="Category">
          <button
            className={`chip ${category === '' ? 'on' : ''}`}
            onClick={() => {
              sound.pop();
              setCategory('');
            }}
          >
            All categories
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? 'on' : ''}`}
              onClick={() => {
                sound.pop();
                setCategory(category === c ? '' : c);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      {!ideas && !error && <SlabSkeletons count={6} />}

      {ideas && (
        <>
          {ideas.length === 0 ? (
            <EmptyState
              title="No ideas match your criteria"
              text="Try adjusting the search query, changing the category, or selecting another stage."
              action={
                <button type="button" className="btn btn-outline" onClick={clearAllFilters}>
                  Reset all filters
                </button>
              }
            />
          ) : (
            <>
              {/* 1. Bento Grid View */}
              {viewMode === 'grid' && (
                <div className="grid grid-slabs">
                  {ideas.map((i) => (
                    <IdeaCard key={i.id} idea={i} />
                  ))}
                </div>
              )}

              {/* 2. Pipeline Kanban View */}
              {viewMode === 'kanban' && (
                <div className="explore-kanban">
                  {STAGES.map((s, idx) => {
                    const list = kanbanGroups[s] || [];
                    return (
                      <div key={s} className="kanban-col" style={{ '--c': heatVar(idx) }}>
                        <header className="kanban-header">
                          <span className="kanban-bar" />
                          <h3>{stageLabel(s)}</h3>
                          <span className="kanban-count">{list.length}</span>
                        </header>
                        <div className="kanban-items">
                          {list.map((item) => (
                            <Link key={item.id} to={`/ideas/${item.id}`} className="kanban-card">
                              <div className="kanban-card-top">
                                <span className="kanban-card-cat">{item.category}</span>
                                <ThermalStrip version={item.current_version} size="sm" />
                              </div>
                              <h4 className="kanban-card-title">{item.title}</h4>
                              <p className="kanban-card-desc">{item.description}</p>
                              <div className="kanban-card-foot">
                                <span className="author">
                                  <Avatar name={item.author_name} size={18} />
                                  <span>{item.author_name.split(' ')[0]}</span>
                                </span>
                                <div className="kanban-quick-actions" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                  <button
                                    type="button"
                                    className={`kanban-btn ${item.has_voted ? 'active' : ''}`}
                                    onClick={(e) => handleQuickVote(item, e)}
                                    title={item.has_voted ? 'Voted' : 'Vote'}
                                    aria-label="Vote"
                                  >
                                    <ThumbsUp size={11} className={item.has_voted ? 'fill-current' : ''} /> {item.votes}
                                  </button>
                                  <button
                                    type="button"
                                    className={`kanban-btn ${item.is_bookmarked ? 'active bookmark-active' : ''}`}
                                    onClick={(e) => handleQuickBookmark(item, e)}
                                    title={item.is_bookmarked ? 'Saved to Bookmarks' : 'Bookmark'}
                                    aria-label="Bookmark"
                                  >
                                    <Bookmark size={11} className={item.is_bookmarked ? 'fill-current' : ''} />
                                  </button>
                                </div>
                              </div>
                            </Link>
                          ))}
                          {list.length === 0 && (
                            <div className="kanban-empty">No ideas in this stage</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. Linear Table / List View */}
              {viewMode === 'list' && (
                <div className="explore-table-wrap">
                  <table className="explore-table">
                    <thead>
                      <tr>
                        <th>Idea</th>
                        <th>Category</th>
                        <th>Stage</th>
                        <th>Version</th>
                        <th>Author</th>
                        <th>Activity</th>
                        <th>Updated</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ideas.map((item) => (
                        <tr key={item.id} className="table-row">
                          <td className="table-main">
                            <Link to={`/ideas/${item.id}`} className="table-title">
                              {item.title}
                            </Link>
                            <span className="table-desc">{item.description}</span>
                          </td>
                          <td>
                            <span className="badge">{item.category}</span>
                          </td>
                          <td>
                            <StagePill stage={item.stage} />
                          </td>
                          <td>
                            <div className="table-version">
                              <ThermalStrip version={item.current_version} size="sm" />
                              <b>{versionLabel(item.current_version)}</b>
                            </div>
                          </td>
                          <td>
                            <span className="author">
                              <Avatar name={item.author_name} size={20} />
                              {item.author_name}
                            </span>
                          </td>
                          <td>
                            <div className="table-metrics" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                              <button
                                type="button"
                                className={`table-action-btn ${item.has_voted ? 'active' : ''}`}
                                onClick={(e) => handleQuickVote(item, e)}
                                title={item.has_voted ? 'Voted' : 'Vote'}
                                aria-label="Vote"
                              >
                                <ThumbsUp size={11} className={item.has_voted ? 'fill-current' : ''} /> {item.votes}
                              </button>
                              <button
                                type="button"
                                className={`table-action-btn ${item.is_bookmarked ? 'active bookmark-active' : ''}`}
                                onClick={(e) => handleQuickBookmark(item, e)}
                                title={item.is_bookmarked ? 'Saved to Bookmarks' : 'Bookmark'}
                                aria-label="Bookmark"
                              >
                                <Bookmark size={11} className={item.is_bookmarked ? 'fill-current' : ''} />
                              </button>
                              <span title="Comments"><MessageSquare size={12} /> {item.comment_count}</span>
                              <span title="Contributors"><Users size={12} /> {item.contributors}</span>
                            </div>
                          </td>
                          <td className="muted small">
                            {timeAgo(item.updated_at)}
                          </td>
                          <td>
                            <Link to={`/ideas/${item.id}`} className="table-action" aria-label="Open idea">
                              <ArrowUpRight size={16} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
