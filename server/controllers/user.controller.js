import User from '../models/User.js';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import Artifact from '../models/Artifact.js';
import CodeVisualization from '../models/CodeVisualization.js';
import Doubt from '../models/Doubt.js';
import EngineSessionState from '../models/EngineSessionState.js';
import LearnerProfile from '../models/LearnerProfile.js';
import ActivityLog from '../models/ActivityLog.js';
import UsageLog from '../models/UsageLog.js';
import VectorStoreService from '../engine/core/vectorStore.js';
import { validateAvatarUrl } from '../utils/validation/securityValidators.js';
import tokenStore from '../utils/auth/tokenStore.js';
import { sendSecurityAlertEmail, sendAccountDeletedEmail } from '../utils/core/mailer.js';
import { container } from '../core/container.js';
import AuthChallenge from '../models/AuthChallenge.js';
import { revokeAllSessions, startSession } from '../services/auth/session.service.js';
import { audit } from '../services/audit.service.js';

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

// Change (or, for Google/GitHub-only accounts, add) the password.
// Every session is ended, then this browser gets a fresh one.
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.password) {
      if (!currentPassword || !(await user.comparePassword(currentPassword))) {
        await audit(req, 'password.change', { targetUserId: user._id, outcome: 'failure' });
        return res.status(401).json({ error: 'Incorrect current password' });
      }
    } else if (!req.recentAuth) {
      // adding a first password: only right after a sign-in (requireRecentAuth sets this)
      return res.status(401).json({ error: 'Sign in again to add a password.', code: 'REAUTH_REQUIRED' });
    }

    const added = !user.password;
    user.password = newPassword;
    user.passwordChangedAt = new Date(Date.now() - 1000);
    await user.save(); // pre-save hook handles hashing

    // Invalidate user cache
    if (container.has('redis-main')) {
      try {
        await container.resolve('redis-main').del(`user:${user._id}`);
      } catch (err) {}
    }

    const revoked = await revokeAllSessions(user._id, 'password_change');
    const { accessToken } = await startSession(req, res, user._id, 'password');
    await audit(req, added ? 'password.added' : 'password.change', { targetUserId: user._id, meta: { sessionsRevoked: revoked } });

    // Send Security Alert Email
    sendSecurityAlertEmail(user).catch(e => console.error('[Mailer] Security alert failed:', e.message));

    res.status(200).json({ success: true, token: accessToken, message: added ? 'Password added' : 'Password updated. Other devices were signed out.' });
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
      CodeVisualization.deleteMany({ userId }),
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
        await container.resolve('redis-main').del(`user:${userId}`);
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
      CodeVisualization.deleteMany({ userId }),
      Doubt.deleteMany({ user: userId }),
      LearnerProfile.deleteMany({ userId }),
      ActivityLog.deleteMany({ userId }),
      UsageLog.deleteMany({ userId }),
      EngineSessionState.deleteMany({ userId }),
      VectorStoreService.clearOwnerMemory(userId.toString())
    ]);
    
    // 2. End every session and clear Redis session data
    if (req.tokenJti) {
      await tokenStore.revokeToken(req.tokenJti, req.tokenExp);
    }
    await revokeAllSessions(userId, 'account_deleted');
    await AuthChallenge.deleteMany({ userId });
    await audit(req, 'account.deleted', { targetUserId: userId });

    if (container.has('redis-main')) {
      try {
        const client = container.resolve('redis-main');
        await client.del(`user:${userId}`);
        await client.del(`auth:refresh:${userId}`);
      } catch (err) {}
      // Note: We could also scan and delete all user-related keys if needed
    }

    // 3. Send Goodbye Email (Transactional - send before we delete the record)
    const user = await User.findById(userId);
    if (user) {
      await sendAccountDeletedEmail(user).catch(e => console.error('[Mailer] Goodbye email failed:', e.message));
    }

    // 4. Delete user record
    await User.findByIdAndDelete(userId);
    
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
