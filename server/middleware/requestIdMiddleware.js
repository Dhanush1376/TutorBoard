/**
 * requestIdMiddleware.js
 * BUG FIX #60: Adds X-Request-ID header and correlation tracking for distributed logging
 * 
 * With 6 agents making separate LLM calls, tracing is impossible without correlation IDs.
 * This middleware:
 * 1. Generates or passes through X-Request-ID headers
 * 2. Adds request ID to res.locals for use in handlers
 * 3. Logs request IDs for tracing session pipelines
 */


/**
 * Generate a unique request ID
 * @returns {string} UUID-like string for request correlation
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Express middleware to add request correlation ID
 */
export function requestIdMiddleware(req, res, next) {
  // Allow client to pass Request-ID or use X-Request-ID header if provided
  const incomingId = req.headers['x-request-id'] || req.headers['request-id'];
  
  // Generate new ID if not provided
  const requestId = incomingId || generateRequestId();
  
  // Store in res.locals for use in handlers
  res.locals.requestId = requestId;
  
  // Add to response header for client reference
  res.setHeader('X-Request-ID', requestId);
  
  // Add to request for downstream use
  req.id = requestId;
  req.requestId = requestId;
  
  // Log with request ID
  console.log(`[${requestId}] ${req.method} ${req.path}`);
  
  next();
}

/**
 * Attach request ID to socket connections
 * Called during socket.io connection setup
 * @param {Socket} socket - socket.io socket instance
 * @param {string} requestId - Request ID from header or middleware
 */
export function attachRequestIdToSocket(socket, requestId) {
  socket.requestId = requestId || generateRequestId();
  socket.emit('connection:init', { requestId: socket.requestId });
}

/**
 * Extract request ID from socket headers or generate new one
 * @param {Socket} socket - socket.io socket instance
 * @returns {string} Request ID
 */
export function getOrCreateRequestId(socket) {
  if (socket.requestId) {
    return socket.requestId;
  }
  
  // Try to get from handshake headers
  const headerId = socket.handshake?.headers?.['x-request-id'];
  if (headerId) {
    socket.requestId = headerId;
    return headerId;
  }
  
  // Generate new one
  socket.requestId = generateRequestId();
  return socket.requestId;
}

/**
 * Create sessionId with embedded requestId for full traceability
 * @param {string} socketId - socket.io socket ID
 * @param {string} requestId - Request correlation ID
 * @returns {string} Session ID with correlation info
 */
export function createTrackedSessionId(socket, requestId) {
  // SEC-SCALABILITY: Prioritize client-provided session ID for reconnect recovery
  const providedId = socket.handshake?.auth?.sessionId || socket.handshake?.query?.sessionId;
  if (providedId && providedId.startsWith('sess_')) return providedId;

  return `sess_${socket.id}_${requestId}_${Date.now()}`;
}
