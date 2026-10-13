// Production Transactional Email Service
// Providers supported:
// 1. Resend API (RESEND_API_KEY)
// 2. Brevo API (BREVO_API_KEY)
// 3. SMTP / Gmail (GMAIL_USER & GMAIL_PASS or SMTP_HOST & SMTP_USER)
// 4. Ethereal / Dev fallback (development and test environments only)
const nodemailer = require('nodemailer');

const env = process.env;
const isProd = process.env.NODE_ENV === 'production';

let smtpTransporter = null;
let etherealTransporter = null;
let etherealAccount = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function initConfiguredTransporter() {
  if (env.GMAIL_USER && env.GMAIL_PASS) {
    try {
      smtpTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: env.GMAIL_USER.trim(),
          pass: env.GMAIL_PASS.replace(/\s+/g, ''),
        },
      });
      console.log(`[MAILER] Gmail SMTP initialized for ${env.GMAIL_USER}`);
      return;
    } catch (e) {
      console.warn('[MAILER] Gmail transport error:', e.message);
    }
  }

  if (env.SMTP_HOST) {
    try {
      smtpTransporter = nodemailer.createTransport({
        host: env.SMTP_HOST.trim(),
        port: Number(env.SMTP_PORT) || 587,
        secure: env.SMTP_SECURE === 'true' || Number(env.SMTP_PORT) === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER.trim(), pass: (env.SMTP_PASS || '').trim() } : undefined,
      });
      console.log(`[MAILER] Custom SMTP transport initialized for ${env.SMTP_HOST}`);
      return;
    } catch (e) {
      console.warn('[MAILER] Custom SMTP transport error:', e.message);
    }
  }

  smtpTransporter = null;
}

initConfiguredTransporter();

async function getEtherealTransporter() {
  if (etherealTransporter) return etherealTransporter;
  if (isProd) return null; // never use Ethereal in production
  try {
    const acc = await Promise.race([
      nodemailer.createTestAccount(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Ethereal setup timed out')), 2500)),
    ]);
    etherealAccount = acc;
    etherealTransporter = nodemailer.createTransport({
      host: acc.smtp.host,
      port: acc.smtp.port,
      secure: acc.smtp.secure,
      auth: { user: acc.user, pass: acc.pass },
      connectionTimeout: 2500,
    });
    console.log(`[MAILER] Dev test inbox initialized: ${acc.user}`);
    return etherealTransporter;
  } catch (err) {
    console.warn('[MAILER] Dev ethereal fallback unavailable:', err.message);
    return null;
  }
}

// Check if any real external delivery service is active
function isConfigured() {
  return !!(
    env.RESEND_API_KEY ||
    env.BREVO_API_KEY ||
    (env.GMAIL_USER && env.GMAIL_PASS) ||
    env.SMTP_HOST
  );
}

// Dispatches an email through the highest priority configured carrier
async function send({ to, subject, text, html, code, purpose, name }) {
  const fromEmail = env.MAIL_FROM || env.GMAIL_USER || 'noreply@ideaforge.io';
  const fromName = env.MAIL_FROM_NAME || 'IdeaForge';

  if (code) {
    console.log(`\n============================================================\n[IDEAFORGE AUTHENTICATION CODE]\n  Recipient : ${to}\n  Code      : ${code}\n  Purpose   : ${purpose || 'verification'}\n============================================================\n`);
  } else {
    console.log(`[MAILER] Sending "${subject}" to ${to}`);
  }

  if (!isConfigured()) {
    console.log('[MAILER NOTICE] To deliver real emails to Gmail inboxes, configure GMAIL_USER & GMAIL_PASS (or RESEND_API_KEY) in backend/.env.');
  }

  // 1. Resend API
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject,
          text,
          html,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`[MAILER] Sent via Resend API: ${data.id}`);
        return { success: true, provider: 'resend', id: data.id };
      }
      console.warn(`[MAILER] Resend API error (${res.status})`);
    } catch (err) {
      console.warn('[MAILER] Resend API dispatch failure:', err.message);
    }
  }

  // 2. Brevo API
  if (env.BREVO_API_KEY) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          textContent: text,
          htmlContent: html,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        console.log(`[MAILER] Sent via Brevo API`);
        return { success: true, provider: 'brevo' };
      }
      console.warn(`[MAILER] Brevo API error (${res.status})`);
    } catch (err) {
      console.warn('[MAILER] Brevo API dispatch failure:', err.message);
    }
  }

  // 3. SMTP / Gmail
  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text,
        html,
      });
      const provider = env.GMAIL_USER ? 'gmail' : 'smtp';
      console.log(`[MAILER] Sent via ${provider}: ${info.messageId}`);
      return { success: true, provider, id: info.messageId };
    } catch (err) {
      console.warn(`[MAILER] SMTP dispatch failure (${err.message})`);
    }
  }

  // 4. Non-production test fallback
  if (!isProd) {
    try {
      const et = await getEtherealTransporter();
      if (et) {
        const info = await et.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to,
          subject,
          text,
          html,
        });
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`[MAILER] Dev Preview: ${previewUrl}`);
        return { success: true, provider: 'ethereal', previewUrl };
      }
    } catch (err) {
      console.warn('[MAILER] Dev transport failed:', err.message);
    }
  }

  if (isProd) {
    throw new Error('Email service is not configured on this server. Please contact an administrator.');
  }

  return { success: false, provider: 'none' };
}

