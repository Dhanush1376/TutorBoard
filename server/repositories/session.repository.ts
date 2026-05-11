/**
 * session.repository.ts — ChatSession Repository
 * 
 * Encapsulates all ChatSession database operations.
 * Replaces direct ChatSession.find() calls in controllers.
 */

import { BaseRepository } from './base.repository.js';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import zlib from 'zlib';
import { s3Enabled, uploadBlob, getDownloadUrl } from '../utils/core/s3.js';
import { AppError, ErrorCode } from '../shared/errors.js';
import { buildSafeUpsert } from '../utils/mongo/updateBuilder.js';

class SessionRepository extends BaseRepository<any> {
  constructor() {
    super(ChatSession);
  }

  /**
   * Find or create a session — atomic upsert
   */
  async findOrCreate(userId: string | null, sessionId: string, defaults: Record<string, unknown> = {}, includeMessages: boolean = true) {
    // If sessionId is falsy, we must create a new session. We cannot query for empty string.
    if (!sessionId) {
      const session = await this.model.create({
        userId,
        title: 'New Session',
        ...defaults
      });
      return session.toObject ? session.toObject() : session;
    }

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId);
    const query = isMongoId 
      ? (userId ? { _id: sessionId, userId } : { _id: sessionId, userId: null })
      : (userId ? { engineSessionId: sessionId, userId } : { engineSessionId: sessionId, userId: null });

    // Build $setOnInsert excluding any fields that also appear in $set
    // to prevent MongoDB "would create a conflict" errors.
    const setFields: Record<string, unknown> = { lastUpdated: new Date() };
    const insertFields: Record<string, unknown> = { 
      userId, 
      title: 'New Session',
      ...defaults 
    };
    // Remove any keys from $setOnInsert that are also in $set
    for (const key of Object.keys(setFields)) {
      delete insertFields[key];
    }

