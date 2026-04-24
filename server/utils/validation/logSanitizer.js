/**
 * Log Sanitizer — Security hardening for all server logs
 * 
 * Ensures no API keys, tokens, or sensitive data appear in logs.
 */

// Patterns to detect and mask
const KEY_PATTERNS = [
  { regex: /Bearer\s+(sk-[a-zA-Z0-9-_]{4,})/gi, prefix: 'Bearer sk-****' },
  { regex: /\b(sk-proj-[a-zA-Z0-9-_]{4})[a-zA-Z0-9-_]+/g, mask: (m, p) => p + '****' },
  { regex: /\b(sk-ant-[a-zA-Z0-9-_]{4})[a-zA-Z0-9-_]+/g, mask: (m, p) => p + '****' },
  { regex: /\b(sk-[a-zA-Z0-9-_]{4})[a-zA-Z0-9-_]{8,}/g, mask: (m, p) => p + '****' },
  { regex: /\b(AIza[a-zA-Z0-9-_]{4})[a-zA-Z0-9-_]+/g, mask: (m, p) => p + '****' },
  { regex: /\b(xai-[a-zA-Z0-9-_]{4})[a-zA-Z0-9-_]+/g, mask: (m, p) => p + '****' },
];

const SENSITIVE_FIELDS = new Set([
  'encryptedkey', 'iv', 'tag', 'apikey', 'api_key', 'password',
  'secret', 'token', 'authorization', 'x-api-key',
  'decryptedkey', 'accesstoken', 'refreshtoken',
]);

/**
 * Mask sensitive patterns in a string
 * @param {string} str — Log message
 * @returns {string} — Sanitized string
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  let result = str;
  for (const { regex, prefix, mask } of KEY_PATTERNS) {
    if (mask) {
      result = result.replace(regex, mask);
    } else if (prefix) {
      result = result.replace(regex, prefix);
    }
  }
  return result;
}

/**
 * Deep-sanitize an object for safe logging
 * Removes sensitive fields and masks key patterns in string values
 * @param {any} obj — Object to sanitize
 * @param {number} depth — Max recursion depth
 * @returns {any} — Sanitized copy
 */
export function sanitizeForLog(obj, depth = 5) {
  if (depth <= 0) return '[TRUNCATED]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;

  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map(item => sanitizeForLog(item, depth - 1));
  }

  if (typeof obj === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = sanitizeForLog(value, depth - 1);
      }
    }
    return clean;
  }

  return obj;
}

/**
 * Validate API key input for security
 * @param {string} apiKey — Raw API key from user input
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateApiKeyInput(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key must be a non-empty string' };
  }
  if (apiKey.length > 256) {
    return { valid: false, error: 'API key exceeds maximum length (256 characters)' };
  }
  if (apiKey.length < 8) {
    return { valid: false, error: 'API key is too short (minimum 8 characters)' };
  }
  // Check for obvious injection attempts
  if (/[<>{}();\n\r]/.test(apiKey)) {
    return { valid: false, error: 'API key contains invalid characters' };
  }
  return { valid: true };
}

/**
 * Validate provider input
 */
export function validateProviderInput(provider) {
  const allowed = [
    'openai', 'google', 'anthropic', 'deepseek', 'groq', 'openrouter', 'custom',
    'mistral', 'cohere', 'together', 'perplexity', 'xai', 'fireworks', 'anyscale',
    'nvidia', 'ai21', 'deepinfra', 'huggingface', 'cerebras', 'sambanova',
    'novita', 'lepton', 'replicate', 'voyage', 'azure', 'aws', 'elevenlabs',
    'stability', 'fal', 'runpod', 'upstage', 'workers', 'ollama', 'vllm', 'lmstudio'
  ];
  if (!provider || !allowed.includes(provider)) {
    return { valid: false, error: `Invalid provider. Must be one of: ${allowed.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Validate model input
 */
export function validateModelInput(model) {
  if (model && (typeof model !== 'string' || model.length > 128)) {
    return { valid: false, error: 'Model must be a string, max 128 characters' };
  }
  return { valid: true };
}

/**
 * Validate base URL input
 */
export function validateBaseUrlInput(baseUrl) {
  if (!baseUrl) return { valid: true };
  try {
    const parsed = new URL(baseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Base URL must use http or https protocol' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
