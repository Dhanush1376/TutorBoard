import User from '../models/User.js';
import ChatSession from '../models/ChatSession.js';
import { validateAvatarUrl } from '../utils/validation/securityValidators.js';
import tokenStore from '../utils/auth/tokenStore.js';

// Update User Settings (merges with existing)
export const updateSettings = async (req, res) => {
  try {
    const { settings = {} } = req.body;
    
    // Perform a deep merge or explicit update
    const user = await User.findById(req.user.id);
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
    
    const user = await User.findById(req.user.id).select('+password');
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

    // SEC-16: Revoke current session on password change for security
    if (req.tokenJti) {
      await tokenStore.revokeToken(req.tokenJti, req.tokenExp);
      console.log(`[Auth] Session ${req.tokenJti} revoked due to password change`);
    }

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
};

// Export All Session Data
export const exportData = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user.id });

    // We could format this, but sending raw JSON is generally what's expected for export plugins
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=tutorboard-export.json');

    // SEC-GDPR: Sanitize sessions to be human-readable and stripped of internal DB fields
    const sanitizedSessions = sessions.map(session => ({
      title: session.title || 'Untitled Session',
      startTime: session.createdAt,
      lastActive: session.updatedAt || session.lastUpdated,
      messageCount: session.messages?.length || 0,
      messages: (session.messages || []).map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        hasVisuals: !!m.hasCanvas
      })),
      canvasNodeCount: session.canvasState?.length || 0,
      // We include canvas state but strip internal Mongoose/MongoDB keys if they leaked into the array
      canvasState: (session.canvasState || []).map(obj => {
        const { _id, __v, ...rest } = obj.toObject ? obj.toObject() : obj;
        return rest;
      })
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
  try {
    await ChatSession.deleteMany({ userId: req.user.id });
    
    res.status(200).json({ success: true, message: 'All cloud session data permanently deleted' });
  } catch (error) {
    console.error('Wipe data error:', error);
    res.status(500).json({ error: 'Failed to wipe cloud data' });
  }
};

// Delete Account completely
export const deleteAccount = async (req, res) => {
  try {
    // 1. Delete all sessions
    await ChatSession.deleteMany({ userId: req.user.id });
    
    // 2. Revoke current token
    if (req.tokenJti) {
      await tokenStore.revokeToken(req.tokenJti, req.tokenExp);
    }

    // 3. Delete user
    await User.findByIdAndDelete(req.user.id);
    
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
