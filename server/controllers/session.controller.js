import mongoose from 'mongoose';
import crypto from 'crypto';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import Artifact from '../models/Artifact.js';
import CodeVisualization from '../models/CodeVisualization.js';
import SessionLedger from '../models/SessionLedger.js';
import ActivityLog from '../models/ActivityLog.js';
import sessionRepository from '../repositories/session.repository.js';
import { issueGuestIdentity, extractGuestToken, verifyGuestToken } from '../utils/auth/guestToken.js';

/**
 * Compound cursor pagination builder for ChatMessage.
 * Order: { timestamp: -1, _id: -1 } (newest first).
 * Cursor: <timestamp>_<id> representing the oldest message on the current page.
 * Filter for strictly older messages:
 *   { $or: [{ timestamp: { $lt: cursorDate } }, { timestamp: cursorDate, _id: { $lt: cursorId } }] }
 */
export function buildCompoundPaginationQuery(sessionId, query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
  const before = query.before;
  const beforeId = query.beforeId;

  const msgQuery = { sessionId };

  let cursorDate = null;
  let cursorId = null;

  if (before && typeof before === 'string') {
    if (before.includes('_')) {
      const parts = before.split('_');
      const d = new Date(isNaN(Number(parts[0])) ? parts[0] : Number(parts[0]));
      if (!isNaN(d.getTime())) cursorDate = d;
      if (parts[1] && mongoose.isValidObjectId(parts[1])) {
        cursorId = new mongoose.Types.ObjectId(parts[1]);
      }
    } else {
      const d = new Date(isNaN(Number(before)) ? before : Number(before));
      if (!isNaN(d.getTime())) cursorDate = d;
    }
  }

  if (beforeId && mongoose.isValidObjectId(beforeId)) {
    cursorId = new mongoose.Types.ObjectId(beforeId);
  }

  if (cursorDate && cursorId) {
    msgQuery.$or = [
      { timestamp: { $lt: cursorDate } },
      { timestamp: cursorDate, _id: { $lt: cursorId } }
    ];
  } else if (cursorDate) {
    msgQuery.timestamp = { $lt: cursorDate };
  } else if (cursorId) {
    msgQuery._id = { $lt: cursorId };
  }

  return { msgQuery, limit };
}

// Schema for request body validation — PERMISSIVE for client payloads
// The client sends messages with `id`, `role`, `content` and other metadata.
// canvasSteps, canvasVersion, and token (for beacon) must all be accepted.
const saveSessionSchema = z.object({
  sessionId: z.string().optional().nullable(),
  // A long first question can become the title: clip it instead of rejecting the whole save
  title: z.string().optional().transform((t) => (t === undefined ? t : t.trim().slice(0, 200))),
  canvasState: z.array(z.any()).max(500).optional(),
  canvasSteps: z.array(z.any()).max(100).optional(),
  canvasVersion: z.number().optional(),
  preferences: z.record(z.any()).optional(),
  activeSnapshotId: z.string().optional().nullable(),
  token: z.string().optional(), // Beacon requests include token in body
}).passthrough(); // Allow extra fields we don't know about yet

/**
 * Helper: Log UX activity to MongoDB
 */
export const logActivity = async ({ userId, sessionId, eventType, eventData, metadata }) => {
  try {
    await ActivityLog.create({
      userId,
      sessionId,
      eventType,
      eventData,
      metadata
    });
  } catch (err) {
    console.error('[ActivityLog] Failed to log event:', err.message);
  }
};

/**
 * GET /api/sessions
 * Get all sessions for the current user
 */
