import express from 'express';
import { getSessions, getSession, saveSession, deleteSession, beaconSave, getSessionMessages, claimLegacySession } from '../controllers/session.controller.js';
import { optionalProtect, requireIdentity, ensureSessionIdentity } from '../middleware/auth.middleware.js';

const router = express.Router();

// Beacon endpoint — emergency unload flush
router.post('/beacon', optionalProtect, beaconSave);

// Session collection routes: Auto-onboard guests with verified guest identity
router.get('/', optionalProtect, ensureSessionIdentity, getSessions);
router.post('/', optionalProtect, ensureSessionIdentity, saveSession);

// Individual session routes: Require verified user or guest identity
router.get('/:id', optionalProtect, requireIdentity, getSession);
router.post('/:id/claim-legacy', optionalProtect, requireIdentity, claimLegacySession);
router.get('/:id/messages', optionalProtect, requireIdentity, getSessionMessages);
router.delete('/:id', optionalProtect, requireIdentity, deleteSession);

export default router;
