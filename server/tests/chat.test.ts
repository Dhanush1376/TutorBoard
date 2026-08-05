import { describe, it, expect, beforeEach } from 'vitest';
import ChatSession from '../models/ChatSession.js';
import mongoose from 'mongoose';

describe('ChatSession Model (P1)', () => {


  it('should enforce canvas state size limit', async () => {
    const largeState = Array.from({ length: 1000 }, () => ({
      type: 'rect',
      data: 'A'.repeat(1000) // ~1MB total
    }));

    const session = new ChatSession({
      canvasState: largeState,
      title: 'Canvas Bloat Test'
    });

    // This should fail validation
    await expect(session.save()).rejects.toThrow(/exceeds 500KB/);
  });
});