const wrapHtml = (inner) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;max-width:540px;margin:auto;padding:36px 32px;background:#ffffff;border-radius:16px;border:1px solid #e5e4ee;color:#15131d;box-shadow:0 8px 30px rgba(0,0,0,0.04)">
  <div style="display:flex;align-items:center;margin-bottom:28px">
    <div style="display:inline-block;padding:8px 16px;background:#e24b27;color:#ffffff;border-radius:10px;font-weight:900;font-size:20px;letter-spacing:-0.5px">IdeaForge</div>
    <span style="margin-left:14px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#7a778c;font-weight:700">Platform Security</span>
  </div>
  ${inner}
  <hr style="border:none;border-top:1px solid #edecee;margin:32px 0 20px" />
  <p style="color:#7a778c;font-size:12px;line-height:1.6;margin:0">This is an automated security transmission from IdeaForge. If you did not initiate this request, your account remains protected.</p>
</div>`;

const PURPOSE_TEXT = {
  verify: 'verify your email address',
  reset: 'reset your account password',
  login: 'complete your 2-step authentication',
};

async function sendWelcome(to, name) {
  return send({
    to,
    name,
    subject: 'Welcome to IdeaForge — Where Ideas Evolve',
    text: `Hi ${name},\n\nWelcome to IdeaForge! You are now part of a community where raw ideas are proposed, tested, and evolved through constructive collaboration.\n\nStart by browsing ideas or submitting your own concept.`,
    html: wrapHtml(`
      <p style="font-size:16px;line-height:1.5;margin-top:0">Hi <b>${esc(name)}</b>,</p>
      <p style="font-size:15px;color:#3c394c;line-height:1.6">Welcome to <b>IdeaForge</b>! Your account has been verified and is ready to use.</p>
      <p style="font-size:15px;color:#3c394c;line-height:1.6">IdeaForge is built to turn rough concepts into battle-tested prototypes through version history, community suggestions, and guided evolution.</p>
      <div style="margin:28px 0;text-align:center">
        <a href="${env.CLIENT_URL || 'http://localhost:5173'}/dashboard" style="display:inline-block;background:#e24b27;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">Open Your Dashboard</a>
      </div>
    `),
  });
}

async function sendOtp(to, name, code, purpose) {
  const what = PURPOSE_TEXT[purpose] || 'continue';
  return send({
    to,
    name,
    code,
    purpose,
    subject: `${code} is your IdeaForge verification code`,
    text: `Hi ${name},\n\nYour code to ${what} is: ${code}\n\nThis code is valid for 10 minutes and can only be used once.\n\nIf you did not request this, you can safely ignore this email.`,
    html: wrapHtml(`
      <p style="font-size:16px;line-height:1.5;margin-top:0">Hi <b>${esc(name)}</b>,</p>
      <p style="font-size:15px;color:#3c394c;line-height:1.6">We received a request to <b>${what}</b>. Use the one-time verification passcode below to proceed:</p>
      <div style="background:#fff4f0;border:2px dashed #f6957a;border-radius:12px;padding:22px;text-align:center;margin:28px 0">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:800;color:#e24b27;margin-bottom:8px">One-Time Passcode</div>
        <div style="font-size:42px;letter-spacing:14px;font-weight:900;color:#e24b27;font-family:'SFMono-Regular',Consolas,Menlo,monospace;text-indent:14px">${code}</div>
      </div>
      <p style="font-size:13px;color:#7a778c;line-height:1.5">⏱️ This code expires in <b>10 minutes</b>. Never share this passcode with anyone.</p>
    `),
  });
}

async function sendNotice(to, name, subject, message) {
  return send({
    to,
    name,
    subject,
    text: `Hi ${name},\n\n${message}\n\nIf this was not you, please secure your account immediately.`,
    html: wrapHtml(`
      <p style="font-size:16px;margin-top:0">Hi <b>${esc(name)}</b>,</p>
      <p style="font-size:15px;color:#3c394c;line-height:1.6">${esc(message)}</p>
      <p style="font-size:13px;color:#b42318;margin-top:22px;font-weight:600">⚠️ If this was not you, reset your password right away.</p>
    `),
  });
}

function getMailStatus() {
  let activeProvider = 'none';
  if (env.RESEND_API_KEY) activeProvider = 'resend';
  else if (env.BREVO_API_KEY) activeProvider = 'brevo';
  else if (env.GMAIL_USER && env.GMAIL_PASS) activeProvider = 'gmail';
  else if (env.SMTP_HOST) activeProvider = 'smtp';
  else if (!isProd && etherealTransporter) activeProvider = 'ethereal';

  return {
    provider: activeProvider,
    isConfigured: isConfigured(),
    isProduction: isProd,
    hasGmail: !!(env.GMAIL_USER && env.GMAIL_PASS),
    hasBrevo: !!env.BREVO_API_KEY,
    hasResend: !!env.RESEND_API_KEY,
    hasSmtp: !!env.SMTP_HOST,
  };
}

module.exports = {
  enabled: true,
  send,
  sendWelcome,
  sendOtp,
  sendNotice,
  isConfigured,
  getMailStatus,
  initConfiguredTransporter,
};
