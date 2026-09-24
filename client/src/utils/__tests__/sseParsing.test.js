import { describe, it, expect, vi } from 'vitest';
import { processSSEStream } from '../sseStreamParser';

// Helper to create a fake ReadableStream reader
function createFakeReader(chunks) {
  let currentIndex = 0;
  return {
    read: async () => {
      if (currentIndex >= chunks.length) {
        return { done: true, value: undefined };
      }
      // Encode string chunks to Uint8Array for the TextDecoder
      const encoder = new TextEncoder();
      const value = typeof chunks[currentIndex] === 'string' 
        ? encoder.encode(chunks[currentIndex])
        : chunks[currentIndex]; // Allow passing Uint8Arrays directly
        
      currentIndex++;
      return { done: false, value };
    }
  };
}

describe('processSSEStream (Shared Processor)', () => {
  it('should parse a complete JSON event in a single chunk', async () => {
    const onEvent = vi.fn();
    const reader = createFakeReader([`event: message\ndata: {"content": "Hello"}\n\n`]);
    
    await processSSEStream(reader, onEvent);
    
    expect(onEvent).toHaveBeenCalledWith('message', { content: 'Hello' }, `{"content": "Hello"}`, false);
  });

  it('should accumulate partial JSON across multiple chunks', async () => {
    const onEvent = vi.fn();
    const reader = createFakeReader([
      `event: message\ndata: {"content": `,
      `"Split message"}\n\n`
    ]);
    
    await processSSEStream(reader, onEvent);
    
    expect(onEvent).toHaveBeenCalledWith('message', { content: 'Split message' }, `{"content": "Split message"}`, false);
  });

  it('should handle heartbeats properly', async () => {
    const onEvent = vi.fn();
    const reader = createFakeReader([`event: heartbeat\ndata: {"type": "heartbeat", "timestamp": 12345}\n\n`]);
    
    await processSSEStream(reader, onEvent);
    
    expect(onEvent).toHaveBeenCalledWith('heartbeat', { type: 'heartbeat', timestamp: 12345 }, `{"type": "heartbeat", "timestamp": 12345}`, false);
  });

  it('should handle multiple events in one chunk', async () => {
    const onEvent = vi.fn();
    const reader = createFakeReader([
      `event: message\ndata: {"content": "First"}\n\nevent: message\ndata: {"content": "Second"}\n\n`
    ]);
    
    await processSSEStream(reader, onEvent);
    
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(1, 'message', { content: 'First' }, `{"content": "First"}`, false);
    expect(onEvent).toHaveBeenNthCalledWith(2, 'message', { content: 'Second' }, `{"content": "Second"}`, false);
  });

  it('should reset accumulator on empty line correctly', async () => {
    const onEvent = vi.fn();
    const reader = createFakeReader([
      `event: meta\ndata: {"partial": `,
      `\n\ndata: {"new": "valid"}\n\n`
    ]);
    
    await processSSEStream(reader, onEvent);
    
    expect(onEvent).toHaveBeenCalledWith('meta', { new: 'valid' }, `{"new": "valid"}`, false);
  });

  it('should fallback to raw string flag when JSON parsing fails but no explicit error is thrown', async () => {
    const onEvent = vi.fn();
    const reader = createFakeReader([`event: message\ndata: Just a raw string\n\n`]);
    
    await processSSEStream(reader, onEvent);
    
    expect(onEvent).toHaveBeenCalledWith('message', 'Just a raw string', 'Just a raw string', true);
  });

  it('should preserve caller errors (like AbortError) thrown inside onEvent', async () => {
    const onEvent = vi.fn().mockImplementation(() => {
      const err = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    });
    
    const reader = createFakeReader([`event: message\ndata: {"content": "Hello"}\n\n`]);
    
    await expect(processSSEStream(reader, onEvent)).rejects.toThrowError('AbortError');
  });

  it('should properly handle multibyte UTF-8 characters split across chunks', async () => {
    const onEvent = vi.fn();
    
    // An emoji (e.g. 🌎 U+1F30E) is 4 bytes: F0 9F 8C 8E
    const emojiBytes = new Uint8Array([0xF0, 0x9F, 0x8C, 0x8E]);
    const eventHeader = new TextEncoder().encode(`event: message\ndata: {"content": "`);
    const eventFooter = new TextEncoder().encode(`"}\n\n`);

    // Chunk 1: Header + first 2 bytes of the emoji
    const chunk1 = new Uint8Array(eventHeader.length + 2);
    chunk1.set(eventHeader);
    chunk1.set(emojiBytes.slice(0, 2), eventHeader.length);

    // Chunk 2: remaining 2 bytes + footer
    const chunk2 = new Uint8Array(2 + eventFooter.length);
    chunk2.set(emojiBytes.slice(2, 4));
    chunk2.set(eventFooter, 2);

    const reader = createFakeReader([chunk1, chunk2]);
    
    await processSSEStream(reader, onEvent);
    
    // The TextDecoder with { stream: true } should properly reassemble the emoji
    expect(onEvent).toHaveBeenCalledWith('message', { content: '🌎' }, `{"content": "🌎"}`, false);
  });
});
