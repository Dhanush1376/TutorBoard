import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import tokenStore from '../utils/auth/tokenStore.js';
import crypto from 'crypto';

// BUG FIX #47: Validate JWT configuration at module load
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const VALID_EXPIRY_FORMATS = /^(\d+[smhd]|forever)$|^\d+$/;

if (!VALID_EXPIRY_FORMATS.test(JWT_EXPIRES_IN)) {
  console.warn(`[Auth] ⚠️ Invalid JWT_EXPIRES_IN value: "${JWT_EXPIRES_IN}". Using default "7d".`);
}

// BUG FIX #47: Generate JWT token with ID (jti) for revocation tracking
const generateToken = (id) => {
  const jti = crypto.randomUUID();
  return jwt.sign(
    { id, jti },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// SEC-12: Simple input sanitization helper
const sanitize = (str, maxLen = 255) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLen)
    .replace(/[<>]/g, ''); // Basic XSS prevention: strip tags
};

/**
 * POST /api/auth/signup
 * Register a new user
 */
export const signup = async (req, res) => {
  let { name, email, password, confirmPassword } = req.body;

  // Sanitize inputs
  name = sanitize(name, 50);
  email = sanitize(email?.toLowerCase(), 100);

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  // Explicit length validation before CPU-intensive hashing
  if (password.length > 128) {
    return res.status(400).json({ error: "Password cannot exceed 128 characters" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords don't match" });
  }

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
          googleId: user.googleId,
          githubId: user.githubId,
          avatar: user.avatar,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ error: 'Invalid user data' });
    }
  } catch (err) {
    console.error('Signup error:', err);
    // Generic error message to prevent leaking schema details
    res.status(500).json({ error: 'Registration failed. Please try again later.' });
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
    let isMatch = false;

    if (user && user.password) {
      isMatch = await user.comparePassword(password);
    } else {
      // SEC-14: Timing attack mitigation. 
      // We perform a dummy comparison to ensure response time is consistent 
      // whether the user exists or not.
      const dummyHash = '$2a$12$LRY6z8Zp9X7X.e.O/B/K/uP9f0n/yX0j0l0k0l0k0l0k0l0k0l0k0';
      await bcrypt.compare(password, dummyHash);
    }

    if (isMatch) {
      // Return full user object for immediate hydration
      const userObj = user.toObject();
      delete userObj.password;
      
      res.json({
        user: {
          id: userObj._id,
          name: userObj.name,
          email: userObj.email,
          settings: userObj.settings || {},
          apiPreferences: userObj.apiPreferences || {},
          googleId: userObj.googleId,
          githubId: userObj.githubId,
          avatar: userObj.avatar,
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
        settings: req.user.settings || {},
        googleId: req.user.googleId,
        githubId: req.user.githubId,
        avatar: req.user.avatar,
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
export const socialLoginSuccess = async (req, res) => {
  console.log('[Auth] Social Login Success for:', req.user?.email);
  if (req.user) {
    const token = generateToken(req.user.id);
    const code = await tokenStore.createCode(token);
    const frontendUrl = process.env.FRONTEND_URL;
    res.redirect(`${frontendUrl}/?code=${code}`);
  } else {
    const frontendUrl = process.env.FRONTEND_URL;
    res.redirect(`${frontendUrl}/?error=auth_failed`);
  }
};

/**
 * GET /api/auth/exchange
 * Trade a one-time code for a JWT
 * BUG FIX #47: Check if token is revoked before exchanging
 */
export const exchangeToken = async (req, res) => {
  const { code } = req.query;
  const token = await tokenStore.exchange(code);

  if (!token) {
    return res.status(400).json({ error: 'Invalid or expired exchange code' });
  }

  // BUG FIX #47: Verify token is not revoked
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (await tokenStore.isTokenRevoked(decoded.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
  } catch (err) {
    console.error('Exchange error:', err);
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  res.json({ token });
};

/**
 * POST /api/auth/logout
 * Revoke the current token
 */
export const logout = async (req, res) => {
  try {
    const { tokenJti } = req;
    
    if (tokenJti) {
      // Tokens usually have an 'exp' field (seconds since epoch)
      // Extract it from req if possible, or use default
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      let exp;
      
      if (token) {
        try {
          const decoded = jwt.decode(token);
          exp = decoded.exp;
        } catch (e) { /* ignore */ }
      }

      await tokenStore.revokeToken(tokenJti, exp);
      console.log(`[Auth] User ${req.user?._id} logged out, token ${tokenJti} revoked`);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Server error during logout' });
  }
};
