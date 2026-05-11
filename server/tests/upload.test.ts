import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock S3
vi.mock('../utils/core/s3.js', () => ({
  s3: { send: vi.fn() },
  s3Enabled: false,
  S3_BUCKET: 'test-bucket'
}));

describe('File Upload Security (P0)', () => {
  let userToken: string;
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

  beforeEach(async () => {
    const user = await User.create({
      email: `upload-test-${Date.now()}@example.com`,
      password: 'password123',
      name: 'Uploader',
    });
    userToken = jwt.sign({ id: user._id.toString(), jti: 'test-jti-upload' }, JWT_SECRET);
  });

  async function getCsrf() {
    const res = await request(app).get('/api/csrf-token');
    const cookies = res.headers['set-cookie'];
    const token = res.body.csrfToken;
    return { token, cookies };
  }

  it('should reject a file with spoofed MIME type (exe renamed to jpg)', async () => {
    const { token, cookies } = await getCsrf();
    
    // Create a fake "malicious" buffer (starts with MZ - Windows executable)
    const maliciousBuffer = Buffer.from('MZ' + 'A'.repeat(100));
    
    const res = await request(app)
      .post('/api/upload')
      .set('Cookie', [...cookies, `tb-token=${userToken}`])
      .set('x-csrf-token', token)
      .attach('file', maliciousBuffer, 'malware.jpg');
    
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Security Alert/);
  });

  it('should allow a valid image file', async () => {
    const { token, cookies } = await getCsrf();
    
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...new Array(10).fill(0)]);
    
    const res = await request(app)
      .post('/api/upload')
      .set('Cookie', [...cookies, `tb-token=${userToken}`])
      .set('x-csrf-token', token)
      .attach('file', validPngBuffer, 'valid.png');
    
    // Note: This might fail if the controller tries to actually move the file or if S3 is mocked incorrectly.
    // But we are testing the middleware validator.
    expect(res.status).not.toBe(400);
  });
});
