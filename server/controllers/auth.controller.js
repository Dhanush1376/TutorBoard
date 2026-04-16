import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import tokenStore from '../utils/tokenStore.js';

// BUG FIX #47: Validate JWT configuration at module load
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const VALID_EXPIRY_FORMATS = /^(\d+[smhd]|forever)$|^\d+$/;

if (!VALID_EXPIRY_FORMATS.test(JWT_EXPIRES_IN)) {
  console.warn(`[Auth] ⚠️ Invalid JWT_EXPIRES_IN value: "${JWT_EXPIRES_IN}". Using default "7d".`);
}

// BUG FIX #47: Generate JWT token with ID (jti) for revocation tracking
const generateToken = (id) => {
  const jti = `jti_${id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  return jwt.sign(
    { id, jti },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * POST /api/auth/signup
 * Register a new user
 */
export const signup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ error: 'Invalid user data' });
    }
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

/**
 * POST /api/auth/signin
 * Authenticate user
 */
export const signin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.comparePassword(password))) {
      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


/**
 * GET /api/auth/me
 * Get current user profile (requires auth middleware)
 */
export const getMe = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    res.json({
      user: {
        id: req.user.id || 'guest',
        name: req.user.name || 'Guest User',
        email: req.user.email || 'guest@example.com',
        settings: req.user.settings || {}
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
    const token = generateToken(req.user.id);
    const code = tokenStore.createCode(token);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?code=${code}`);
  } else {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
};

/**
 * GET /api/auth/exchange
 * Trade a one-time code for a JWT
 * BUG FIX #47: Check if token is revoked before exchanging
 */
export const exchangeToken = async (req, res) => {
  const { code } = req.query;
  const token = tokenStore.exchange(code);

  if (!token) {
    return res.status(400).json({ error: 'Invalid or expired exchange code' });
  }

  // BUG FIX #47: Verify token is not revoked
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (tokenStore.isTokenRevoked(decoded.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid token', details: err.message });
  }

  res.json({ token });
};
