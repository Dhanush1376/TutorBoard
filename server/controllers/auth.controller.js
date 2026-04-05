import jwt from 'jsonwebtoken';

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
  return res.status(501).json({ error: 'Signup is disabled in stateless mode. Please use social login or continue as Guest.' });
};

/**
 * POST /api/auth/signin
 * Authenticate user
 */
export const signin = async (req, res) => {
  return res.status(501).json({ error: 'Signin is disabled in stateless mode. Please use social login or continue as Guest.' });
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
  console.log('[Auth] Social Login Success (Mock) for:', req.user?.email);
  if (req.user) {
    const token = generateToken(req.user.id || 'social-guest');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/dashboard?token=${token}`);
  } else {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
};
