import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, Lock, Gauge, Sun, Moon, Volume2, VolumeX,
  Sparkles, Flame, GitPullRequest, GitBranch, Cpu, ChevronDown, CheckCircle2, Globe, Users,
  Zap, Workflow, Layers, Shield, TrendingUp, Check, ExternalLink, Activity
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useConsent } from '../context/ConsentContext';
import { useDocumentTitle } from '../hooks';
import { Wordmark } from '../components/ui';
import HeroLog from '../components/HeroLog';
import { Reveal } from '../components/Motion';
import IdeaCard from '../components/IdeaCard';
import { sound } from '../utils/sound';

const STATS = [
  { value: '4,850+', label: 'Ideas Evolving', sub: 'Across 8 core disciplines' },
  { value: '19,200+', label: 'Merged Suggestions', sub: 'Peer-reviewed improvements' },
  { value: '100%', label: 'Cryptographic History', sub: 'Every word change tracked' },
  { value: '< 15m', label: 'First Suggestion Cycle', sub: 'Average response time' },
];

const ECOSYSTEM_TRACKS = [
  { label: 'Autonomous AI Agents', icon: Cpu, stage: 'Production v4.2' },
  { label: 'Clean Energy Microgrids', icon: Zap, stage: 'Active v3.0' },
  { label: 'Decentralized Ledgers', icon: GitBranch, stage: 'Verifiable' },
  { label: 'Robotics & Hardware Labs', icon: Workflow, stage: 'Evolving' },
  { label: 'BioTech Computational Genomics', icon: Sparkles, stage: 'Peer Review' },
  { label: 'Quantum Algorithm Optimization', icon: Layers, stage: 'Research' },
  { label: 'Design System Engineering', icon: Flame, stage: 'White-Hot' },
  { label: 'Collaborative Space Technologies', icon: Globe, stage: 'Production v5.0' },
];

const PIPELINE_FLOW = [
  {
    step: '01',
    title: 'Genesis Thesis',
    version: 'v1.0',
    color: 'var(--h1)',
    desc: 'Author submits problem thesis, target demographic, and initial architecture. Immutable SHA-256 genesis stamp recorded.',
  },
  {
    step: '02',
    title: 'Peer Scrutiny',
    version: 'v2.0',
    color: 'var(--h2)',
    desc: 'Domain specialists propose specific textual revisions. Contextual debate is decoupled from mergeable changes.',
  },
  {
    step: '03',
    title: 'Gemini Copilot',
    version: 'v3.0',
    color: 'var(--h3)',
    desc: 'ForgeAI synthesizes vulnerability SWOT analysis, automated 8-week execution milestones, and executive briefings.',
  },
  {
    step: '04',
    title: 'Consensus Merge',
    version: 'v4.0',
    color: 'var(--h4)',
    desc: 'Idea owner merges peer contributions with a click. Contributor merit score permanently recorded in verified ledger.',
  },
  {
    step: '05',
    title: 'Production Prototype',
    version: 'v5.0',
    color: 'var(--h5)',
    desc: 'Concept reaches white-hot maturity with full audit trail ready for funding, engineering execution, or open-source release.',
  },
];

const BENTO_FEATURES = [
  {
    icon: GitBranch,
    tag: 'Genealogy Engine',
    title: 'Word-Level Diff Genealogy',
    desc: 'Never lose context. Review exact word-by-word additions, deletions, and architectural pivots across any historical release.',
    badge: 'Precision Diff',
  },
  {
    icon: Cpu,
    tag: 'ForgeAI Assistant',
    title: 'Gemini Intelligence Copilot',
    desc: 'Instant 8-week roadmaps, SWOT vulnerability critiques, and executive summaries powered by Google Gemini AI.',
    badge: 'Gemini 3.5',
  },
  {
    icon: Globe,
    tag: 'Identity & Access',
    title: 'Enterprise Multi-Provider SSO',
    desc: 'Continue seamlessly with Google or GitHub with zero latency, verified emails, and genuine OpenID 2.0 authentication.',
    badge: 'OAuth 2.0 SSO',
  },
  {
    icon: ShieldCheck,
    tag: 'Enterprise Fortification',
    title: 'Bank-Grade 2FA & Bcrypt Guard',
    desc: 'Authenticator app TOTP, encrypted recovery keys, timing-safe nonces, and brute-force mitigation on every endpoint.',
    badge: 'Hardened Security',
  },
];

