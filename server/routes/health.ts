import express, { Request, Response } from 'express';
import { healthManager } from '../core/healthManager.js';
import { getRuntimeReport } from '../core/capabilities.js';

const router = express.Router();

/**
 * GET /health
 * Comprehensive system health report for administrators.
 */
router.get('/health', async (req: Request, res: Response) => {
  const report = await healthManager.getFullStatus();
  const statusCode = report.status === 'unhealthy' ? 503 : (report.status === 'degraded' ? 200 : 200);
  res.status(statusCode).json(report);
});

/**
 * GET /ready
 * Readiness check for load balancers and orchestration (K8s/Docker).
 */
router.get('/ready', (req: Request, res: Response) => {
  const readiness = healthManager.getReadiness();
  res.status(readiness.ready ? 200 : 503).json({
    status: readiness.ready ? 'ready' : 'not_ready',
    ...readiness.details
  });
});

/**
 * GET /capabilities
 * Detailed runtime capability report (Sync).
 */
router.get('/capabilities', (req: Request, res: Response) => {
  res.json(getRuntimeReport());
});

export default router;
