import express from 'express';
import { updateSettings, updatePassword, exportData, wipeCloudData, deleteAccount } from '../controllers/user.controller.js';
import { protect, restrictToUsers } from '../middleware/auth.middleware.js';

const router = express.Router();

router.put('/settings', protect, updateSettings);
router.put('/password', protect, restrictToUsers, updatePassword);
router.get('/export', protect, restrictToUsers, exportData);
router.delete('/data', protect, restrictToUsers, wipeCloudData);
router.delete('/account', protect, restrictToUsers, deleteAccount);

export default router;
