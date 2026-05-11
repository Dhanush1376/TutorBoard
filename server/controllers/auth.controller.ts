import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import tokenStore from '../utils/auth/tokenStore.js';
import crypto from 'crypto';
import { sendWelcomeEmail, sendPasswordResetEmail, sendSecurityAlertEmail } from '../utils/core/mailer.js';
import { trackEvent } from '../utils/core/analytics.js';
import { container } from '../core/container.js';
import { AppError, ErrorCode } from '../shared/errors.js';

// Enterprise Target: Access token (15min) + refresh token (30d)
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';

interface JWTPayload {
  id: string;
  jti: string;
  type: 'access' | 'refresh';
  exp?: number;
}

const generateTokens = (id: string) => {
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();
  
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing');

  const accessToken = jwt.sign(
    { id, jti: accessJti, type: 'access' } as JWTPayload,
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
  
  const refreshToken = jwt.sign(
    { id, jti: refreshJti, type: 'refresh' } as JWTPayload,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
  
  return { accessToken, refreshToken, accessJti, refreshJti };
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const isProd = process.env.NODE_ENV === 'production';
  
  res.cookie('tb-access-token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000 // 15 mins
  });

  res.cookie('tb-refresh-token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
};

const sanitize = (str: string | undefined, maxLen = 255): string => {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLen)
    .replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[char] || char;
    });
};

export const signup = async (req: Request, res: Response) => {
  let { name, email, password, confirmPassword } = req.body;

  name = sanitize(name, 50);
  email = sanitize(email?.toLowerCase(), 100);

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  if (password.length > 128) {
    return res.status(400).json({ error: "Password cannot exceed 128 characters" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords don't match" });
  }

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ error: 'This email is already registered. Please sign in or use a different email.' });
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      const { accessToken, refreshToken } = generateTokens(user._id.toString());
      setAuthCookies(res, accessToken, refreshToken);

      sendWelcomeEmail(user as any).catch(err => console.error('[Auth] Welcome email failed:', err));

      trackEvent(user._id.toString(), 'user_signed_up', {
        name: user.name,
        auth_method: 'email',
      });

      res.status(201).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          settings: user.settings || {},
          apiPreferences: user.apiPreferences || {},
          googleId: user.googleId,
          githubId: user.githubId,
          avatar: user.avatar,
        }
      });
    } else {
      res.status(400).json({ error: 'Invalid user data' });
    }
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again later.' });
  }
};

