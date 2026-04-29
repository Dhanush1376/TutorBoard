import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env using absolute path to prevent CWD issues (BUG FIX #48)
dotenv.config({ path: path.join(__dirname, '.env') });
import crypto from 'crypto';

process.stdout.setEncoding('utf8');

import fs from 'fs';

// BUG FIX #99: Global crash logging (Console only to prevent nodemon restart loop)
// BUG FIX #99: Global crash logging (Console only to prevent nodemon restart loop)
process.on('uncaughtException', async (err) => {
  const msg = `[CRITICAL] Uncaught Exception at ${new Date().toISOString()}:\n${err.stack}\n\n`;
  console.error(msg);
  
  // REL-05: Graceful shutdown for production reliability
  if (typeof httpServer !== 'undefined' && httpServer.listening) {
    console.log('[Graceful] Closing HTTP server...');
    httpServer.close(() => {
      console.log('[Graceful] HTTP server closed.');
      mongoose.connection.close(false).then(async () => {
        console.log('[Graceful] Mongoose connection closed.');
        await flushAnalytics();
        process.exit(1);
      });
    });
    
    // Force exit after 10s if graceful shutdown hangs
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

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import generateRoutes from './routes/generate.js';
import doubtRoutes from './routes/doubt.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/session.js';
import apikeyRoutes from './routes/apikeys.js';
import userRoutes from './routes/user.js';
import uploadRoutes from './routes/upload.js';
import aiRouter from './ai-router/index.js';
import learnerRoutes from './routes/learner.routes.js';
import { setupTeachingSocket } from './sockets/teaching.socket.js';
import { httpRateLimiter, strictGuestLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
import mongoose from 'mongoose';
import passport from './utils/auth/passport.js';
import { optionalProtect } from './middleware/auth.middleware.js';

import * as Sentry from "@sentry/node";
import { initPostgres } from './utils/core/postgres.js';
import { flushAnalytics } from './utils/core/analytics.js';

if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 1.0,
  });
  console.log('[Sentry] Backend monitoring: ACTIVE ✅');
}

const app = express();
app.set('trust proxy', 1); // Trust only the immediate reverse proxy (Vercel, Cloudflare, etc.)

// CSP Nonces were removed to support static SPA deployments via Vercel. 
// CSP should be managed via Vercel headers for client-side protection.

// BUG FIX #57: Enhanced CSP header for API protection.
// Note: Client-side CSP for the React SPA is managed via vercel.json headers.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allowed for React component styles
      imgSrc: ["'self'", 'data:', 'https:'],      // Allow data: URLs for canvas exports
      objectSrc: ["'none'"],                      // Prevent plugin injection
      baseUri: ["'self'"],                        // Restrict base tag
      formAction: ["'self'"],                     // Forms must target same origin
      frameAncestors: ["'self'"],                 // Prevent clickjacking
      upgradeInsecureRequests: [],                // Allow HTTP in development
    },
  },
}));

// ─── CORS Origins ───
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

// Check if an origin matches — supports wildcard Vercel preview subdomains
function isOriginAllowed(origin, callback) {
  // Allow requests with no origin (like mobile apps, curl, or server-to-server calls)
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

// ─── Core Middleware ───
// Parse JSON bodies first
app.use(express.json({ limit: '1mb' }));
// CORS must be early
app.use(cors({
  origin: isOriginAllowed,
  credentials: true,
}));

// Serve static uploads with security headers
app.use('/uploads', express.static('uploads', {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'attachment');
  }
}));

// Request Logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// BUG FIX #60: Request correlation ID for distributed tracing across agent pipeline
app.use(requestIdMiddleware);

// Database Connection Config
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/tutorboard';
mongoose.set('bufferCommands', false);

// Only enable query logging in development to prevent PII leaks in production
const isDevMode = process.env.NODE_ENV !== 'production';
mongoose.set('debug', isDevMode);
if (isDevMode) console.log('[DB] Mongoose Debug Mode: ENABLED');

