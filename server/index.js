import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import generateRoutes from './routes/generate.js';
import doubtRoutes from './routes/doubt.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173' // Securely allow only the frontend
}));
app.use(express.json());

// Fixed Root Route
app.get('/', (req, res) => {
  res.send('TutorBoard API is running 🚀');
});

// Test API Route
app.get('/api/test', (req, res) => {
  res.json({ message: "API working" });
});

// Modular Routes
app.use('/', generateRoutes);
app.use('/', doubtRoutes);


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
