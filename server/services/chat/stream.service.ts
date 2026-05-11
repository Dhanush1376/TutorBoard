/**
 * stream.service.ts — Production-Safe Streaming Engine
 * 
 * Manages the lifecycle of an AI response stream, ensuring SSE compliance,
 * mid-stream error recovery, and proper resource disposal.
 */

import { Response } from 'express';
import { AppError, ErrorCode } from '../../shared/errors.js';
import { container } from '../../core/container.js';
import { captureException } from '../../utils/core/monitoring.js';

export interface StreamChunk {
  type: 'chunk' | 'metadata' | 'error' | 'heartbeat' | 'status';
  content?: string;
  data?: any;
  timestamp: number;
}

export class StreamLifecycleManager {
  private res: Response;
  private requestId: string;
  private sessionId?: string;
  private controller: AbortController;
  private isClosed: boolean = false;
  private tokenCount: number = 0;

  constructor(res: Response, requestId: string, sessionId?: string) {
    this.res = res;
    this.requestId = requestId;
    this.sessionId = sessionId;
    this.controller = new AbortController();

    // Initialize SSE Headers
    this.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering on Nginx
    });

    // Handle client disconnect
    this.res.on('close', () => {
      this.cleanup();
    });
  }

  get signal() {
    return this.controller.signal;
  }

  /**
   * Sends a structured chunk to the client
   */
  send(chunk: Omit<StreamChunk, 'timestamp'>) {
    if (this.isClosed) return;

    const fullChunk: StreamChunk = {
      ...chunk,
      timestamp: Date.now(),
    };

    this.res.write(`data: ${JSON.stringify(fullChunk)}\n\n`);
    
    if (this.sessionId) {
      this.broadcast(fullChunk);
    }

    if (chunk.type === 'chunk' && chunk.content) {
      // Basic token estimation (approx 4 chars per token)
      this.tokenCount += Math.ceil(chunk.content.length / 4);
    }
  }

  /**
   * Sends a heartbeat to keep the connection alive
   */
  heartbeat() {
    this.send({ type: 'heartbeat' });
  }

  /**
   * Signals an error mid-stream and closes gracefully
   */
  error(err: any) {
    console.error(`[StreamManager:${this.requestId}] Stream Error:`, err);
    
    const errorChunk: StreamChunk = {
      type: 'error',
      content: err.message || 'An unexpected error occurred during generation.',
      data: { code: err.code || ErrorCode.INTERNAL_ERROR },
      timestamp: Date.now(),
    };

    this.send(errorChunk);
    captureException(err, { requestId: this.requestId, sessionId: this.sessionId });
    this.close();
  }

  /**
   * Finalizes the stream
   */
  close(metadata?: any) {
    if (this.isClosed) return;

    if (metadata) {
      this.send({ type: 'metadata', data: { ...metadata, estimatedTokens: this.tokenCount } });
    }

    this.res.write('event: end\ndata: {}\n\n');
    this.res.end();
    this.isClosed = true;
  }

  private broadcast(chunk: StreamChunk) {
    if (!this.sessionId || !container.has('redis-service')) return;
    try {
      const service = container.resolve<any>('redis-service');
      const channel = `tutorboard:stream:${this.sessionId}`;
      service.publish(channel, JSON.stringify({ 
        event: 'teaching:stream', 
        data: chunk 
      })).catch((err: any) => console.warn(`[StreamManager] Broadcast failed: ${err.message}`));
    } catch (err) {}
  }

  private cleanup() {
    if (this.isClosed) return;
    console.log(`[StreamManager:${this.requestId}] Client disconnected. Aborting work...`);
    this.controller.abort();
    this.isClosed = true;
  }
}
