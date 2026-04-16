import express from 'express';
import { updateSettings, updatePassword, exportData, wipeCloudData, deleteAccount } from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.put('/settings', protect, updateSettings);
router.put('/password', protect, updatePassword);
router.get('/export', protect, exportData);
router.delete('/data', protect, wipeCloudData);
router.delete('/account', protect, deleteAccount);

export default router;
