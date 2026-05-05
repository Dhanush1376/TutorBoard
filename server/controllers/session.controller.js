import { z } from 'zod';
import jwt from 'jsonwebtoken';
import ChatSession from '../models/ChatSession.js';
import ActivityLog from '../models/ActivityLog.js';

// Schema for request body validation — PERMISSIVE for client payloads
// The client sends messages with `id`, `role`, `content` and other metadata.
// canvasSteps, canvasVersion, and token (for beacon) must all be accepted.
const saveSessionSchema = z.object({
  sessionId: z.string().optional().nullable(),
  title: z.string().max(200).optional(),
  messages: z.array(z.object({
    id: z.string().optional(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(50000),
    timestamp: z.any().optional(),
    canvasSnapshot: z.any().optional(),
  }).passthrough()).max(200).optional(),
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      ChatSession.find({ userId: req.user._id })
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ChatSession.countDocuments({ userId: req.user._id })
    ]);

    res.json({
      sessions,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        hasMore: skip + sessions.length < total
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
    const session = await ChatSession.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};

/**
 * POST /api/sessions
 * Create or Update a session
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

    console.log(`[DB] Save Request: User=${userId || 'GUEST'}, Session=${sessionId || 'NEW'}`);

    let session;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId || '');

    if (sessionId && isMongoId) {
      // Build update object — only include fields that were actually sent
      const updateFields = { lastUpdated: Date.now() };
      if (title !== undefined) updateFields.title = title;
      
      // Always sync top-level canvas state if provided
      if (canvasState !== undefined) updateFields.canvasState = canvasState;
      if (canvasSteps !== undefined) updateFields.canvasSteps = canvasSteps;
      if (canvasVersion !== undefined) updateFields.canvasVersion = canvasVersion;

      // If we're editing a specific message's snapshot, inject the state there
      if (activeSnapshotId && messages) {
        const msgIndex = messages.findIndex(m => m.id === activeSnapshotId);
        if (msgIndex !== -1) {
          messages[msgIndex].canvasSnapshot = {
            canvasObjects: canvasState,
            canvasSteps,
            canvasVersion,
            totalSteps: canvasSteps?.length || 0,
            currentStepIndex: req.body.currentStepIndex || 0,
          };
          messages[msgIndex].hasCanvas = true;
        }
        updateFields.messages = messages;
      } else {
        // Normal session-wide message update
        if (messages !== undefined) updateFields.messages = messages;
      }

      if (preferences !== undefined) updateFields.preferences = preferences;

      const query = isGuest ? { _id: sessionId } : { _id: sessionId, userId: userId.toString() };
      
      session = await ChatSession.findOneAndUpdate(
        query,
        { $set: updateFields },
        { new: true, runValidators: true }
      );
      
      if (session) {
        console.log(`[DB] ✅ Updated existing session: ${session._id}`);
      }
    }

    if (!session) {
      // Create new session if document not found or if sessionId is a local UUID
      // This handles the "Initial Save" from the client before a MongoDB ID is assigned.
      session = await ChatSession.create({
        userId: isGuest ? null : userId,
        title: title || 'New Session',
        messages: messages || [],
        canvasState: canvasState || [],
        canvasSteps: canvasSteps || [],
        canvasVersion: canvasVersion || 0,
        preferences: preferences || {},
        engineSessionId: sessionId // Store the client's local ID for audit/linking
      });
      console.log(`[DB] ✨ Created new session: ${session._id} (Client UUID: ${sessionId}) (Guest: ${isGuest})`);
      
      // LOG ACTIVITY: Session Start
      logActivity({
        userId: isGuest ? null : userId,
        sessionId: session._id.toString(),
        eventType: 'session_start',
        eventData: { title: session.title }
      });
    }
  else {
    // LOG ACTIVITY: Session Update (e.g. canvas action)
    logActivity({
      userId: isGuest ? null : userId,
        sessionId: session._id.toString(),
        eventType: 'canvas_action',
        eventData: { version: canvasVersion }
      });
    }

    res.json(session);
  } catch (err) {
    console.error('Save session error:', err);
    res.status(500).json({ error: 'Failed to save session' });
  }
};

/**
 * POST /api/sessions/beacon
 * Emergency flush via Beacon API (no auth header — token is in body)
 */
export const beaconSave = async (req, res) => {
  try {
    const token = req.body && req.body.token;
    const { sessionId, ...data } = req.body;
    
    // Beacon requests include the token in the body since Beacon API doesn't support headers
    // The `protect` middleware won't have run, so we need to verify inline
    if (!token || !sessionId) {
      return res.status(400).json({ error: 'Missing token or sessionId' });
    }

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId);
    if (!isMongoId) {
      return res.status(400).json({ error: 'Invalid session ID for beacon' });
    }

    let userId = null;
    if (token && token !== 'guest') {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded?.id;
      } catch (e) {
        // invalid token, treat as guest
      }
    }

    const updateFields = { lastUpdated: Date.now() };
    if (data.title !== undefined) updateFields.title = data.title;
    if (data.messages !== undefined) updateFields.messages = data.messages;
    if (data.canvasState !== undefined) updateFields.canvasState = data.canvasState;
    if (data.canvasSteps !== undefined) updateFields.canvasSteps = data.canvasSteps;
    if (data.canvasVersion !== undefined) updateFields.canvasVersion = data.canvasVersion;
    if (data.preferences !== undefined) updateFields.preferences = data.preferences;

    const query = userId ? { _id: sessionId, userId } : { _id: sessionId };
    
    await ChatSession.findOneAndUpdate(
      query,
      { $set: updateFields }
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
    
    const query = isGuest ? { _id: req.params.id } : { _id: req.params.id, userId: userId.toString() };

    const session = await ChatSession.findOneAndDelete(query);
    
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
};