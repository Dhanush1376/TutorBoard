import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * POST /api/auth/signup
 * Register a new user
 */
export const signup = async (req, res) => {
  console.log('[Auth] Signup attempt for:', req.body.email);

  // Check DB connection first
  if (mongoose.connection.readyState !== 1) {
    console.error('[Auth] Database not connected. Current state:', mongoose.connection.readyState);
    return res.status(503).json({ error: 'Database connection error. Please try again later.' });
  }

  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please fill in all fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check if user already exists
    console.log('[Auth] Checking existing user...');
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Create user (password is hashed by the pre-save hook)
    console.log('[Auth] Creating user record...');
    const user = await User.create({ name, email, password });

    // Generate token
    console.log('[Auth] Generating token...');
    const token = generateToken(user._id.toString());

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Signup error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    if (err.code === 11000) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }
    res.status(500).json({ error: 'Server error during registration' });
  }
};

/**
 * POST /api/auth/signin
 * Authenticate user
 */
export const signin = async (req, res) => {
  console.log('[Auth] Signin attempt for:', req.body.email);

  // Check DB connection first
  if (mongoose.connection.readyState !== 1) {
    console.error('[Auth] Database not connected. Current state:', mongoose.connection.readyState);
    return res.status(503).json({ error: 'Database connection error. Please try again later.' });
  }

  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    // Find user and explicitly include password field
    console.log('[Auth] Finding user...');
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare passwords
    console.log('[Auth] Comparing passwords...');
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    console.log('[Auth] Generating token...');
    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Signin error details:', {
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({ error: 'Server error during login' });
  }
};

/**
 * GET /api/auth/me
 * Get current user profile (requires auth middleware)
 */
export const getMe = async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        createdAt: req.user.createdAt,
      },
    });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Social Auth Success Handler
 * Generates token and redirects to frontend
 */
export const socialLoginSuccess = (req, res) => {
  console.log('[Auth] Social Login Success for:', req.user?.email);
  if (req.user) {
    const token = generateToken(req.user._id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Redirect to dashboard with token as query param
    // The frontend will catch this token and store it in localStorage
    res.redirect(`${frontendUrl}/dashboard?token=${token}`);
  } else {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
};
