/**
 * VectorStoreService v3.0 — STUBBED for Production Readiness
 * 
 * BUG-NEW-03 & BUG-NEW-04 Fix: 
 * This service is temporarily stubbed to prevent non-deterministic context 
 * injection and ephemeral filesystem issues. Real semantic retrieval will 
 * be re-introduced in Phase 5 via pgvector.
 */

class VectorStoreService {
  /**
   * Stubs the embedding generation to return a neutral empty vector.
   */
  async generateEmbedding(text) {
    return [];
  }

  /**
   * Stubs session addition to be a no-op.
   */
  async addSession(sessionId, summary, metadata) {
    // SEC-NEW-03 FIX: Sanitize sessionId to prevent path traversal
    const safeSessionId = String(sessionId || '').replace(/\.\.\//g, '').replace(/[^\w-]/g, '_');
    
    // No-op until Phase 5
    console.log(`[VectorStore:Stub] Skipping memory for session ${safeSessionId}`);
  }

  /**
   * Stubs retrieval to always return an empty context.
   */
  async getContextForTopic(topic, limit = 3, userId = null) {
    return "";
  }

  /**
   * Stubs similarity calculation.
   */
  cosineSimilarity(v1, v2) {
    return 0;
  }
}

export default new VectorStoreService();
