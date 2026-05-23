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
import { childLogger } from '../../core/logger.js';

const log = childLogger({ subsystem: 'stream-manager' });

export interface StreamChunk {
  type: 'chunk' | 'metadata' | 'error' | 'heartbeat' | 'status' | 'plan' | 'canvas_skeleton' | 'scene_nodes' | 'artifact' | 'message_ids';
  content?: string;
  data?: any;
  timestamp: number;
  [key: string]: any;
}

export class StreamLifecycleManager {
  private res: Response;
  private requestId: string;
  private sessionId?: string;
  private controller: AbortController;
  private isClosed: boolean = false;
  private tokenCount: number = 0;
  private heartbeatInterval?: NodeJS.Timeout;

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

    // SEC-SSE-01: Start heartbeat interval (every 15s) to prevent proxy timeouts (Render/Vercel/Nginx)
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 15000);
  }

  get signal() {
    return this.controller.signal;
  }

  /**
   * Sends a structured chunk to the client
   */
  send(chunk: Omit<StreamChunk, 'timestamp'>) {
    if (this.isClosed || !this.res.writable) return;

    const fullChunk: StreamChunk = {
      ...chunk,
      timestamp: Date.now(),
    } as StreamChunk;

    try {
      const json = JSON.stringify(fullChunk);
      const canContinue = this.res.write(`data: ${json}\n\n`);

      // Support compression middleware (e.g. compression package)
      if (typeof (this.res as any).flush === 'function') {
        (this.res as any).flush();
      }

      // DIAGNOSTIC LOGGING
      if (chunk.type === 'scene_nodes') {
        log.info(`[StreamManager:${this.requestId}] PIPELINE DIAGNOSTIC: Sending scene_nodes SSE event with ${chunk.nodes?.length} nodes.`);
      }

      // BROADCAST: Only broadcast meaningful events to Redis. 
      // Skip heartbeats to reduce unnecessary cross-instance traffic.
      if (this.sessionId && chunk.type !== 'heartbeat') {
        this.broadcast(fullChunk);
      }

      if (chunk.type === 'chunk' && chunk.content) {
        // Basic token estimation (approx 4 chars per token)
        this.tokenCount += Math.ceil(chunk.content.length / 4);
      }

      return canContinue;
    } catch (err: any) {
      log.error(`[StreamManager:${this.requestId}] Write failed: ${err.message}`);
      this.cleanup();
      return false;
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
    log.error(`Stream Error for ${this.requestId}:`, { error: err.message, stack: err.stack });
    
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
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private broadcast(chunk: StreamChunk) {
    if (!this.sessionId || !container.has('redis-service')) return;
    try {
      const service = container.resolve<any>('redis-service');
      const channel = `tutorboard:stream:${this.sessionId}`;
      service.publish(channel, JSON.stringify({ 
        event: 'teaching:stream', 
        data: chunk 
      })).catch((err: any) => log.warn(`Broadcast failed: ${err.message}`));
    } catch (err) {}
  }

  private cleanup() {
    if (this.isClosed) return;
    log.info(`Client disconnected for ${this.requestId}. Aborting work...`);
    this.controller.abort();
    this.isClosed = true;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }
}
