// Server boot — LLM Chat System v2
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { Redis } from 'ioredis';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import * as Sentry from "@sentry/node";

// Component imports (Assuming .js extensions remain for now due to ESM/TS compatibility in transitions)
// @ts-ignore
import { setupTeachingSocket } from './sockets/teaching.socket.js';
// @ts-ignore
import { httpRateLimiter, strictGuestLimiter } from './middleware/rateLimiter.js';
// @ts-ignore
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
// @ts-ignore
import passport from './utils/auth/passport.js';
// @ts-ignore
import { optionalProtect } from './middleware/auth.middleware.js';
// @ts-ignore
import { initPostgres } from './utils/core/postgres.js';
// @ts-ignore
import { flushAnalytics } from './utils/core/analytics.js';

// Route imports
// @ts-ignore
import generateRoutes from './routes/generate.js';
// @ts-ignore
import doubtRoutes from './routes/doubt.js';
// @ts-ignore
import authRoutes from './routes/auth.js';
// @ts-ignore
import sessionRoutes from './routes/session.js';
// @ts-ignore
import apikeyRoutes from './routes/apikeys.js';
// @ts-ignore
import userRoutes from './routes/user.js';
// @ts-ignore
import uploadRoutes from './routes/upload.js';
// @ts-ignore
import aiRouter from './ai-router/index.js';
// @ts-ignore
import learnerRoutes from './routes/learner.routes.js';
// @ts-ignore
import chatRoutes from './routes/chat.routes.js';
// @ts-ignore
import artifactRoutes from './routes/artifact.routes.js';
// @ts-ignore
import compilerRoutes from './routes/compiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

process.stdout.setEncoding('utf8');

let httpServer: HttpServer;

