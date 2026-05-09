import express from 'express';
import {
  saveArtifact,
  getArtifact,
  updateArtifact,
  getArtifactHistory,
  getSessionArtifacts,
  modifyArtifact,
} from '../controllers/artifact.controller.js';
import { protect, optionalProtect } from '../middleware/auth.middleware.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Create a new artifact
router.post('/save', optionalProtect, saveArtifact);

// AI-powered artifact modification (Protected + Rate Limited)
router.post('/modify', protect, aiRateLimiter, modifyArtifact);

// Get all artifacts for a session (must be before /:id to avoid route conflict)
router.get('/session/:sessionId', optionalProtect, getSessionArtifacts);

// Get version history (must be before /:id)
router.get('/history/:id', optionalProtect, getArtifactHistory);

// Get a single artifact
router.get('/:id', optionalProtect, getArtifact);

// Update an artifact (increments version)
router.put('/:id', protect, updateArtifact);

export default router;

