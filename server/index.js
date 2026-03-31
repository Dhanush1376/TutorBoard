import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import generateRoutes from './routes/generate.js';
import doubtRoutes from './routes/doubt.js';
import authRoutes from './routes/auth.js';

dotenv.config();

console.log("=====================================");
console.log("API KEY CHECK (OpenAI):", process.env.OPENAI_API_KEY ? "Loaded ✅" : "Missing ❌");
console.log("API KEY CHECK (OpenRouter):", process.env.OPENROUTER_API_KEY ? "Loaded ✅" : "Missing ❌");
console.log("MongoDB URI:", process.env.MONGODB_URI ? "Loaded ✅" : "Missing ❌");
console.log("JWT Secret:", process.env.JWT_SECRET ? "Loaded ✅" : "Missing ❌");
console.log("=====================================");

const app = express();
const port = process.env.PORT || 3001;

// --------------- MongoDB Connection ---------------

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️  MONGODB_URI not set — auth features will not work');
      return;
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host} ✅`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Don't exit — let the rest of the app work without auth
  }
};

connectDB();

// --------------- Middleware ---------------

// CORS: allow Vercel production + localhost dev
const allowedOrigins = [
  'https://tutor-board-mocha.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
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
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