// ─── Environment Variable Validation ─────────────────────────────────────────
// BUG FIX #47: Added JWT_EXPIRES_IN to required env vars for token expiry validation
const REQUIRED_ENV = [
  { key: 'MONGODB_URI',        critical: true,  label: 'MongoDB Connection URI' },
  { key: 'OPENROUTER_API_KEY', critical: true,  label: 'OpenRouter API Key' },
  { key: 'JWT_SECRET',         critical: true,  label: 'JWT Secret' },
  { key: 'ENCRYPTION_KEY',     critical: true,  label: 'AES-256 Encryption Key' },
  { key: 'FRONTEND_URL',       critical: true,  label: 'Frontend Redirect URL' },
  { key: 'JWT_EXPIRES_IN',     critical: false, label: 'JWT Expiry Time (default: 7d)' },
  { key: 'GITHUB_CLIENT_ID',   critical: false, label: 'GitHub Client ID' },
  { key: 'GITHUB_CLIENT_SECRET', critical: false, label: 'GitHub Client Secret' },
  { key: 'SENTRY_DSN',           critical: false, label: 'Sentry DSN' },
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
    console.error('The server cannot start securely. Please check your .env or platform secrets.');
    process.exit(1);
  } else {
    console.warn('⚠️ Missing critical environment variables. Server will run in DEGRADED MODE.');
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️ No JWT_SECRET found. Using developmental fallback. NOT SECURE FOR PRODUCTION.');
      process.env.JWT_SECRET = 'tutorboard-dev-secret-not-for-production';
    }
  }
}

const httpServer = createServer(app);
const port = process.env.PORT || 5000;


// --------------- Socket.IO ---------------
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

// Mount teaching WebSocket handlers
setupTeachingSocket(io);

// --------------- Middleware ---------------

// CORS: allow configured origins + Vercel preview deployments
// CORS and JSON parsing were moved to top

// Initialize Passport for Social Auth
app.use(passport.initialize());

// Request logger was moved to top

// ─── Database Reliability Middleware ─────────────────────────────────────────
const dbCheck = (req, res, next) => {
  const state = mongoose.connection.readyState;
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  console.log(`[DB Check] State: ${states[state] || state} (Targeting: /api/chat/save)`);
  
  if (state !== 1) {
    console.error(`[DB Check] 🚨 REJECTED: Database is ${states[state] || 'offline'}. Request path: ${req.path}`);
    return res.status(503).json({ 
      error: 'Database not available', 
      code: 'DB_OFFLINE',
      details: 'The server is running in Degraded Mode. Please ensure your IP is whitelisted in MongoDB Atlas.' 
    });
  }
  next();
};

// --------------- Routes ---------------

// Root / Health check
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'TutorBoard API is running 🚀' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Test route
app.get('/api/test', (_req, res) => {
  res.json({ message: 'API working' });
});

// Feature routes (rate-limited)
app.use('/', httpRateLimiter, dbCheck, generateRoutes);
app.use('/', httpRateLimiter, dbCheck, doubtRoutes);

// Auth routes (rate-limited)
app.use('/api/auth', httpRateLimiter, dbCheck, authRoutes);
app.use('/api/user', httpRateLimiter, dbCheck, userRoutes);
app.use('/api/ai', httpRateLimiter, optionalProtect, strictGuestLimiter, dbCheck, aiRouter);
app.use('/api/sessions', httpRateLimiter, dbCheck, sessionRoutes);
app.use('/api/apikeys', httpRateLimiter, dbCheck, apikeyRoutes);
app.use('/api/learner', httpRateLimiter, dbCheck, learnerRoutes);
app.use('/api', httpRateLimiter, dbCheck, uploadRoutes);

Sentry.setupExpressErrorHandler(app);

// --------------- Global Error Handler ---------------
// Must be registered AFTER all routes
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// ─── Startup ─────────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    httpServer.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Socket.IO ready on /teaching namespace`);
    });

    console.log(`[DB] Attempting connection to: ${MONGODB_URI.split('@')[1] || 'localhost'}`);
    console.log(`[DB] Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, 
      connectTimeoutMS: 10000,
      family: 4 
    });
    console.log(`[DB] Connected to MongoDB ✅`);

    // Initialize Postgres + pgvector for Phase 5
    if (process.env.POSTGRES_URL) {
      await initPostgres();
    }
  } catch (err) {
    console.error(`[DB] FAILED TO CONNECT AT STARTUP: ${err.message}`);
    console.error(`[DB] The server will continue running in offline mode.`);
  }
};

startServer();
// Trigger nodemon restart
