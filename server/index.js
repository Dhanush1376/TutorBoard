import dotenv from 'dotenv';
dotenv.config();

process.stdout.setEncoding('utf8');

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import generateRoutes from './routes/generate.js';
import doubtRoutes from './routes/doubt.js';
import authRoutes from './routes/auth.js';
import { setupTeachingSocket } from './sockets/teaching.socket.js';
import { httpRateLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
import mongoose from 'mongoose';

const app = express();
app.set('trust proxy', true); // Trust reverse proxies (Vercel, Cloudflare, etc.) for rate limiting

// BUG FIX #57: Enhanced CSP header to prevent SVG/script injection from LLM-generated content
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // React requires unsafe-inline
      styleSrc: ["'self'", "'unsafe-inline'"],    // Tailwind CSS dynamic styles
      imgSrc: ["'self'", 'data:', 'https:'],      // Allow data: URLs for canvas exports
      svgSrc: ["'self'"],                         // SVG content only from self
      objectSrc: ["'none'"],                      // Prevent plugin injection
      baseUri: ["'self'"],                        // Restrict base tag
      formAction: ["'self'"],                     // Forms must target same origin
      frameAncestors: ["'self'"],                 // Prevent clickjacking
      upgradeInsecureRequests: [],                // Allow HTTP in development
    },
  },
}));

// ─── Core Middleware ─────────────────────────────────────────────────────────
// Parse JSON bodies first
app.use(express.json({ limit: '1mb' }));
// CORS must be early
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
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

// ─── Database Connection ─────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorboard';
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 2000, // Fail fast (2s)
  connectTimeoutMS: 5000,
})
  .then(() => console.log(`[DB] Connected to MongoDB ✅`))
  .catch(err => console.error(`[DB] Connection Error (Non-fatal): ${err.message}`));

// ─── Environment Variable Validation ─────────────────────────────────────────
// BUG FIX #47: Added JWT_EXPIRES_IN to required env vars for token expiry validation
const REQUIRED_ENV = [
  { key: 'OPENROUTER_API_KEY', critical: true,  label: 'OpenRouter API Key' },
  { key: 'JWT_SECRET',         critical: true,  label: 'JWT Secret' },
  { key: 'JWT_EXPIRES_IN',     critical: false, label: 'JWT Expiry Time (default: 7d)' },
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
  console.error('❌ Missing critical environment variables. Server cannot function. Exiting.');
  process.exit(1);
}

const httpServer = createServer(app);
const port = process.env.PORT || 3001;

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
import passport from 'passport';
app.use(passport.initialize());

// Request logger was moved to top

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
app.use('/api/auth', httpRateLimiter, authRoutes);

// --------------- Global Error Handler ---------------
// Must be registered AFTER all routes
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// --------------- Start ---------------
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Socket.IO ready on /teaching namespace`);
});
