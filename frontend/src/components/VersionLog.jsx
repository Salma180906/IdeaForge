import { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Avatar } from './ui';
import DiffText from './DiffText';
import { fieldDiffs, formatDate, heatForVersion, stageLabel, STAGES } from '../utils';

// The evolution log: newest version on top, joined by a rail that cools towards the first version.
// Every version can open to show exactly which words changed since the one before it.
// Historical versions can be restored by the idea owner as a new version branch.
export default function VersionLog({ versions, isOwner = false, onRestore = null }) {
  const [open, setOpen] = useState(null);
  const ordered = [...versions].sort((a, b) => b.version_no - a.version_no);
  const newest = ordered[0]?.version_no;

  return (
    <ol className="vlog">
      {ordered.map((v, idx) => {
        const older = ordered[idx + 1];
        const diffs = older ? fieldDiffs(older, v) : [];
        const isOpen = open === v.id;
        const stage = STAGES[Math.min(v.version_no - 1, 4)];
        return (
          <li key={v.id} className={`vlog-item ${v.version_no === newest ? 'is-newest' : ''}`}
            style={{ '--i': idx, '--c': heatForVersion(v.version_no), '--c-older': older ? heatForVersion(older.version_no) : 'var(--line)' }}>
            <span className="vlog-node" aria-hidden="true" />
            <div className="vlog-body">
              <div className="vlog-head">
                <b className="vlog-tag">v{v.version_no}.0</b>
                <span className="vlog-stage">{stageLabel(stage)}</span>
                {v.version_no === newest && <span className="vlog-current">Current</span>}
                <time className="vlog-date" dateTime={v.created_at}>{formatDate(v.created_at)}</time>
              </div>
              <p className="vlog-msg prose">{v.change_summary}</p>
              <div className="vlog-foot">
                <span className="author"><Avatar name={v.created_by_name} size={20} />{v.created_by_name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isOwner && v.version_no < newest && onRestore && (
                    <button
                      type="button"
                      className="link-btn vlog-restore-btn"
                      onClick={() => onRestore(v)}
                      title={`Restore version ${v.version_no} as the new active version`}
                    >
                      <RotateCcw size={13} aria-hidden="true" /> Restore this version
                    </button>
                  )}
                  {older && (
                    <button type="button" className={`link-btn ${isOpen ? 'on' : ''}`} aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : v.id)}>
                      {diffs.length ? `What changed (${diffs.length})` : 'What changed'}
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              {isOpen && (
                <div className="vlog-diff">
                  {diffs.length === 0 && <p className="muted small">This version was recorded without changing any text.</p>}
                  {diffs.map((d) => (
                    <div key={d.key} className="diff-field">
                      <h5>{d.label}</h5>
                      <DiffText ops={d.ops} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
