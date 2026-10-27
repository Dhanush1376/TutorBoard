import express from 'express';
import { protect, restrictToUsers } from '../middleware/auth.middleware.js';
import { authRecoveryRateLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import { getMyAdminAccess, requestAdminAccess, cancelAdminRequest } from '../controllers/adminAccess.controller.js';

/** /api/admin-access — a signed-in user asking for admin access for their own account. */
const router = express.Router();
router.use(protect, restrictToUsers);

router.get('/me', asyncHandler(getMyAdminAccess));
router.post('/request', authRecoveryRateLimiter, asyncHandler(requestAdminAccess));
router.delete('/request', asyncHandler(cancelAdminRequest));

export default router;
