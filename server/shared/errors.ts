/**
 * errors.ts — TutorBoard Error Taxonomy
 * 
 * Centralized error codes and factory functions.
 * Replaces ad-hoc error strings thrown throughout the codebase.
 * 
 * Usage:
 *   import { AppError, ErrorCode } from '../shared/errors.js';
 *   throw new AppError(ErrorCode.SESSION_NOT_FOUND, 'Session xyz not found');
 */

// ── Error Code Registry ───────────────────────────────────────────────────────

export enum ErrorCode {
  // Auth (1xxx)
  AUTH_INVALID_CREDENTIALS   = 'AUTH_1001',
  AUTH_TOKEN_EXPIRED         = 'AUTH_1002',
  AUTH_TOKEN_REVOKED         = 'AUTH_1003',
  AUTH_INSUFFICIENT_ROLE     = 'AUTH_1004',
  AUTH_OAUTH_FAILED          = 'AUTH_1005',
  AUTH_GUEST_LIMIT_REACHED   = 'AUTH_1006',

  // Session (2xxx)
  SESSION_NOT_FOUND          = 'SESSION_2001',
  SESSION_ACCESS_DENIED      = 'SESSION_2002',
  SESSION_SAVE_FAILED        = 'SESSION_2003',
  SESSION_MESSAGE_CAP        = 'SESSION_2004',

  // AI / LLM (3xxx)
  AI_PROVIDER_UNAVAILABLE    = 'AI_3001',
  AI_RATE_LIMITED             = 'AI_3002',
  AI_CONTEXT_TOO_LONG        = 'AI_3003',
  AI_GENERATION_FAILED       = 'AI_3004',
  AI_BUDGET_EXCEEDED         = 'AI_3005',
  AI_MODEL_NOT_FOUND         = 'AI_3006',
  AI_STREAMING_INTERRUPTED   = 'AI_3007',

  // Teaching Pipeline (4xxx)
  TEACH_PIPELINE_FAILED      = 'TEACH_4001',
  TEACH_VALIDATION_FAILED    = 'TEACH_4002',
  TEACH_CONCURRENCY_FULL     = 'TEACH_4003',
  TEACH_AGENT_TIMEOUT        = 'TEACH_4004',
  TEACH_CRITIC_REJECTED      = 'TEACH_4005',

  // Upload / File (5xxx)
  UPLOAD_FILE_TOO_LARGE      = 'UPLOAD_5001',
  UPLOAD_INVALID_TYPE        = 'UPLOAD_5002',
  UPLOAD_S3_FAILED           = 'UPLOAD_5003',

  // Validation (6xxx)
  VALIDATION_FAILED          = 'VALID_6001',
  VALIDATION_SCHEMA_MISMATCH = 'VALID_6002',

  // Infrastructure (7xxx)
  DB_CONNECTION_FAILED       = 'INFRA_7001',
  REDIS_UNAVAILABLE          = 'INFRA_7002',
  VECTOR_STORE_FAILED        = 'INFRA_7003',
  CIRCUIT_BREAKER_OPEN       = 'INFRA_7004',

  // Generic (9xxx)
  INTERNAL_ERROR             = 'INTERNAL_9001',
  NOT_FOUND                  = 'INTERNAL_9002',
  METHOD_NOT_ALLOWED         = 'INTERNAL_9003',
}

// ── HTTP Status Mapping ───────────────────────────────────────────────────────

const STATUS_MAP: Record<string, number> = {
  AUTH_1001: 401, AUTH_1002: 401, AUTH_1003: 401, AUTH_1004: 403, AUTH_1005: 502, AUTH_1006: 429,
  SESSION_2001: 404, SESSION_2002: 403, SESSION_2003: 500, SESSION_2004: 422,
  AI_3001: 503, AI_3002: 429, AI_3003: 422, AI_3004: 500, AI_3005: 402, AI_3006: 404, AI_3007: 499,
  TEACH_4001: 500, TEACH_4002: 422, TEACH_4003: 429, TEACH_4004: 504, TEACH_4005: 422,
  UPLOAD_5001: 413, UPLOAD_5002: 415, UPLOAD_5003: 502,
  VALID_6001: 400, VALID_6002: 422,
  INFRA_7001: 503, INFRA_7002: 503, INFRA_7003: 503, INFRA_7004: 503,
  INTERNAL_9001: 500, INTERNAL_9002: 404, INTERNAL_9003: 405,
};

// ── AppError Class ────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      isOperational?: boolean;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS_MAP[code] || 500;
    this.isOperational = options?.isOperational ?? true;
    this.context = options?.context;

    // Capture stack trace (skip AppError constructor)
    Error.captureStackTrace?.(this, AppError);
  }

  /**
   * Serialize for API response (excludes internal details)
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(process.env.NODE_ENV !== 'production' && this.context ? { context: this.context } : {}),
      },
    };
  }
}

// ── Error Handler Middleware ───────────────────────────────────────────────────

export function errorHandler(err: Error, _req: any, res: any, _next: any) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Unknown errors — don't leak internals
  console.error('[TutorBoard] Unhandled error:', err);
  return res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
}