export const getSessions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const isUser = Boolean(req.user?._id || req.user?.id);
    const userId = req.user?._id || req.user?.id;
    const guestId = req.guestId;

    if (!isUser && !guestId) {
      return res.json({
        sessions: [],
        pagination: { total: 0, page, pages: 0, hasMore: false }
      });
    }

    const query = isUser 
      ? { userId: req.user._id, isDeleted: { $ne: true } } 
      : { guestId, userId: null, isDeleted: { $ne: true } };

    const matchQuery = isUser
      ? { ...query, userId: new mongoose.Types.ObjectId(String(userId)) }
      : { ...query };
    
    // One round trip: each conversation with its 50 most recent messages
    // (ChatMessage is the source of truth). Previously this ran one extra query
    // per conversation. The client hides conversations without a user message.
    const [sessionsWithMessages, total] = await Promise.all([
      ChatSession.aggregate([
        { $match: matchQuery },
        { $sort: { lastUpdated: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { messages: 0, canvasArchive: 0, snapshots: 0 } },
        {
          $lookup: {
            from: ChatMessage.collection.name,
            let: { sid: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$sessionId', '$$sid'] } } },
              { $sort: { timestamp: -1, _id: -1 } },
              { $limit: 50 },
            ],
            as: 'messages',
          },
        },
      ]).then((rows) => rows.map((s) => ({ ...s, messages: s.messages.reverse() }))),
      ChatSession.countDocuments(query)
    ]);

    res.json({
      sessions: sessionsWithMessages,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        hasMore: skip + sessionsWithMessages.length < total
      }
    });
  } catch (err) {
    console.error('[Session] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

/**
 * GET /api/sessions/:id
 * Get a specific session
 */
export const getSession = async (req, res) => {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id || '')) return res.status(404).json({ error: 'Session not found' });
    
    const isUser = Boolean(req.user?._id || req.user?.id);
    const userId = req.user?._id || req.user?.id;
    const guestId = req.guestId;

    if (!isUser && !guestId) {
      return res.status(401).json({ error: 'Authentication or guest identity required', code: 'UNAUTHORIZED' });
    }

    const query = isUser 
      ? { _id: req.params.id, userId: req.user._id, isDeleted: { $ne: true } }
      : { _id: req.params.id, guestId, userId: null, isDeleted: { $ne: true } };

    let session = await ChatSession.findOne(query);

    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    // SEC-STORAGE: Resolve offloaded canvas state for the client
    const sessionObj = session.toObject();
    sessionObj.canvasState = await session.resolveCanvasState();
    
    // CRITICAL FIX: Fetch messages from the ChatMessage collection (source of truth)
    // Support stable compound pagination: newest messages first up to limit, returned in chronological order.
    try {
      const { msgQuery, limit } = buildCompoundPaginationQuery(session._id, req.query);

      // Fetch latest messages up to limit
      const rawMessages = await ChatMessage.find(msgQuery)
        .sort({ timestamp: -1, _id: -1 })
        .limit(limit)
        .lean();
      
      const oldestMsg = rawMessages[rawMessages.length - 1];
      const nextCursor = (rawMessages.length === limit && oldestMsg)
        ? `${new Date(oldestMsg.timestamp).toISOString()}_${oldestMsg._id}`
        : null;

      // Reverse so client receives chronological order (oldest to newest)
      const chatMessages = rawMessages.reverse();

      if (chatMessages.length > 0) {
        sessionObj.messages = chatMessages.map(m => ({
          ...m,
          id: m._id?.toString() || m.id,
          metadata: m.metadata ? {
            ...m.metadata,
            versions: Array.isArray(m.metadata.versions) ? m.metadata.versions.map(v => ({
              ...v,
              text: v.text || v.content || ''
            })) : undefined
          } : undefined
        }));
      }

      sessionObj.pagination = {
        hasMore: rawMessages.length === limit,
        nextCursor,
        oldestTimestamp: chatMessages[0]?.timestamp || null,
        newestTimestamp: chatMessages[chatMessages.length - 1]?.timestamp || null,
        count: chatMessages.length,
        limit
      };
    } catch (msgErr) {
      console.warn('[Session] Failed to fetch ChatMessage history:', msgErr.message);
    }
    
    // Fetch persisted artifacts associated with this session
    try {
      const artifacts = await Artifact.find({ sessionId: session._id, isDeleted: false })
        .sort({ createdAt: 1 })
        .lean();
      sessionObj.artifacts = artifacts.map(a => ({
        ...a,
        id: a._id?.toString() || a.id
      }));
    } catch (artErr) {
      console.warn('[Session] Failed to fetch Artifact history:', artErr.message);
    }

    // Ensure session canvas snapshot and steps reflect the latest visual artifact if session level is empty
    if ((!sessionObj.canvasSteps || sessionObj.canvasSteps.length === 0) && Array.isArray(sessionObj.messages)) {
      for (let i = sessionObj.messages.length - 1; i >= 0; i--) {
        const m = sessionObj.messages[i];
        if (m.role === 'assistant' && (m.canvasSnapshot || m.metadata?.visuals || m.hasCanvas)) {
          const snapshot = m.canvasSnapshot || m.metadata?.visuals;
          if (snapshot) {
            sessionObj.canvasSnapshot = snapshot;
            sessionObj.canvasSteps = snapshot.canvasSteps || snapshot.steps || [];
            break;
          }
        }
      }
    }

    // An answer still being generated (e.g. the learner refreshed mid-answer):
    // the client keeps its "thinking" state and reloads once it has been saved.
    try {
      const pending = await SessionLedger.findOne({
        sessionId: session._id,
        status: { $in: ['requesting', 'streaming'] },
        updatedAt: { $gt: new Date(Date.now() - 3 * 60 * 1000) },
      }).sort({ updatedAt: -1 }).lean();
      sessionObj.pendingRequest = pending ? { requestId: pending.requestId, status: pending.status } : null;
    } catch {
      sessionObj.pendingRequest = null;
    }

    res.json(sessionObj);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};