const COMPARISONS = [
  {
    feature: 'Revision Lineage & Audit Trail',
    traditional: 'Overwritten files, lost author rationale',
    ideaforge: 'Immutable word-by-word cryptographic genealogy',
  },
  {
    feature: 'Collaborative Evolution',
    traditional: 'Scattered in email threads and casual chats',
    ideaforge: 'Structured PR-style textual suggestions & voting',
  },
  {
    feature: 'Contributor Credit & Attribution',
    traditional: 'Uncredited or buried in meeting minutes',
    ideaforge: 'Permanent merit scores & public portfolio proof',
  },
  {
    feature: 'Autonomous AI Fortification',
    traditional: 'Manual prompt copy-pasting',
    ideaforge: 'Native Google Gemini 3.5 Copilot built-in',
  },
  {
    feature: 'Security & Access Control',
    traditional: 'Basic password logins without safeguards',
    ideaforge: 'Enterprise OAuth 2.0 + TOTP 2FA + Bcrypt-12 Guard',
  },
];

const FAQS = [
  {
    q: 'Why should I share an unpolished or rough idea?',
    a: 'Breakthrough ideas rarely emerge fully formed. IdeaForge provides a structured sandbox where other builders, designers, and domain experts can suggest specific textual improvements that you can accept or decline with a single click.',
  },
  {
    q: 'How does versioning and crediting work?',
    a: 'When an author accepts a suggestion, IdeaForge automatically increments the idea’s version number (e.g. v1.0 to v2.0), records the exact textual changes, and permanently attributes the contributor on the project page and their profile.',
  },
  {
    q: 'Can I keep ideas private while drafting?',
    a: 'Yes. Draft ideas are strictly private to you on the server side and will never appear in explore, searches, or public APIs until you choose to publish them.',
  },
  {
    q: 'How do the Google & GitHub sign-ins work?',
    a: 'IdeaForge supports industry-standard OAuth 2.0 for Google and GitHub. Your authenticated session uses secure JWTs with rate limiting and verified email linking.',
  },
];

