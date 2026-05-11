import pgPool, { isVectorSearchReady, isPostgresReady } from '../../utils/core/postgres.js';
import { getEmbeddings } from '../../utils/ai/llmClient.js';
import crypto from 'crypto';

export interface MemoryEntry {
  ownerId: string;
  namespace: 'session' | 'project' | 'user' | 'global';
  referenceId?: string;
  content: string;
  metadata?: any;
}

class VectorStoreService {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    if (!process.env.POSTGRES_URL) {
      console.info('[VectorStore] POSTGRES_URL not set. AI Semantic Memory is disabled.');
    }
  }

  /**
   * Generates embedding for text using the LLM client.
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      if (!text) return null;
      // We assume the default embedding model (text-embedding-3-small) is used which has 1536 dims
      return await getEmbeddings(text);
    } catch (err: any) {
      console.error('[VectorStore] Embedding generation failed:', err.message);
      return null;
    }
  }

  /**
   * Generates a unique hash for content to avoid duplicate embeddings.
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Adds a new memory entry to the vector store.
   * Professional implementation with deduplication and transactional safety.
   */
  async addMemory(entry: MemoryEntry): Promise<boolean> {
    return new Promise((resolve) => {
      this.writeQueue = this.writeQueue.then(async () => {
        if (!isVectorSearchReady()) {
          console.warn('[VectorStore] Cannot add memory: Vector search is not ready.');
          resolve(false);
          return;
        }

        const { ownerId, namespace, referenceId, content, metadata = {} } = entry;
        const contentHash = this.generateHash(content);

        try {
          const embedding = await this.generateEmbedding(content);
          if (!embedding) {
            resolve(false);
            return;
          }

          const vectorStr = `[${embedding.join(',')}]`;
          
          await pgPool.query(
            `INSERT INTO ai_memory (owner_id, namespace, reference_id, content, metadata, content_hash, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (content_hash) DO UPDATE SET
               updated_at = CURRENT_TIMESTAMP,
               metadata = ai_memory.metadata || EXCLUDED.metadata`,
            [ownerId, namespace, referenceId || null, content, JSON.stringify(metadata), contentHash, vectorStr]
          );

          console.log(`[VectorStore] Persisted ${namespace} memory for ${ownerId}`);
          resolve(true);
        } catch (err: any) {
          console.error(`[VectorStore] Failed to add memory:`, err.message);
          resolve(false);
        }
      });
    });
  }

  /**
   * Searches for semantically similar memories.
   */
  async searchMemory(queryText: string, options: {
    ownerId: string;
    namespace?: string;
    limit?: number;
    minSimilarity?: number;
  }): Promise<any[]> {
    if (!isVectorSearchReady()) return [];

    const { ownerId, namespace, limit = 5, minSimilarity = 0.7 } = options;

    try {
      const queryEmbedding = await this.generateEmbedding(queryText);
      if (!queryEmbedding) return [];

      const vectorStr = `[${queryEmbedding.join(',')}]`;
      
      let sql = `
        SELECT 
          content, 
          metadata, 
          namespace, 
          reference_id as "referenceId",
          1 - (embedding <=> $1) as similarity
        FROM ai_memory
        WHERE owner_id = $2
      `;
      
      const params: any[] = [vectorStr, ownerId];
      
      if (namespace) {
        sql += ` AND namespace = $3`;
        params.push(namespace);
      }
      
      sql += ` AND 1 - (embedding <=> $1) >= $${params.length + 1}`;
      params.push(minSimilarity);
      
      sql += ` ORDER BY embedding <=> $1 LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await pgPool.query(sql, params);
      return result?.rows || [];
    } catch (err: any) {
      console.error('[VectorStore] Search failed:', err.message);
      return [];
    }
  }

  /**
   * Retrieves the most recent memories without semantic search.
   */
  async getLatestMemories(ownerId: string, namespace: string, limit = 10): Promise<any[]> {
    if (!isPostgresReady()) return [];

    try {
      const result = await pgPool.query(
        `SELECT content, metadata, namespace, reference_id as "referenceId", created_at as "createdAt"
         FROM ai_memory
         WHERE owner_id = $1 AND namespace = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [ownerId, namespace, limit]
      );
      return result?.rows || [];
    } catch (err: any) {
      console.error('[VectorStore] getLatestMemories failed:', err.message);
      return [];
    }
  }

  /**
   * Formats search results as a RAG context string.
   */
  async getRAGContext(queryText: string, options: {
    ownerId: string;
    namespace?: string;
    limit?: number;
    prefix?: string;
  }): Promise<string> {
    const memories = await this.searchMemory(queryText, options);
    if (memories.length === 0) return '';

    const context = memories
      .map(m => `[${m.namespace}] ${m.content}`)
      .join('\n\n');

    return `${options.prefix || 'RELEVANT PAST CONTEXT'}:\n${context}\n`;
  }

  /**
   * Legacy wrapper for compatibility with existing code.
   * @deprecated Use addMemory instead
   */
  async addSession(sessionId: string, summary: any, metadata: any = {}) {
    return this.addMemory({
      ownerId: metadata.userId || 'anonymous',
      namespace: 'session',
      referenceId: sessionId,
      content: typeof summary === 'string' ? summary : JSON.stringify(summary),
      metadata
    });
  }

  /**
   * Legacy wrapper for compatibility with existing code.
   * @deprecated Use getRAGContext instead
   */
  async getContextForTopic(topic: string, limit = 3, userId: string | null = null) {
    if (!userId) return '';
    return this.getRAGContext(topic, {
      ownerId: userId,
      namespace: 'session',
      limit,
      prefix: 'PAST RELEVANT SESSIONS'
    });
  }

  /**
   * Deletes memories by reference ID.
   */
  async deleteMemoryByReference(referenceId: string): Promise<void> {
    if (!isPostgresReady()) return;
    await pgPool.query('DELETE FROM ai_memory WHERE reference_id = $1', [referenceId]);
  }

  /**
   * Deletes all memories for an owner.
   */
  async clearOwnerMemory(ownerId: string): Promise<void> {
    if (!isPostgresReady()) return;
    await pgPool.query('DELETE FROM ai_memory WHERE owner_id = $1', [ownerId]);
  }
}

export default new VectorStoreService();
