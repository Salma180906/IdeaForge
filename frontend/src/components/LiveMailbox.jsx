import { useState, useEffect } from 'react';
import {
  Mail,
  X,
  ExternalLink,
  Copy,
  Check,
  Send,
  Sparkles,
  Inbox,
  Settings,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  BellRing,
} from 'lucide-react';
import { api } from '../api/client';
import { sound } from '../utils/sound';

export default function LiveMailbox() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('inbox'); // 'inbox' | 'test' | 'setup'
  const [emails, setEmails] = useState([]);
  const [selectedMail, setSelectedMail] = useState(null);
  const [mailStatus, setMailStatus] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [toastMail, setToastMail] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [gmailUser, setGmailUser] = useState('salmameerkhan06@gmail.com');
  const [gmailPass, setGmailPass] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState(null);

  // Poll recent emails every 3.5s
  useEffect(() => {
    let lastSeenId = null;

    const fetchEmails = async () => {
      try {
        const res = await api.get('/auth/recent-emails');
        if (res?.emails) {
          setEmails(res.emails);
          if (res.status) setMailStatus(res.status);

          if (res.emails.length > 0) {
            const newest = res.emails[0];
            // Select newest if none selected
            setSelectedMail((prev) => prev || newest);

            // Trigger toast if a genuinely new email arrived
            if (lastSeenId && newest.id !== lastSeenId) {
              setToastMail(newest);
              setUnreadCount((c) => c + 1);
              sound.notify();
            }
            lastSeenId = newest.id;
          }
        }
      } catch {
        // quiet poll fail
      }
    };

    fetchEmails();
    const interval = setInterval(fetchEmails, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = () => {
    sound.pop();
    setOpen(true);
    setUnreadCount(0);
    if (!selectedMail && emails.length > 0) {
      setSelectedMail(emails[0]);
    }
  };

  const handleClose = () => {
    sound.click();
    setOpen(false);
  };

  const handleCopyCode = (code, id) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    sound.pop();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAutofill = (code) => {
    if (!code) return;
    sound.success();
    window.dispatchEvent(new CustomEvent('ideaforge:autofill-code', { detail: { code } }));
    setToastMail(null);
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testEmail || testing) return;
    setTesting(true);
    setTestResult(null);
    sound.click();
    try {
      const res = await api.post('/auth/test-email', { email: testEmail });
      setTestResult({ ok: true, data: res });
      sound.success();
      // refresh emails
      const r = await api.get('/auth/recent-emails');
      if (r?.emails) {
        setEmails(r.emails);
        if (r.emails[0]) setSelectedMail(r.emails[0]);
      }
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    }
    setTesting(false);
  };

  const handleConnectGmail = async (e) => {
    e.preventDefault();
    if (!gmailUser || !gmailPass || connecting) return;
    setConnecting(true);
    setConnectMsg(null);
    sound.click();
    try {
      const res = await api.post('/auth/save-gmail-config', {
        gmailUser: gmailUser.trim(),
        gmailPass: gmailPass.trim(),
      });
      setConnectMsg({ ok: true, message: res.message });
      sound.success();
      // refresh status and emails
      const st = await api.get('/auth/mail-status');
      if (st) setMailStatus(st);
      const em = await api.get('/auth/recent-emails');
      if (em?.emails) {
        setEmails(em.emails);
        if (em.emails[0]) setSelectedMail(em.emails[0]);
      }
    } catch (err) {
      setConnectMsg({ ok: false, message: err.message });
    }
    setConnecting(false);
  };

  return (
    <>
      {/* 1. Floating Launcher Dock */}
      <div className="live-mailbox-dock" role="region" aria-label="Mailbox Quick Access">
        <button
          type="button"
          className="mailbox-dock-btn"
          onClick={handleOpen}
          title="Open Live Mailbox & OTP Receiver"
        >
          <div className="dock-icon-wrap">
            <Mail size={18} />
            {unreadCount > 0 && <span className="dock-unread-badge">{unreadCount}</span>}
          </div>
          <span className="dock-label">Live Mailbox</span>
          {mailStatus?.hasGmailConfig ? (
            <span className="dock-provider-badge live">Gmail</span>
          ) : (
            <span className="dock-provider-badge sandbox">Ethereal / In-App</span>
          )}
        </button>
      </div>

      {/* 2. Floating Notification Toast when new email arrives */}
      {toastMail && (
        <div className="mailbox-toast-banner" role="alert">
          <div className="toast-glow" />
          <div className="toast-left">
            <div className="toast-icon"><BellRing size={18} /></div>
            <div className="toast-meta">
              <div className="toast-title">
                Incoming Email to <b>{toastMail.to}</b>
              </div>
              <div className="toast-sub">
                {toastMail.code ? (
                  <>Verification Code: <span className="toast-code">{toastMail.code}</span></>
                ) : (
                  toastMail.subject
                )}
              </div>
            </div>
          </div>
          <div className="toast-actions">
            {toastMail.code && (
              <button
                type="button"
                className="toast-autofill-btn"
                onClick={() => handleAutofill(toastMail.code)}
              >
                <Sparkles size={13} /> Auto-Fill
              </button>
            )}
            <button
              type="button"
              className="toast-view-btn"
              onClick={() => {
                setSelectedMail(toastMail);
                setOpen(true);
                setToastMail(null);
                sound.pop();
              }}
            >
              View Email
            </button>
            <button
              type="button"
              className="toast-dismiss-btn"
              onClick={() => setToastMail(null)}
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* 3. Slide-over / Modal Drawer */}
      {open && (
        <div className="mailbox-modal-overlay" onClick={handleClose}>
          <div className="mailbox-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="mailbox-header">
              <div className="mailbox-header-title">
                <div className="mailbox-header-icon"><Mail size={20} /></div>
                <div>
                  <h3>IdeaForge Live Mailbox</h3>
                  <div className="mailbox-status-line">
                    <span className="status-dot online" />
                    <span>Active Provider: <b>{mailStatus?.provider || 'In-App Sandbox'}</b></span>
                    {mailStatus?.hasGmailConfig && <span className="status-pill gmail">Direct Gmail Delivery</span>}
                  </div>
                </div>
              </div>
              <button type="button" className="mailbox-close-btn" onClick={handleClose}>
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="mailbox-tabs">
              <button
                type="button"
                className={`mailbox-tab-btn ${tab === 'inbox' ? 'active' : ''}`}
                onClick={() => { sound.click(); setTab('inbox'); }}
              >
                <Inbox size={15} /> Recent Inboxes ({emails.length})
              </button>
              <button
                type="button"
                className={`mailbox-tab-btn ${tab === 'test' ? 'active' : ''}`}
                onClick={() => { sound.click(); setTab('test'); }}
              >
                <Send size={15} /> Send Test Mail
              </button>
              <button
                type="button"
                className={`mailbox-tab-btn ${tab === 'setup' ? 'active' : ''}`}
                onClick={() => { sound.click(); setTab('setup'); }}
              >
                <Settings size={15} /> Gmail Setup Guide
              </button>
            </div>

            {/* TAB 1: INBOX */}
            {tab === 'inbox' && (
              <div className="mailbox-inbox-grid">
                {/* Left: Email List */}
                <div className="mailbox-sidebar">
                  {emails.length === 0 ? (
                    <div className="mailbox-empty-state">
                      <Inbox size={32} />
                      <p>No emails dispatched yet.</p>
                      <span className="muted small">Trigger a Forgot Password, Email Verify, or Send a Test Email.</span>
                    </div>
                  ) : (
                    emails.map((m) => (
                      <div
                        key={m.id}
                        className={`mailbox-item ${selectedMail?.id === m.id ? 'active' : ''}`}
                        onClick={() => { sound.click(); setSelectedMail(m); }}
                      >
                        <div className="item-head">
                          <span className="item-to">{m.to}</span>
                          <span className="item-time">
                            {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <div className="item-subject">{m.subject}</div>
                        {m.code && (
                          <div className="item-code-badge">
                            <span>Code: <b>{m.code}</b></span>
                            <span className="item-purpose">{m.purpose}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Right: Selected Email Viewer */}
                <div className="mailbox-detail-pane">
                  {selectedMail ? (
                    <div className="mail-detail-content">
                      <div className="detail-meta-card">
                        <div className="meta-row">
                          <span className="meta-label">Subject:</span>
                          <span className="meta-val font-bold">{selectedMail.subject}</span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-label">To:</span>
                          <span className="meta-val code-font">{selectedMail.to}</span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-label">Dispatched:</span>
                          <span className="meta-val">{new Date(selectedMail.sentAt).toLocaleString()}</span>
                          <span className="detail-provider-pill">{selectedMail.provider}</span>
                        </div>

                        {/* Passcode Quick Action Bar */}
                        {selectedMail.code && (
                          <div className="otp-action-strip">
                            <div className="otp-display">
                              <span className="otp-label">ONE-TIME CODE</span>
                              <span className="otp-value">{selectedMail.code}</span>
                            </div>
                            <div className="otp-btn-group">
                              <button
                                type="button"
                                className="otp-copy-btn"
                                onClick={() => handleCopyCode(selectedMail.code, selectedMail.id)}
                              >
                                {copiedId === selectedMail.id ? <Check size={14} /> : <Copy size={14} />}
                                {copiedId === selectedMail.id ? 'Copied' : 'Copy'}
                              </button>
                              <button
                                type="button"
                                className="otp-autofill-btn"
                                onClick={() => handleAutofill(selectedMail.code)}
                              >
                                <Sparkles size={14} /> Auto-Fill Everywhere
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedMail.previewUrl && (
                          <div className="ethereal-link-bar">
                            <span>View external web message:</span>
                            <a
                              href={selectedMail.previewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ethereal-ext-btn"
                            >
                              <ExternalLink size={13} /> Open in Ethereal Online Inbox
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Rendered HTML Message Body */}
                      <div className="mail-body-preview">
                        <div
                          className="mail-rendered-html"
                          dangerouslySetInnerHTML={{ __html: selectedMail.html }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="detail-empty">Select an email to view its contents.</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: SEND TEST MAIL */}
            {tab === 'test' && (
              <div className="mailbox-test-pane">
                <div className="test-intro">
                  <ShieldCheck size={28} className="intro-icon" />
                  <div>
                    <h4>Test Outgoing Email Delivery</h4>
                    <p className="muted">
                      Send a real verification email to any email address to verify how delivery behaves on your computer.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSendTest} className="test-mail-form">
                  <div className="field">
                    <label htmlFor="test-email-inp">Destination Email Address</label>
                    <input
                      id="test-email-inp"
                      type="email"
                      required
                      placeholder="e.g. salmameerkhan06@gmail.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={testing}>
                    {testing ? (
                      <><RefreshCw size={14} className="spin" /> Dispatching Test Email...</>
                    ) : (
                      <><Send size={14} /> Send Test Passcode Email</>
                    )}
                  </button>
                </form>

                {testResult && (
                  <div className={`test-feedback-box ${testResult.ok ? 'success' : 'error'}`}>
                    {testResult.ok ? (
                      <>
                        <div className="feedback-head">
                          <Check size={18} />
                          <span><b>Successfully Dispatched!</b></span>
                        </div>
                        <p>{testResult.data.message}</p>
                        <div className="feedback-details">
                          <div>Generated OTP: <b>{testResult.data.code}</b></div>
                          <div>Carrier Provider: <b>{testResult.data.provider}</b></div>
                          {testResult.data.previewUrl && (
                            <a
                              href={testResult.data.previewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ marginTop: '8px', display: 'inline-flex' }}
                            >
                              <ExternalLink size={13} /> View Delivered Email in Browser
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <b>Failed to send:</b> {testResult.error}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GMAIL SETUP & DIRECT CONNECT */}
            {tab === 'setup' && (
              <div className="mailbox-setup-pane">
                <div className="setup-hero">
                  <h4>Want real emails delivered straight to your personal Gmail inbox?</h4>
                  <p className="muted">
                    Because this project runs locally on your machine, Google requires an authenticated Google App Password to deliver emails directly to your Gmail app on your phone.
                  </p>
                </div>

                {/* Direct Connect Form */}
                <div className="connect-gmail-card">
                  <div className="card-head">
                    <ShieldCheck size={20} className="card-head-icon" />
                    <div>
                      <h5>1-Click Gmail Connect</h5>
                      <span className="muted small">Enter your Gmail and 16-letter App Password to immediately start receiving emails on your phone.</span>
                    </div>
                  </div>

                  <form onSubmit={handleConnectGmail} className="gmail-connect-form">
                    <div className="field">
                      <label htmlFor="gm-user">Your Gmail Address</label>
                      <input
                        id="gm-user"
                        type="email"
                        required
                        value={gmailUser}
                        onChange={(e) => setGmailUser(e.target.value)}
                        placeholder="e.g. salmameerkhan06@gmail.com"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="gm-pass">
                        Google App Password (16 characters)
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noreferrer"
                          className="app-pass-link"
                        >
                          <ExternalLink size={12} /> Get App Password from Google
                        </a>
                      </label>
                      <input
                        id="gm-pass"
                        type="password"
                        required
                        value={gmailPass}
                        onChange={(e) => setGmailPass(e.target.value)}
                        placeholder="abcd efgh ijkl mnop"
                        autoComplete="new-password"
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block" disabled={connecting}>
                      {connecting ? (
                        <><RefreshCw size={14} className="spin" /> Verifying with Google & Sending Test Mail...</>
                      ) : (
                        <><Sparkles size={14} /> Connect Gmail & Send Real Email to My Phone</>
                      )}
                    </button>
                  </form>

                  {connectMsg && (
                    <div className={`connect-result-box ${connectMsg.ok ? 'success' : 'error'}`}>
                      {connectMsg.ok ? (
                        <div className="result-ok">
                          <Check size={18} />
                          <div>
                            <b>Connected Successfully!</b>
                            <p>{connectMsg.message}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="result-err">
                          <b>Connection Failed:</b> {connectMsg.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="setup-steps">
                  <div className="setup-step">
                    <div className="step-num">1</div>
                    <div className="step-body">
                      <b>How to generate your Google App Password (free, takes 30 seconds):</b>
                      <p>
                        1. Visit <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords</a> on your Google account.<br />
                        2. <i>(Ensure 2-Step Verification is turned on in your Google Account security)</i>.<br />
                        3. In "App name", type <code>IdeaForge</code> and click <b>Generate</b>.<br />
                        4. Copy the 16-letter password (e.g. <code>abcd efgh ijkl mnop</code>) and paste it into the box above or into <code>backend/.env</code>!
                      </p>
                    </div>
                  </div>

                  <div className="setup-step">
                    <div className="step-num">2</div>
                    <div className="step-body">
                      <b>Alternative: Add directly to <code>backend/.env</code>:</b>
                      <pre className="setup-code">
{`MAIL_PROVIDER=smtp
GMAIL_USER=salmameerkhan06@gmail.com
GMAIL_PASS=abcd efgh ijkl mnop
MAIL_FROM=salmameerkhan06@gmail.com
MAIL_FROM_NAME=IdeaForge`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
