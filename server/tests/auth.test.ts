import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import User from '../models/User.js';
import RevokedToken from '../models/RevokedToken.js';
import jwt from 'jsonwebtoken';

// Mock dependencies
vi.mock('../utils/core/redis.js', () => ({
  default: {
    isConnected: true,
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setupExpressErrorHandler: vi.fn(),
}));

vi.mock('../utils/core/analytics.js', () => ({
  flushAnalytics: vi.fn(),
}));

describe('Authentication & Security', () => {
  let userToken: string;
  let userId: string;
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

  beforeEach(async () => {
    // Create a test user
    const user = await User.create({
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
      name: 'Test User',
    });
    userId = user._id.toString();
    userToken = jwt.sign({ id: userId, jti: 'test-jti' }, JWT_SECRET);
  });

  async function getCsrf() {
    const res = await request(app).get('/api/csrf-token');
    const cookies = res.headers['set-cookie'];
    const token = res.body.csrfToken;
    return { token, cookies };
  }

  describe('Guest Access (P0)', () => {
    it('should reject access to protected routes without a token', async () => {
      const res = await request(app).put('/api/user/settings').send({ name: 'New Name' });
      expect(res.status).toBe(403); // CSRF blocks first
      expect(res.body.code).toBe('CSRF_INVALID');
    });

    it('should reject access to protected routes with CSRF but no Auth', async () => {
      const { token, cookies } = await getCsrf();
      const res = await request(app)
        .put('/api/user/settings')
        .set('Cookie', cookies)
        .set('x-csrf-token', token)
        .send({ name: 'New Name' });
      
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Not authorized|Please log in/);
    });
  });

  describe('Token Revocation (P0)', () => {
    it('should invalidate access if the token is revoked', async () => {
      const { token: csrfToken, cookies: csrfCookies } = await getCsrf();
      const authCookie = `tb-token=${userToken}`;
      const allCookies = [...csrfCookies, authCookie];

      // 1. Verify access works initially
      const res1 = await request(app)
        .put('/api/user/settings')
        .set('Cookie', allCookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Updated Name' });
      
      expect(res1.status).toBe(200);

      // 2. Revoke the token
      await RevokedToken.create({ jti: 'test-jti', expiresAt: new Date(Date.now() + 3600000) });

      // 3. Verify access is now denied
      const res2 = await request(app)
        .put('/api/user/settings')
        .set('Cookie', allCookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Should Fail' });
      
      expect(res2.status).toBe(401);
      expect(res2.body.error).toMatch(/revoked/);
    });
  });
});
