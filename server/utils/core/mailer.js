import nodemailer from 'nodemailer';
import fs from 'fs';
import crypto from 'crypto';
import { EMAIL_MARK_CID, EMAIL_MARK_PNG_BASE64 } from './emailMark.js';

/**
 * Transactional email over SMTP (any provider: Brevo, Gmail, SES, Mailgun, …).
 *
 *   SMTP_HOST, SMTP_PORT (587 = STARTTLS, 465 = implicit TLS), SMTP_SECURE
 *   (optional override), SMTP_USER, SMTP_PASS, MAIL_FROM.
 *
 * The transport is created on first use, so the values are read after dotenv
 * has loaded them. Logs never contain the message body (it can hold one-time codes).
 */

const SEND_TIMEOUT_MS = 10000;

let transport = null;
let transportKey = '';

/** Safe description of the mail setup for diagnostics (never the password). */
export function mailConfig() {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  return {
    configured: !!(host && process.env.SMTP_USER && process.env.SMTP_PASS),
    host,
    port,
    secure,
    from: process.env.MAIL_FROM || '',
  };
}

function getTransport() {
  const cfg = mailConfig();
  if (!cfg.configured) return null;
  // rebuilt if the settings change (tests, hot reload)
  const rejectUnauthorized = process.env.NODE_ENV === 'production' || process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';
  const key = [cfg.host, cfg.port, cfg.secure, process.env.SMTP_USER, crypto.createHash('sha256').update(String(process.env.SMTP_PASS)).digest('hex'), rejectUnauthorized].join('|');
  if (!transport || key !== transportKey) {
    transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      // on 587 refuse to send the password over an unencrypted connection
      requireTLS: !cfg.secure,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // a self-signed certificate is accepted only outside production, and only when asked for (local test servers)
      tls: { rejectUnauthorized },
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    });
    transportKey = key;
  }
  return transport;
}

/** Escape text before it goes into email HTML (names come from users and OAuth profiles). */
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// network trouble and SMTP 4xx replies are worth one retry; auth failures and 5xx are not
const isTransient = (error) => {
  const code = String(error?.code || '');
  const rc = Number(error?.responseCode || 0);
  return /ETIMEDOUT|ECONNECTION|ESOCKET|ECONNRESET|EDNS|timeout/i.test(code + ' ' + (error?.message || '')) || (rc >= 400 && rc < 500);
};

/** Short, secret-free reason for logs and the admin test. */
export const describeMailError = (error) => {
  if (!error) return 'unknown';
  if (error.code === 'EAUTH') return 'SMTP login rejected (check SMTP_USER / SMTP_PASS)';
  if (error.responseCode) return `SMTP ${error.responseCode}: ${String(error.response || '').slice(0, 120)}`;
  return error.code || error.message || 'unknown';
};

const logoAttachment = () => ({
  filename: 'tutorboard.png',
  content: Buffer.from(EMAIL_MARK_PNG_BASE64, 'base64'),
  contentType: 'image/png',
  cid: EMAIL_MARK_CID,
  contentDisposition: 'inline',
});

