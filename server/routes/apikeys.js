import express from 'express';
import {
  getApiKeys,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  testApiKey,
  updatePreferences,
  getUsageStats,
  getModels,
  getHealthStatus,
  getCostStatus,
} from '../controllers/apikeys.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All API key routes require authentication
router.use(protect);

// Model catalog (no auth needed for reference, but we protect anyway)
router.get('/models', getModels);

// Usage analytics & monitoring
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

export default router;
