/**
 * chatErrors.js — typed chat failures on the client.
 *
 * The server sends a stable `code` and a safe sentence with every chat error
 * (server/services/chat/chatErrors.ts). The client adds the failures only it
 * can see (network down, stream cut off) and maps each code to what the error
 * card says and whether "Try again" is offered.
 */

export class ChatRequestError extends Error {
  constructor(code, message, { retryable = true, status } = {}) {
    super(message || COPY[code]?.desc || COPY.INTERNAL.desc);
    this.name = 'ChatRequestError';
    this.code = code || 'INTERNAL';
    this.retryable = retryable;
    this.status = status;
  }
}

const COPY = {
  NETWORK: { title: 'Connection lost', desc: 'Check your internet connection, then try again.', tone: 'blue' },
  STREAM_INTERRUPTED: { title: 'Answer interrupted', desc: 'The connection dropped before the answer finished.', tone: 'blue' },
  RATE_LIMITED: { title: 'Busy right now', desc: 'The AI service is busy. Wait a few seconds and try again.', tone: 'amber' },
  PROVIDER_UNAVAILABLE: { title: 'AI service unavailable', desc: 'The AI service is temporarily unavailable.', tone: 'amber' },
  PROVIDER_TIMEOUT: { title: 'Taking too long', desc: 'The AI service took too long to respond.', tone: 'amber' },
  NOT_CONFIGURED: { title: 'AI not configured', desc: 'No working AI provider is configured. Check your API key settings.', tone: 'red' },
  EMPTY_RESPONSE: { title: 'Empty answer', desc: 'The AI returned an empty answer.', tone: 'amber' },
  CONTEXT_TOO_LONG: { title: 'Conversation too long', desc: 'Start a new chat to continue.', tone: 'red' },
  PERSISTENCE_FAILED: { title: 'Not saved', desc: 'The answer could not be saved. Try again to save it.', tone: 'amber' },
  SESSION_NOT_FOUND: { title: 'Conversation not found', desc: 'This conversation no longer exists. Start a new chat.', tone: 'red' },
  ACCESS_DENIED: { title: 'No access', desc: 'You do not have access to this conversation.', tone: 'red' },
  DUPLICATE_IN_PROGRESS: { title: 'Already answering', desc: 'This message is already being answered.', tone: 'blue' },
  INVALID_REQUEST: { title: 'Message not sent', desc: 'The message could not be sent.', tone: 'red' },
  FETCH_ERROR: { title: 'History not loaded', desc: 'Some messages could not be loaded.', tone: 'blue' },
  RESTORE_ERROR: { title: 'History not loaded', desc: 'Some messages could not be loaded.', tone: 'blue' },
  INTERNAL: { title: 'Something went wrong', desc: 'The answer could not be generated.', tone: 'red' },
};

/** Build a ChatRequestError from a non-2xx JSON body or an SSE `error` event. */
export function fromServerError(payload, status) {
  const p = payload || {};
  const code = p.code || p.data?.code || (status === 429 ? 'RATE_LIMITED' : status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'INTERNAL');
  // Only typed chat errors carry text written for learners; anything else (a
  // proxy page, CORS, a framework error) gets the category's own sentence.
  const raw = p.code ? (p.content || p.message || p.error?.message || p.error) : undefined;
  const message = typeof raw === 'string' && raw ? raw : undefined;
  const retryable = typeof p.retryable === 'boolean' ? p.retryable
    : typeof p.data?.retryable === 'boolean' ? p.data.retryable
    : code !== 'INVALID_REQUEST' && code !== 'ACCESS_DENIED' && code !== 'SESSION_NOT_FOUND';
  return new ChatRequestError(code, message, { retryable, status });
}

/** What the error card shows for a stored `lastAIError`. */
export function describeChatError(err) {
  const code = err?.code || err?.type;
  const copy = COPY[code] || COPY.INTERNAL;
  const message = typeof err === 'string' ? err : err?.message;
  return { title: copy.title, desc: message || copy.desc, tone: copy.tone, code: code || 'INTERNAL' };
}
