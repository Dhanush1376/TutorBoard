/**
 * session.service.ts — TutorBoard v6.0
 * 
 * Manages ChatSession lifecycle, persistence, and ledger updates.
 */

import ChatSession from '../../models/ChatSession.js';
import ChatMessage from '../../models/ChatMessage.js';
import { generateMessageId } from '../../utils/core/idGenerator.js';
import SessionLedger from '../../models/SessionLedger.js';

export class SessionService {
  /**
   * Updates the request ledger atomically to prevent race conditions.
   * MONGO-06: Now uses a dedicated collection to reduce write amplification.
   */
  async writeLedgerAtomic(sessionId: string, requestId: string, payload: any) {
    try {
      await SessionLedger.findOneAndUpdate(
        { sessionId, requestId },
        { $set: { ...payload, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (err: any) {
      console.error('[Session:Ledger] Atomic update failed:', err.message);
    }
  }

  /**
   * Loads a session by ID and UserID (with guest support)
   */
  async loadSession(sessionId: string, userId: string | null, isGuest: boolean) {
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(sessionId);
    const query = isGuest ? { _id: sessionId, userId: null } : { _id: sessionId, userId: userId };
    return await ChatSession.findOne(query);
  }

  /**
   * Creates a new session
   */
  async createSession(userId: string | null, title: string, initialTopic: string, initialMessage: any) {
    const session = await ChatSession.create({
      userId,
      title,
      currentTopic: initialTopic,
      explanationMode: 'basic',
    });
    if (initialMessage) {
      await ChatMessage.create({
        ...initialMessage,
        sessionId: session._id,
        timestamp: new Date(),
      });
    }
    return session;
  }

  /**
   * Generates a context summary of the session history for the AI
   */
  buildRichMemorySummary(session: any): string {
    if (!session?.messages || session.messages.length < 2) return '';

    const msgs = session.messages;
    const userMessages = msgs.filter((m: any) => m.role === 'user');
    const recentExchanges = msgs.slice(-8).map((m: any) => 
      `[${m.role.toUpperCase()}]: ${(m.content || '').substring(0, 150)}`
    ).join('\n');

    let summary = `SESSION CONTEXT:\n`;
    summary += `- Total exchanges: ${userMessages.length}\n`;
    summary += `- Session topic: ${session.currentTopic || session.title || 'General'}\n`;
    summary += `\nRECENT CONVERSATION FLOW:\n${recentExchanges}\n`;
    summary += `\nIMPORTANT: Use this history as PRIMARY CONTEXT. Reference past topics naturally.\n`;

    return summary;
  }
}

export default new SessionService();
