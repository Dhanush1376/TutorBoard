import express from 'express';
import { getSessions, getSession, saveSession, deleteSession, beaconSave } from '../controllers/session.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Beacon endpoint MUST be before the protect middleware — it handles its own auth via body token
router.post('/beacon', beaconSave);

// All other session routes require authentication
router.use(protect);

router.get('/', getSessions);
router.get('/:id', getSession);
router.post('/', saveSession);
router.delete('/:id', deleteSession);

export default router;
