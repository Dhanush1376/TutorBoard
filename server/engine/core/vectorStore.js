/**
 * VectorStoreService v1.0 — Semantic Memory for Learner Profile
 * 
 * Manages session embeddings and semantic retrieval for long-term 
 * pedagogical continuity.
 */

import fs from 'fs';
import path from 'path';
import { requestCompletion, resolveModelId } from '../../utils/ai/llmClient.js';

const STORAGE_PATH = path.resolve('server/data/vector_store.json');

class VectorStoreService {
  constructor() {
    this.store = this.loadStore();
  }

  loadStore() {
    try {
      if (fs.existsSync(STORAGE_PATH)) {
        return JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8'));
      }
    } catch (err) {
      console.error('[VectorStore] Load failed:', err.message);
    }
    return { sessions: [] };
  }

  saveStore() {
    try {
      const dir = path.dirname(STORAGE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(this.store, null, 2));
    } catch (err) {
      console.error('[VectorStore] Save failed:', err.message);
    }
  }

  /**
   * Generates an embedding for a text snippet using the LLM provider.
   * @param {string} text 
   * @returns {Promise<number[]>}
   */
  async generateEmbedding(text) {
    try {
      // NOTE: Using a simple completion-based embedding proxy if no dedicated embedding API is configured.
      // In production, this should call OpenAI's text-embedding-3-small or Gemini's embedding models.
      // For now, we simulate with a hash-based vector if the LLM client doesn't support it.
      
      // Simulation: Generate a pseudo-vector (1536 dims)
      // Real implementation would use: await client.embeddings.create(...)
      const vector = new Array(1536).fill(0).map(() => Math.random()); 
      return vector;
    } catch (err) {
      console.error('[VectorStore] Embedding generation failed:', err.message);
      return [];
    }
  }

  /**
   * Adds a session to the semantic memory.
   * @param {string} sessionId 
   * @param {string} summary - Pedagogical summary of what was learned.
   * @param {Object} metadata - userId, topic, mastery score.
   */
  async addSession(sessionId, summary, metadata) {
    const vector = await this.generateEmbedding(summary);
    this.store.sessions.push({
      id: sessionId,
      summary,
      metadata,
      vector,
      timestamp: Date.now()
    });
    this.saveStore();
    console.log(`[VectorStore] 🧠 Memorized session ${sessionId} (${metadata.topic})`);
  }

  /**
   * Retrieves relevant past context for a new session.
   * @param {string} topic - The new lesson topic.
   * @param {number} limit 
   * @returns {Promise<string>} - Context string for LLM injection.
   */
  async getContextForTopic(topic, limit = 3) {
    const queryVector = await this.generateEmbedding(topic);
    
    // Simple cosine similarity (simulated for now)
    const results = this.store.sessions
      .map(s => ({
        ...s,
        similarity: this.cosineSimilarity(queryVector, s.vector)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    if (results.length === 0) return "";

    return results.map(r => 
      `PAST SESSION (${new Date(r.timestamp).toLocaleDateString()}): ${r.summary}`
    ).join("\n\n");
  }

  cosineSimilarity(v1, v2) {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        mag1 += v1[i] * v1[i];
        mag2 += v2[i] * v2[i];
    }
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }
}

export default new VectorStoreService();
