import express from 'express';
import { protect, requireAdmin, requireSuperAdmin, requireRecentAuth } from '../middleware/auth.middleware.js';
import * as access from '../controllers/adminAccess.controller.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import * as admin from '../controllers/admin.controller.js';

/**
 * /api/admin — every route: signed-in (protect) + admin role from the DB
 * (requireAdmin) + admin rate limit. Deny by default: there is no public route.
 */
const router = express.Router();
router.use(protect, requireAdmin, adminRateLimiter);

router.get('/overview', asyncHandler(admin.getOverview));
router.get('/diagnostics', asyncHandler(admin.getDiagnostics));
router.post('/diagnostics/test-email', asyncHandler(admin.sendTestEmail));
router.get('/audit', asyncHandler(admin.listAudit));

router.get('/users', asyncHandler(admin.listUsers));
router.get('/users/:id', asyncHandler(admin.getUser));
router.post('/users/:id/disable', asyncHandler(admin.disableUser));
router.post('/users/:id/enable', asyncHandler(admin.enableUser));
router.post('/users/:id/revoke-sessions', asyncHandler(admin.revokeUserSessions));
router.put('/users/:id/role', requireSuperAdmin, requireRecentAuth(), asyncHandler(admin.setUserRole));

// admin access requests — super-admin only; decisions need a recent sign-in
router.get('/access/requests', requireSuperAdmin, asyncHandler(access.listAccessRequests));
router.get('/access/admins', requireSuperAdmin, asyncHandler(access.listAdmins));
router.post('/access/requests/:id/approve', requireSuperAdmin, requireRecentAuth(), asyncHandler(access.approveAccessRequest));
router.post('/access/requests/:id/reject', requireSuperAdmin, asyncHandler(access.rejectAccessRequest));
router.post('/access/admins/:userId/revoke', requireSuperAdmin, requireRecentAuth(), asyncHandler(access.revokeAdminAccess));

router.get('/settings', asyncHandler(admin.getSettings));
router.put('/settings', asyncHandler(admin.putSettings));
router.post('/settings/rollback', asyncHandler(admin.rollbackSettings));

router.get('/providers', asyncHandler(admin.listProviders));
router.post('/providers', asyncHandler(admin.createProvider));
router.post('/providers/test', asyncHandler(admin.testUnsavedProvider));
router.put('/providers/:id', asyncHandler(admin.updateProvider));
router.delete('/providers/:id', asyncHandler(admin.deleteProvider));
router.post('/providers/:id/test', asyncHandler(admin.testProvider));
router.post('/providers/:id/enabled', asyncHandler(admin.setProviderEnabled));
router.post('/providers/:id/rollback', asyncHandler(admin.rollbackProvider));

export default router;