/** Plain-text part (spam filters and text-only clients): the HTML without markup. */
export function htmlToText(html) {
  return String(html)
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<(br|\/p|\/h1|\/tr|\/table)[^>]*>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#\d+;/g, '').replace(/&amp;/g, '&')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

/**
 * Sends a transactional email over SMTP
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content of the email
 * @param {string} [options.from] - Sender (defaults to MAIL_FROM; must be a sender your SMTP provider has verified)
 * @returns {Promise<{ success?: true, id?: string, skipped?: true, error?: any }>}
 */
export const sendEmail = async ({ to, subject, html, from }) => {
  try {
    const smtp = getTransport();
    if (!smtp) {
      // Local development only: MAIL_DEV_OUTBOX=<file> appends outgoing mail to a file
      // so sign-up/reset can be exercised without a mail provider. Never in production.
      if (process.env.NODE_ENV !== 'production' && process.env.MAIL_DEV_OUTBOX) {
        fs.appendFileSync(process.env.MAIL_DEV_OUTBOX, JSON.stringify({ at: new Date().toISOString(), to, subject, html }) + '\n');
        return { success: true, id: 'dev-outbox' };
      }
      console.warn('[Mailer] SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS). Email skipped:', { subject });
      return { skipped: true };
    }

    const sender = from || process.env.MAIL_FROM || process.env.SMTP_USER;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const info = await smtp.sendMail({
          from: sender,
          to,
          subject,
          html,
          text: htmlToText(html),
          // the logo is referenced as cid:tutorboard-mark; attach it only when used
          attachments: html.includes(`cid:${EMAIL_MARK_CID}`) ? [logoAttachment()] : [],
        });
        console.log('[Mailer] Email sent:', info.messageId, `(${subject})`);
        return { success: true, id: info.messageId };
      } catch (err) {
        if (attempt === 0 && isTransient(err)) {
          await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
          continue;
        }
        console.error('[Mailer] Error sending email:', describeMailError(err), `(${subject})`);
        return { error: err };
      }
    }
    return { error: 'unreachable' };
  } catch (err) {
    console.error('[Mailer] Critical failure in sendEmail:', err.message);
    return { error: err.message };
  }
};

// ─── Templates ───────────────────────────────────────────────────────────────
//
// One layout for every email that follows the reader's mail theme instead of
// forcing one. The inline styles are the light version (what every client can
// show); a <style> block re-colours the same elements for dark mode in clients
// that support it (Apple Mail, iOS Mail, Outlook: prefers-color-scheme and
// [data-ogsc]); the Gmail apps darken light emails on their own. The page has
// no background of its own, so the email sits on the client's own surface.
// Table-based with inline styles because email clients ignore flex/grid.
// The TutorBoard mark is an inline PNG (cid:), shown top-left before the title.

const L = { card: '#ffffff', line: '#e6e4dd', tile: '#f6f5f0', text: '#0f0f0e', muted: '#4f4d47', faint: '#8a877e', accent: '#b45f06', danger: '#c2410c', btnBg: '#0f0f0e', btnText: '#fdfaf3' };
const D = { card: '#141413', line: '#2a2a27', tile: '#1c1c1a', text: '#f9f6e5', muted: '#b4b1a7', faint: '#7c7a72', accent: '#f5a524', danger: '#f87171', btnBg: '#f9f6e5', btnText: '#0f0f0e' };

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";

const DARK_CSS = (sel) => `
  ${sel} .tb-card { background-color:${D.card} !important; border-color:${D.line} !important; }
  ${sel} .tb-tile { background-color:${D.tile} !important; border-color:${D.line} !important; }
  ${sel} .tb-line { background-color:${D.line} !important; border-color:${D.line} !important; }
  ${sel} .tb-bt { border-color:${D.line} !important; }
  ${sel} .tb-text { color:${D.text} !important; }
  ${sel} .tb-muted { color:${D.muted} !important; }
  ${sel} .tb-faint { color:${D.faint} !important; }
  ${sel} .tb-accent { color:${D.accent} !important; }
  ${sel} .tb-bar { border-left-color:${D.accent} !important; }
  ${sel} .tb-bar-danger { border-left-color:${D.danger} !important; }
  ${sel} .tb-dot { background-color:${D.accent} !important; }
  ${sel} .tb-btn { background-color:${D.btnBg} !important; }
  ${sel} .tb-btn a { color:${D.btnText} !important; }
  ${sel} .tb-logo { box-shadow:0 0 0 1px #3a3a36 !important; }`;

const appUrl = (path = '') => `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}${path}`;

/** Text that mail clients must not turn into links (host names, dates, addresses). */
const plain = (s) => escapeHtml(s).replace(/([.:@])/g, '$1&#8203;');

const p = (html, { tone = 'muted', size = 15, top = 0 } = {}) =>
  `<p class="tb-${tone}" style="margin:${top}px 0 0;font-family:${FONT};font-size:${size}px;line-height:1.65;color:${L[tone]};">${html}</p>`;

