import pool, { isPostgresReady } from '../../utils/core/postgres.js';
import { getEmbeddings } from '../../utils/ai/llmClient.js';

class VectorStoreService {
  constructor() {
    this.writeQueue = Promise.resolve();
    if (!process.env.POSTGRES_URL) {
      console.warn("[VectorStore] ⚠️ POSTGRES_URL not set — RAG/memory disabled for all sessions.");
    }
  }
  /**
   * Generates embedding for text using the LLM client.
   */
  async generateEmbedding(text) {
    try {
      if (!text) return null;
      return await getEmbeddings(text);
    } catch (err) {
      console.error('[VectorStore] Embedding generation failed:', err.message);
      return null;
    }
  }

  /**
   * Stores a session summary with its embedding in Postgres.
   */
  async addSession(sessionId, summary, metadata = {}) {
    // BUG-LOCK-09: Serialize writes to prevent potential race conditions or connection spikes
    return this.writeQueue = this.writeQueue.then(async () => {
      const safeSessionId = String(sessionId || '').replace(/\.\.\//g, '').replace(/[^\w-]/g, '_');
      const userId = metadata.userId || 'anonymous';
      const topic = metadata.topic || 'General';
      const summaryText = typeof summary === 'string' ? summary : JSON.stringify(summary);

      try {
        const embedding = await this.generateEmbedding(summaryText);
        if (!embedding) {
          console.warn(`[VectorStore] Skipping storage for session ${safeSessionId} (no embedding)`);
          return;
        }

        if (!isPostgresReady()) return;

        const client = await pool.connect();
        try {
          // Convert embedding array to string format for pgvector '[0.1, 0.2, ...]'
          const vectorStr = `[${embedding.join(',')}]`;
          
          await client.query(
            'INSERT INTO session_memory (user_id, session_id, topic, summary, embedding) VALUES ($1, $2, $3, $4, $5)',
            [userId, safeSessionId, topic, summaryText, vectorStr]
          );
          
          console.log(`[VectorStore] 🧠 Persisted memory for session: ${safeSessionId} (${topic})`);
        } finally {
          client.release();
        }
      } catch (err) {
        console.error(`[VectorStore] Failed to add session ${safeSessionId}:`, err.message);
      }
    });
  }

  /**
   * Retrieves semantically similar past sessions.
   */
  async getContextForTopic(topic, limit = 3, userId = null) {
    if (!userId || !topic) return "";

    try {
      const queryEmbedding = await this.generateEmbedding(topic);
      if (!queryEmbedding) return "";

      if (!isPostgresReady()) {
        console.warn('[VectorStore] Skipping retrieval — Postgres not ready');
        return "";
      }

      const client = await pool.connect();
      try {
        const vectorStr = `[${queryEmbedding.join(',')}]`;
        
        // Semantic search using cosine distance (<=>)
        const result = await client.query(
          `SELECT topic, summary, 1 - (embedding <=> $1) as similarity 
           FROM session_memory 
           WHERE user_id = $2 
           ORDER BY embedding <=> $1 
           LIMIT $3`,
          [vectorStr, userId, limit]
        );

        if (result.rows.length === 0) return "";

        const context = result.rows
          .map(row => `Session on "${row.topic}": ${row.summary}`)
          .join('\n\n');

        console.log(`[VectorStore] 🔍 Retrieved ${result.rows.length} similar sessions for topic: ${topic}`);
        return `PAST RELEVANT SESSIONS:\n${context}\n`;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[VectorStore] Retrieval failed:', err.message);
      return "";
    }
  }

  /**
   * Utility for cosine similarity (not directly used by pgvector but good for debug)
   */
  cosineSimilarity(v1, v2) {
    if (!v1 || !v2 || v1.length !== v2.length) return 0;
    let dot = 0, m1 = 0, m2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
      m1 += v1[i] * v1[i];
      m2 += v2[i] * v2[i];
    }
    return dot / (Math.sqrt(m1) * Math.sqrt(m2));
  }
}

export default new VectorStoreService();