// Global crash logging
process.on('uncaughtException', async (err: Error) => {
  const msg = `[CRITICAL] Uncaught Exception at ${new Date().toISOString()}:\n${err.stack}\n\n`;
  console.error(msg);
  
  if (httpServer && httpServer.listening) {
    console.log('[Graceful] Closing HTTP server and active connections...');
    
    // Aggressively close all active connections to free the port immediately
    if ((httpServer as any).closeAllConnections) {
      (httpServer as any).closeAllConnections();
    }

    httpServer.close(() => {
      console.log('[Graceful] HTTP server closed.');
      mongoose.connection.close(false).then(async () => {
        console.log('[Graceful] Mongoose connection closed.');
        await flushAnalytics();
        process.exit(1);
      });
    });
    
    setTimeout(() => {
      console.error('[Graceful] Shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  const msg = `[CRITICAL] Unhandled Rejection at ${new Date().toISOString()}:\nReason: ${reason}\n\n`;
  console.error(msg);
});

// SIGINT / SIGTERM handlers for nodemon/production graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`[${signal}] Received. Starting graceful shutdown...`);
  
  if (httpServer && httpServer.listening) {
    // Aggressively close all active connections to free the port immediately
    if ((httpServer as any).closeAllConnections) {
      (httpServer as any).closeAllConnections();
    }
    
    httpServer.close(() => {
      console.log('[Graceful] HTTP server closed.');
      mongoose.connection.close(false).then(async () => {
        console.log('[Graceful] Mongoose connection closed.');
        await flushAnalytics();
        console.log('[Graceful] Shutdown complete.');
        process.exit(0);
      });
    });

    // Forced exit if graceful shutdown takes too long
    setTimeout(() => {
      console.error('[Graceful] Shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (process.env.REDIS_URL) {
  try {
    const client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
    console.log('[Redis] Initializing connection...');
  } catch (err) {
    console.error('Redis connection error:', err);
  }
}

if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 1.0,
  });
  console.log('[Sentry] Backend monitoring: ACTIVE ✅');
}

const app: Application = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// CORS Origins
const DEFAULT_ORIGINS = [
  'https://tutor-board-mocha.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

function isOriginAllowed(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  if (!origin) return callback(null, true);
  
  const isAllowed = allowedOrigins.includes(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    /^https:\/\/tutor-board[a-z0-9-]*\.vercel\.app$/.test(origin);

  if (isAllowed) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: isOriginAllowed as any,
  credentials: true,
}));
app.use(cookieParser());

app.use(requestIdMiddleware);

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/tutorboard';
mongoose.set('bufferCommands', false);

const isDevMode = process.env.NODE_ENV !== 'production';
mongoose.set('debug', isDevMode);

const REQUIRED_ENV = [
  { key: 'MONGODB_URI',        critical: true,  label: 'MongoDB Connection URI' },
  { key: 'OPENROUTER_API_KEY', critical: true,  label: 'OpenRouter API Key' },
  { key: 'JWT_SECRET',         critical: true,  label: 'JWT Secret' },
  { key: 'ENCRYPTION_KEY',     critical: true,  label: 'AES-256 Encryption Key' },
  { key: 'FRONTEND_URL',       critical: true,  label: 'Frontend Redirect URL' },
];

console.log("=====================================");
let hasAllCritical = true;
for (const { key, critical, label } of REQUIRED_ENV) {
  const ok = !!process.env[key];
  console.log(`${label}: ${ok ? 'Loaded ✅' : (critical ? 'Missing ❌ — CRITICAL' : 'Missing ⚠️')}`);
  if (critical && !ok) hasAllCritical = false;
}
console.log("=====================================");

if (!process.env.ENCRYPTION_KEY) {
  console.error('FATAL: ENCRYPTION_KEY is not set. Exiting.');
  process.exit(1);
}

if (!hasAllCritical) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL ERROR: Missing required environment variables in PRODUCTION.');
    process.exit(1);
  } else {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'tutorboard-dev-secret-not-for-production';
    }
  }
}

httpServer = createServer(app);
const port = process.env.PORT || 5000;

const io = new SocketIO(httpServer, {
  cors: {
    origin: isOriginAllowed as any,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.engine.on("connection_error", (err: any) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(err);
  }
});

setupTeachingSocket(io);

app.use(passport.initialize());

const dbCheck = (req: Request, res: Response, next: NextFunction) => {
  const state = mongoose.connection.readyState;
  if (state !== 1) {
    return res.status(503).json({ 
      error: 'Database not available', 
      code: 'DB_OFFLINE',
    });
  }
  next();
};

app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'TutorBoard API is running 🚀' });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/', httpRateLimiter, dbCheck, generateRoutes);
app.use('/', httpRateLimiter, dbCheck, doubtRoutes);
app.use('/api/auth', httpRateLimiter, dbCheck, authRoutes);
app.use('/api/user', httpRateLimiter, dbCheck, userRoutes);
app.use('/api/ai', httpRateLimiter, optionalProtect, strictGuestLimiter, dbCheck, aiRouter);
app.use('/api/sessions', httpRateLimiter, dbCheck, sessionRoutes);
app.use('/api/apikeys', httpRateLimiter, dbCheck, apikeyRoutes);
app.use('/api/learner', httpRateLimiter, dbCheck, learnerRoutes);
app.use('/api/chat', httpRateLimiter, dbCheck, chatRoutes);
app.use('/api/artifact', httpRateLimiter, dbCheck, artifactRoutes);
app.use('/', httpRateLimiter, compilerRoutes);
app.use('/api', httpRateLimiter, dbCheck, uploadRoutes);

// @ts-ignore
Sentry.setupExpressErrorHandler(app);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const startServer = async () => {
  try {
    console.log(`[Server] Attempting to listen on port ${port}...`);
    httpServer.listen(port, () => {
      console.log(`Server running on port ${port} in TS Mode 🚀`);
    });

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, 
      connectTimeoutMS: 10000,
    });
    console.log(`[DB] Connected to MongoDB ✅`);

    if (process.env.POSTGRES_URL) {
      await initPostgres();
    }
  } catch (err: any) {
    console.error(`[DB] FAILED TO CONNECT: ${err.message}`);
  }
};

startServer();