const codeBlock = (code, note) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
    <tr><td class="tb-tile" align="center" style="background-color:${L.tile};border:1px solid ${L.line};border-radius:16px;padding:22px 12px;">
      <div class="tb-text tb-code" style="font-family:${MONO};font-size:34px;font-weight:700;letter-spacing:12px;color:${L.text};padding-left:12px;">${escapeHtml(code)}</div>
      ${note ? `<div class="tb-faint" style="margin-top:10px;font-family:${FONT};font-size:12.5px;color:${L.faint};">${note}</div>` : ''}
    </td></tr>
  </table>`;

const button = (label, href) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
    <tr><td class="tb-btn" style="border-radius:999px;background-color:${L.btnBg};">
      <a href="${href}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:14px;font-weight:600;color:${L.btnText};text-decoration:none;border-radius:999px;">${label}</a>
    </td></tr>
  </table>`;

const details = (rows) => `
  <table class="tb-tile" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;background-color:${L.tile};border:1px solid ${L.line};border-radius:14px;border-collapse:separate;">
    ${rows.map(([k, v], i) => `
    <tr>
      <td class="tb-faint tb-k${i ? ' tb-bt' : ''}" style="padding:11px 16px;${i ? `border-top:1px solid ${L.line};` : ''}font-family:${FONT};font-size:13px;color:${L.faint};width:38%;vertical-align:top;">${k}</td>
      <td class="tb-text tb-v${i ? ' tb-bt' : ''}" style="padding:11px 16px;${i ? `border-top:1px solid ${L.line};` : ''}font-family:${FONT};font-size:13px;color:${L.text};vertical-align:top;">${v}</td>
    </tr>`).join('')}
  </table>`;

const callout = (html, tone = 'accent') => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
    <tr><td class="tb-tile tb-muted ${tone === 'danger' ? 'tb-bar-danger' : 'tb-bar'}" style="border-left:3px solid ${L[tone]};background-color:${L.tile};border-radius:0 12px 12px 0;padding:14px 16px;font-family:${FONT};font-size:13.5px;line-height:1.6;color:${L.muted};">${html}</td></tr>
  </table>`;

const list = (items) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">
    ${items.map(([title, text]) => `
    <tr>
      <td width="22" style="vertical-align:top;padding:0 0 12px;"><div class="tb-dot" style="width:8px;height:8px;border-radius:8px;background-color:#f5a524;margin-top:8px;"></div></td>
      <td class="tb-muted" style="vertical-align:top;padding:0 0 12px;font-family:${FONT};font-size:14px;line-height:1.6;color:${L.muted};"><span class="tb-text" style="color:${L.text};font-weight:600;">${title}</span> — ${text}</td>
    </tr>`).join('')}
  </table>`;

const link = (label, href) => `<a class="tb-accent" href="${href}" style="color:${L.accent};text-decoration:none;font-weight:600;">${label}</a>`;

/**
 * @param {{ preheader: string, title: string, body: string, footerNote?: string }} o
 */
