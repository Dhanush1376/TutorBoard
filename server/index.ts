import path from 'path';
import { fileURLToPath } from 'url';
import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import * as Sentry from '@sentry/node';

import { generateCsrfSecret, deriveCsrfToken, validateCsrf } from './utils/auth/csrf.js';
import { httpRateLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
import passport from './utils/auth/passport.js';
import { protect } from './middleware/auth.middleware.js';
import { AppError, errorHandler as appErrorHandler, ErrorCode } from './shared/errors.js';
import { socketManager } from './services/socket/socket.manager.js';
import { lifecycle } from './core/lifecycle.js';
import { runtimeState } from './core/runtimeState.js';

import healthRoutes from './routes/health.js';
import generateRoutes from './routes/generate.js';
import doubtRoutes from './routes/doubt.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/session.js';
import apikeyRoutes from './routes/apikeys.js';
import userRoutes from './routes/user.js';
import uploadRoutes from './routes/upload.js';
import learnerRoutes from './routes/learner.routes.js';
import chatRoutes from './routes/chat.routes.js';
import artifactRoutes from './routes/artifact.routes.js';
import compilerRoutes from './routes/compiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'https://tutorboard.vercel.app',
  'https://tutor-board-mocha.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

const isOriginAllowed = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  const isVercelPreview = origin && (
    /^https:\/\/tutorboard-git-.*-dhanush1376\.vercel\.app$/.test(origin) ||
    /^https:\/\/tutorboard-.*-dhanush1376\.vercel\.app$/.test(origin)
  );

  if (!origin || allowedOrigins.includes(origin) || isVercelPreview) callback(null, true);
  else callback(new Error('Not allowed by CORS'));
};

