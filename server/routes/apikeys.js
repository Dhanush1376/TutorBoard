import express from 'express';
import {
  getApiKeys,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  testApiKey,
  updatePreferences,
  getApiKeyDashboard,
  getUsageStats,
  getModels,
  getHealthStatus,
  getCostStatus,
  testTransientKey,
} from '../controllers/apikeys.controller.js';
import { protect, restrictToUsers } from '../middleware/auth.middleware.js';

const router = express.Router();

// All API key routes require authentication and a persistent user account
router.use(protect);
router.use(restrictToUsers);

// Model catalog (no auth needed for reference, but we protect anyway)
router.get('/models', getModels);

// Usage analytics & monitoring
router.get('/dashboard', getApiKeyDashboard);
router.get('/usage', getUsageStats);
router.get('/health', getHealthStatus);
router.get('/cost-status', getCostStatus);

// Preferences
router.put('/preferences', updatePreferences);

// CRUD
router.get('/', getApiKeys);
router.post('/', addApiKey);
router.put('/:id', updateApiKey);
router.delete('/:id', deleteApiKey);
router.post('/:id/test', testApiKey);
router.post('/test-transient', testTransientKey);

export default router;
