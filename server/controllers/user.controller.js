import User from '../models/User.js';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import Artifact from '../models/Artifact.js';
import Doubt from '../models/Doubt.js';
import EngineSessionState from '../models/EngineSessionState.js';
import LearnerProfile from '../models/LearnerProfile.js';
import ActivityLog from '../models/ActivityLog.js';
import UsageLog from '../models/UsageLog.js';
import VectorStoreService from '../engine/core/vectorStore.js';
import { validateAvatarUrl } from '../utils/validation/securityValidators.js';
import tokenStore from '../utils/auth/tokenStore.js';
import { sendSecurityAlertEmail, sendEmail } from '../utils/core/mailer.js';
import { container } from '../core/container.js';

// Update User Settings (merges with existing)
export const updateSettings = async (req, res) => {
  try {
    const { settings = {} } = req.body;
    
    // Perform a deep merge or explicit update
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Merge settings only if they are provided in the payload
    if (!user.settings) user.settings = {};
    
    // Support merging multiple categories at once
    const categories = ['general', 'appearance', 'canvas', 'privacy'];
    categories.forEach(cat => {
      if (settings[cat]) {
        user.settings[cat] = { 
          ...(user.settings[cat] || {}), 
          ...settings[cat] 
        };
        // Explicitly mark as modified for Mongoose if needed (especially for nested paths)
        user.markModified(`settings.${cat}`);
      }
    });
    
    // Explicitly update top-level fields
    // Prize req.body.avatar, then settings.avatar, then keep existing
    const avatarToValidate = req.body.avatar !== undefined ? req.body.avatar : settings.avatar;
    
    if (avatarToValidate !== undefined) {
      const validation = validateAvatarUrl(avatarToValidate);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      user.avatar = avatarToValidate;
    }

    if (settings.general?.name) {
       user.name = settings.general.name;
    }

    await user.save();
    
    // Invalidate user cache
    if (container.has('redis-main')) {
      try {
        await container.resolve('redis-main').del(`user:${user._id}`);
      } catch (err) {}
    }
    
    res.status(200).json({ success: true, settings: user.settings, name: user.name });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

// Change User Password
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // If user has no password (OAuth only), block this
    if (!user.password) {
      return res.status(400).json({ error: 'No password set. This account relies on Google/GitHub login.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save(); // pre-save hook handles hashing

    // Invalidate user cache
    if (container.has('redis-main')) {
      try {
        await container.resolve('redis-main').del(`user:${user._id}`);
      } catch (err) {}
    }

    // SEC-16: Revoke current session on password change for security
    if (req.tokenJti) {
      await tokenStore.revokeToken(req.tokenJti, req.tokenExp);
      console.log(`[Auth] Session ${req.tokenJti} revoked due to password change`);
    }

    // Send Security Alert Email
    sendSecurityAlertEmail(user).catch(e => console.error('[Mailer] Security alert failed:', e));

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
};

// Export All Session Data
export const exportData = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user._id });

    // We could format this, but sending raw JSON is generally what's expected for export plugins
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=tutorboard-export.json');

    // SEC-GDPR: Sanitize sessions to be human-readable and stripped of internal DB fields
    const sanitizedSessions = await Promise.all(sessions.map(async session => {
      // DL-01: Messages were migrated to ChatMessage collection
      const messages = await ChatMessage.find({ sessionId: session._id }).sort({ timestamp: 1 }).lean();
      
      // DL-02: Decompress canvas state properly (resolves Buffer/S3 issues)
      const resolvedCanvas = await session.resolveCanvasState();

      return {
        title: session.title || 'Untitled Session',
        startTime: session.createdAt,
        lastActive: session.updatedAt || session.lastUpdated,
        messageCount: messages.length,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          hasVisuals: !!m.hasCanvas
        })),
        canvasNodeCount: resolvedCanvas.length,
        // We include canvas state but strip internal Mongoose/MongoDB keys
        canvasState: resolvedCanvas.map(obj => {
          // obj is already a plain object from lean() or JSON.parse()
          const { _id, __v, ...rest } = obj;
          return rest;
        })
      };
    }));

    res.status(200).json({
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      user: {
        name: req.user.name,
        email: req.user.email,
        settings: req.user.settings
      },
      sessions: sanitizedSessions
    });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
};

// Wipe Cloud Data (Keep Account)
export const wipeCloudData = async (req, res) => {
  const userId = req.user._id;
  try {
    // SEC-08: Complete GDPR-compliant data wipe
    await Promise.all([
      ChatSession.deleteMany({ userId }),
      ChatMessage.deleteMany({ userId }),
      Artifact.deleteMany({ userId }),
      Doubt.deleteMany({ user: userId }),
      LearnerProfile.deleteMany({ userId }),
      ActivityLog.deleteMany({ userId }),
      UsageLog.deleteMany({ userId }),
      EngineSessionState.deleteMany({ userId }),
      VectorStoreService.clearOwnerMemory(userId.toString())
    ]);
    
    // Invalidate cache
    if (container.has('redis-main')) {
      try {
        await container.resolve<any>('redis-main').del(`user:${userId}`);
      } catch (err) {}
    }

    res.status(200).json({ success: true, message: 'All cloud data permanently deleted' });
  } catch (error) {
    console.error('Wipe data error:', error);
    res.status(500).json({ error: 'Failed to wipe cloud data' });
  }
};

// Delete Account completely
export const deleteAccount = async (req, res) => {
  const userId = req.user._id;
  try {
    // 1. Full data wipe (GDPR compliance)
    await Promise.all([
      ChatSession.deleteMany({ userId }),
      ChatMessage.deleteMany({ userId }),
      Artifact.deleteMany({ userId }),
      Doubt.deleteMany({ user: userId }),
      LearnerProfile.deleteMany({ userId }),
      ActivityLog.deleteMany({ userId }),
      UsageLog.deleteMany({ userId }),
      EngineSessionState.deleteMany({ userId }),
      VectorStoreService.clearOwnerMemory(userId.toString())
    ]);
    
    // 2. Revoke current token and clear Redis session data
    if (req.tokenJti) {
      await tokenStore.revokeToken(req.tokenJti, req.tokenExp);
    }

    if (container.has('redis-main')) {
      try {
        const client = container.resolve<any>('redis-main');
        await client.del(`user:${userId}`);
        await client.del(`auth:refresh:${userId}`);
      } catch (err) {}
      // Note: We could also scan and delete all user-related keys if needed
    }

    // 3. Send Goodbye Email (Transactional - send before we delete the record)
    const user = await User.findById(userId);
    if (user) {
      await sendEmail({
        to: user.email,
        subject: 'TutorBoard Account Deleted',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px; border-radius: 24px;">
            <h2 style="color: #ff3e3e;">Your account has been deleted</h2>
            <p style="color: #cccccc;">We're sorry to see you go. As requested, your account and all associated cloud data have been permanently deleted from our systems.</p>
            <p style="color: #666666; font-size: 12px;">If this was a mistake, you can always create a new account anytime.</p>
          </div>
        `
      }).catch(e => console.error('[Mailer] Goodbye email failed:', e));
    }

    // 4. Delete user record
    await User.findByIdAndDelete(userId);
    
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