/**
 * POST /api/sessions/:id/claim-legacy
 * Safe proof-of-possession legacy session adoption.
 * Rejects guessing, enumeration, and unauthorized transfer.
 */
export const claimLegacySession = async (req, res) => {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id || '')) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isUser = Boolean(req.user?._id || req.user?.id);
    const guestId = req.guestId;

    if (isUser) {
      return res.status(403).json({
        error: 'Registered-user accounts cannot adopt sessions via guest claim',
        code: 'REGISTERED_USER_CLAIM_DENIED'
      });
    }

    if (!guestId) {
      return res.status(401).json({
        error: 'Verified guest identity required to claim legacy session',
        code: 'UNAUTHORIZED'
      });
    }

    const session = await ChatSession.findById(req.params.id);
    if (!session || session.isDeleted) {
      return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    // Registered-user sessions cannot be claimed as guest sessions
    if (session.userId) {
      return res.status(403).json({
        error: 'Registered-user sessions cannot be adopted as guest sessions',
        code: 'CANNOT_ADOPT_USER_SESSION'
      });
    }

    // Already owned by a guest
    if (session.guestId) {
      if (session.guestId === guestId) {
        return res.json({ message: 'Session already owned by caller', session });
      }
      return res.status(409).json({
        error: 'Session has already been claimed by another guest',
        code: 'ALREADY_CLAIMED'
      });
    }

    // Proof of Possession Verification:
    // A guest cannot claim an unowned session simply by knowing its ID or requesting it first.
    // The claimant must provide:
    // 1. A valid legacyRecoveryToken matching the session's stored token, OR
    // 2. The exact content of the initial user message in that session (from local client storage), OR
    // 3. A client session fingerprint (title + first user message)
    const proof = req.body?.proof || {};
    let isProofValid = false;

    if (proof.recoveryToken && session.legacyRecoveryToken && proof.recoveryToken === session.legacyRecoveryToken) {
      isProofValid = true;
    }

    if (!isProofValid && (proof.firstMessage || proof.initialPrompt)) {
      const targetText = (proof.firstMessage || proof.initialPrompt || '').trim();
      if (targetText.length > 0) {
        const firstMsg = await ChatMessage.findOne({ sessionId: session._id, role: 'user' })
          .sort({ timestamp: 1, _id: 1 })
          .lean();
        if (firstMsg && firstMsg.content && firstMsg.content.trim().toLowerCase() === targetText.toLowerCase()) {
          isProofValid = true;
        }
      }
    }

    if (!isProofValid && proof.sessionFingerprint && typeof proof.sessionFingerprint === 'string') {
      const expectedFingerprint = crypto.createHash('sha256').update(`${session._id}_${session.title}`).digest('hex');
      if (proof.sessionFingerprint === expectedFingerprint) {
        isProofValid = true;
      }
    }

    if (!isProofValid) {
      return res.status(403).json({
        error: 'Proof of possession required to claim legacy session. Safe recovery denied.',
        code: 'PROOF_OF_POSSESSION_FAILED'
      });
    }

    // Atomic CAS to prevent concurrent adoption attempts from transferring ownership twice
    const adopted = await ChatSession.findOneAndUpdate(
      {
        _id: session._id,
        userId: null,
        $or: [{ guestId: null }, { guestId: { $exists: false } }],
        isDeleted: { $ne: true }
      },
      {
        $set: { guestId, lastUpdated: new Date() },
        $inc: { docVersion: 1 }
      },
      { returnDocument: 'after' }
    );

    if (!adopted) {
      return res.status(409).json({
        error: 'Concurrent adoption detected — session was already claimed',
        code: 'ADOPTION_CONFLICT'
      });
    }

    // Cascade update child records to the adopting guest
    await Promise.all([
      ChatMessage.updateMany(
        { sessionId: adopted._id, userId: null, $or: [{ guestId: null }, { guestId: { $exists: false } }] },
        { guestId }
      ),
      Artifact.updateMany(
        { sessionId: adopted._id.toString(), userId: null, $or: [{ guestId: null }, { guestId: { $exists: false } }] },
        { guestId }
      )
    ]);

    return res.json({
      message: 'Legacy session successfully adopted',
      session: adopted
    });
  } catch (err) {
    console.error('[Session:ClaimLegacy] Error:', err.message);
    return res.status(500).json({ error: 'Failed to claim legacy session' });
  }
};

