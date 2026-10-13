import { useEffect, useState } from 'react';
import { RotateCcw, Sparkles, Check, ArrowRight } from 'lucide-react';
import { StagePill, ThermalStrip, Avatar } from './ui';
import { useReducedMotion } from '../hooks';
import { STAGES, heatForVersion, versionLabel, stageLabel } from '../utils';
import { sound } from '../utils/sound';

const EVOLUTION_STEPS = [
  {
    version: 1,
    who: 'Salma',
    role: 'Creator',
    stage: 'concept',
    title: 'Resource Lending for Lab Kits',
    summary: 'First draft: Students can lend unused microcontroller kits to peers.',
    diffAdded: 'Basic peer-to-peer equipment ledger with email pinging.',
    tempLabel: 'Cold Concept (Raw)',
    score: '18%',
  },
  {
    version: 2,
    who: 'Priya',
    role: 'Contributor',
    stage: 'exploring',
    title: 'Automated Slot Booking System',
    summary: 'Added 48-hour reservation windows so kits are never double-booked.',
    diffAdded: '+ Conflict-free time slots and department inventory verification.',
    tempLabel: 'Warming Up',
    score: '42%',
  },
  {
    version: 3,
    who: 'Karthik',
    role: 'Reviewer',
    stage: 'refining',
    title: 'Condition Proof with Smart Photos',
    summary: 'Return condition photos taken via camera prevent gear dispute.',
    diffAdded: '+ Multi-angle photo escrow and instant hardware checklist.',
    tempLabel: 'Accelerating',
    score: '67%',
  },
  {
    version: 4,
    who: 'Arjun',
    role: 'Contributor',
    stage: 'prototype',
    title: 'Reputation & Multi-Tier Trust Staking',
    summary: 'Trust score algorithms dynamically unlock higher tier gear access.',
    diffAdded: '+ Merit staking algorithm and autonomous return escrow.',
    tempLabel: 'High Velocity',
    score: '88%',
  },
  {
    version: 5,
    who: 'Salma',
    role: 'Lead',
    stage: 'evolved',
    title: 'Multi-Department Campus Grid',
    summary: 'Two universities pilot program deployed with hardware tracking.',
    diffAdded: '+ Production deployment across EE & CS faculty departments.',
    tempLabel: 'White-Hot Evolved',
    score: '100%',
  },
];

export default function HeroLog() {
  const reduced = useReducedMotion();
  const [currentIdx, setCurrentIdx] = useState(4); // Default to fully evolved
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const interval = setInterval(() => {
      setCurrentIdx((prev) => {
        const next = (prev + 1) % EVOLUTION_STEPS.length;
        sound.pop();
        if (next === EVOLUTION_STEPS.length - 1) {
          sound.shimmer();
          setIsPlaying(false);
        }
        return next;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const activeStep = EVOLUTION_STEPS[currentIdx];

  const handleSelectVersion = (idx) => {
    sound.pop();
    setIsPlaying(false);
    setCurrentIdx(idx);
    if (idx === 4) sound.shimmer();
  };

  const handleReplay = () => {
    sound.click();
    setCurrentIdx(0);
    setIsPlaying(true);
  };

  return (
    <figure className="herolog interactive-sandbox" aria-label="Interactive idea evolution engine">
      <div className="sandbox-topbar">
        <div className="sandbox-indicator">
          <span className="sandbox-live-dot" />
          <span>The Evolution Ledger (Interactive)</span>
        </div>
        <button
          type="button"
          className="sandbox-replay-btn"
          onClick={handleReplay}
          title="Auto-play evolution cycle"
        >
          <RotateCcw size={13} className={isPlaying ? 'spinning' : ''} />
          <span>{isPlaying ? 'Evolving...' : 'Simulate Evolution'}</span>
        </button>
      </div>

      <div className="herolog-head">
        <div>
          <span className="herolog-kicker">Live Idea Genealogy</span>
          <h2 className="sandbox-title">{activeStep.title}</h2>
        </div>
        <StagePill stage={activeStep.stage} />
      </div>

      {/* Version selector pills */}
      <div className="sandbox-version-picker" role="tablist" aria-label="Version progression">
        {EVOLUTION_STEPS.map((s, idx) => (
          <button
            key={s.version}
            type="button"
            role="tab"
            aria-selected={currentIdx === idx}
            className={`v-tab ${currentIdx === idx ? 'active' : ''}`}
            style={{ '--c': heatForVersion(s.version) }}
            onClick={() => handleSelectVersion(idx)}
          >
            <span>v{s.version}.0</span>
          </button>
        ))}
      </div>

      <div className="herolog-numeral" style={{ '--c': heatForVersion(activeStep.version) }}>
        <div className="temp-readout">
          <span className="temp-badge">{activeStep.tempLabel}</span>
          <span className="temp-score">{activeStep.score} complete</span>
        </div>
        <span className="herolog-bar" />
      </div>
      <ThermalStrip version={activeStep.version} size="lg" />

      {/* Active version detail card */}
      <div className="sandbox-active-card" style={{ '--c': heatForVersion(activeStep.version) }}>
        <div className="sandbox-card-meta">
          <span className="author">
            <Avatar name={activeStep.who} size={22} />
            <b>{activeStep.who}</b>
            <span className="author-role">{activeStep.role}</span>
          </span>
          <span className="sandbox-v-badge">v{activeStep.version}.0</span>
        </div>
        <p className="sandbox-summary">{activeStep.summary}</p>
        <div className="sandbox-diff-preview">
          <span className="diff-label">Merged changes:</span>
          <code>{activeStep.diffAdded}</code>
        </div>
      </div>

      {/* Evolution timeline steps */}
      <div className="sandbox-timeline-wrap">
        <div className="sandbox-timeline-header">
          <span>Version Lineage Timeline</span>
          <span className="timeline-hint">Click version to inspect</span>
        </div>
        <div className="herolog-list">
          {EVOLUTION_STEPS.slice(0, currentIdx + 1).map((s) => (
            <div
              key={s.version}
              className={`herolog-item ${s.version === activeStep.version ? 'highlight' : ''}`}
              style={{ '--c': heatForVersion(s.version) }}
              onClick={() => handleSelectVersion(s.version - 1)}
              role="button"
              tabIndex={0}
            >
              <span className="herolog-dot" aria-hidden="true" />
              <div className="herolog-item-content">
                <div className="herolog-item-top">
                  <span className="herolog-v-tag">v{s.version}.0</span>
                  <span className="herolog-author-tag">
                    <Avatar name={s.who} size={15} />
                    <span>{s.who}</span>
                  </span>
                  <span className="herolog-stage-text">{stageLabel(s.stage)}</span>
                </div>
                <p className="herolog-summary-text">{s.summary}</p>
              </div>
            </div>
          )).reverse()}
        </div>
      </div>
    </figure>
  );
}
