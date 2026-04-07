/**
 * rateLimiter.js — In-memory rate limiter
 *
 * HTTP middleware: 60 requests per minute per IP
 * Socket helper:  20 events per minute per socket
 *
 * Uses a sliding window approach with automatic cleanup.
 */

// ─── Store: IP → [timestamp, timestamp, ...] ───
const hitsByIP = new Map();
const hitsBySocket = new Map();

const HTTP_WINDOW_MS = 60_000;   // 1 minute
const HTTP_MAX_HITS  = 60;       // 60 requests per window

const SOCKET_WINDOW_MS = 60_000;
const SOCKET_MAX_HITS  = 20;     // 20 events per window

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hitsByIP) {
    const fresh = timestamps.filter(t => now - t < HTTP_WINDOW_MS);
    if (fresh.length === 0) hitsByIP.delete(key);
    else hitsByIP.set(key, fresh);
  }
  for (const [key, timestamps] of hitsBySocket) {
    const fresh = timestamps.filter(t => now - t < SOCKET_WINDOW_MS);
    if (fresh.length === 0) hitsBySocket.delete(key);
    else hitsBySocket.set(key, fresh);
  }
}, 5 * 60_000);

/**
 * Express middleware — attach to API routes
 */
export function httpRateLimiter(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();

  if (!hitsByIP.has(ip)) hitsByIP.set(ip, []);
  const timestamps = hitsByIP.get(ip);

  // Remove entries outside the window
  const fresh = timestamps.filter(t => now - t < HTTP_WINDOW_MS);
  fresh.push(now);
  hitsByIP.set(ip, fresh);

  if (fresh.length > HTTP_MAX_HITS) {
    const retryAfter = Math.ceil(HTTP_WINDOW_MS / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before trying again.',
      retryAfterSeconds: retryAfter,
    });
  }

  next();
}

/**
 * Socket-level rate limiter — call from socket event handlers
 * Returns true if the event should be allowed, false if rate-limited.
 */
export function checkSocketRate(socketId) {
  const now = Date.now();

  if (!hitsBySocket.has(socketId)) hitsBySocket.set(socketId, []);
  const timestamps = hitsBySocket.get(socketId);

  const fresh = timestamps.filter(t => now - t < SOCKET_WINDOW_MS);
  fresh.push(now);
  hitsBySocket.set(socketId, fresh);

  return fresh.length <= SOCKET_MAX_HITS;
}

/**
 * Clean up a socket's rate limit data on disconnect
 */
export function cleanupSocket(socketId) {
  hitsBySocket.delete(socketId);
}