    try {
      const session = await this.model.findOneAndUpdate(
        query,
        buildSafeUpsert(setFields, insertFields),
        { upsert: true, returnDocument: 'after', runValidators: true }
      ).select('-canvasState -snapshots').lean().exec();

      if (session && includeMessages) {
        session.messages = await this.getMessages(session._id, 1, 50);
      }
      
      return session;
    } catch (err: any) {
      // If we hit a race condition (E11000 duplicate key), retry once to find the existing document
      if (err.code === 11000 && !isMongoId) {
        console.log(`[SessionRepo] Concurrent upsert detected for ${sessionId}, retrying find...`);
        const session = await this.model.findOne(query).select('-canvasState -snapshots').lean().exec();
        if (session) {
          if (includeMessages) session.messages = await this.getMessages(session._id, 1, 50);
          return session;
        }
      }
      throw err;
    }
  }

  async getByIdOrEngineId(id?: string, userId?: string, projection?: any) {
    if (!id) return null;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
    const query = isMongoId 
      ? (userId ? { _id: id, userId } : { _id: id, userId: null })
      : (userId ? { engineSessionId: id, userId } : { engineSessionId: id, userId: null });
    
    const queryBuilder = this.model.findOne(query);
    if (projection) queryBuilder.select(projection);
    const session = await queryBuilder.lean().exec();

    if (!session) return null;

    // SCALABILITY: Resolve canvas if it exists in the projection
    if (session.canvasState) {
      session.canvasState = await this.resolveSessionCanvas(session);
    }

    // SCALABILITY: Fetch messages separately if they aren't explicitly excluded
    if (session && (!projection || !projection.includes('-messages'))) {
      session.messages = await this.getMessages(session._id, 1, 50);
    }
    
    return session;
  }

  /**
   * Enterprise-Grade Canvas Resolution (S3 + Compression)
   */
  async resolveSessionCanvas(session: any) {
    if (!session.canvasState) return [];

    // 1. Handle S3 Offloading
    if (session.canvasState.offloaded && session.canvasState.s3Key) {
      try {
        const url = await getDownloadUrl(session.canvasState.s3Key);
        const response = await fetch(url!);
        if (!response.ok) throw new Error(`S3 fetch failed: ${response.statusText}`);
        return await response.json();
      } catch (err) {
        console.error(`[SessionRepo] S3 resolution failed for ${session._id}:`, (err as Error).message);
        return [];
      }
    }

    // 2. Handle MongoDB Compression (Buffer)
    if (Buffer.isBuffer(session.canvasState)) {
      try {
        const decompressed = zlib.gunzipSync(session.canvasState).toString();
        return JSON.parse(decompressed);
      } catch (err) {
        console.error(`[SessionRepo] Decompression failed for ${session._id}:`, (err as Error).message);
        return [];
      }
    }

    return Array.isArray(session.canvasState) ? session.canvasState : [];
  }

  /**
   * Get messages for a session with pagination
   */
  async getMessages(sessionId: string, page = 1, limit = 50) {
    return ChatMessage.find({ sessionId })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .then(msgs => msgs.reverse()); // Return in chronological order
  }

  /**
   * Get a slim version of the session for quick updates (excludes large fields)
   */
  async getSlimSession(id: string, userId?: string) {
    return this.getByIdOrEngineId(id, userId, '-canvasState -snapshots -requestLedger');
  }

  /**
   * Atomic message creation in separate collection
   */
  async addMessage(sessionId: string, message: any) {
    const msg = await ChatMessage.create({
      ...message,
      sessionId,
      timestamp: new Date()
    });
    
    // Update session heartbeat
    await this.model.findByIdAndUpdate(sessionId, { 
      $set: { lastUpdated: new Date() } 
    });

    return msg._id.toString();
  }

  /**
   * Prepares the canvas state (handles compression/offloading) without executing the update.
   * Useful for combining canvas updates with other session changes in a single atomic operation.
   */
  async prepareCanvasUpdate(sessionId: string, canvasState: any[]) {
    let finalState = canvasState;
    const raw = JSON.stringify(canvasState);

    // INFRA-15: Manual offloading/compression since we bypass hooks in findOneAndUpdate
    if (s3Enabled && raw.length > 102400) {
      const key = `canvas/${sessionId}/${Date.now()}.json`;
      try {
        await uploadBlob(key, raw);
        finalState = { s3Key: key, length: raw.length, offloaded: true } as any;
      } catch (err) {
        console.error('[SessionRepo] S3 offload failed:', err);
      }
    } else if (raw.length > 51200) {
      try {
        finalState = zlib.gzipSync(raw) as any;
      } catch (err) {
        console.error('[SessionRepo] Compression failed:', err);
      }
    }
    return finalState;
  }

  /**
   * Atomic canvas update with compression/offloading and optimistic locking
   */
  async updateCanvasState(sessionId: string, canvasState: any[], steps?: any[]) {
    const finalState = await this.prepareCanvasUpdate(sessionId, canvasState);

    const update: any = { 
      $set: { 
        canvasState: finalState,
        lastUpdated: new Date()
      },
      $inc: { docVersion: 1 }
    };
    if (steps) update.$set.canvasSteps = steps;

    return this.model.findByIdAndUpdate(sessionId, update, { returnDocument: 'after' }).lean().exec();
  }

  /**
   * Get user's sessions (paginated, recent first)
   */
  async getUserSessions(userId: string, page = 1, limit = 20) {
    // SEC-PERF: Only load necessary fields for the dashboard list view
    return this.model.find({ userId, isDeleted: { $ne: true } })
      .select('title currentTopic topic explanationMode lastUpdated updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();
  }

  /**
   * Map pushMessage to addMessage
   */
  async pushMessage(sessionId: string, message: Record<string, unknown>) {
    return this.addMessage(sessionId, message);
  }

  /**
   * Get session with legacy cap - now mostly a pass-through
   */
  async getSessionWithMessageCap(sessionId: string, maxMessages = 200) {
    return this.getByIdOrEngineId(sessionId);
  }

  /**
   * Soft delete session
   */
  async softDelete(sessionId: string, userId: string) {
    return this.updateOne(
      { _id: sessionId, userId },
      { isDeleted: true, deletedAt: new Date() }
    );
  }

  /**
   * Update session title
   */
  async updateTitle(sessionId: string, title: string) {
    return this.updateById(sessionId, { title });
  }
}

export default new SessionRepository();