export default function Landing() {
  useDocumentTitle('Where Ideas Evolve');
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { openPanel: openCookies } = useConsent();
  const [featured, setFeatured] = useState(null);
  const [sfx, setSfx] = useState(sound.isEnabled());
  const [activeFaq, setActiveFaq] = useState(null);
  const [activeFlowStep, setActiveFlowStep] = useState(2); // Default to Gemini Copilot

  useEffect(() => {
    api.get('/ideas?sort=popular')
      .then((r) => setFeatured(r.slice(0, 3)))
      .catch(() => setFeatured([]));
  }, []);

  // Interactive 3D tilt and cursor spotlight across landing cards
  useEffect(() => {
    const onMove = (e) => {
      const card = e.target.closest?.('.bento-bezel, .slab, .flow-step-card, .ticker-item');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const rx = ((y / r.height) - 0.5) * -7;
      const ry = ((x / r.width) - 0.5) * 7;
      card.style.setProperty('--mx', `${x}px`);
      card.style.setProperty('--my', `${y}px`);
      card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    };
    const onLeave = (e) => {
      const card = e.target.closest?.('.bento-bezel, .slab, .flow-step-card, .ticker-item');
      if (!card) return;
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onLeave, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
    };
  }, []);

  const toggleFaq = (idx) => {
    sound.pop();
    setActiveFaq(activeFaq === idx ? null : idx);
  };

  return (
    <div className="land motion-scene">
      {/* Floating Ambient Kinetic Particles */}
      <div className="kinetic-particles" aria-hidden="true">
        <span className="kp kp-1" />
        <span className="kp kp-2" />
        <span className="kp kp-3" />
        <span className="kp kp-4" />
        <span className="kp kp-5" />
        <span className="kp kp-6" />
      </div>

      {/* Editorial Folio Top Banner */}
      <div className="editorial-folio-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 6px', borderBottom: '1px solid var(--line)', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="pulse-beacon">
            <span className="beacon-ring" />
            <span className="beacon-core" />
          </span>
          <span>ENTERPRISE ATELIER // PLATFORM STATUS: OPERATIONAL</span>
        </div>
        <span>CRYPTOGRAPHIC LINEAGE &amp; VERIFIED GENEALOGY</span>
        <span style={{ display: 'none', md: 'inline' }}>GEMINI AI ACCELERATION ENGINE</span>
      </div>

      {/* Floating Dynamic Topbar */}
      <header className="land-nav">
        <Link to="/" aria-label="IdeaForge home" onClick={() => sound.click()}>
          <Wordmark />
        </Link>
        <div className="land-links">
          <Link to="/explore" className="btn btn-ghost" onClick={() => sound.click()}>
            Explore
          </Link>
          <a href="#pipeline" className="btn btn-ghost" onClick={() => sound.click()}>
            Lineage Engine
          </a>
          <a href="#architecture" className="btn btn-ghost" onClick={() => sound.click()}>
            Architecture
          </a>
          <button
            type="button"
            className="icon-btn sfx-toggle"
            onClick={() => {
              const next = sound.toggle();
              setSfx(next);
            }}
            title={sfx ? 'Sound effects on' : 'Sound effects muted'}
            aria-label={sfx ? 'Disable audio' : 'Enable audio'}
          >
            {sfx ? <Volume2 size={17} /> : <VolumeX size={17} className="muted" />}
          </button>
          <button
            type="button"
            className="icon-btn theme-toggle"
            onClick={() => {
              sound.pop();
              toggle();
            }}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <Link to="/login" className="btn btn-ghost" onClick={() => sound.click()}>
            Log in
          </Link>
          <Link to="/register" className={user ? 'btn btn-outline' : 'btn btn-primary shimmer-sweep'} onClick={() => sound.click()}>
            Sign up
          </Link>
          {user && (
            <>
              <Link to="/dashboard" className="btn btn-primary" onClick={() => sound.click()}>
                Dashboard
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  sound.click();
                  logout();
                }}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="land-hero">
        <div className="hero-glow" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="land-hero-copy">
          <Link to="/explore" className="announcement-pill" onClick={() => sound.click()}>
            <span className="announcement-tag">Release v3.2</span>
            <span>Enterprise Engine • Cryptographic Lineage &amp; Gemini Copilot</span>
            <ArrowRight size={13} />
          </Link>

          <h1>
            Ideas sharpen in the open — <span className="font-serif text-shimmer-flow" style={{ fontWeight: 500 }}>word by word.</span>
          </h1>
          <p>
            IdeaForge keeps every version of an idea, who shaped it, and exactly which words moved. Start rough. Let mentors, peers, and Gemini AI sharpen it into a white-hot prototype.
          </p>

          <div className="land-cta">
            <Link
              to={user ? '/create' : '/register'}
              className="btn btn-primary btn-lg nested-cta magnetic-btn shimmer-sweep"
              onClick={() => sound.click()}
            >
              <span>{user ? 'Open Studio Workspace' : 'Launch Free Atelier'}</span>
              <span className="cta-icon-nest">
                <ArrowRight size={15} />
              </span>
            </Link>
            <Link to="/explore" className="btn btn-outline btn-lg magnetic-btn" onClick={() => sound.click()}>
              Browse Community Ideas
            </Link>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '28px', fontSize: '12px', color: 'var(--ink-3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--lime)' }} /> 100% Cryptographic Audit Trail
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--lime)' }} /> OpenID 2.0 Google &amp; GitHub SSO
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--lime)' }} /> Bank-Grade 2FA MFA
            </span>
          </div>
        </div>

        {/* Interactive Simulator */}
        <HeroLog />
      </section>

      {/* Ecosystem Infinite Marquee */}
      <div className="org-marquee-wrap" aria-label="Supported innovation fields">
        <div className="org-marquee-track">
          {[...ECOSYSTEM_TRACKS, ...ECOSYSTEM_TRACKS].map((t, idx) => {
            const Icon = t.icon;
            return (
              <span key={`${t.label}-${idx}`} className="org-pill-item">
                <span className="org-pill-icon"><Icon size={12} /></span>
                <span>{t.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{t.stage}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Live Telemetry Ticker */}
      <div className="land-ticker-wrap">
        <div className="land-ticker">
          {STATS.map((st) => (
            <div key={st.label} className="ticker-item">
              <b>{st.value}</b>
              <span className="ticker-label">{st.label}</span>
              <span className="ticker-sub">{st.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Continuous Energy Flow Pipeline Architecture */}
      <Reveal as="section" id="pipeline" className="land-section">
        <div className="section-title">
          <div>
            <span className="section-eyebrow">Interactive Lineage Architecture</span>
            <h2>How Ideas Move from Cold Sparks to White-Hot Reality</h2>
            <p className="muted" style={{ fontSize: '15px', marginTop: '6px' }}>
              Click any stage below to inspect the architectural transformation and lineage controls.
            </p>
          </div>
        </div>

        <div className="flow-pipeline-wrap">
          <div className="flow-track-line">
            <span className="flow-beam-runner" />
          </div>

          <div className="flow-grid-steps">
            {PIPELINE_FLOW.map((p, idx) => (
              <div
                key={p.step}
                className={`flow-step-card ${activeFlowStep === idx ? 'active' : ''}`}
                style={{ '--step-color': p.color }}
                onClick={() => {
                  sound.pop();
                  setActiveFlowStep(idx);
                }}
              >
                <div className="flow-node-badge">{p.version}</div>
                <span className="flow-step-title">{p.title}</span>
                <span className="flow-step-sub">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Double-Bezel Bento Grid Architecture */}
      <Reveal as="section" id="architecture" className="land-section bento-section">
        <div className="section-title">
          <div>
            <span className="section-eyebrow">Enterprise Grade Foundation</span>
            <h2>Architected for Mission-Critical Development</h2>
          </div>
        </div>

        <div className="bento-grid">
          {BENTO_FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="bento-bezel">
                <div className="bento-core">
                  <div className="bento-top">
                    <div className="bento-icon-wrap">
                      <Icon size={20} />
                    </div>
                    <span className="bento-badge">{feat.badge}</span>
                  </div>
                  <span className="bento-tag">{feat.tag}</span>
                  <h3>{feat.title}</h3>
                  <p>{feat.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>

      {/* Comparison Matrix: Traditional vs IdeaForge */}
      <Reveal as="section" className="land-section">
        <div className="section-title text-center">
          <div>
            <span className="section-eyebrow">Paradigm Shift</span>
            <h2>Why Modern Teams Build on IdeaForge</h2>
          </div>
        </div>

        <div className="comparison-table-wrap">
          <table className="comp-table">
            <thead>
              <tr>
                <th style={{ width: '32%' }}>Capability</th>
                <th style={{ width: '34%' }}>Traditional Documents &amp; Wikis</th>
                <th className="brand-col" style={{ width: '34%' }}>IdeaForge Living Ledger</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISONS.map((row) => (
                <tr key={row.feature}>
                  <td style={{ fontWeight: 600 }}>{row.feature}</td>
                  <td style={{ color: 'var(--ink-3)' }}>{row.traditional}</td>
                  <td className="brand-col">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} style={{ color: 'var(--accent)' }} />
                      {row.ideaforge}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* Popular Ideas Spotlight */}
      <Reveal as="section" className="land-section">
        <div className="section-title">
          <div>
            <span className="section-eyebrow">Trending in the Community</span>
            <h2>Popular Right Now</h2>
          </div>
          <Link to="/explore" className="btn btn-ghost btn-sm" onClick={() => sound.click()}>
            See all ideas <ArrowRight size={14} />
          </Link>
        </div>
        {featured && featured.length > 0 && (
          <div className="grid grid-slabs">
            {featured.map((i) => (
              <IdeaCard key={i.id} idea={i} />
            ))}
          </div>
        )}
        {featured && featured.length === 0 && (
          <div className="empty">
            <h3>No ideas published yet</h3>
            <p>Be the first. Post a rough idea and let others help it grow.</p>
            <Link to={user ? '/create' : '/register'} className="btn btn-primary" onClick={() => sound.click()}>
              Start an idea
            </Link>
          </div>
        )}
      </Reveal>

      {/* Frequently Asked Questions */}
      <Reveal as="section" className="land-section faq-section">
        <div className="section-title text-center">
          <div>
            <span className="section-eyebrow">Clear Answers</span>
            <h2>Frequently Asked Questions</h2>
          </div>
        </div>

        <div className="faq-list">
          {FAQS.map((faq, i) => (
            <div key={faq.q} className={`faq-item ${activeFaq === i ? 'open' : ''}`}>
              <button
                type="button"
                className="faq-question"
                onClick={() => toggleFaq(i)}
                aria-expanded={activeFaq === i}
              >
                <span>{faq.q}</span>
                <ChevronDown size={18} className={`faq-icon ${activeFaq === i ? 'rotated' : ''}`} />
              </button>
              {activeFaq === i && (
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Reveal>

      {/* High-Impact Final CTA */}
      <Reveal as="section" className="land-section cta-banner-section">
        <div className="cta-banner shimmer-sweep">
          <div className="cta-banner-content">
            <span className="cta-badge">Ready to build?</span>
            <h2>Stop hoarding ideas. Let them evolve.</h2>
            <p>Join hundreds of creators sharpening raw concepts into white-hot prototypes with verifiable lineage.</p>
            <div className="cta-buttons">
              <Link to={user ? '/create' : '/register'} className="btn btn-primary btn-lg nested-cta" onClick={() => sound.click()}>
                <span>{user ? 'Open Studio Workspace' : 'Get Started Free'}</span>
                <span className="cta-icon-nest"><ArrowRight size={15} /></span>
              </Link>
              <Link to="/explore" className="btn btn-outline btn-lg" onClick={() => sound.click()}>
                Explore Public Ideas
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Professional Organization Footer */}
      <footer className="org-footer">
        <div className="org-footer-grid">
          <div className="org-footer-brand">
            <Wordmark />
            <p>
              The open atelier for creative intelligence, verifiable idea lineage, and collaborative evolution.
            </p>
            <div className="org-footer-status">
              <span className="pulse-beacon">
                <span className="beacon-ring" />
                <span className="beacon-core" />
              </span>
              <span>All Systems Operational (99.99%)</span>
            </div>
          </div>

          <div className="org-footer-col">
            <h4>Platform</h4>
            <div className="org-footer-links">
              <Link to="/explore">Explore Ideas</Link>
              <a href="#pipeline">Lineage Pipeline</a>
              <a href="#architecture">Gemini Copilot</a>
              <Link to="/create">Studio Editor</Link>
            </div>
          </div>

          <div className="org-footer-col">
            <h4>Security &amp; Trust</h4>
            <div className="org-footer-links">
              <Link to="/security">Bank-Grade 2FA</Link>
              <Link to="/privacy">Privacy Architecture</Link>
              <button type="button" onClick={openCookies}>Cookie Preferences</button>
              <a href="https://github.com" target="_blank" rel="noreferrer">Open Protocol <ExternalLink size={11} style={{ display: 'inline' }} /></a>
            </div>
          </div>

          <div className="org-footer-col">
            <h4>Organization</h4>
            <div className="org-footer-links">
              <Link to="/about">About Atelier</Link>
              <Link to="/contributions">Contributor Score</Link>
              <Link to="/login">SSO Portal</Link>
              <Link to="/register">Create Account</Link>
            </div>
          </div>
        </div>

        <div className="org-footer-bottom">
          <span>&copy; {new Date().getFullYear()} IdeaForge Open Atelier Inc. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/privacy">Terms of Service</Link>
            <button type="button" onClick={openCookies}>Cookies</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