export const signin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password') as any;
    let isMatch = false;

    if (user && user.password) {
      isMatch = await user.comparePassword(password);
    } else {
      const dummyHash = '$2a$12$LRY6z8Zp9X7X.e.O/B/K/uP9f0n/yX0j0l0k0l0k0l0k0l0k0l0k0';
      await bcrypt.compare(password, dummyHash);
    }

    if (isMatch && user) {
      const userObj = user.toObject() as any;
      delete userObj.password;
      
      const { accessToken, refreshToken } = generateTokens(user._id.toString());
      setAuthCookies(res, accessToken, refreshToken);

      trackEvent(user._id.toString(), 'user_signed_in', {
        auth_method: 'email',
      });

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
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    res.json({
      user: {
        id: user.id || user._id || 'guest',
        name: user.name || 'Guest User',
        email: user.email || 'guest@example.com',
        settings: user.settings || {},
        googleId: user.googleId,
        githubId: user.githubId,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const socialLoginSuccess = async (req: Request, res: Response) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://tutorboard.vercel.app',
      'https://tutor-board-mocha.vercel.app'
    ];
    
    const isAllowed = allowedOrigins.some(origin => frontendUrl.startsWith(origin)) || 
                     /^https:\/\/tutorboard-([a-zA-Z0-9-]+)-dhanush1376\.vercel\.app$/.test(frontendUrl);
    
    const safeRedirect = isAllowed ? frontendUrl : 'http://localhost:5173';

    const user = (req as any).user;
    if (user) {
      const { accessToken, refreshToken } = generateTokens(user.id || user._id);
      const code = await tokenStore.createCode(accessToken);
      if (container.has('redis-main')) {
        try {
          await container.resolve<any>('redis-main').set(`auth:refresh:${user.id || user._id}`, refreshToken, 'EX', 86400); // 24 hours — generous window for code exchange
        } catch (err) {}
      }
      res.redirect(`${safeRedirect}/?code=${code}`);
    } else {
      res.redirect(`${safeRedirect}/?error=auth_failed`);
    }
  } catch (err) {
    console.error('[Auth] Social login error:', err);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=server_error`);
  }
};

export const exchangeToken = async (req: Request, res: Response) => {
  const code = req.body?.code || req.query?.code;

  if (!code) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, 'Exchange code is required');
  }

  const accessToken = await tokenStore.exchange(code);

  if (!accessToken) {
    throw new AppError(ErrorCode.AUTH_TOKEN_EXPIRED, 'Invalid or expired exchange code');
  }

  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing');
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET, { algorithms: ['HS256'] }) as JWTPayload;
    
    if (await tokenStore.isTokenRevoked(decoded.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    let refreshToken = null;
    if (container.has('redis-main')) {
      try {
        const client = container.resolve<any>('redis-main');
        refreshToken = await client.get(`auth:refresh:${decoded.id}`);
        if (refreshToken) {
          setAuthCookies(res, accessToken, refreshToken);
          await client.del(`auth:refresh:${decoded.id}`);
        }
      } catch (err) {}
    }

    if (!refreshToken) {
      const { refreshToken: newRefresh } = generateTokens(decoded.id);
      setAuthCookies(res, accessToken, newRefresh);
    }
  } catch (err) {
    console.error('Exchange error:', err);
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  res.json({ success: true });
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies['tb-refresh-token'];

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token missing' });
  }

  try {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT secret missing');
    
    const decoded = jwt.verify(refreshToken, secret, { algorithms: ['HS256'] }) as JWTPayload;
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    if (await tokenStore.isTokenRevoked(decoded.jti)) {
      return res.status(401).json({ error: 'Refresh token revoked' });
    }

    const { accessToken: newAccess, refreshToken: newRefresh } = generateTokens(decoded.id);
    
    if (decoded.exp) {
      await tokenStore.revokeToken(decoded.jti, decoded.exp);
    }

    setAuthCookies(res, newAccess, newRefresh);

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Auth] Refresh failed:', err.message);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie('tb-access-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  });
  res.clearCookie('tb-refresh-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  });

  try {
    const { tokenJti, tokenExp } = req as any;
    
    if (tokenJti) {
      await tokenStore.revokeToken(tokenJti, tokenExp);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    // Even if revocation fails, we've cleared the client cookies, so we return success
    // to avoid confusing the UI, while logging the server-side error.
    res.json({ success: true, message: 'Logged out successfully (client-side)' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = (Date.now() + 60 * 60 * 1000) as any; // 1 hour

    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail(user as any, resetToken);

    res.json({ success: true, message: 'Reset email sent' });
  } catch (err) {
    console.error('ForgotPassword error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body;

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.passwordChangedAt = (Date.now() as any);

    await user.save();
    
    if (container.has('redis-main')) {
      try {
        await container.resolve<any>('redis-main').del(`user:${user._id}`);
      } catch (err) {}
    }

    sendSecurityAlertEmail(user as any).catch(e => console.error('[Auth] Security alert failed:', e));

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('ResetPassword error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
export const forceReset = async (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'strict' : 'lax') as any,
  };

  res.clearCookie('tb-access-token', cookieOptions);
  res.clearCookie('tb-refresh-token', cookieOptions);
  res.clearCookie('tb-token', cookieOptions);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  if (req.method === 'GET') {
    return res.redirect(`${frontendUrl}/?reset=success`);
  }
  
  res.json({ success: true, message: 'All session cookies cleared' });
};