/**
 * POST /api/sessions
 * Create or Update a session with optimistic locking for conflict detection
 */
export const saveSession = async (req, res) => {
  try {
    const validation = saveSessionSchema.safeParse(req.body);
    if (!validation.success) {
      console.error('[Session] Validation failed:', JSON.stringify(validation.error.format(), null, 2));
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validation.error.format() 
      });
    }

    const { 
      sessionId, title, messages, canvasState, canvasSteps, 
      canvasVersion, preferences, activeSnapshotId, annotations
    } = validation.data;
    
    const isUser = Boolean(req.user?._id || req.user?.id);
    const userId = req.user?._id || req.user?.id;
    let guestId = req.guestId;

    if (!isUser && !guestId) {
      if (!sessionId) {
        const issued = issueGuestIdentity(res);
        guestId = issued.guestId;
        req.guestId = guestId;
      } else {
        return res.status(401).json({ error: 'Authentication or guest identity required', code: 'UNAUTHORIZED' });
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DB] Save Request: User=${isUser ? userId : 'GUEST:' + guestId}, Session=${sessionId || 'NEW'}`);
    }

    let session;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId || '');

    if (!sessionId) {
      // Create new session
      session = await ChatSession.create({
        userId: isUser ? userId : null,
        guestId: isUser ? null : guestId,
        title: title || 'New Session',
        canvasState: canvasState || [],
        canvasSteps: canvasSteps || [],
        canvasVersion: canvasVersion || 0,
        preferences: preferences || {},
        annotations: annotations || { strokes: [], shapes: [], notes: [], highlights: [] },
        docVersion: 0,
      });
      console.log(`[DB] 🌟 Created new session: ${session._id}`);
    } else {
      // Update existing session with optimistic locking
      const query = isMongoId 
        ? (isUser ? { _id: sessionId, userId: userId.toString() } : { _id: sessionId, guestId, userId: null })
        : (isUser ? { engineSessionId: sessionId, userId: userId.toString() } : { engineSessionId: sessionId, guestId, userId: null });

      // Atomic Update Payload
      const setFields = { lastUpdated: new Date() };
      const incFields = { docVersion: 1 };
      
      if (title !== undefined) setFields.title = title;
      if (canvasVersion !== undefined) setFields.canvasVersion = canvasVersion;
      if (preferences !== undefined) setFields.preferences = preferences;
      if (annotations !== undefined) setFields.annotations = annotations;
      
      // Use repository for canvas processing (handles compression/S3)
      if (canvasState !== undefined) {
        setFields.canvasState = await sessionRepository.prepareCanvasUpdate(sessionId, canvasState);
        if (canvasSteps) setFields.canvasSteps = canvasSteps;
      }

      const updatePayload = { 
        $set: setFields, 
        $inc: incFields,
        ...(!isMongoId ? { $setOnInsert: { engineSessionId: sessionId, userId: isUser ? userId : null, guestId: isUser ? null : guestId } } : {})
      };

      try {
        session = await ChatSession.findOneAndUpdate(
          query,
          updatePayload,
          { 
            returnDocument: 'after', 
            // Only a client conversation key may create a session; an ObjectId
            // must already exist and belong to the caller.
            upsert: !isMongoId, 
            runValidators: true,
          }
        );
      } catch (err) {
        if (err.code === 11000 && !isMongoId) {
          console.log(`[SessionController] Concurrent upsert detected for ${sessionId}, retrying find...`);
          session = await ChatSession.findOne(query);
        } else {
          throw err;
        }
      }

      if (session) {
        console.log(`[DB] ✅ Atomic update complete for session: ${session._id} (version: ${session.docVersion})`);
      } else {
        console.warn(`[DB] ⚠️  Session not found for update: ${sessionId}`);
        return res.status(404).json({ error: 'Session not found or update failed' });
      }

    }

    if (!session) return res.status(404).json({ error: 'Session not found or update failed' });

    // SEC-STORAGE: Resolve offloaded canvas state for the client
    const sessionObj = session.toObject();
    sessionObj.canvasState = await session.resolveCanvasState();
    
    // CRITICAL FIX: Return messages from ChatMessage collection (source of truth)
    try {
      const chatMessages = await ChatMessage.find({ sessionId: session._id })
        .sort({ timestamp: 1, _id: 1 })
        .limit(200)
        .lean();
      if (chatMessages.length > 0) {
        sessionObj.messages = chatMessages.map(m => ({
          ...m,
          id: m._id?.toString() || m.id,
          metadata: m.metadata ? {
            ...m.metadata,
            versions: Array.isArray(m.metadata.versions) ? m.metadata.versions.map(v => ({
              ...v,
              text: v.text || v.content || ''
            })) : undefined
          } : undefined
        }));
      }
    } catch (msgErr) {
      console.warn('[Session:Save] Failed to fetch ChatMessage history:', msgErr.message);
    }
    
    res.json(sessionObj);
  } catch (err) {
    console.error('[Session] Save error:', err.message);
    res.status(500).json({ error: 'Failed to save session' });
  }
};

/**
 * POST /api/sessions/beacon
 * Emergency flush via Beacon API (no auth header — token is in body)
 * Includes optimistic locking to detect concurrent updates
 */
export const beaconSave = async (req, res) => {
  try {
    const { sessionId, ...data } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId);
    if (!isMongoId) {
      return res.status(400).json({ error: 'Invalid session ID for beacon' });
    }

    // AUTH: Check cookies, body token (beacon payload), or Authorization header
    let userId = null;
    let guestId = req.guestId || null;
    let token = req.cookies?.['tb-access-token'] || req.cookies?.['tb-token'] || req.body?.token;
    if (!token && req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token && token !== 'guest' && token !== 'verified') {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (decoded?.type === 'guest') {
          guestId = decoded.guestId;
        } else if (decoded?.id) {
          userId = decoded.id;
        }
      } catch (e) {
        // invalid token
      }
    }

    // Also check guest token from cookies or header if userId is not resolved
    if (!userId && !guestId) {
      const gToken = extractGuestToken(req);
      if (gToken) {
        guestId = await verifyGuestToken(gToken);
      }
    }

    if (!userId && !guestId) {
      return res.status(401).json({ error: 'Authentication or guest identity required' });
    }

    const updateFields = { lastUpdated: Date.now() };
    if (data.title !== undefined) updateFields.title = data.title;
    if (data.canvasState !== undefined) updateFields.canvasState = data.canvasState;
    if (data.canvasSteps !== undefined) updateFields.canvasSteps = data.canvasSteps;
    if (data.canvasVersion !== undefined) updateFields.canvasVersion = data.canvasVersion;
    if (data.preferences !== undefined) updateFields.preferences = data.preferences;
    if (data.annotations !== undefined) updateFields.annotations = data.annotations;

    const query = userId 
      ? { _id: sessionId, userId } 
      : { _id: sessionId, guestId, userId: null };
    
    const updatePayload = { $set: updateFields, $inc: { docVersion: 1 } };
    
    await ChatSession.findOneAndUpdate(
      query,
      updatePayload,
      { returnDocument: 'after', runValidators: true }
    );

    res.status(204).end();
  } catch (err) {
    console.error('[Beacon] Save failed:', err.message);
    res.status(500).json({ error: 'Beacon save failed' });
  }
};

/**
 * Check whether multi-document MongoDB transactions are supported on this cluster.
 * Standalone instances return false; Replica sets and Sharded clusters return true.
 */
export function areTransactionsSupported() {
  try {
    if (process.env.FORCE_MONGO_TRANSACTIONS === 'true') return true;
    if (process.env.FORCE_MONGO_TRANSACTIONS === 'false') return false;

    const client = mongoose.connection?.getClient?.();
    if (!client) return false;
    const type = client.topology?.description?.type;
    return type === 'ReplicaSetWithPrimary' || type === 'Sharded';
  } catch (e) {
    return false;
  }
}

/**
 * DELETE /api/sessions/:id
 * Reliable two-phase cascading deletion.
 * - In replica set / mongos: performs atomic deletion in a MongoDB transaction.
 * - In standalone MongoDB: marks recoverable state, purges child records first,
 *   never deletes the parent session while child cleanup has failed, and records failures for idempotent retry.
 */
export const deleteSession = async (req, res) => {
  let dbSession = null;
  try {
    const isUser = Boolean(req.user?._id || req.user?.id);
    const userId = req.user?._id || req.user?.id;
    const guestId = req.guestId;

    if (!isUser && !guestId) {
      return res.status(401).json({ error: 'Authentication or guest identity required', code: 'UNAUTHORIZED' });
    }
    
    // Allow matching active sessions OR sessions that previously failed child purge (to permit idempotent retry)
    const query = isUser 
      ? { 
          _id: req.params.id, 
          userId: userId.toString(), 
          $or: [{ isDeleted: { $ne: true } }, { deletionState: 'purge_failed' }] 
        } 
      : { 
          _id: req.params.id, 
          guestId, 
          userId: null, 
          $or: [{ isDeleted: { $ne: true } }, { deletionState: 'purge_failed' }] 
        };

    // Phase 1: Soft-delete immediately to hide the session from all reads/writes, set deletionState: 'purging'
    const session = await ChatSession.findOneAndUpdate(
      query,
      { $set: { isDeleted: true, deletionState: 'purging', deletedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Phase 2: Transactional cascading purge where genuinely supported (Replica Set / Atlas / mongos)
    const transactionsSupported = areTransactionsSupported();

    if (transactionsSupported) {
      try {
        dbSession = await mongoose.startSession();
        dbSession.startTransaction();

        await Promise.all([
          ChatMessage.deleteMany({ sessionId: session._id }, { session: dbSession }),
          Artifact.deleteMany({ sessionId: session._id.toString() }, { session: dbSession }),
          CodeVisualization.deleteMany({ sessionId: session._id.toString() }, { session: dbSession }),
          SessionLedger.deleteMany({ sessionId: session._id }, { session: dbSession }),
          ChatSession.deleteOne({ _id: session._id }, { session: dbSession })
        ]);

        await dbSession.commitTransaction();
        return res.json({ message: 'Session deleted', transaction: true });
      } catch (txErr) {
        if (dbSession && dbSession.inTransaction()) {
          try { await dbSession.abortTransaction(); } catch (_) {}
        }

        // Transactions ARE supported on this cluster, but the operation failed.
        // Record failure state and do NOT permanently delete the parent session!
        await ChatSession.updateOne(
          { _id: session._id },
          { $set: { deletionState: 'purge_failed', deletionError: txErr.message } }
        );
        return res.status(500).json({
          error: 'Transaction deletion failed',
          code: 'TRANSACTION_DELETE_FAILED',
          details: txErr.message
        });
      } finally {
        if (dbSession) {
          try { await dbSession.endSession(); } catch (_) {}
        }
      }
    }

    // Standalone MongoDB fallback: Reliable two-phase recoverable cleanup
    // Child records MUST be purged before parent is permanently removed
    const childFailures = [];

    try {
      await ChatMessage.deleteMany({ sessionId: session._id });
    } catch (e) {
      childFailures.push({ resource: 'messages', error: e.message });
    }

    try {
      await Artifact.deleteMany({ sessionId: session._id.toString() });
    } catch (e) {
      childFailures.push({ resource: 'artifacts', error: e.message });
    }

    try {
      await CodeVisualization.deleteMany({ sessionId: session._id.toString() });
    } catch (e) {
      childFailures.push({ resource: 'code walkthroughs', error: e.message });
    }

    try {
      await SessionLedger.deleteMany({ sessionId: session._id });
    } catch (e) {
      childFailures.push({ resource: 'ledger', error: e.message });
    }

    if (childFailures.length > 0) {
      // CRITICAL: DO NOT permanently delete ChatSession when child cleanup failed!
      // Record failure state for idempotent retry and recovery
      await ChatSession.updateOne(
        { _id: session._id },
        { 
          $set: { 
            deletionState: 'purge_failed', 
            deletionError: childFailures.map(f => `${f.resource}: ${f.error}`).join('; ') 
          } 
        }
      );
      return res.status(500).json({
        error: 'Cascading deletion incomplete — child cleanup failed',
        code: 'CASCADE_CLEANUP_FAILED',
        failures: childFailures
      });
    }

    // All child resources purged successfully. Now permanently remove parent.
    await ChatSession.deleteOne({ _id: session._id });
    return res.json({ message: 'Session deleted', transaction: false });
  } catch (err) {
    console.error('[Session:Delete] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete session' });
  }
};

/**
 * GET /api/sessions/:id/messages
 * Dedicated pagination endpoint using compound cursor for retrieving older chat messages.
 */
export const getSessionMessages = async (req, res) => {
  try {
    const isUser = Boolean(req.user?._id || req.user?.id);
    const guestId = req.guestId;

    if (!isUser && !guestId) {
      return res.status(401).json({ error: 'Authentication or guest identity required', code: 'UNAUTHORIZED' });
    }

    const query = isUser 
      ? { _id: req.params.id, userId: req.user._id, isDeleted: { $ne: true } }
      : { _id: req.params.id, guestId, userId: null, isDeleted: { $ne: true } };

    const session = await ChatSession.findOne(query).select('_id').lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { msgQuery, limit } = buildCompoundPaginationQuery(session._id, req.query);

    const rawMessages = await ChatMessage.find(msgQuery)
      .sort({ timestamp: -1, _id: -1 })
      .limit(limit)
      .lean();

    const oldestMsg = rawMessages[rawMessages.length - 1];
    const nextCursor = (rawMessages.length === limit && oldestMsg)
      ? `${new Date(oldestMsg.timestamp).toISOString()}_${oldestMsg._id}`
      : null;

    const messages = rawMessages.reverse().map(m => ({
      ...m,
      id: m._id?.toString() || m.id
    }));

    res.json({
      sessionId: session._id,
      messages,
      pagination: {
        hasMore: rawMessages.length === limit,
        nextCursor,
        oldestTimestamp: messages[0]?.timestamp || null,
        newestTimestamp: messages[messages.length - 1]?.timestamp || null,
        count: messages.length,
        limit
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session messages' });
  }
};
