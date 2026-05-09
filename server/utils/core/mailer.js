import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY) 
  : null;

/**
 * Sends a transactional email using Resend
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content of the email
 * @param {string} [options.from] - Sender email (defaults to process.env.MAIL_FROM)
 */
export const sendEmail = async ({ to, subject, html, from }) => {
  try {
    if (!resend) {
      console.warn('[Mailer] ⚠️ RESEND_API_KEY is missing. Email skipped:', { to, subject });
      return { skipped: true };
    }

    const sender = from || process.env.MAIL_FROM || 'TutorBoard <onboarding@resend.dev>';

    const { data, error } = await resend.emails.send({
      from: sender,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[Mailer] ❌ Error sending email:', error);
      return { error };
    }

    console.log('[Mailer] ✅ Email sent successfully:', data.id);
    return { success: true, id: data.id };
  } catch (err) {
    console.error('[Mailer] 💥 Critical failure in sendEmail:', err.message);
    return { error: err.message };
  }
};

/**
 * Pre-defined: Send Welcome Email
 */
export const sendWelcomeEmail = async (user) => {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #00d2ff; font-size: 28px; margin-bottom: 20px;">Welcome to TutorBoard AI, ${user.name}! 🚀</h1>
      <p style="font-size: 16px; line-height: 1.6; color: #cccccc;">
        We're thrilled to have you in the cinematic AI learning environment. Get ready to transform the way you learn complex subjects.
      </p>
      <div style="margin: 30px 0; padding: 20px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
        <h3 style="margin-top: 0; color: #ffffff;">What's Next?</h3>
        <ul style="color: #999999; padding-left: 20px;">
          <li>Start your first AI-powered teaching session</li>
          <li>Explore the orbital navigation timeline</li>
          <li>Customize your learning preferences in settings</li>
        </ul>
      </div>
      <a href="${process.env.FRONTEND_URL}" style="display: inline-block; background: #ffffff; color: #000000; padding: 12px 30px; border-radius: 30px; text-decoration: none; font-weight: bold; margin-top: 20px;">Launch Workspace</a>
      <hr style="margin: 40px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);" />
      <p style="font-size: 12px; color: #666666; text-align: center;">
        © 2026 TutorBoard AI. Built for the future of pedagogy.
      </p>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject: 'Welcome to TutorBoard AI!',
    html,
  });
};

/**
 * Pre-defined: Password Reset Email
 */
export const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);">
      <h2 style="color: #ff3e3e; font-size: 24px;">Reset Your Password</h2>
      <p style="font-size: 16px; color: #cccccc;">
        We received a request to reset your TutorBoard AI password. If you didn't make this request, you can safely ignore this email.
      </p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${resetUrl}" style="display: inline-block; background: #ff3e3e; color: #ffffff; padding: 14px 35px; border-radius: 30px; text-decoration: none; font-weight: bold;">Reset Password</a>
      </div>
      <p style="font-size: 12px; color: #666666;">
        This link will expire in 1 hour. For security, please do not share this link with anyone.
      </p>
      <hr style="margin: 30px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);" />
      <p style="font-size: 11px; color: #444444; text-align: center;">
        If the button above doesn't work, copy and paste this URL into your browser:<br/>
        <span style="color: #00d2ff;">${resetUrl}</span>
      </p>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject: 'Password Reset Request | TutorBoard AI',
    html,
  });
};

/**
 * Pre-defined: Session Milestone Email
 */
export const sendSessionMilestoneEmail = async (user, topicName) => {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 50px;">🏆</span>
      </div>
      <h2 style="color: #ffaa00; font-size: 24px; text-align: center;">New Milestone Achieved!</h2>
      <p style="font-size: 16px; text-align: center; color: #cccccc;">
        Congratulations, <strong>${user.name}</strong>! You just mastered the topic:
      </p>
      <div style="margin: 25px 0; padding: 20px; background: rgba(255,170,0,0.05); border: 1px dashed #ffaa00; border-radius: 12px; text-align: center;">
        <span style="font-size: 20px; font-weight: bold; color: #ffaa00;">${topicName}</span>
      </div>
      <p style="font-size: 14px; color: #999999; text-align: center;">
        Your progress has been recorded in your learning timeline. Keep the momentum going!
      </p>
      <div style="margin-top: 30px; text-align: center;">
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #ffffff; color: #000000; padding: 12px 30px; border-radius: 30px; text-decoration: none; font-weight: bold;">View Progress</a>
      </div>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject: `Mastery Unlocked: ${topicName} 🚀`,
    html,
  });
};

/**
 * Pre-defined: Security Alert (Password Changed)
 */
export const sendSecurityAlertEmail = async (user) => {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);">
      <h2 style="color: #ff3e3e; font-size: 20px;">Security Alert: Password Changed</h2>
      <p style="font-size: 14px; color: #cccccc;">
        Hi ${user.name}, the password for your TutorBoard AI account was recently changed.
      </p>
      <div style="margin: 20px 0; padding: 15px; background: rgba(255,62,62,0.05); border-left: 4px solid #ff3e3e; color: #cccccc; font-size: 13px;">
        If you made this change, you can safely ignore this email.
      </div>
      <p style="font-size: 14px; color: #cccccc;">
        <strong>If you did NOT change your password</strong>, please secure your account immediately by resetting your password:
      </p>
      <div style="margin-top: 25px;">
        <a href="${process.env.FRONTEND_URL}/forgot-password" style="display: inline-block; color: #00d2ff; text-decoration: none; font-weight: bold;">Secure Account →</a>
      </div>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject: 'Security Alert: Password Change Detected',
    html,
  });
};
