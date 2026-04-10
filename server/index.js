import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import generateRoutes from './routes/generate.js';
import doubtRoutes from './routes/doubt.js';
import authRoutes from './routes/auth.js';
import { setupTeachingSocket } from './sockets/teaching.socket.js';
import { httpRateLimiter } from './middleware/rateLimiter.js';
import mongoose from 'mongoose';

// ─── Database Connection ─────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorboard';
mongoose.connect(MONGODB_URI)
  .then(() => console.log(`[DB] Connected to MongoDB: ${MONGODB_URI.split('@').pop()}`))
  .catch(err => console.error(`[DB] Connection Error: ${err.message}`));

// ─── Environment Variable Validation ─────────────────────────────────────────
const REQUIRED_ENV = [
  { key: 'OPENROUTER_API_KEY', critical: true,  label: 'OpenRouter API Key' },
  { key: 'JWT_SECRET',         critical: false, label: 'JWT Secret' },
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

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3001;

// --------------- CORS Origins ---------------
// Read from env var, or fall back to defaults. Comma-separated.
const DEFAULT_ORIGINS = [
  'https://tutor-board-mocha.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

// Check if an origin matches — supports wildcard Vercel preview subdomains
function isOriginAllowed(origin) {
  if (!origin) return true; // Allow requests with no origin (mobile apps, curl, server-to-server)
  if (allowedOrigins.includes(origin)) return true;
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

// Parse JSON bodies (with a size limit for safety)
app.use(express.json({ limit: '1mb' }));

// Initialize Passport for Social Auth
import passport from 'passport';
app.use(passport.initialize());

// Request logger (useful for debugging on Render)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

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
