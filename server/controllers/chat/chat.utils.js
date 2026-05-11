import ChatSession from '../../models/ChatSession.js';
import SessionLedger from '../../models/SessionLedger.js';

export function generateMessageId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export async function writeLedgerAtomic(sessionId, requestId, payload) {
  try {
    await SessionLedger.findOneAndUpdate(
      { sessionId, requestId },
      { $set: { ...payload, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[Ledger:Atomic] Update failed:', err.message);
  }
}

export function resolveRequestId(req, providedId) {
  return (
    providedId ||
    req.headers['x-request-id'] ||
    req.headers['x-client-request-id'] ||
    `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

export async function readLedgerEntry(sessionId, requestId) {
  return await SessionLedger.findOne({ sessionId, requestId }).lean();
}

export function buildRichMemorySummary(session) {
  if (!session?.messages || session.messages.length < 2) return '';

  const msgs = session.messages;
  const userMessages = msgs.filter(m => m.role === 'user');
  const assistantMessages = msgs.filter(m => m.role === 'assistant');

  const topicsAsked = userMessages
    .map(m => m.content?.substring(0, 100))
    .filter(Boolean);

  const recentExchanges = msgs.slice(-8).map(m => 
    `[${m.role.toUpperCase()}]: ${(m.content || '').substring(0, 150)}`
  ).join('\n');

  const avgMsgLength = userMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0) / (userMessages.length || 1);
  const asksFollowUps = userMessages.filter(m => 
    /why|how|what if|can you|explain more|but|wait/i.test(m.content || '')
  ).length;

  let behaviorNote = '';
  if (avgMsgLength > 200) {
    behaviorNote = 'The student writes detailed questions — they are thorough and want deep explanations.';
  } else if (avgMsgLength < 30) {
    behaviorNote = 'The student writes short, direct questions — keep responses focused and concise unless depth is needed.';
  }
  if (asksFollowUps > userMessages.length * 0.5) {
    behaviorNote += ' They frequently ask follow-up questions — they are curious and want to truly understand.';
  }

  let summary = `SESSION CONTEXT:\n`;
  summary += `- Total exchanges: ${userMessages.length} questions, ${assistantMessages.length} responses\n`;
  summary += `- Session topic: ${session.currentTopic || session.title || 'General'}\n`;
  
  if (topicsAsked.length > 0) {
    summary += `\nTOPICS THE STUDENT HAS EXPLORED (in order):\n`;
    summary += topicsAsked.map((t, i) => `  ${i + 1}. "${t}"`).join('\n');
    summary += '\n';
  }

  if (behaviorNote) {
    summary += `\nSTUDENT BEHAVIOR ANALYSIS:\n${behaviorNote}\n`;
  }

  summary += `\nRECENT CONVERSATION FLOW:\n${recentExchanges}\n`;
  summary += `\nIMPORTANT: Use this history as PRIMARY CONTEXT. Reference past topics naturally. If the student mentioned something earlier, connect it to your current answer.\n`;

  return summary;
}

export function detectTopic(message) {
  if (!message) return 'General';
  // Simplified topic detection for now
  return message.substring(0, 50);
}
