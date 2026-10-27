/**
 * generationRegistry.ts — answers currently being generated, and how to stop them.
 *
 * A closed connection (refresh, tab closed, network blip) does not cancel a
 * generation: like ChatGPT/Claude, the answer finishes and is saved, so it is
 * there when the learner comes back. Stopping is an explicit request
 * (POST /api/chat/stop) that reaches the generation through this registry.
 *
 * The registry is an interface so the backing store can change without touching
 * callers. Today it is in-memory and per process (one server instance). For
 * several instances, provide a `CancellationRegistry` whose `requestStop` also
 * publishes the stop to the other instances (e.g. a cancel flag on the request
 * ledger that each instance checks, or a pub/sub channel) and whose owning
 * instance calls the registered `stop()` when it sees it — then install it with
 * `setCancellationRegistry()` at startup. No extra infrastructure is needed for
 * the single-instance deployment.
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
  /** aborts the model call; ChatService then saves any partial text as `cancelled` */
  stop: () => void;
}

export interface StopCaller {
  userId: string | null;
  guestId?: string | null;
  sessionId?: string;
}

/** stopped: aborted here · not_found: not running (finished, or unknown) · forbidden: not the owner */
export type StopResult = 'stopped' | 'not_found' | 'forbidden';

export interface CancellationRegistry {
  /** Track a running generation; the returned function releases it when it ends. */
  register(gen: ActiveGeneration): () => void;
  /** Record the canonical conversation id once it is resolved. */
  setSessionId(requestId: string, sessionId: string): void;
  /** Ask the owner's generation to stop. Async so a shared backend can reach other instances. */
  requestStop(requestId: string, caller: StopCaller): Promise<StopResult>;
  /** Number of generations running here (diagnostics, tests). */
  size(): number;
}

/** Owner check shared by every implementation. */
export function canStop(gen: ActiveGeneration, caller: StopCaller): boolean {
  if ((gen.userId || null) !== (caller.userId || null)) return false;
  if (gen.userId) return true;
  // guests share userId null: a verified guest identity must match, otherwise
  // the caller must name the conversation (server id or client key)
  if (gen.guestId) return caller.guestId === gen.guestId;
  const named = caller.sessionId;
  return !!named && (named === gen.sessionId || named === gen.sessionKey);
}

/** Single-instance implementation (the default). */
export class InMemoryCancellationRegistry implements CancellationRegistry {
  private active = new Map<string, ActiveGeneration>();

  register(gen: ActiveGeneration) {
    // A duplicate of a running request must not take over the original's entry
    if (this.active.has(gen.requestId)) return () => {};
    this.active.set(gen.requestId, gen);
    return () => {
      if (this.active.get(gen.requestId) === gen) this.active.delete(gen.requestId);
    };
  }

  setSessionId(requestId: string, sessionId: string) {
    const gen = this.active.get(requestId);
    if (gen) gen.sessionId = sessionId;
  }

  async requestStop(requestId: string, caller: StopCaller): Promise<StopResult> {
    const gen = this.active.get(requestId);
    if (!gen) return 'not_found';
    if (!canStop(gen, caller)) return 'forbidden';
    gen.stop();
    return 'stopped';
  }

  size() {
    return this.active.size;
  }
}

let registry: CancellationRegistry = new InMemoryCancellationRegistry();

/** Install a different backend (e.g. a shared one for multi-instance deployments). */
export function setCancellationRegistry(next: CancellationRegistry) {
  registry = next;
}

/** The active registry. Callers always go through this, never a cached instance. */
export const generationRegistry: CancellationRegistry = {
  register: (gen) => registry.register(gen),
  setSessionId: (requestId, sessionId) => registry.setSessionId(requestId, sessionId),
  requestStop: (requestId, caller) => registry.requestStop(requestId, caller),
  size: () => registry.size(),
};
