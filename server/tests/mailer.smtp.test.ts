/**
 * SMTP delivery against a real local SMTP server (STARTTLS + AUTH), so the
 * mailer is exercised the way Brevo (smtp-relay.brevo.com:587) will be.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
// @ts-ignore - no bundled types
import { SMTPServer } from 'smtp-server';
import { AddressInfo } from 'net';
import { sendEmail, mailConfig, sendPasswordResetCodeEmail } from '../utils/core/mailer.js';

const received: Array<{ from: string; to: string[]; raw: string; user: string }> = [];
let port = 0;
let server: any;

beforeAll(async () => {
  server = new SMTPServer({
    // smtp-server ships a self-signed certificate and offers STARTTLS with it
    authMethods: ['PLAIN', 'LOGIN'],
    onAuth(auth: any, _session: any, cb: any) {
      if (auth.username === 'smtp-login' && auth.password === 'smtp-key') return cb(null, { user: auth.username });
      return cb(Object.assign(new Error('Invalid credentials'), { responseCode: 535 }));
    },
    onData(stream: any, session: any, cb: any) {
      let raw = '';
      stream.on('data', (c: Buffer) => (raw += c.toString()));
      stream.on('end', () => {
        received.push({ from: session.envelope.mailFrom.address, to: session.envelope.rcptTo.map((r: any) => r.address), raw, user: session.user });
        cb();
      });
    },
    logger: false,
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  port = (server.server.address() as AddressInfo).port;
});

afterAll(() => server?.close());

beforeEach(() => {
  received.length = 0;
  Object.assign(process.env, {
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(port),
    SMTP_USER: 'smtp-login',
    SMTP_PASS: 'smtp-key',
    MAIL_FROM: 'TutorBoard <no-reply@tutorboard.test>',
    SMTP_TLS_REJECT_UNAUTHORIZED: 'false',
  });
  delete process.env.SMTP_SECURE;
  delete process.env.MAIL_DEV_OUTBOX;
});

describe('SMTP mailer', () => {
  it('delivers over STARTTLS with the configured login and sender', async () => {
    const r: any = await sendEmail({ to: 'learner@example.test', subject: 'Hello', html: '<p>Hi</p>' });
    expect(r.success).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ from: 'no-reply@tutorboard.test', to: ['learner@example.test'], user: 'smtp-login' });
    expect(received[0].raw).toContain('Subject: Hello');
    expect(mailConfig()).toMatchObject({ configured: true, port, secure: false });
  });

  it('sends the reset code email with the code in it', async () => {
    const r: any = await sendPasswordResetCodeEmail({ name: 'Learner <b>', email: 'learner@example.test' }, '123456');
    expect(r.success).toBe(true);
    expect(received[0].raw).toContain('123456');
    // HTML part escapes the name (the plain-text part shows it literally, which is safe)
    expect(received[0].raw).toMatch(/Learner &lt;b&gt;|Learner =\r?\n?&lt;b&gt;/);
  });

  it('every template carries the inline TutorBoard logo, a plain-text part and escaped names', async () => {
    const { templates } = await import('../utils/core/mailer.js');
    const user = { name: 'Learner <b>', email: 'learner@example.test' };
    const all = [
      templates.welcome(user), templates.verifyEmail(user, '123456'), templates.resetCode(user, '654321'),
      templates.passwordChanged(user), templates.newSignIn(user, { method: 'google', userAgent: 'Chrome/130 Windows' }),
      templates.accountNotice(user, 'Sign-in method added', 'Google can now be used.'), templates.milestone(user, 'Photosynthesis'),
      templates.accountDeleted(user), templates.smtpTest(user, 'smtp.example', 587),
    ];
    for (const t of all) {
      expect(t.html).toContain('src="cid:tutorboard-mark"');
      expect(t.html).not.toContain('Learner <b>');
    }
    const r: any = await sendEmail({ to: user.email, ...templates.verifyEmail(user, '123456') });
    expect(r.success).toBe(true);
    const raw = received[0].raw;
    expect(raw).toMatch(/Content-ID: <tutorboard-mark>/i);
    expect(raw).toMatch(/Content-Type: text\/plain/i);
    expect(raw).toContain('123456');
  });

  it('reports a wrong SMTP key as a failure without retrying or throwing', async () => {
    process.env.SMTP_PASS = 'wrong-key';
    const r: any = await sendEmail({ to: 'learner@example.test', subject: 'x', html: 'x' });
    expect(r.success).toBeUndefined();
    expect(r.error?.code).toBe('EAUTH');
    expect(received).toHaveLength(0);
  });

  it('does not send when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const r: any = await sendEmail({ to: 'learner@example.test', subject: 'x', html: 'x' });
    expect(r.skipped).toBe(true);
    expect(mailConfig().configured).toBe(false);
  });

  it('never accepts a self-signed certificate in production', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const r: any = await sendEmail({ to: 'learner@example.test', subject: 'x', html: 'x' });
      expect(r.success).toBeUndefined();
      expect(received).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