function layout({ preheader, title, body, footerNote }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media (prefers-color-scheme: dark) {${DARK_CSS('')}
  }${DARK_CSS('[data-ogsc]')}
</style>
<style>
  /* Separate block: Gmail drops a whole <style> that has a selector it does not
     support (the attribute selectors above), and these rules must survive.
     phones: no outer gap (the mail app has its own margins), tighter card,
     smaller code, detail rows stacked label-over-value */
  @media (max-width: 600px) {
    .tb-outer { padding: 8px 4px !important; }
    .tb-pad { padding: 22px 18px 24px !important; border-radius: 16px !important; }
    .tb-h1 { font-size: 21px !important; }
    .tb-code { font-size: 28px !important; letter-spacing: 7px !important; padding-left: 7px !important; }
    .tb-k, .tb-v { display: block !important; width: auto !important; }
    .tb-k { padding: 11px 14px 2px !important; }
    .tb-v { padding: 0 14px 11px !important; border-top: 0 !important; }
    .tb-foot { padding: 14px 6px 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td class="tb-outer" align="center" style="padding:24px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td class="tb-card tb-pad" style="background-color:${L.card};border:1px solid ${L.line};border-radius:20px;padding:28px 28px 30px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                <img class="tb-logo" src="cid:${EMAIL_MARK_CID}" width="32" height="32" alt="TutorBoard" style="display:block;width:32px;height:32px;border:0;border-radius:9px;">
              </td>
              <td class="tb-text" style="vertical-align:middle;font-family:${FONT};font-size:16px;font-weight:600;letter-spacing:-0.2px;color:${L.text};">TutorBoard</td>
            </tr>
          </table>
          <div class="tb-line" style="height:1px;background-color:${L.line};margin:22px 0 26px;line-height:1px;font-size:1px;">&nbsp;</div>
          <h1 class="tb-text tb-h1" style="margin:0;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:600;letter-spacing:-0.4px;color:${L.text};">${title}</h1>
          ${body}
        </td></tr>
        <tr><td class="tb-faint tb-foot" style="padding:18px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${L.faint};text-align:left;">
          ${footerNote ? `${footerNote}<br>` : ''}
          <a class="tb-muted" href="${appUrl('/')}" style="color:${L.muted};text-decoration:none;">TutorBoard</a> · Visual learning on a live canvas
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const hi = (user) => `Hi ${escapeHtml(user.name || 'there')},`;
const NOT_YOU = `If this wasn't you, ${link('reset your password', appUrl('/login?forgot=1'))} now — that also signs out every device.`;

function describeDevice(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'A browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}
const METHOD = { password: 'Email and password', google: 'Google', github: 'GitHub', legacy: 'Saved session', reset: 'Password reset' };
const when = (d = new Date()) => plain(`${new Date(d).toUTCString().replace(' GMT', '')} UTC`);

// Each builder returns { subject, html }, so a template can be previewed or sent.
export const templates = {
  welcome: (user) => ({
    subject: 'Welcome to TutorBoard',
    html: layout({
      preheader: 'Ask anything — TutorBoard explains it on a live canvas.',
      title: `Welcome to TutorBoard, ${escapeHtml(user.name || 'learner')}`,
      body:
        p('Your account is ready. Ask about anything — physics, history, economics, code — and TutorBoard teaches it step by step on a live canvas you can draw on and question.', { top: 12 }) +
        list([
          ['Ask a question', 'type it in plain words, or start from one of the suggestions.'],
          ['Follow the canvas', 'each step is drawn and explained; pause, rewind or ask a doubt at any step.'],
          ['Pick up anywhere', 'your sessions are saved to your account on every device.'],
        ]) +
        button('Open TutorBoard', appUrl('/session')),
      footerNote: 'You received this because you created a TutorBoard account.',
    }),
  }),

  verifyEmail: (user, code) => ({
    subject: `${code} is your TutorBoard verification code`,
    html: layout({
      preheader: `Your code is ${code}. It expires in 10 minutes.`,
      title: 'Confirm your email',
      body:
        p(`${hi(user)} enter this code in TutorBoard to confirm that this email address is yours.`, { top: 12 }) +
        codeBlock(code, 'Expires in 10 minutes · works once') +
        p("Don't share this code with anyone. TutorBoard will never ask you for it.", { tone: 'faint', size: 13, top: 20 }),
      footerNote: "If you didn't create a TutorBoard account, you can ignore this email.",
    }),
  }),

  resetCode: (user, code) => ({
    subject: `${code} is your TutorBoard password reset code`,
    html: layout({
      preheader: `Your password reset code is ${code}. It expires in 10 minutes.`,
      title: 'Reset your password',
      body:
        p(`${hi(user)} someone asked to reset the password for your TutorBoard account. Enter this code to choose a new one.`, { top: 12 }) +
        codeBlock(code, 'Expires in 10 minutes · works once') +
        callout("Didn't ask for this? Ignore this email — your password stays the same, and nobody can change it without this code."),
      footerNote: 'Sent because a password reset was requested for this address.',
    }),
  }),

  passwordChanged: (user) => ({
    subject: 'Your TutorBoard password was changed',
    html: layout({
      preheader: 'Your password was just changed and other devices were signed out.',
      title: 'Your password was changed',
      body:
        p(`${hi(user)} the password for your TutorBoard account was just changed. For your safety, every other device was signed out.`, { top: 12 }) +
        details([['When', when()], ['Account', plain(user.email)]]) +
        callout(NOT_YOU, 'danger'),
      footerNote: 'Security notices are always sent.',
    }),
  }),

  newSignIn: (user, { method = 'password', userAgent = '', ip = '', at = new Date() } = {}) => ({
    subject: 'New sign-in to your TutorBoard account',
    html: layout({
      preheader: `${describeDevice(userAgent)} signed in to your account.`,
      title: 'New sign-in to your account',
      body:
        p(`${hi(user)} your TutorBoard account was just signed in to from a device it hasn't used before.`, { top: 12 }) +
        details([
          ['Device', escapeHtml(describeDevice(userAgent))],
          ['Signed in with', escapeHtml(METHOD[method] || method)],
          ['When', when(at)],
          ...(ip ? [['IP address', plain(ip)]] : []),
        ]) +
        p('If this was you, there is nothing to do.', { top: 20 }) +
        callout(`${NOT_YOU} You can also review your devices in Settings → Account.`, 'danger'),
      footerNote: 'Security notices are always sent.',
    }),
  }),

  accountNotice: (user, subject, text) => ({
    subject: `${subject} | TutorBoard`,
    html: layout({
      preheader: text,
      title: escapeHtml(subject),
      body:
        p(`${hi(user)} ${escapeHtml(text)}`, { top: 12 }) +
        details([['When', when()], ['Account', plain(user.email)]]) +
        callout(NOT_YOU, 'danger'),
      footerNote: 'Security notices are always sent.',
    }),
  }),

  milestone: (user, topicName) => ({
    subject: `You finished “${String(topicName).slice(0, 80)}” on TutorBoard`,
    html: layout({
      preheader: `Nice work — you completed ${topicName}.`,
      title: 'Lesson complete',
      body:
        p(`Nice work, ${escapeHtml(user.name || 'learner')}! You worked through every step of:`, { top: 12 }) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">
          <tr><td class="tb-tile tb-accent" style="background-color:${L.tile};border:1px solid ${L.line};border-radius:16px;padding:18px 20px;font-family:${FONT};font-size:18px;font-weight:600;color:${L.accent};">${escapeHtml(topicName)}</td></tr>
        </table>` +
        p('It is saved in your history, so you can replay it or ask follow-up questions any time.', { top: 20 }) +
        button('Keep learning', appUrl('/session')),
      footerNote: 'You received this because you completed a lesson on TutorBoard.',
    }),
  }),

  accountDeleted: (user) => ({
    subject: 'Your TutorBoard account was deleted',
    html: layout({
      preheader: 'Your account and its data have been deleted.',
      title: 'Your account was deleted',
      body:
        p(`${hi(user)} as you asked, your TutorBoard account and everything in it — sessions, canvases and settings — have been permanently deleted.`, { top: 12 }) +
        p("We're sorry to see you go. You're welcome back any time with a new account.", { top: 14 }) +
        button('Visit TutorBoard', appUrl('/')),
      footerNote: 'This is the last email you will get about this account.',
    }),
  }),

  adminRequestReceived: (superadmin, request) => ({
    subject: `Admin access request from ${String(request.name || request.email).slice(0, 60)}`,
    html: layout({
      preheader: `${request.email} asked for access to the TutorBoard admin portal.`,
      title: 'New admin access request',
      body:
        p(`${hi(superadmin)} someone asked for access to the TutorBoard admin portal. Only a super-admin can approve it.`, { top: 12 }) +
        details([
          ['Name', escapeHtml(request.name || '—')],
          ['Account', plain(request.email)],
          ['Requested', when(request.createdAt)],
          ...(request.reason ? [['Reason', escapeHtml(request.reason)]] : []),
        ]) +
        button('Review request', appUrl('/admin?tab=access')) +
        callout('Approve only people you know. An admin can see every account, change platform settings and manage AI providers.'),
      footerNote: 'You received this because you are a TutorBoard super-admin.',
    }),
  }),

  adminRequestDecision: (user, approved, note) => ({
    subject: approved ? 'You now have TutorBoard admin access' : 'Your TutorBoard admin access request',
    html: layout({
      preheader: approved ? 'Your admin access request was approved.' : 'Your admin access request was not approved.',
      title: approved ? 'Admin access approved' : 'Admin access not approved',
      body:
        p(approved
          ? `${hi(user)} your request was approved. Sign in again to open the admin portal — for security you were signed out on every device.`
          : `${hi(user)} a super-admin reviewed your request for admin access and did not approve it this time.`, { top: 12 }) +
        (note ? callout(`<span class="tb-text" style="color:${L.text};font-weight:600;">Note from the super-admin:</span> ${escapeHtml(note)}`) : '') +
        (approved ? button('Open the admin portal', appUrl('/admin')) : p('You can ask again after 24 hours.', { top: 18, tone: 'faint', size: 13 })),
      footerNote: 'Sent because you requested admin access on TutorBoard.',
    }),
  }),

  adminAccessRevoked: (user) => ({
    subject: 'Your TutorBoard admin access was removed',
    html: layout({
      preheader: 'A super-admin removed your admin access.',
      title: 'Admin access removed',
      body:
        p(`${hi(user)} a super-admin removed your access to the TutorBoard admin portal. Your learning account is unchanged; you were signed out on every device, so sign in again to continue.`, { top: 12 }) +
        details([['When', when()], ['Account', plain(user.email)]]),
      footerNote: 'Security notices are always sent.',
    }),
  }),

  smtpTest: (user, host, port) => ({
    subject: 'TutorBoard email test',
    html: layout({
      preheader: 'Your TutorBoard email settings work.',
      title: 'Email is working',
      body:
        p(`${hi(user)} this test message reached you, so TutorBoard can deliver verification codes, password reset codes and security notices.`, { top: 12 }) +
        details([['Mail server', plain(`${host}:${port}`)], ['Sent', when()]]),
      footerNote: 'Sent from the TutorBoard admin console.',
    }),
  }),
};

// ─── Senders (what the app calls) ────────────────────────────────────────────

const deliver = (user, { subject, html }) => sendEmail({ to: user.email, subject, html });

/** One-time code to confirm the account's email address. */
export const sendVerificationCodeEmail = (user, code) => deliver(user, templates.verifyEmail(user, code));
/** One-time code to reset the password. */
export const sendPasswordResetCodeEmail = (user, code) => deliver(user, templates.resetCode(user, code));
/** Account-security notice (sign-in method linked/unlinked, …). */
export const sendAccountNoticeEmail = (user, subject, text) => deliver(user, templates.accountNotice(user, subject, text));
export const sendWelcomeEmail = (user) => deliver(user, templates.welcome(user));
export const sendSessionMilestoneEmail = (user, topicName) => deliver(user, templates.milestone(user, topicName));
/** Password changed or reset. */
export const sendSecurityAlertEmail = (user) => deliver(user, templates.passwordChanged(user));
/** Sign-in from a device this account has not used before. */
export const sendNewSignInEmail = (user, info) => deliver(user, templates.newSignIn(user, info));
export const sendAccountDeletedEmail = (user) => deliver(user, templates.accountDeleted(user));
/** To each super-admin: someone asked for admin access. */
export const sendAdminRequestReceivedEmail = (superadmin, request) => deliver(superadmin, templates.adminRequestReceived(superadmin, request));
/** To the requester: approved or declined. */
export const sendAdminRequestDecisionEmail = (user, approved, note) => deliver(user, templates.adminRequestDecision(user, approved, note));
/** To a former admin: access removed. */
export const sendAdminAccessRevokedEmail = (user) => deliver(user, templates.adminAccessRevoked(user));
