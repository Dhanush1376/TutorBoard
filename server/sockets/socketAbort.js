/**
 * socketAbort.js — TutorBoard v4.0
 *
 * Gives each socket a single "current operation" AbortController.
 * When a new session:start or session:doubt arrives, the previous
 * in-flight AI call is cancelled immediately.
 *
 * This eliminates the "stuck" feeling where:
 * - A previous slow response is still generating
 * - The user sends a new message
 * - Both responses stream simultaneously / fight for the UI
 *
 * Usage:
 *   import { getAbortSignal, abortCurrent } from './socketAbort.js';
 *
 *   // In any handler that calls the LLM:
 *   const signal = getAbortSignal(socket);
 *   try {
 *     const response = await someAICall({ signal });
 *   } catch (err) {
 *     if (err.name === 'AbortError') return; // user sent a new message, silently stop
 *   }
 */

/** Map<socketId, AbortController> */
const controllers = new Map();

/**
 * Cancel any in-flight operation for this socket and return a fresh signal.
 * Call this at the TOP of every handler that starts an AI operation.
 */
export function getAbortSignal(socket) {
  abortCurrent(socket);
  const controller = new AbortController();
  controllers.set(socket.id, controller);
  return controller.signal;
}

/**
 * Cancel the current in-flight operation for a socket (if any).
 * Call this from the disconnect handler to free resources.
 */
export function abortCurrent(socket) {
  const existing = controllers.get(socket.id);
  if (existing && !existing.signal.aborted) {
    try { existing.abort(); } catch (_) { /* safe */ }
  }
  controllers.delete(socket.id);
}

/**
 * Clean up after a socket disconnects.
 * Always call this in the socket 'disconnect' handler.
 */
export function cleanupAbort(socket) {
  abortCurrent(socket);
}