export function createApp(): Application {
  const app: Application = express();
  app.set('trust proxy', 1);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...(process.env.NODE_ENV !== 'production' ? ["'unsafe-inline'", "'unsafe-eval'"] : []), 'https://app.posthog.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.sentry.io', 'https://*.posthog.com', 'wss:', 'https:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
  }));

  app.use(cors({
    origin: isOriginAllowed as any,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'X-Request-Id', 'Cache-Control'],
    exposedHeaders: ['X-Request-ID', 'X-CSRF-Token']
  }));

  app.options('*', cors({ 
    origin: isOriginAllowed as any, 
    credentials: true, 
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'X-Request-Id', 'Cache-Control'],
    exposedHeaders: ['X-Request-ID', 'X-CSRF-Token']
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use(httpRateLimiter);
  
  if (process.env.NODE_ENV === 'development') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[API][${req.method}] ${req.path}`);
      next();
    });
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    const isProd = process.env.NODE_ENV === 'production';
    const secret = req.cookies?.['tb-csrf-secret'];
    const token = req.cookies?.['tb-csrf-token'];
    const invalid = secret && token && !validateCsrf(secret, token);

    if ((!secret || !token || invalid) && req.method === 'GET') {
      const newSecret = generateCsrfSecret();
      const newToken = deriveCsrfToken(newSecret);
      const CSRF_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
      res.cookie('tb-csrf-secret', newSecret, { httpOnly: true, secure: isProd, sameSite: isProd ? 'strict' : 'lax', maxAge: CSRF_EXPIRY });
      res.cookie('tb-csrf-token', newToken, { httpOnly: false, secure: isProd, sameSite: isProd ? 'strict' : 'lax', maxAge: CSRF_EXPIRY });
      if (req.path === '/api/csrf-token') {
        req.cookies['tb-csrf-secret'] = newSecret;
        req.cookies['tb-csrf-token'] = newToken;
      }
    }

    next();
  });

  app.get('/api/csrf-token', (req: Request, res: Response) => {
    // SEC-07: Proactive CSRF token generation if missing, regardless of middleware flow
    let token = req.cookies?.['tb-csrf-token'];
    if (!token) {
      const isProd = process.env.NODE_ENV === 'production';
      const secret = generateCsrfSecret();
      token = deriveCsrfToken(secret);
      const CSRF_EXPIRY = 7 * 24 * 60 * 60 * 1000;
      res.cookie('tb-csrf-secret', secret, { httpOnly: true, secure: isProd, sameSite: isProd ? 'strict' : 'lax', maxAge: CSRF_EXPIRY });
      res.cookie('tb-csrf-token', token, { httpOnly: false, secure: isProd, sameSite: isProd ? 'strict' : 'lax', maxAge: CSRF_EXPIRY });
    }
    res.json({ csrfToken: token });
  });

  // Health & Readiness (Exposed at root for orchestration)
  app.use('/', healthRoutes);

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.path.includes('/auth/google/callback') || req.path.includes('/auth/github/callback')) return next();
    // Beacon uses cookie-based auth and has no CSRF token; auth/exchange is pre-CSRF
    if (req.path.includes('/sessions/beacon') || req.path.includes('/auth/exchange') || req.path.includes('/auth/refresh')) return next();

    const secret = req.cookies?.['tb-csrf-secret'];
    const token = req.headers['x-csrf-token'] as string;
    if (!secret || !token || !validateCsrf(secret, token)) {
      return res.status(403).json({ error: 'Security validation failed (CSRF)', code: 'CSRF_INVALID' });
    }
    next();
  });

  app.use(passport.initialize());

  const dbCheck = (req: Request, res: Response, next: NextFunction) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not available', code: 'DB_OFFLINE' });
    }
    next();
  };

  app.get('/', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'TutorBoard API is running' });
  });

  app.use('/', dbCheck, generateRoutes);
  app.use('/', dbCheck, doubtRoutes);
  app.use('/api/auth', dbCheck, authRoutes);
  app.use('/api/user', dbCheck, userRoutes);
  app.use('/api/sessions', dbCheck, sessionRoutes);
  app.use('/api/apikeys', dbCheck, apikeyRoutes);
  app.use('/api/learner', dbCheck, learnerRoutes);
  app.use('/api/chat', dbCheck, chatRoutes);
  app.use('/api/artifact', dbCheck, artifactRoutes);
  app.use('/api', dbCheck, uploadRoutes);
  app.use('/', compilerRoutes);

  app.get('/uploads/:filename', protect, (req, res) => {
    const filename = path.basename(req.params.filename);
    const safePath = path.join(__dirname, 'uploads', filename);
    res.sendFile(safePath, (err) => {
      if (err) res.status(404).json({ error: 'File not found' });
    });
  });

  // @ts-ignore
  Sentry.setupExpressErrorHandler(app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) return appErrorHandler(err, req, res, next);
    console.error('[Server] Unhandled error:', err.message || err);
    return res.status(err.status || 500).json({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
      },
    });
  });

  return app;
}

export async function startHttpServer(app: Application, port: number): Promise<HttpServer> {
  console.log('[App] Initializing Server Components...');
  const httpServer = createServer(app);
  const io = socketManager.start(httpServer, isOriginAllowed);

  io.engine.on('connection_error', (err: any) => {
    if (process.env.NODE_ENV === 'production') Sentry.captureException(err);
  });

  // ASYNC-08: Register HTTP server cleanup with lifecycle
  runtimeState.registerCleanup('http-server', async () => {
    return new Promise((resolve) => {
      console.log('[Lifecycle] Closing HTTP server...');
      httpServer.close(() => {
        console.log('[Lifecycle] HTTP server closed.');
        resolve();
      });
    });
  });

  return new Promise<HttpServer>((resolve, reject) => {
    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      reject(err.code === 'EADDRINUSE'
        ? new Error(`EADDRINUSE: Port ${port} is already in use. Kill orphan processes.`)
        : err);
    });

    httpServer.listen(port, () => {
      runtimeState.setCapability({
        name: 'http',
        mode: 'REAL',
        status: 'healthy',
        ready: true,
        details: `Listening on ${port}`,
      });
      console.log(`[Server] HTTP server listening on port ${port}`);
      resolve(httpServer);
    });
  });
}

export const app = createApp();

export default createApp;
