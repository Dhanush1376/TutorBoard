import mongoose from 'mongoose';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import ActivityLog from '../models/ActivityLog.js';
import sessionRepository from '../repositories/session.repository.js';

// Schema for request body validation — PERMISSIVE for client payloads
// The client sends messages with `id`, `role`, `content` and other metadata.
// canvasSteps, canvasVersion, and token (for beacon) must all be accepted.
const saveSessionSchema = z.object({
  sessionId: z.string().optional().nullable(),
  title: z.string().max(200).optional(),
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

    const query = req.user?._id 
      ? { userId: req.user._id, isDeleted: { $ne: true } } 
      : { userId: null, isDeleted: { $ne: true } };
    
    // One round trip: each conversation with its 50 most recent messages
    // (ChatMessage is the source of truth). Previously this ran one extra query
    // per conversation. The client hides conversations without a user message.
    const [sessionsWithMessages, total] = await Promise.all([
      ChatSession.aggregate([
        // aggregate() does not cast like find(): make the owner an ObjectId
        { $match: { ...query, userId: query.userId ? new mongoose.Types.ObjectId(String(query.userId)) : null } },
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
    const query = req.user?._id 
      ? { _id: req.params.id, userId: req.user._id }
      : { _id: req.params.id, userId: null };

    const session = await ChatSession.findOne(query);
    
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    // SEC-STORAGE: Resolve offloaded canvas state for the client
    const sessionObj = session.toObject();
    sessionObj.canvasState = await session.resolveCanvasState();
    
    // CRITICAL FIX: Fetch messages from the ChatMessage collection (source of truth)
    // instead of the deprecated embedded ChatSession.messages[] array.
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
      // If no ChatMessage docs found, fall through to whatever was in the embedded array
    } catch (msgErr) {
      console.warn('[Session] Failed to fetch ChatMessage history:', msgErr.message);
    }
    
    res.json(sessionObj);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
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
      canvasVersion, preferences, activeSnapshotId 
    } = validation.data;
    
    const userId = req.user?._id || req.user?.id;
    const isGuest = !userId || req.user?.isGuest;

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DB] Save Request: User=${userId || 'GUEST'}, Session=${sessionId || 'NEW'}`);
    }

    let session;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId || '');

    if (!sessionId) {
      // Create new session
      session = await ChatSession.create({
        userId: isGuest ? null : userId,
        title: title || 'New Session',
        canvasState: canvasState || [],
        canvasSteps: canvasSteps || [],
        canvasVersion: canvasVersion || 0,
        preferences: preferences || {},
        docVersion: 0,
      });
      console.log(`[DB] 🌟 Created new session: ${session._id}`);
    } else {
      // Update existing session with optimistic locking
      const query = isMongoId 
        ? (isGuest ? { _id: sessionId, userId: null } : { _id: sessionId, userId: userId.toString() })
        : (isGuest ? { engineSessionId: sessionId, userId: null } : { engineSessionId: sessionId, userId: userId.toString() });

      // Atomic Update Payload
      const setFields = { lastUpdated: new Date() };
      const incFields = { docVersion: 1 };
      
      if (title !== undefined) setFields.title = title;
      if (canvasVersion !== undefined) setFields.canvasVersion = canvasVersion;
      if (preferences !== undefined) setFields.preferences = preferences;
      
      // Use repository for canvas processing (handles compression/S3)
      if (canvasState !== undefined) {
        setFields.canvasState = await sessionRepository.prepareCanvasUpdate(sessionId, canvasState);
        if (canvasSteps) setFields.canvasSteps = canvasSteps;
      }

      // Messages are NOT written here. Every chat, lesson and doubt turn is
      // persisted by the server when it is generated (ChatService / sessionStore),
      // and feedback / edit / delete / versions have their own endpoints. Writing
      // the client's copy back used to insert duplicates (content-matched upserts
      // with client timestamps) and overwrite server metadata (lost visuals).

      const updatePayload = { 
        $set: setFields, 
        $inc: incFields,
        ...(!isMongoId ? { $setOnInsert: { engineSessionId: sessionId, userId: isGuest ? null : userId } } : {})
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
    let token = req.cookies?.['tb-access-token'] || req.cookies?.['tb-token'] || req.body?.token;
    if (!token && req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token && token !== 'guest' && token !== 'verified') {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded?.id;
      } catch (e) {
        // invalid token, treat as guest
      }
    }

    const updateFields = { lastUpdated: Date.now() };
    if (data.title !== undefined) updateFields.title = data.title;
    // Messages are persisted server-side as they are generated (see saveSession).
    if (data.canvasState !== undefined) updateFields.canvasState = data.canvasState;
    if (data.canvasSteps !== undefined) updateFields.canvasSteps = data.canvasSteps;
    if (data.canvasVersion !== undefined) updateFields.canvasVersion = data.canvasVersion;
    if (data.preferences !== undefined) updateFields.preferences = data.preferences;

    const query = userId ? { _id: sessionId, userId } : { _id: sessionId, userId: null };
    
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
 * DELETE /api/sessions/:id
 */
export const deleteSession = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const isGuest = !userId || req.user?.isGuest;
    
    const query = isGuest ? { _id: req.params.id, userId: null } : { _id: req.params.id, userId: userId.toString() };

    const session = await ChatSession.findOneAndDelete(query);
    
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // CASCADE: Clean up all associated ChatMessage documents to prevent orphaned data
    try {
      const deleteResult = await ChatMessage.deleteMany({ sessionId: session._id });
      console.log(`[Session] Cascade deleted ${deleteResult.deletedCount} messages for session ${session._id}`);
    } catch (msgErr) {
      console.warn('[Session] Failed to cascade-delete messages:', msgErr.message);
    }

    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
};
