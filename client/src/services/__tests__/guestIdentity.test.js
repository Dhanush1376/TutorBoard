/**
 * One guest identity per browser: until one is stored, requests that can create
 * a guest identity go one at a time, so parallel requests can't each be given a
 * different guest id (which hid every chat saved under the losing ids).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { acquireIdentitySlot, storeGuestToken } from '../api';

beforeEach(() => localStorage.clear());

describe('acquireIdentitySlot', () => {
  it('a second identity-creating request waits until the first has stored its guest token', async () => {
    const order = [];
    const releaseFirst = await acquireIdentitySlot('/api/sessions?page=1&limit=15');
    const second = acquireIdentitySlot('/api/chat/stream').then((release) => {
      order.push(`second sees token: ${localStorage.getItem('tb-guest-token')}`);
      release();
    });
    await Promise.resolve();
    order.push('first response');
    storeGuestToken({ 'x-guest-token': 'token-A' });
    releaseFirst();
    await second;
    expect(order).toEqual(['first response', 'second sees token: token-A']);
  });

  it('once an identity is stored, nothing waits', async () => {
    localStorage.setItem('tb-guest-token', 'token-A');
    const a = await acquireIdentitySlot('/api/chat/stream');
    const b = await acquireIdentitySlot('/api/chat/stream'); // resolves without a being released
    a(); b();
  });

  it('requests that cannot create an identity never wait', async () => {
    const hold = await acquireIdentitySlot('/api/sessions');
    await acquireIdentitySlot('/api/auth/me');
    await acquireIdentitySlot('/api/sessions/6adee2f33edaad16081d1203');
    hold();
  });

  it('reads the token from fetch Headers too', () => {
    storeGuestToken(new Headers({ 'X-Guest-Token': 'token-B' }));
    expect(localStorage.getItem('tb-guest-token')).toBe('token-B');
  });
});
