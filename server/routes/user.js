import express from 'express';
import { updateSettings, updatePassword, exportData, wipeCloudData, deleteAccount } from '../controllers/user.controller.js';
import { protect, restrictToUsers, requireRecentAuth } from '../middleware/auth.middleware.js';
import { validateBody, ChangePasswordSchema } from '../middleware/validation.middleware.js';

const router = express.Router();

router.put('/settings', protect, updateSettings);
router.put('/password', protect, restrictToUsers, requireRecentAuth({ optional: true }), validateBody(ChangePasswordSchema), updatePassword);
router.get('/export', protect, restrictToUsers, exportData);
router.delete('/data', protect, restrictToUsers, wipeCloudData);
router.delete('/account', protect, restrictToUsers, requireRecentAuth(), deleteAccount);

export default router;
