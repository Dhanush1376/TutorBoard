/**
 * compiler-service.ts — Standalone Code Execution Service v7.0
 * 
 * This service provides isolated code execution capabilities,
 * decoupled from the main API process. It can be scaled independently
 * and restricted with tighter security profiles (e.g., no DB access).
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { executeCodeProxy } from '../controllers/compiler.controller.js';

dotenv.config();

const app = express();
const PORT = process.env.COMPILER_PORT || 6000;
const JUDGE0_HOST = process.env.JUDGE0_HOST || 'ce.judge0.com';

if (!process.env.JUDGE0_HOST) {
  console.warn('[CompilerService] ⚠️ JUDGE0_HOST not set. Falling back to public API (rate-limited).');
}

app.use(cors({ origin: 'http://localhost:5000' }));
app.use(express.json());

// Security Middleware: Internal Key Validation
const internalAuth = (req: any, res: any, next: any) => {
  const internalKey = req.headers['x-internal-key'];
  if (!process.env.INTERNAL_SERVICE_KEY || internalKey !== process.env.INTERNAL_SERVICE_KEY) {
    console.warn(`[CompilerService] ⚠️ Unauthorized access attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Internal service key required' });
  }
  next();
};

// Health Check
app.get('/health', (req, res) => res.json({ status: 'online', service: 'compiler' }));

// Execution Route (Protected)
app.post('/execute', internalAuth, executeCodeProxy);

app.listen(PORT, () => {
  console.log(`[CompilerService] 🚀 Isolated compiler listening on port ${PORT}`);
  console.log(`[CompilerService] Target Host: ${JUDGE0_HOST}`);
});
