import jwt from 'jsonwebtoken';


/**
 * Middleware to protect routes that require authentication.
 * Expects: Authorization: Bearer <token>
 */
export const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Not authorized — no token provided',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Mock user from token (stateless)
    req.user = { id: decoded.id, name: 'Guest User', email: 'guest@example.com' };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({
      error: 'Not authorized — invalid token',
    });
  }
};
