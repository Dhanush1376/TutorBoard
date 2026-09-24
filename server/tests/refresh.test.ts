import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../index.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import tokenStore from '../utils/auth/tokenStore.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

describe('Auth Token Refresh Endpoint', () => {
  let testUser: any;
  let validRefreshToken: string;
  let validRefreshJti: string;

  beforeAll(async () => {
    // Generate valid tokens
    testUser = await User.create({
      name: 'Refresh Test User',
      email: 'refresh@test.com',
      password: await bcrypt.hash('password123', 10),
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  beforeEach(() => {
    validRefreshJti = crypto.randomUUID();
    validRefreshToken = jwt.sign(
      { id: testUser._id.toString(), jti: validRefreshJti, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || 'test-secret',
      { expiresIn: '30d' }
    );
  });

  it('should issue new access and refresh tokens when provided a valid refresh token', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`tb-refresh-token=${validRefreshToken}`]);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const cookies = response.headers['set-cookie'] || [];
    const hasAccessToken = cookies.some((c: string) => c.startsWith('tb-access-token='));
    const hasNewRefreshToken = cookies.some((c: string) => c.startsWith('tb-refresh-token='));

    expect(hasAccessToken).toBe(true);
    expect(hasNewRefreshToken).toBe(true);
  });

  it('should reject requests with missing refresh token', async () => {
    const response = await request(app)
      .post('/api/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Refresh token missing');
  });

  it('should reject requests with an invalid token signature', async () => {
    const invalidToken = jwt.sign(
      { id: testUser._id.toString(), type: 'refresh' },
      'wrong-secret'
    );

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`tb-refresh-token=${invalidToken}`]);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid refresh token');
  });

  it('should reject requests with an access token (wrong type)', async () => {
    const accessToken = jwt.sign(
      { id: testUser._id.toString(), type: 'access' },
      process.env.JWT_REFRESH_SECRET || 'test-secret'
    );

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`tb-refresh-token=${accessToken}`]);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid token type');
  });

  it('should reject requests if the refresh token has been revoked', async () => {
    // Revoke the token
    await tokenStore.revokeToken(validRefreshJti, Math.floor(Date.now() / 1000) + 3600);

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`tb-refresh-token=${validRefreshToken}`]);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Refresh token revoked');
  });
});
