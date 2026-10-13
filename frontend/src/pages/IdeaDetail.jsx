import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ThumbsUp, Heart, Pencil, GitCompare, Check, X, Bot, Users, MessageSquare,
  Eye, Sparkles, Share2, Copy, ArrowDownRight, Bookmark, RotateCcw, MapPin, BarChart3, FileText,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks';
import { Avatar, StagePill, StageLadder, ProgressRing, ThermalStrip, Spinner, ErrorBox, Modal, Segmented } from '../components/ui';
import VersionLog from '../components/VersionLog';
import DiffText from '../components/DiffText';
import { Embers } from '../components/Motion';
import ShareExportModal from '../components/ShareExportModal';
import MilestonesPanel from '../components/MilestonesPanel';
import AnalyticsPanel from '../components/AnalyticsPanel';
import { sound } from '../utils/sound';
import { LIMITS, splitTags, timeAgo, versionLabel, fieldDiffs } from '../utils';
import { getMockIdeaDetail } from '../data/exploreMockIdeas';

const SECTIONS = [
  ['problem', 'Problem being solved'],
  ['solution', 'Proposed solution'],
  ['target_users', 'Target users'],
  ['impact', 'Expected impact'],
];

export default function IdeaDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [showCompare, setShowCompare] = useState(false);
  const [v1, setV1] = useState(1);
  const [v2, setV2] = useState(1);

  const [activeTab, setActiveTab] = useState('full'); // 'full' | 'roadmap' | 'analytics'

  const [kind, setKind] = useState('comment');
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const [accepting, setAccepting] = useState(null);
  const [acceptField, setAcceptField] = useState('');
  const [acceptText, setAcceptText] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreSummary, setRestoreSummary] = useState('');
  const [restoring, setRestoring] = useState(false);

  const [burst, setBurst] = useState(0);
  const [evolve, setEvolve] = useState(0);
  const [ai, setAi] = useState(null);
  const [aiKind, setAiKind] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useDocumentTitle(data?.idea.title);

  const isMockId = String(id).startsWith('mock-');

  const load = () => {
    if (isMockId) {
      const mockDetail = getMockIdeaDetail(id);
      if (mockDetail) {
        setData(mockDetail);
        setV1(Math.max(1, mockDetail.versions.length - 1));
        setV2(mockDetail.versions.length);
      } else {
        setError('Idea not found');
      }
      return Promise.resolve();
    }
    return api.get(`/ideas/${id}`).then((d) => {
      setData(d);
      setV1(Math.max(1, d.versions.length - 1));
      setV2(d.versions.length);
    }).catch((e) => setError(e.message));
  };

  useEffect(() => { setData(null); setError(''); setAi(null); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;
  const { idea, versions, comments, contributors, hasVoted, isFollowing, isBookmarked, isOwner } = data;

  const needLogin = () => { if (!user) { toast.info('Log in to do that.'); return true; } return false; };
  const run = async (fn, done) => {
    try { await fn(); if (done) toast.success(done); } catch (e) { toast.error(e.message); }
  };

  const toggleVote = () => needLogin() || run(async () => {
    sound.success();
    if (isMockId) {
      const nextVoted = !hasVoted;
      const nextVotes = idea.votes + (nextVoted ? 1 : -1);
      setData({ ...data, hasVoted: nextVoted, idea: { ...idea, votes: nextVotes } });
      if (nextVoted) setBurst(Date.now());
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
      return;
    }
    const r = await api.post(`/ideas/${id}/vote`);
    setData({ ...data, hasVoted: r.voted, idea: { ...idea, votes: r.votes } });
    if (r.voted) setBurst(Date.now());
    window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
  });

  const toggleFollow = () => needLogin() || run(async () => {
    sound.pop();
    if (isMockId) {
      const nextFollow = !isFollowing;
      setData({ ...data, isFollowing: nextFollow });
      toast.success(nextFollow ? 'You will be notified when this idea evolves.' : 'Unfollowed.');
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
      return;
    }
    const r = await api.post(`/ideas/${id}/follow`);
    setData({ ...data, isFollowing: r.following });
    toast.success(r.following ? 'You will be notified when this idea evolves.' : 'Unfollowed.');
    window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
  });

  const toggleBookmark = () => needLogin() || run(async () => {
    sound.pop();
    if (isMockId) {
      const nextBm = !isBookmarked;
      setData({ ...data, isBookmarked: nextBm });
      toast.success(nextBm ? 'Saved to your Bookmarks.' : 'Removed from Bookmarks.');
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
      return;
    }
    const r = await api.post(`/ideas/${id}/bookmark`);
    setData({ ...data, isBookmarked: r.bookmarked });
    toast.success(r.bookmarked ? 'Saved to your Bookmarks.' : 'Removed from Bookmarks.');
    window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
  });

  const postComment = () => needLogin() || run(async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      sound.success();
      if (isMockId) {
        const newComment = {
          id: Date.now(),
          user_id: user.id,
          user_name: user.name,
          type: kind,
          status: kind === 'suggestion' ? 'pending' : 'none',
          content: text.trim(),
          created_at: new Date().toISOString(),
        };
        setData({ ...data, comments: [newComment, ...comments], idea: { ...idea, comment_count: (idea.comment_count || 0) + 1 } });
        setText('');
        window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
        return;
      }
      await api.post(`/ideas/${id}/comments`, { type: kind, content: text });
      setText('');
      await load();
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
    }
    finally { setPosting(false); }
  }, kind === 'suggestion' ? 'Suggestion sent to the owner.' : 'Comment posted.');

  const openAccept = (c) => { sound.pop(); setAccepting(c); setAcceptField(''); setAcceptText(''); };
  const pickField = (f) => { setAcceptField(f); setAcceptText(f ? idea[f] || '' : ''); };
  const confirmAccept = () => run(async () => {
    sound.shimmer();
    const updates = acceptField ? { [acceptField]: acceptText } : {};
    await api.patch(`/comments/${accepting.id}/accept`, { updates });
    setAccepting(null);
    await load();
    setEvolve(Date.now());
    window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
  }, 'Suggestion accepted. A new version was created.');
  const reject = (c) => run(async () => { sound.click(); await api.patch(`/comments/${c.id}/reject`); await load(); window.dispatchEvent(new CustomEvent('ideaforge:nav-update')); }, 'Suggestion declined.');

  const handleOpenRestore = (v) => {
    sound.pop();
    setRestoreTarget(v);
    setRestoreSummary(`Restored content snapshot from version ${v.version_no}.0`);
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    sound.shimmer();
    try {
      await api.post(`/ideas/${id}/restore-version`, {
        versionNo: restoreTarget.version_no,
        summary: restoreSummary.trim() || `Restored from version ${restoreTarget.version_no}.0`,
      });
      toast.success(`Successfully restored version ${restoreTarget.version_no}.0 as a new version!`);
      setRestoreTarget(null);
      await load();
      setEvolve(Date.now());
      window.dispatchEvent(new CustomEvent('ideaforge:nav-update'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRestoring(false);
    }
  };

  const askAI = async (k) => {
    if (needLogin()) return;
    sound.pop();
    setAiKind(k); setAiLoading(true); setAi(null); setAiError('');
    try {
      const res = await api.post(`/ai/${k}`, {
        ideaId: idea.id,
        idea: {
          title: idea.title,
          description: idea.description,
          category: idea.category,
          problem: idea.problem,
          solution: idea.solution,
          target_users: idea.target_users,
          impact: idea.impact,
          current_version: idea.current_version,
          stage: idea.stage,
        },
      });
      setAi(res);
      sound.shimmer();
    } catch (e) { setAiError(e.message); }
    setAiLoading(false);
  };

  const copyAiOutput = () => {
    if (!ai) return;
    sound.success();
    const textToCopy = `${ai.title}:\n` + ai.items.map((it) => `• ${it}`).join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopiedAi(true);
    toast.success('Copied AI recommendations to clipboard');
    setTimeout(() => setCopiedAi(false), 2000);
  };

  const proposeAiAsSuggestion = () => {
    if (!ai) return;
    sound.pop();
    setKind('suggestion');
    setText(`AI Recommended Improvement:\n` + ai.items.map((it) => `- ${it}`).join('\n'));
    toast.info('Populated suggestion form with AI analysis');
    const composer = document.querySelector('.composer');
    if (composer) composer.scrollIntoView({ behavior: 'smooth' });
  };

  const a = versions.find((v) => v.version_no === Number(v1));
  const b = versions.find((v) => v.version_no === Number(v2));
  const merged = a && b && a.version_no < b.version_no ? fieldDiffs(a, b) : null;

  return (
    <div className="detail-grid">
      <div className="stack">
        <header className="idea-head">
          <div className="idea-head-top">
            <span className="slab-cat">{idea.category}</span>
            <StagePill stage={idea.stage} />
            {!idea.is_published && <span className="kind kind-pending">Draft</span>}
          </div>
          <h1>{idea.title}</h1>
          <p className="prose idea-lede">{idea.description}</p>
          <div className="tags">{splitTags(idea.tags).map((t) => <span key={t} className="tag">#{t}</span>)}</div>
          <Link to={`/users/${idea.owner_id}`} className="author idea-author"><Avatar name={idea.author_name} size={26} />{idea.author_name}</Link>
          <div className="idea-actions">
            <span className="burst-anchor">
              <button className={`btn ${hasVoted ? 'btn-active' : 'btn-outline'} ${hasVoted ? 'is-voted' : ''}`} aria-pressed={hasVoted} onClick={toggleVote}><ThumbsUp size={16} /> {hasVoted ? 'Voted' : 'Vote'} · <span key={idea.votes} className="bump">{idea.votes}</span></button>
              <Embers burst={burst} count={12} />
            </span>
            <button className={`btn ${isFollowing ? 'btn-active' : 'btn-outline'}`} aria-pressed={isFollowing} onClick={toggleFollow}><Heart size={16} /> {isFollowing ? 'Following' : 'Follow'}</button>
            <button className={`btn ${isBookmarked ? 'btn-active' : 'btn-outline'}`} aria-pressed={isBookmarked} onClick={toggleBookmark} title={isBookmarked ? 'Saved to bookmarks' : 'Bookmark this idea'}><Bookmark size={16} /> {isBookmarked ? 'Bookmarked' : 'Bookmark'}</button>
            <button className="btn btn-outline" onClick={() => { sound.click(); setShowShareModal(true); }}><Share2 size={16} /> Share &amp; Export</button>
            {isOwner && <Link to={`/ideas/${idea.id}/edit`} className="btn btn-primary" onClick={() => sound.click()}><Pencil size={16} /> Edit idea</Link>}
          </div>
        </header>

        <section className="panel heat-panel">
          <ProgressRing value={idea.progress} />
          <div className="heat-panel-main">
            <div className="heat-version"><span className="burst-anchor"><b key={idea.current_version} className="v-num">{versionLabel(idea.current_version)}</b><Embers burst={evolve} count={26} /></span><ThermalStrip version={idea.current_version} size="lg" /></div>
            <StageLadder stage={idea.stage} />
            <div className="detail-stats">
              <span><Users size={14} /> <b>{idea.contributors}</b> contributors</span>
              <span><MessageSquare size={14} /> <b>{idea.comment_count}</b> comments</span>
              <span><Eye size={14} /> <b>{idea.views}</b> views</span>
            </div>
          </div>
        </section>

        {/* Section Navigation Tabs */}
        <div className="detail-nav-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          <button
            type="button"
            className={`chip ${activeTab === 'full' ? 'on' : ''}`}
            onClick={() => { sound.pop(); setActiveTab('full'); }}
          >
            <FileText size={14} style={{ display: 'inline', marginRight: '5px' }} />
            Specification &amp; History
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'roadmap' ? 'on' : ''}`}
            onClick={() => { sound.pop(); setActiveTab('roadmap'); }}
          >
            <MapPin size={14} style={{ display: 'inline', marginRight: '5px' }} />
            Roadmap &amp; Milestones
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'analytics' ? 'on' : ''}`}
            onClick={() => { sound.pop(); setActiveTab('analytics'); }}
          >
            <BarChart3 size={14} style={{ display: 'inline', marginRight: '5px' }} />
            Analytics
          </button>
        </div>

        {activeTab === 'full' && (
          <>
            <section className="panel">
              <div className="section-title">
                <div><h2>Version history</h2><p className="muted small">Newest first. Open any version to see which words changed.</p></div>
                {versions.length > 1 && (
                  <button className={`btn btn-sm ${showCompare ? 'btn-active' : 'btn-outline'}`} aria-pressed={showCompare} onClick={() => setShowCompare(!showCompare)}>
                    <GitCompare size={15} /> Compare
                  </button>
                )}
              </div>

              {showCompare && a && b && (
                <div className="compare">
                  <div className="form-row">
                    <div className="field"><label htmlFor="cmp-from">From</label>
                      <select id="cmp-from" value={v1} onChange={(e) => setV1(e.target.value)}>
                        {versions.map((v) => <option key={v.id} value={v.version_no}>{versionLabel(v.version_no)}</option>)}
                      </select></div>
                    <div className="field"><label htmlFor="cmp-to">To</label>
                      <select id="cmp-to" value={v2} onChange={(e) => setV2(e.target.value)}>
                        {versions.map((v) => <option key={v.id} value={v.version_no}>{versionLabel(v.version_no)}</option>)}
                      </select></div>
                  </div>
                  {!merged && <p className="muted small">Pick an earlier version in From and a later one in To.</p>}
                  {merged && merged.length === 0 && <p className="muted small">No text changed between these versions.</p>}
                  {merged && merged.map((d) => (
                    <div key={d.key} className="diff-field"><h5>{d.label}</h5><DiffText ops={d.ops} /></div>
                  ))}
                </div>
              )}

              <VersionLog
                versions={versions}
                isOwner={isOwner}
                onRestore={handleOpenRestore}
              />
            </section>

            <section className="panel">
              <div className="section-title"><h2>The idea in full</h2><span className="vlog-tag" style={{ '--c': 'var(--ink-2)' }}>{versionLabel(idea.current_version)}</span></div>
              {SECTIONS.map(([f, label]) => (
                <div key={f} className="content-block">
                  <h4>{label}</h4>
                  <p className="prose">{idea[f] || <span className="muted">Not filled in yet.</span>}</p>
                </div>
              ))}
            </section>
          </>
        )}

        {activeTab === 'roadmap' && (
          <section className="panel">
            <MilestonesPanel ideaId={idea.id} isOwner={isOwner} />
          </section>
        )}

        {activeTab === 'analytics' && (
          <section className="panel">
            <AnalyticsPanel ideaId={idea.id} />
          </section>
        )}

        <section className="panel">
          <div className="section-title"><h2>Discussion</h2><span className="muted small">{comments.length} total</span></div>
          <div className="composer">
            <Segmented label="Type of response" value={kind} onChange={setKind} options={[['comment', 'Comment'], ['suggestion', 'Suggest a change']]} />
            <textarea value={text} maxLength={LIMITS.comment} onChange={(e) => setText(e.target.value)} aria-label="Your response"
              placeholder={kind === 'suggestion' ? 'Describe a concrete change. The owner can accept it into a new version.' : 'Share a thought or ask a question.'} />
            <div className="composer-row">
              <span className="muted small">{user ? `Posting as ${user.name} · ${text.length}/${LIMITS.comment}` : 'Log in to join the discussion'}</span>
              <button className="btn btn-primary btn-sm" onClick={postComment} disabled={posting || !text.trim()}>
                {kind === 'suggestion' ? 'Send suggestion' : 'Post comment'}
              </button>
            </div>
          </div>

          {comments.length === 0 && <p className="muted" style={{ padding: '18px 0 4px' }}>No discussion yet. Be the first to respond.</p>}
          {comments.map((c) => (
            <article key={c.id} className={`comment ${c.type === 'suggestion' ? 'is-suggestion' : ''}`}>
              <Avatar name={c.user_name} size={32} />
              <div className="comment-body">
                <div className="comment-head">
                  <b>{c.user_name}</b>
                  <span className={`kind kind-${c.type}`}>{c.type}</span>
                  {c.type === 'suggestion' && <span className={`kind kind-${c.status}`}>{c.status}</span>}
                  <span className="muted small">{timeAgo(c.created_at)}</span>
                </div>
                <p className="prose">{c.content}</p>
                {isOwner && c.type === 'suggestion' && c.status === 'pending' && (
                  <div className="comment-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => openAccept(c)}><Check size={14} /> Accept into a new version</button>
                    <button className="btn btn-outline btn-sm" onClick={() => reject(c)}><X size={14} /> Decline</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>

      <aside className="stack side-stack">
        <section className="panel">
          <div className="section-title"><h2>Contributors</h2></div>
          {contributors.map((u) => (
            <Link key={u.id} to={`/users/${u.id}`} className="contrib">
              <Avatar name={u.name} size={32} />
              <div><b>{u.name}</b>{u.id === idea.owner_id && <small>Owner</small>}</div>
            </Link>
          ))}
        </section>

        <section className="panel ai-panel">
          <div className="ai-panel-head">
            <h3><Bot size={17} aria-hidden="true" /> ForgeAI Copilot</h3>
            <span className="ai-chip">Gemini Intelligence</span>
          </div>
          <p className="muted small">Analyze, critique, or generate strategic roadmaps with Gemini AI.</p>
          <div className="ai-buttons">
            {[
              ['summary', 'Summarize'],
              ['improve', 'Critique & Weaknesses'],
              ['similar', 'Find similar ideas'],
              ['roadmap', '8-Week Roadmap'],
            ].map(([k, label]) => (
              <button key={k} className={aiKind === k ? 'on' : ''} onClick={() => askAI(k)} disabled={aiLoading}>{label}</button>
            ))}
          </div>
          {aiLoading && <div className="ai-result"><Sparkles size={14} className="sparkle-spin" aria-hidden="true" /> Analyzing idea structure. Please wait...</div>}
          {aiError && <div className="ai-result error">{aiError}</div>}
          {ai && (
            <div className="ai-result">
              <div className="ai-result-top">
                <b>{ai.title}</b>
                <div className="ai-result-btns">
                  <button type="button" className="btn-ai-action" onClick={copyAiOutput} title="Copy recommendations">
                    {copiedAi ? <Check size={13} /> : <Copy size={13} />} {copiedAi ? 'Copied' : 'Copy'}
                  </button>
                  <button type="button" className="btn-ai-action" onClick={proposeAiAsSuggestion} title="Propose as Suggestion">
                    <ArrowDownRight size={13} /> Propose
                  </button>
                </div>
              </div>
              <ul>{ai.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
              <div className="ai-note">Synthesized by Google Gemini AI · Click &quot;Propose&quot; to insert into suggestions</div>
            </div>
          )}
        </section>
      </aside>

      {accepting && (
        <Modal title="Accept suggestion" onClose={() => setAccepting(null)}>
          <blockquote className="quote"><b>{accepting.user_name}</b><p className="prose">{accepting.content}</p></blockquote>
          <p className="muted small" style={{ margin: '12px 0' }}>
            This creates {versionLabel(idea.current_version + 1)} and credits {accepting.user_name}. Optionally rewrite a section so the change shows up in the history.
          </p>
          <div className="field"><label htmlFor="acc-field">Section to update</label>
            <select id="acc-field" value={acceptField} onChange={(e) => pickField(e.target.value)}>
              <option value="">No text change (record only)</option>
              <option value="description">Description</option>
              {SECTIONS.map(([f, l]) => <option key={f} value={f}>{l}</option>)}
            </select></div>
          {acceptField && (
            <div className="field"><label htmlFor="acc-text">New text</label>
              <textarea id="acc-text" maxLength={LIMITS.section} value={acceptText} onChange={(e) => setAcceptText(e.target.value)} /></div>
          )}
          <div className="form-actions">
            <button className="btn btn-primary" onClick={confirmAccept}>Accept and create version</button>
            <button className="btn btn-outline" onClick={() => setAccepting(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {restoreTarget && (
        <Modal title={`Restore Version ${restoreTarget.version_no}.0`} onClose={() => setRestoreTarget(null)}>
          <p className="muted small">
            Restoring will create <b>{versionLabel(idea.current_version + 1)}</b> whose content snapshot matches Version {restoreTarget.version_no}.0. Complete audit history is preserved and nothing is deleted.
          </p>
          <div className="field" style={{ marginTop: '14px' }}>
            <label htmlFor="restore-summary">Restoration Summary</label>
            <input
              id="restore-summary"
              maxLength={250}
              value={restoreSummary}
              onChange={(e) => setRestoreSummary(e.target.value)}
              placeholder={`Restored from version ${restoreTarget.version_no}.0`}
            />
          </div>
          <div className="form-actions" style={{ marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={handleConfirmRestore} disabled={restoring}>
              <RotateCcw size={14} /> {restoring ? 'Restoring...' : `Confirm & Create v${idea.current_version + 1}.0`}
            </button>
            <button className="btn btn-outline" onClick={() => setRestoreTarget(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {showShareModal && (
        <ShareExportModal
          idea={idea}
          versions={versions}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
