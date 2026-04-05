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

console.log("=====================================");
console.log("API KEY CHECK (OpenRouter):", process.env.OPENROUTER_API_KEY ? "Loaded ✅" : "Missing ❌ — AI will not work!");
console.log("JWT Secret:", process.env.JWT_SECRET ? "Loaded ✅" : "Missing ❌");
console.log("=====================================");

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3001;

// --------------- Socket.IO ---------------
const allowedOrigins = [
  'https://tutor-board-mocha.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

const io = new SocketIO(httpServer, {
  cors: {
    origin: allowedOrigins,
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

// CORS: allow Vercel production + localhost dev
const corsOrigins = [
  'https://tutor-board-mocha.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || corsOrigins.includes(origin)) {
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

// Feature routes
app.use('/', generateRoutes);
app.use('/', doubtRoutes);

// Auth routes
app.use('/api/auth', authRoutes);

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
