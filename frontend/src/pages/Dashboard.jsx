import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Compass, Flame } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks';
import { Spinner, ErrorBox, EmptyState, StatLedger, ThermalStrip, ProgressRing, StageLadder } from '../components/ui';
import IdeaCard from '../components/IdeaCard';
import ActivityGrid from '../components/ActivityGrid';
import { greeting, timeAgo, STAGES, stageLabel, heatVar, versionLabel } from '../utils';

// Your published ideas laid out by temperature: cold on the left, evolved on the right.
function Pipeline({ ideas }) {
  return (
    <div className="pipeline">
      {STAGES.map((s, i) => {
        const here = ideas.filter((x) => x.stage === s);
        return (
          <section key={s} className="pipe-col" style={{ '--c': heatVar(i) }}>
            <header><span className="pipe-bar" /><h3>{stageLabel(s)}</h3><b>{here.length}</b></header>
            {here.map((x) => (
              <Link key={x.id} to={`/ideas/${x.id}`} className="pipe-card">
                <span>{x.title}</span>
                <small><ThermalStrip version={x.current_version} /> {versionLabel(x.current_version)}</small>
              </Link>
            ))}
            {here.length === 0 && <p className="pipe-none">Nothing here</p>}
          </section>
        );
      })}
    </div>
  );
}

const MESSAGE = [
  'Start with something rough. Heat comes from other people.',
  'Your idea is warming up. Ask for suggestions to move it on.',
  'Good progress. Accept a suggestion to reach the next version.',
  'You are close. A few more versions and it is fully evolved.',
  'White-hot. Your idea has fully evolved.',
];

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/me/dashboard').then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;
  const { stats, pulse } = data;
  const hottest = [...data.activeIdeas].sort((a, b) => b.current_version - a.current_version || b.progress - a.progress)[0];
  const heatIndex = hottest ? Math.min(hottest.current_version - 1, 4) : 0;

  return (
    <div className="dash">
      <section className="dash-hero" style={{ '--c': heatVar(heatIndex) }}>
        <div className="dash-glow" aria-hidden="true"><i /><i /><i /></div>
        <div className="dash-hero-copy">
          <span className="dash-kicker"><Flame size={14} aria-hidden="true" /> Your forge</span>
          <h1>{greeting()}, {user.name.split(' ')[0]}</h1>
          <p>{hottest ? MESSAGE[heatIndex] : MESSAGE[0]}</p>
          <div className="dash-cta">
            <Link to="/create" className="btn btn-primary"><PlusCircle size={16} /> New idea</Link>
            <Link to="/explore" className="btn btn-outline"><Compass size={16} /> Explore</Link>
          </div>
        </div>
        {hottest ? (
          <Link to={`/ideas/${hottest.id}`} className="dash-hot">
            <ProgressRing value={hottest.progress} size={112} label="evolved" />
            <div>
              <span className="dash-hot-tag">Hottest idea</span>
              <h2>{hottest.title}</h2>
              <div className="dash-hot-meta"><b>{versionLabel(hottest.current_version)}</b><ThermalStrip version={hottest.current_version} /></div>
              <StageLadder stage={hottest.stage} />
            </div>
          </Link>
        ) : (
          <div className="dash-hot dash-hot-empty"><p>Publish your first idea and it will show up here, getting hotter with every version.</p></div>
        )}
      </section>

      <StatLedger items={[
        { label: 'Ideas created', value: stats.ideasCreated },
        { label: 'Versions written', value: pulse.versions },
        { label: 'Votes received', value: pulse.votesReceived },
        { label: 'Contributions', value: stats.contributions },
        { label: 'Following', value: stats.following },
      ]} />

      <div className="section">
        <div className="section-title"><h2>Your last 12 weeks</h2></div>
        <div className="panel"><ActivityGrid calendar={data.calendar} /></div>
      </div>

      <div className="section">
        <div className="section-title"><h2>Your pipeline</h2><Link to="/my-ideas" className="btn btn-ghost btn-sm">All my ideas</Link></div>
        {data.activeIdeas.length ? <Pipeline ideas={data.activeIdeas} /> : (
          <EmptyState title="No published ideas yet" text="Start with a rough idea. It does not need to be perfect."
            action={<Link to="/create" className="btn btn-primary"><PlusCircle size={16} /> Create an idea</Link>} />
        )}
      </div>

      <div className="two-col section">
        <div>
          <div className="section-title"><h2>Recent activity</h2></div>
          <div className="panel">
            {data.activity.length ? data.activity.map((a) => (
              <div key={a.id} className="log-row">
                <span className="log-dot" />
                <span>{a.message}</span>
                <time className="muted small">{timeAgo(a.created_at)}</time>
              </div>
            )) : <p className="muted">Nothing yet. Votes, suggestions and new versions on your ideas show up here.</p>}
          </div>
        </div>
        <div>
          <div className="section-title"><h2>Worth a look</h2><Link to="/explore" className="btn btn-ghost btn-sm">Explore more</Link></div>
          {data.recommended.length ? <div className="stack">{data.recommended.slice(0, 2).map((i) => <IdeaCard key={i.id} idea={i} />)}</div>
            : <div className="panel"><p className="muted">Ideas from other people will appear here.</p></div>}
        </div>
      </div>
    </div>
  );
}
