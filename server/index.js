import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { Redis } from 'ioredis';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import * as Sentry from "@sentry/node";

// Component imports
import { setupTeachingSocket } from './sockets/teaching.socket.js';
import { httpRateLimiter, strictGuestLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
import passport from './utils/auth/passport.js';
import { optionalProtect } from './middleware/auth.middleware.js';
import { initPostgres } from './utils/core/postgres.js';
import { flushAnalytics } from './utils/core/analytics.js';

// Route imports
import generateRoutes from './routes/generate.js';
import doubtRoutes from './routes/doubt.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/session.js';
import apikeyRoutes from './routes/apikeys.js';
import userRoutes from './routes/user.js';
import uploadRoutes from './routes/upload.js';
import aiRouter from './ai-router/index.js';
import learnerRoutes from './routes/learner.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

process.stdout.setEncoding('utf8');

let httpServer;

// Global crash logging
process.on('uncaughtException', async (err) => {
  const msg = `[CRITICAL] Uncaught Exception at ${new Date().toISOString()}:\n${err.stack}\n\n`;
  console.error(msg);
  
  if (httpServer && httpServer.listening) {
    console.log('[Graceful] Closing HTTP server...');
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

if (process.env.REDIS_URL) {
  try {
    const client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
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

const app = express();
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

function isOriginAllowed(origin, callback) {
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

app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: isOriginAllowed,
  credentials: true,
}));

app.use('/uploads', express.static('uploads', {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'attachment');
  }
}));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

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
    origin: isOriginAllowed,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.engine.on("connection_error", (err) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(err);
  }
});

setupTeachingSocket(io);

app.use(passport.initialize());

const dbCheck = (req, res, next) => {
  const state = mongoose.connection.readyState;
  if (state !== 1) {
    return res.status(503).json({ 
      error: 'Database not available', 
      code: 'DB_OFFLINE',
    });
  }
  next();
};

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'TutorBoard API is running 🚀' });
});

app.get('/health', (req, res) => {
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
app.use('/api', httpRateLimiter, dbCheck, uploadRoutes);

Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const startServer = async () => {
  try {
    httpServer.listen(port, () => {
      console.log(`Server running on port ${port} in JS Mode 🚀`);
    });

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, 
      connectTimeoutMS: 10000,
    });
    console.log(`[DB] Connected to MongoDB ✅`);

    if (process.env.POSTGRES_URL) {
      await initPostgres();
    }
  } catch (err) {
    console.error(`[DB] FAILED TO CONNECT: ${err.message}`);
  }
};

startServer();
