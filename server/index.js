import dotenv from 'dotenv';
dotenv.config();
import crypto from 'crypto';

process.stdout.setEncoding('utf8');

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
import { setupTeachingSocket } from './sockets/teaching.socket.js';
import { httpRateLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
import mongoose from 'mongoose';
import passport from './utils/auth/passport.js';

import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
  console.log('[Sentry] Backend monitoring: ACTIVE ✅');
}

const app = express();
app.set('trust proxy', 1); // Trust only the immediate reverse proxy (Vercel, Cloudflare, etc.)

// Middleware to generate a unique nonce for each request to support CSP without 'unsafe-inline'
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// BUG FIX #57: Enhanced CSP header with nonces to prevent SVG/script injection from LLM-generated content
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      imgSrc: ["'self'", 'data:', 'https:'],      // Allow data: URLs for canvas exports
      objectSrc: ["'none'"],                      // Prevent plugin injection
      baseUri: ["'self'"],                        // Restrict base tag
      formAction: ["'self'"],                     // Forms must target same origin
      frameAncestors: ["'self'"],                 // Prevent clickjacking
      upgradeInsecureRequests: [],                // Allow HTTP in development
    },
  },
}));

// --------------- CORS Origins ---------------
// Read from env var, or fall back to defaults. Comma-separated.
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

// ─── Core Middleware ─────────────────────────────────────────────────────────
// Parse JSON bodies first
app.use(express.json({ limit: '1mb' }));
// CORS must be early
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Request Logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// BUG FIX #60: Request correlation ID for distributed tracing across agent pipeline
app.use(requestIdMiddleware);

// ─── Database Connection Config ──────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorboard';
mongoose.set('bufferCommands', false);
mongoose.set('debug', true);
console.log('[DB] Mongoose Debug Mode: ENABLED');

// ─── Environment Variable Validation ─────────────────────────────────────────
// BUG FIX #47: Added JWT_EXPIRES_IN to required env vars for token expiry validation
const REQUIRED_ENV = [
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

// Check if an origin matches — supports wildcard Vercel preview subdomains
function isOriginAllowed(origin) {
  if (!origin) return false; // Block requests with no origin (strictly follow CORS for credentialed setup)
  if (allowedOrigins.includes(origin)) return true;
  
  // Allow any localhost or 127.0.0.1 origin for robust development
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;

  // Match Vercel preview deployments: tutor-board-*.vercel.app
  if (/^https:\/\/tutor-board[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

// --------------- Socket.IO ---------------
const io = new SocketIO(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin (Socket.IO): ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
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
app.use('/', httpRateLimiter, generateRoutes);
app.use('/', httpRateLimiter, doubtRoutes);

// Auth routes (rate-limited)
app.use('/api/auth', httpRateLimiter, dbCheck, authRoutes);
app.use('/api/user', httpRateLimiter, dbCheck, userRoutes);
app.use('/api/sessions', httpRateLimiter, dbCheck, sessionRoutes);
app.use('/api/apikeys', httpRateLimiter, dbCheck, apikeyRoutes);

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

    console.log(`[DB] Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, 
      connectTimeoutMS: 10000,
      family: 4 
    });
    console.log(`[DB] Connected to MongoDB ✅`);
  } catch (err) {
    console.error(`[DB] FAILED TO CONNECT AT STARTUP: ${err.message}`);
    console.error(`[DB] The server will continue running in offline mode.`);
  }
};

startServer();
