import { describe, it, expect, beforeEach } from 'vitest';
import ChatSession from '../models/ChatSession.js';
import mongoose from 'mongoose';

describe('ChatSession Model (P1)', () => {
  it('should cap the number of messages at 200', async () => {
    // 1. Create a session with 205 messages
    const messages = Array.from({ length: 205 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
      timestamp: new Date()
    }));

    const session = new ChatSession({
      messages,
      title: 'Bloat Test'
    });

    // 2. Save the session
    await session.save();

    // 3. Verify it was capped at 200
    const savedSession = await ChatSession.findById(session._id);
    if (!savedSession) throw new Error('Session not found');
    expect(savedSession.messages.length).toBe(200);
    
    // 4. Verify it kept the MOST RECENT messages (Message 5 to Message 204)
    expect(savedSession.messages[0].content).toBe('Message 5');
    expect(savedSession.messages[199].content).toBe('Message 204');
  });

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
