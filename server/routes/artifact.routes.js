import express from 'express';
import {
  saveArtifact,
  getArtifact,
  updateArtifact,
  deleteArtifact,
  getArtifactHistory,
  getSessionArtifacts,
  modifyArtifact,
  generateArtifact,
  editArtifact,
} from '../controllers/artifact.controller.js';
import { optionalProtect, ensureSessionIdentity } from '../middleware/auth.middleware.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Create a new artifact (checks target session ownership)
router.post('/save', optionalProtect, ensureSessionIdentity, saveArtifact);

// AI-powered high-fidelity generation (Protected + Rate Limited)
router.post('/generate', optionalProtect, ensureSessionIdentity, aiRateLimiter, generateArtifact);

// AI-powered visual artifact delta editing (Protected + Rate Limited)
router.post('/edit', optionalProtect, ensureSessionIdentity, aiRateLimiter, editArtifact);

// AI-powered artifact modification (Protected + Rate Limited)
router.post('/modify', optionalProtect, ensureSessionIdentity, aiRateLimiter, modifyArtifact);

// Get all artifacts for a session (must be before /:id to avoid route conflict)
router.get('/session/:sessionId', optionalProtect, getSessionArtifacts);

// Get version history (must be before /:id)
router.get('/history/:id', optionalProtect, getArtifactHistory);

// Get a single artifact
router.get('/:id', optionalProtect, getArtifact);

// Update an artifact (increments version)
router.put('/:id', optionalProtect, updateArtifact);

// Delete an artifact
router.delete('/:id', optionalProtect, deleteArtifact);

export default router;
