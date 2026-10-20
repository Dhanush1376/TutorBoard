/**
 * chatErrors.ts — what a chat failure means to the learner.
 *
 * Every failure on the chat path is reduced to one of these categories before
 * it reaches the browser. The full error (provider body, stack, Mongo details)
 * stays in the server log; the client gets a stable `code`, a plain sentence,
 * and whether retrying the same request can help.
 */

import { AppError, ErrorCode } from '../../shared/errors.js';

export type ChatErrorCode =
  | 'CANCELLED'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'NOT_CONFIGURED'
  | 'EMPTY_RESPONSE'
  | 'STREAM_INTERRUPTED'
  | 'CONTEXT_TOO_LONG'
  | 'PERSISTENCE_FAILED'
  | 'SESSION_NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'DUPLICATE_IN_PROGRESS'
  | 'INVALID_REQUEST'
  | 'INTERNAL';

export interface ChatClientError {
  code: ChatErrorCode;
  message: string;
  retryable: boolean;
  status: number;
}

const MESSAGES: Record<ChatErrorCode, { message: string; retryable: boolean; status: number }> = {
  CANCELLED: { message: 'Generation was stopped.', retryable: true, status: 499 },
  RATE_LIMITED: { message: 'The AI service is busy right now. Wait a few seconds and try again.', retryable: true, status: 429 },
  PROVIDER_UNAVAILABLE: { message: 'The AI service is temporarily unavailable. Please try again.', retryable: true, status: 503 },
  PROVIDER_TIMEOUT: { message: 'The AI service took too long to respond. Please try again.', retryable: true, status: 504 },
  NOT_CONFIGURED: { message: 'The AI service is not configured on this server. Check the API key settings.', retryable: false, status: 503 },
  EMPTY_RESPONSE: { message: 'The AI returned an empty answer. Please try again.', retryable: true, status: 502 },
  STREAM_INTERRUPTED: { message: 'The answer was interrupted before it finished. Please try again.', retryable: true, status: 502 },
  CONTEXT_TOO_LONG: { message: 'This conversation is too long for the model. Start a new chat to continue.', retryable: false, status: 422 },
  PERSISTENCE_FAILED: { message: 'The answer was generated but could not be saved. Try again to save it.', retryable: true, status: 503 },
  SESSION_NOT_FOUND: { message: 'This conversation no longer exists. Start a new chat.', retryable: false, status: 404 },
  ACCESS_DENIED: { message: 'You do not have access to this conversation.', retryable: false, status: 403 },
  DUPLICATE_IN_PROGRESS: { message: 'This message is already being answered.', retryable: false, status: 409 },
  INVALID_REQUEST: { message: 'The request was invalid.', retryable: false, status: 400 },
  INTERNAL: { message: 'Something went wrong while generating the answer. Please try again.', retryable: true, status: 500 },
};

/** A chat failure with a known category (thrown inside the chat pipeline). */
export class ChatError extends Error {
  readonly chatCode: ChatErrorCode;
  constructor(code: ChatErrorCode, detail?: string, options?: { cause?: unknown }) {
    super(detail || MESSAGES[code].message, { cause: options?.cause });
    this.name = 'ChatError';
    this.chatCode = code;
  }
}

const APP_ERROR_MAP: Partial<Record<ErrorCode, ChatErrorCode>> = {
  [ErrorCode.SESSION_NOT_FOUND]: 'SESSION_NOT_FOUND',
  [ErrorCode.SESSION_ACCESS_DENIED]: 'ACCESS_DENIED',
  [ErrorCode.AI_RATE_LIMITED]: 'RATE_LIMITED',
  [ErrorCode.AI_PROVIDER_UNAVAILABLE]: 'PROVIDER_UNAVAILABLE',
  [ErrorCode.AI_CONTEXT_TOO_LONG]: 'CONTEXT_TOO_LONG',
  [ErrorCode.AI_STREAMING_INTERRUPTED]: 'STREAM_INTERRUPTED',
  [ErrorCode.AI_GENERATION_FAILED]: 'PROVIDER_UNAVAILABLE',
  [ErrorCode.CIRCUIT_BREAKER_OPEN]: 'PROVIDER_UNAVAILABLE',
  [ErrorCode.VALIDATION_FAILED]: 'INVALID_REQUEST',
  [ErrorCode.VALIDATION_SCHEMA_MISMATCH]: 'INVALID_REQUEST',
  [ErrorCode.DB_CONNECTION_FAILED]: 'PERSISTENCE_FAILED',
};

/** Reduce any thrown value on the chat path to a category. */
export function classifyChatError(err: any): ChatErrorCode {
  if (!err) return 'INTERNAL';
  if (err instanceof ChatError) return err.chatCode;
  if (err instanceof AppError) return APP_ERROR_MAP[err.code] || 'INTERNAL';
  if (err.name === 'ZodError') return 'INVALID_REQUEST';

  const name = String(err.name || '');
  const msg = String(err.message || '').toLowerCase();
  const status = Number(err.status ?? err.statusCode ?? err.response?.status ?? 0);

  if (name === 'AbortError' || name === 'APIUserAbortError' || msg.includes('aborted')) return 'CANCELLED';
  if (msg.startsWith('stream_interrupted') || err.code === ErrorCode.AI_STREAMING_INTERRUPTED) return 'STREAM_INTERRUPTED';
  if (msg.startsWith('system_not_configured') || msg.includes('no ai provider keys')) return 'NOT_CONFIGURED';
  if (status === 401 || status === 403) return 'NOT_CONFIGURED';
  if (status === 429 || msg.includes('rate limit') || msg.includes('quota')) return 'RATE_LIMITED';
  if (status === 413 || msg.includes('context length') || msg.includes('maximum context') || msg.includes('too many tokens')) return 'CONTEXT_TOO_LONG';
  if (name === 'APIConnectionTimeoutError' || msg.includes('timeout') || msg.includes('timed out') || status === 408 || status === 504) return 'PROVIDER_TIMEOUT';
  if (msg.startsWith('circuit_open')) return 'PROVIDER_UNAVAILABLE';
  if (status >= 500 || name === 'APIConnectionError' || msg.includes('all system ai providers failed')) return 'PROVIDER_UNAVAILABLE';
  if (name.startsWith('Mongo') || name === 'ValidationError' || name === 'VersionError') return 'PERSISTENCE_FAILED';
  return 'INTERNAL';
}

/** The safe, client-facing view of an error. */
export function toChatClientError(err: any): ChatClientError {
  const code = classifyChatError(err);
  const base = MESSAGES[code];
  // Operational AppErrors / ChatErrors carry messages written for users; anything
  // else (provider bodies, Mongo errors) is replaced by the category's sentence.
  const message = code === 'INVALID_REQUEST' && err instanceof AppError ? err.message : base.message;
  return { code, message, retryable: base.retryable, status: base.status };
}
