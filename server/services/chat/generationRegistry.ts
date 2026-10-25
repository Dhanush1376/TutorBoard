/**
 * generationRegistry.ts — answers currently being generated on this server.
 *
 * A closed connection (refresh, tab closed, network blip) no longer cancels a
 * generation: like ChatGPT/Claude, the answer finishes and is saved, so it is
 * there when the learner comes back. Stopping is an explicit request
 * (POST /api/chat/stop) that finds the generation here and aborts it.
 *
 * In-memory and per process: with several server instances, Stop reaches the
 * instance that owns the generation only (it then runs to completion elsewhere).
 */

export interface ActiveGeneration {
  requestId: string;
  /** owner: an authenticated user id, or null for a guest */
  userId: string | null;
  /** a guest's verified identity (guest token), when there is one */
  guestId?: string | null;
  /** canonical conversation id (known once resolved) */
  sessionId?: string;
  /** the client's conversation key, which a guest uses to prove ownership */
  sessionKey?: string;
  startedAt: number;
  stop: () => void;
}

const active = new Map<string, ActiveGeneration>();

export const generationRegistry = {
  register(gen: ActiveGeneration) {
    // A duplicate of a running request must not take over the original's entry
    if (active.has(gen.requestId)) return () => {};
    active.set(gen.requestId, gen);
    return () => {
      if (active.get(gen.requestId) === gen) active.delete(gen.requestId);
    };
  },

  setSessionId(requestId: string, sessionId: string) {
    const gen = active.get(requestId);
    if (gen) gen.sessionId = sessionId;
  },

  /**
   * Stop a generation the caller owns: the same signed-in user, or the same
   * verified guest. A guest without a guest identity must also name the
   * conversation (id or key), since such guests share `userId: null`.
   */
  stop(requestId: string, caller: { userId: string | null; guestId?: string | null; sessionId?: string }): 'stopped' | 'not_found' | 'forbidden' {
    const gen = active.get(requestId);
    if (!gen) return 'not_found';
    if ((gen.userId || null) !== (caller.userId || null)) return 'forbidden';
    if (!gen.userId) {
      if (gen.guestId) {
        if (caller.guestId !== gen.guestId) return 'forbidden';
      } else {
        const named = caller.sessionId;
        if (!named || (named !== gen.sessionId && named !== gen.sessionKey)) return 'forbidden';
      }
    }
    gen.stop();
    return 'stopped';
  },

  size() {
    return active.size;
  },
};
