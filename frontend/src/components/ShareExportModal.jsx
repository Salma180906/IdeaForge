import { useState, useEffect } from 'react';
import { Share2, Download, Copy, Check, QrCode, FileText, Code2, Printer, Twitter, Linkedin, MessageCircle, ExternalLink, X } from 'lucide-react';
import { Modal } from './ui';
import { api } from '../api/client';
import { sound } from '../utils/sound';
import { versionLabel, stageLabel } from '../utils';

export default function ShareExportModal({ idea, versions, onClose }) {
  const [tab, setTab] = useState('share'); // 'share' | 'export'
  const [copied, setCopied] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  const url = typeof window !== 'undefined' ? window.location.href : `https://ideaforge.io/ideas/${idea.id}`;

  useEffect(() => {
    setQrLoading(true);
    api.get(`/ideas/${idea.id}/qr`)
      .then((res) => setQrData(res.qr))
      .catch(() => setQrData(null))
      .finally(() => setQrLoading(false));
  }, [idea.id]);

  const handleCopy = () => {
    sound.success();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadMarkdown = () => {
    sound.success();
    const md = `# ${idea.title} (${versionLabel(idea.current_version)})
*Stage: ${stageLabel(idea.stage)} | Category: ${idea.category} | Author: ${idea.author_name}*

## Overview
${idea.description || 'No description provided.'}

## Problem Statement
${idea.problem || 'Not specified.'}

## Proposed Solution
${idea.solution || 'Not specified.'}

## Target Users
${idea.target_users || 'Not specified.'}

## Expected Impact
${idea.impact || 'Not specified.'}

## Evolution & History
${versions?.map((v) => `- **${versionLabel(v.version_no)}**: ${v.change_summary || v.title} (by ${v.created_by_name || 'Owner'})`).join('\n') || 'Initial concept'}

---
*Exported from IdeaForge: ${url}*
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${idea.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-v${idea.current_version}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDownloadJson = () => {
    sound.success();
    const data = {
      idea,
      versions,
      exportedAt: new Date().toISOString(),
      url,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${idea.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-data.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handlePrint = () => {
    sound.click();
    window.print();
  };

  const shareText = encodeURIComponent(`Check out "${idea.title}" on IdeaForge:`);
  const shareUrl = encodeURIComponent(url);

  return (
    <Modal title="Share & Export Idea" onClose={onClose}>
      <div className="share-modal-tabs">
        <button
          type="button"
          className={`tab-btn ${tab === 'share' ? 'active' : ''}`}
          onClick={() => {
            sound.pop();
            setTab('share');
          }}
        >
          <Share2 size={15} />
          <span>Share &amp; QR Code</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === 'export' ? 'active' : ''}`}
          onClick={() => {
            sound.pop();
            setTab('export');
          }}
        >
          <Download size={15} />
          <span>Export Documents</span>
        </button>
      </div>

      {tab === 'share' ? (
        <div className="share-tab-content">
          <div className="share-link-group">
            <label className="field-label">Shareable Link</label>
            <div className="share-copy-row">
              <input type="text" readOnly value={url} className="share-input" />
              <button type="button" className={`btn ${copied ? 'btn-active' : 'btn-primary'}`} onClick={handleCopy}>
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
          </div>

          <div className="share-social-grid">
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn twitter"
              onClick={() => sound.click()}
            >
              <Twitter size={15} /> Twitter / X
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn linkedin"
              onClick={() => sound.click()}
            >
              <Linkedin size={15} /> LinkedIn
            </a>
            <a
              href={`https://api.whatsapp.com/send?text=${shareText}%20${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn whatsapp"
              onClick={() => sound.click()}
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(idea.title)}&body=${encodeURIComponent(`Check out this idea on IdeaForge: ${url}`)}`}
              className="social-btn email"
              onClick={() => sound.click()}
            >
              <ExternalLink size={15} /> Email
            </a>
          </div>

          <div className="qr-section">
            <div className="qr-card">
              {qrLoading ? (
                <div className="qr-loading">Generating QR code...</div>
              ) : qrData ? (
                <img src={qrData} alt="Scan to view idea" className="qr-img" />
              ) : (
                <div className="qr-fallback"><QrCode size={48} /></div>
              )}
              <div className="qr-meta">
                <b>Scan to open on phone</b>
                <span className="muted small">Instant mobile preview without logging in</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="export-tab-content">
          <p className="muted small">
            Export complete snapshot including version genealogy, problem breakdown, and contributor attributions.
          </p>

          <div className="export-actions-list">
            <button type="button" className="export-item" onClick={handleDownloadMarkdown}>
              <div className="export-icon"><FileText size={20} /></div>
              <div className="export-info">
                <b>Markdown Document (.md)</b>
                <span>Formatted GitHub-style document with all version sections and headers</span>
              </div>
              <Download size={16} className="export-arrow" />
            </button>

            <button type="button" className="export-item" onClick={handleDownloadJson}>
              <div className="export-icon"><Code2 size={20} /></div>
              <div className="export-info">
                <b>Machine-Readable JSON (.json)</b>
                <span>Full structured data payload for integration or backup</span>
              </div>
              <Download size={16} className="export-arrow" />
            </button>

            <button type="button" className="export-item" onClick={handlePrint}>
              <div className="export-icon"><Printer size={20} /></div>
              <div className="export-info">
                <b>Print / Clean PDF Summary</b>
                <span>Opens browser print view formatted cleanly for one-sheet distribution</span>
              </div>
              <ExternalLink size={16} className="export-arrow" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
