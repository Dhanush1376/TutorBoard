import ChatSession from '../models/ChatSession.js';

/**
 * GET /api/sessions
 * Get all sessions for the current user
 */
export const getSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user._id }).sort({ lastUpdated: -1 });
    res.json(sessions);
  } catch (err) {
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
  const { sessionId, title, messages, canvasState, preferences } = req.body;
  
  try {
    // If sessionId is provided and looks like a MongoDB ID, try to update
    let session;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId);

    if (sessionId && isMongoId) {
      session = await ChatSession.findOneAndUpdate(
        { _id: sessionId, userId: req.user._id },
        { title, messages, canvasState, preferences, lastUpdated: Date.now() },
        { new: true }
      );
    }

    if (!session) {
      // Create new session
      session = await ChatSession.create({
        userId: req.user._id,
        title: title || 'New Session',
        messages: messages || [],
        canvasState: canvasState || [],
        preferences: preferences || {},
      });
    }

    res.json(session);
  } catch (err) {
    console.error('Save session error:', err);
    res.status(500).json({ error: 'Failed to save session' });
  }
};

/**
 * DELETE /api/sessions/:id
 */
export const deleteSession = async (req, res) => {
  try {
    const session = await ChatSession.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
};
