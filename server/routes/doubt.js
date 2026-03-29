import express from 'express';
import { answerDoubt } from '../controllers/doubt.controller.js';

const router = express.Router();

router.post('/doubt', answerDoubt);

export default router;
