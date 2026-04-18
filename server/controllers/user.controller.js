import User from '../models/User.js';
import ChatSession from '../models/ChatSession.js';
import bcrypt from 'bcryptjs';

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
    if (settings.general) user.settings.general = { ...user.settings.general, ...settings.general };
    if (settings.appearance) user.settings.appearance = { ...user.settings.appearance, ...settings.appearance };
    if (settings.canvas) user.settings.canvas = { ...user.settings.canvas, ...settings.canvas };
    if (settings.privacy) user.settings.privacy = { ...user.settings.privacy, ...settings.privacy };
    
    // Explicitly update top-level fields
    // Prize req.body.avatar, then settings.avatar, then keep existing
    if (req.body.avatar !== undefined) {
      user.avatar = req.body.avatar;
    } else if (settings.avatar !== undefined) {
      user.avatar = settings.avatar;
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
    await user.save(); // pre-save hook handles hashing

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
    
    res.status(200).json({
      exportDate: new Date().toISOString(),
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        settings: req.user.settings
      },
      sessions
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
    
    // 2. Delete user
    await User.findByIdAndDelete(req.user.id);
    
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
